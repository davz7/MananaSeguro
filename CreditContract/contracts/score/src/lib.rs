#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, token, Address, Env, Symbol};

// ─── Storage Keys ─────────────────────────────────────────────────────────────

#[contracttype]
pub enum DataKey {
    /// Saldo bloqueado por usuario.
    Balance(Address),
    /// Número de depósitos realizados.
    DepositCount(Address),
    /// Timestamp Unix de la fecha de retiro permitida.
    RetiroFecha(Address),
    /// Meta de ahorro en stroops (1 USDC = 10_000_000).
    Meta(Address),
    /// Saldo pendiente del autopréstamo.
    Prestamo(Address),
    /// Meses pagados del autopréstamo.
    PrestamoMeses(Address),
    /// Dirección del administrador del contrato.
    Admin,
    /// Dirección del token USDC.
    UsdcToken,
}

// ─── Constantes del modelo de negocio ─────────────────────────────────────────

/// Depósito mínimo: 2 USDC (en stroops, 7 decimales Stellar).
const MIN_DEPOSIT: i128 = 20_000_000;
/// Comisión de plataforma: 1% en basis points (10000 = 100%).
const PLATAFORMA_FEE: i128 = 100;
/// Porcentaje máximo del saldo para autopréstamo: 30%.
const PRESTAMO_MAX_PCT: i128 = 30;
/// Interés mensual del autopréstamo: 0.5% en basis points.
const PRESTAMO_FEE_MENSUAL: i128 = 50;
/// Plazo máximo del autopréstamo en meses.
const PRESTAMO_MAX_MESES: u32 = 24;
/// 1 USDC = 10_000_000 stroops.
const STROOP: i128 = 10_000_000;

// ─── Contrato ─────────────────────────────────────────────────────────────────

#[contract]
pub struct MananaSeguroContract;

#[contractimpl]
impl MananaSeguroContract {
    /// Inicializa el contrato con la dirección del administrador y del token USDC.
    pub fn inicializar(env: Env, admin: Address, usdc_token: Address) {
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::UsdcToken, &usdc_token);
    }

    /// Deposita USDC al contrato y bloquea los fondos hasta la fecha de retiro.
    /// En el primer depósito se fija la fecha de retiro y una meta por defecto (10x el monto).
    ///
    /// # Arguments
    /// * `usuario` - Dirección del depositante.
    /// * `monto` - Cantidad en stroops (mínimo 2 USDC).
    /// * `anios_bloqueo` - Años de bloqueo (1-40).
    ///
    /// # Panics
    /// Si el monto es menor a `MIN_DEPOSIT`, si `anios_bloqueo` está fuera del rango,
    /// o si el usuario no autoriza la transferencia.
    pub fn depositar(env: Env, usuario: Address, monto: i128, anios_bloqueo: u32) {
        usuario.require_auth();

        assert!(monto >= MIN_DEPOSIT, "Mínimo $2 USDC por depósito");
        assert!(
            anios_bloqueo >= 1 && anios_bloqueo <= 40,
            "Bloqueo entre 1 y 40 años"
        );

        // Transferir USDC del usuario al contrato
        let usdc: Address = env.storage().instance().get(&DataKey::UsdcToken).unwrap();
        let token_client = token::Client::new(&env, &usdc);
        token_client.transfer(&usuario, &env.current_contract_address(), &monto);

        // Actualizar saldo bloqueado
        let saldo_actual: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::Balance(usuario.clone()))
            .unwrap_or(0);
        env.storage()
            .persistent()
            .set(&DataKey::Balance(usuario.clone()), &(saldo_actual + monto));

        // Contador de depósitos
        let count: u32 = env
            .storage()
            .persistent()
            .get(&DataKey::DepositCount(usuario.clone()))
            .unwrap_or(0);
        env.storage()
            .persistent()
            .set(&DataKey::DepositCount(usuario.clone()), &(count + 1));

        // Fecha de retiro (solo se establece en el primer depósito)
        if count == 0 {
            let segundos_bloqueo = (anios_bloqueo as u64) * 365 * 24 * 3600;
            let fecha_retiro = env.ledger().timestamp() + segundos_bloqueo;
            env.storage()
                .persistent()
                .set(&DataKey::RetiroFecha(usuario.clone()), &fecha_retiro);

            // Meta por defecto: 10x el primer depósito
            let meta = monto * 10;
            env.storage()
                .persistent()
                .set(&DataKey::Meta(usuario.clone()), &meta);
        }

        // Emitir evento
        env.events()
            .publish((Symbol::new(&env, "deposito"), usuario.clone()), monto);
    }

    /// Retorna el saldo bloqueado del usuario en stroops.
    pub fn ver_balance(env: Env, usuario: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::Balance(usuario))
            .unwrap_or(0)
    }

    /// Retorna el timestamp Unix de la fecha de retiro permitida para el usuario.
    pub fn ver_retiro(env: Env, usuario: Address) -> u64 {
        env.storage()
            .persistent()
            .get(&DataKey::RetiroFecha(usuario))
            .unwrap_or(0)
    }

    /// Retorna la meta de ahorro del usuario en stroops.
    pub fn ver_meta(env: Env, usuario: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::Meta(usuario))
            .unwrap_or(0)
    }

    /// Retorna la cantidad de depósitos realizados por el usuario.
    pub fn ver_depositos(env: Env, usuario: Address) -> u32 {
        env.storage()
            .persistent()
            .get(&DataKey::DepositCount(usuario))
            .unwrap_or(0)
    }

    /// Retira el saldo bloqueado del usuario.
    /// Requiere que se cumpla al menos una de estas condiciones:
    /// 1. El timestamp actual superó la fecha de retiro, o
    /// 2. El saldo alcanzó o superó la meta.
    /// No debe haber un autopréstamo activo. Se cobra una comisión de plataforma (1%).
    ///
    /// # Panics
    /// Si el usuario no tiene saldo, si no cumple las condiciones de retiro,
    /// o si tiene un préstamo activo sin liquidar.
    pub fn retirar(env: Env, usuario: Address) {
        usuario.require_auth();

        let saldo: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::Balance(usuario.clone()))
            .unwrap_or(0);

        assert!(saldo > 0, "No tienes saldo bloqueado");

        let fecha_retiro: u64 = env
            .storage()
            .persistent()
            .get(&DataKey::RetiroFecha(usuario.clone()))
            .unwrap_or(u64::MAX);

        let meta: i128 = env
            .storage()
            .persistent()
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
        let prestamo: i128 = env
            .storage()
            .persistent()
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
        env.storage()
            .persistent()
            .remove(&DataKey::Balance(usuario.clone()));
        env.storage()
            .persistent()
            .remove(&DataKey::RetiroFecha(usuario.clone()));
        env.storage()
            .persistent()
            .remove(&DataKey::Meta(usuario.clone()));
        env.storage()
            .persistent()
            .remove(&DataKey::DepositCount(usuario.clone()));

        // Emitir evento
        env.events().publish(
            (Symbol::new(&env, "retiro"), usuario.clone()),
            monto_usuario,
        );
    }

    /// Solicita un autopréstamo de emergencia sobre el saldo bloqueado.
    /// Máximo 30% del saldo, interés 0.5% mensual, plazo hasta 24 meses.
    ///
    /// # Arguments
    /// * `monto` - Cantidad a solicitar en stroops (mínimo 1 USDC).
    ///
    /// # Panics
    /// Si el usuario no tiene saldo, si ya tiene un préstamo activo,
    /// si excede el 30% del saldo, o si el monto es menor a 1 USDC.
    pub fn solicitar_prestamo(env: Env, usuario: Address, monto: i128) {
        usuario.require_auth();

        let saldo: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::Balance(usuario.clone()))
            .unwrap_or(0);

        assert!(saldo > 0, "No tienes saldo bloqueado");

        // Verificar que no hay préstamo activo
        let prestamo_activo: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::Prestamo(usuario.clone()))
            .unwrap_or(0);
        assert!(prestamo_activo == 0, "Ya tienes un autopréstamo activo");

        // Máximo 30% del saldo
        let max_prestamo = saldo * PRESTAMO_MAX_PCT / 100;
        assert!(monto <= max_prestamo, "Excede el 30% de tu saldo bloqueado");
        assert!(monto >= STROOP, "Mínimo 1 USDC de préstamo");

        // Guardar saldo del préstamo
        env.storage()
            .persistent()
            .set(&DataKey::Prestamo(usuario.clone()), &monto);
        env.storage()
            .persistent()
            .set(&DataKey::PrestamoMeses(usuario.clone()), &0u32);

        // Transferir USDC al usuario
        let usdc: Address = env.storage().instance().get(&DataKey::UsdcToken).unwrap();
        let token_client = token::Client::new(&env, &usdc);
        token_client.transfer(&env.current_contract_address(), &usuario, &monto);

        // Emitir evento
        env.events()
            .publish((Symbol::new(&env, "prestamo"), usuario.clone()), monto);
    }

    /// Paga la cuota mensual del autopréstamo activo.
    /// El pago incluye capital (saldo / meses restantes) + interés mensual.
    /// El interés se transfiere al administrador.
    ///
    /// # Panics
    /// Si el usuario no tiene un autopréstamo activo, o si ya está liquidado.
    pub fn pagar_prestamo(env: Env, usuario: Address) {
        usuario.require_auth();

        let saldo_prestamo: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::Prestamo(usuario.clone()))
            .unwrap_or(0);

        assert!(saldo_prestamo > 0, "No tienes autopréstamo activo");

        let meses: u32 = env
            .storage()
            .persistent()
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
            env.storage()
                .persistent()
                .remove(&DataKey::Prestamo(usuario.clone()));
            env.storage()
                .persistent()
                .remove(&DataKey::PrestamoMeses(usuario.clone()));
        } else {
            env.storage()
                .persistent()
                .set(&DataKey::Prestamo(usuario.clone()), &nuevo_saldo);
            env.storage()
                .persistent()
                .set(&DataKey::PrestamoMeses(usuario.clone()), &nuevos_meses);
        }

        env.events().publish(
            (Symbol::new(&env, "pago_prestamo"), usuario.clone()),
            pago_total,
        );
    }

    /// Retorna el saldo pendiente del autopréstamo y los meses pagados.
    pub fn ver_prestamo(env: Env, usuario: Address) -> (i128, u32) {
        let saldo: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::Prestamo(usuario.clone()))
            .unwrap_or(0);
        let meses: u32 = env
            .storage()
            .persistent()
            .get(&DataKey::PrestamoMeses(usuario.clone()))
            .unwrap_or(0);
        (saldo, meses)
    }

    /// Actualiza la meta de ahorro del usuario.
    ///
    /// # Arguments
    /// * `nueva_meta` - Nueva meta en stroops (debe ser mayor a 0).
    ///
    /// # Panics
    /// Si `nueva_meta` es 0 o negativo.
    pub fn actualizar_meta(env: Env, usuario: Address, nueva_meta: i128) {
        usuario.require_auth();
        assert!(nueva_meta > 0, "La meta debe ser mayor a 0");
        env.storage()
            .persistent()
            .set(&DataKey::Meta(usuario), &nueva_meta);
    }
}

mod test;
