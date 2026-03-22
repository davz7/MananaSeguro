#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype,
    token, Address, Env, Symbol,
};

// ─── Storage Keys ─────────────────────────────────────────────────────────────

#[contracttype]
pub enum DataKey {
    Balance(Address),       // saldo bloqueado por usuario
    DepositCount(Address),  // número de depósitos
    RetiroFecha(Address),   // timestamp unix de fecha de retiro
    Meta(Address),          // meta en stroops (1 USDC = 10_000_000)
    Prestamo(Address),      // saldo pendiente del autopréstamo
    PrestamoMeses(Address), // meses pagados del autopréstamo
    Admin,                  // dirección del administrador
    UsdcToken,              // dirección del token USDC
}

// ─── Constantes del modelo de negocio ─────────────────────────────────────────

const MIN_DEPOSIT: i128 = 2_000_000;          // $2 USDC (7 decimales Stellar)
const PLATAFORMA_FEE: i128 = 100;             // 1% en basis points (10000 = 100%)
const PRESTAMO_MAX_PCT: i128 = 30;            // 30% del saldo
const PRESTAMO_FEE_MENSUAL: i128 = 50;        // 0.5% mensual en basis points
const PRESTAMO_MAX_MESES: u32 = 24;
const STROOP: i128 = 10_000_000;              // 1 USDC = 10_000_000 stroops

// ─── Contrato ─────────────────────────────────────────────────────────────────

#[contract]
pub struct MananaSeguroContract;

#[contractimpl]
impl MananaSeguroContract {

    // ── Inicializar contrato ──────────────────────────────────────────────────
    pub fn inicializar(env: Env, admin: Address, usdc_token: Address) {
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::UsdcToken, &usdc_token);
    }

    // ── Depositar USDC y bloquear ─────────────────────────────────────────────
    // El usuario deposita USDC al contrato. Los fondos quedan bloqueados.
    pub fn depositar(env: Env, usuario: Address, monto: i128, anios_bloqueo: u32) {
        usuario.require_auth();

        assert!(monto >= MIN_DEPOSIT, "Mínimo $2 USDC por depósito");
        assert!(anios_bloqueo >= 1 && anios_bloqueo <= 40, "Bloqueo entre 1 y 40 años");

        // Transferir USDC del usuario al contrato
        let usdc: Address = env.storage().instance().get(&DataKey::UsdcToken).unwrap();
        let token_client = token::Client::new(&env, &usdc);
        token_client.transfer(&usuario, &env.current_contract_address(), &monto);

        // Actualizar saldo bloqueado
        let saldo_actual: i128 = env.storage().persistent()
            .get(&DataKey::Balance(usuario.clone()))
            .unwrap_or(0);
        env.storage().persistent()
            .set(&DataKey::Balance(usuario.clone()), &(saldo_actual + monto));

        // Contador de depósitos
        let count: u32 = env.storage().persistent()
            .get(&DataKey::DepositCount(usuario.clone()))
            .unwrap_or(0);
        env.storage().persistent()
            .set(&DataKey::DepositCount(usuario.clone()), &(count + 1));

        // Fecha de retiro (solo se establece en el primer depósito)
        if count == 0 {
            let segundos_bloqueo = (anios_bloqueo as u64) * 365 * 24 * 3600;
            let fecha_retiro = env.ledger().timestamp() + segundos_bloqueo;
            env.storage().persistent()
                .set(&DataKey::RetiroFecha(usuario.clone()), &fecha_retiro);

            // Meta por defecto: 10x el primer depósito
            let meta = monto * 10;
            env.storage().persistent()
                .set(&DataKey::Meta(usuario.clone()), &meta);
        }

        // Emitir evento
        env.events().publish(
            (Symbol::new(&env, "deposito"), usuario.clone()),
            monto,
        );
    }

    // ── Ver saldo bloqueado ───────────────────────────────────────────────────
    pub fn ver_balance(env: Env, usuario: Address) -> i128 {
        env.storage().persistent()
            .get(&DataKey::Balance(usuario))
            .unwrap_or(0)
    }

    // ── Ver fecha de retiro ───────────────────────────────────────────────────
    pub fn ver_retiro(env: Env, usuario: Address) -> u64 {
        env.storage().persistent()
            .get(&DataKey::RetiroFecha(usuario))
            .unwrap_or(0)
    }

    // ── Ver meta ──────────────────────────────────────────────────────────────
    pub fn ver_meta(env: Env, usuario: Address) -> i128 {
        env.storage().persistent()
            .get(&DataKey::Meta(usuario))
            .unwrap_or(0)
    }

    // ── Ver número de depósitos ───────────────────────────────────────────────
    pub fn ver_depositos(env: Env, usuario: Address) -> u32 {
        env.storage().persistent()
            .get(&DataKey::DepositCount(usuario))
            .unwrap_or(0)
    }

    // ── Retirar al llegar la meta ─────────────────────────────────────────────
    // Solo se puede retirar si:
    // 1. El timestamp actual >= fecha de retiro, O
    // 2. El saldo >= meta
    pub fn retirar(env: Env, usuario: Address) {
        usuario.require_auth();

        let saldo: i128 = env.storage().persistent()
            .get(&DataKey::Balance(usuario.clone()))
            .unwrap_or(0);

        assert!(saldo > 0, "No tienes saldo bloqueado");

        let fecha_retiro: u64 = env.storage().persistent()
            .get(&DataKey::RetiroFecha(usuario.clone()))
            .unwrap_or(u64::MAX);

        let meta: i128 = env.storage().persistent()
            .get(&DataKey::Meta(usuario.clone()))
            .unwrap_or(i128::MAX);

        let ahora = env.ledger().timestamp();
        let meta_alcanzada = saldo >= meta;
        let tiempo_cumplido = ahora >= fecha_retiro;

        assert!(
            meta_alcanzada || tiempo_cumplido,
            "Aún no alcanzas la meta ni el tiempo de bloqueo"
        );

        // Verificar que no hay préstamo pendiente
        let prestamo: i128 = env.storage().persistent()
            .get(&DataKey::Prestamo(usuario.clone()))
            .unwrap_or(0);
        assert!(prestamo == 0, "Liquida tu autopréstamo antes de retirar");

        // Calcular comisión de plataforma (1% del saldo)
        let comision = saldo * PLATAFORMA_FEE / 10_000;
        let monto_usuario = saldo - comision;

        // Transferir USDC al usuario
        let usdc: Address = env.storage().instance().get(&DataKey::UsdcToken).unwrap();
        let token_client = token::Client::new(&env, &usdc);
        token_client.transfer(&env.current_contract_address(), &usuario, &monto_usuario);

        // Transferir comisión al admin
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        token_client.transfer(&env.current_contract_address(), &admin, &comision);

        // Limpiar estado del usuario
        env.storage().persistent().remove(&DataKey::Balance(usuario.clone()));
        env.storage().persistent().remove(&DataKey::RetiroFecha(usuario.clone()));
        env.storage().persistent().remove(&DataKey::Meta(usuario.clone()));
        env.storage().persistent().remove(&DataKey::DepositCount(usuario.clone()));

        // Emitir evento
        env.events().publish(
            (Symbol::new(&env, "retiro"), usuario.clone()),
            monto_usuario,
        );
    }

    // ── Solicitar autopréstamo de emergencia ──────────────────────────────────
    // Máximo 30% del saldo bloqueado, 0.5% mensual, hasta 24 meses
    pub fn solicitar_prestamo(env: Env, usuario: Address, monto: i128) {
        usuario.require_auth();

        let saldo: i128 = env.storage().persistent()
            .get(&DataKey::Balance(usuario.clone()))
            .unwrap_or(0);

        assert!(saldo > 0, "No tienes saldo bloqueado");

        // Verificar que no hay préstamo activo
        let prestamo_activo: i128 = env.storage().persistent()
            .get(&DataKey::Prestamo(usuario.clone()))
            .unwrap_or(0);
        assert!(prestamo_activo == 0, "Ya tienes un autopréstamo activo");

        // Máximo 30% del saldo
        let max_prestamo = saldo * PRESTAMO_MAX_PCT / 100;
        assert!(monto <= max_prestamo, "Excede el 30% de tu saldo bloqueado");
        assert!(monto >= STROOP, "Mínimo 1 USDC de préstamo");

        // Guardar saldo del préstamo
        env.storage().persistent()
            .set(&DataKey::Prestamo(usuario.clone()), &monto);
        env.storage().persistent()
            .set(&DataKey::PrestamoMeses(usuario.clone()), &0u32);

        // Transferir USDC al usuario
        let usdc: Address = env.storage().instance().get(&DataKey::UsdcToken).unwrap();
        let token_client = token::Client::new(&env, &usdc);
        token_client.transfer(&env.current_contract_address(), &usuario, &monto);

        // Emitir evento
        env.events().publish(
            (Symbol::new(&env, "prestamo"), usuario.clone()),
            monto,
        );
    }

    // ── Pagar cuota mensual del autopréstamo ──────────────────────────────────
    pub fn pagar_prestamo(env: Env, usuario: Address) {
        usuario.require_auth();

        let saldo_prestamo: i128 = env.storage().persistent()
            .get(&DataKey::Prestamo(usuario.clone()))
            .unwrap_or(0);

        assert!(saldo_prestamo > 0, "No tienes autopréstamo activo");

        let meses: u32 = env.storage().persistent()
            .get(&DataKey::PrestamoMeses(usuario.clone()))
            .unwrap_or(0);

        assert!(meses < PRESTAMO_MAX_MESES, "Préstamo ya liquidado");

        // Calcular pago: capital / meses_restantes + interés mensual
        let meses_restantes = (PRESTAMO_MAX_MESES - meses) as i128;
        let capital_mes = saldo_prestamo / meses_restantes;
        let interes_mes = saldo_prestamo * PRESTAMO_FEE_MENSUAL / 10_000;
        let pago_total = capital_mes + interes_mes;

        // Transferir pago del usuario al contrato
        let usdc: Address = env.storage().instance().get(&DataKey::UsdcToken).unwrap();
        let token_client = token::Client::new(&env, &usdc);
        token_client.transfer(&usuario, &env.current_contract_address(), &pago_total);

        // Transferir interés al admin
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        token_client.transfer(&env.current_contract_address(), &admin, &interes_mes);

        // Actualizar saldo del préstamo
        let nuevo_saldo = saldo_prestamo - capital_mes;
        let nuevos_meses = meses + 1;

        if nuevo_saldo <= 0 || nuevos_meses >= PRESTAMO_MAX_MESES {
            // Préstamo liquidado
            env.storage().persistent().remove(&DataKey::Prestamo(usuario.clone()));
            env.storage().persistent().remove(&DataKey::PrestamoMeses(usuario.clone()));
        } else {
            env.storage().persistent()
                .set(&DataKey::Prestamo(usuario.clone()), &nuevo_saldo);
            env.storage().persistent()
                .set(&DataKey::PrestamoMeses(usuario.clone()), &nuevos_meses);
        }

        env.events().publish(
            (Symbol::new(&env, "pago_prestamo"), usuario.clone()),
            pago_total,
        );
    }

    // ── Ver estado del autopréstamo ───────────────────────────────────────────
    pub fn ver_prestamo(env: Env, usuario: Address) -> (i128, u32) {
        let saldo: i128 = env.storage().persistent()
            .get(&DataKey::Prestamo(usuario.clone()))
            .unwrap_or(0);
        let meses: u32 = env.storage().persistent()
            .get(&DataKey::PrestamoMeses(usuario.clone()))
            .unwrap_or(0);
        (saldo, meses)
    }

    // ── Actualizar meta de retiro ─────────────────────────────────────────────
    pub fn actualizar_meta(env: Env, usuario: Address, nueva_meta: i128) {
        usuario.require_auth();
        assert!(nueva_meta > 0, "La meta debe ser mayor a 0");
        env.storage().persistent()
            .set(&DataKey::Meta(usuario), &nueva_meta);
    }
}

mod test;
