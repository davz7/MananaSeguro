#![no_std]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, token, Address, Env,
};

// ─── Error Enum ───────────────────────────────────────────────────────────────

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    /// Monto de depósito menor al mínimo permitido (2 USDC).
    MontoBajoMinimo = 1,
    /// Período de bloqueo de años inválido (debe estar entre 1 y 40 años).
    AniosBloqueoInvalidos = 2,
    /// El usuario no posee saldo bloqueado en el contrato.
    SinSaldo = 3,
    /// No se ha alcanzado la meta de ahorro ni el tiempo de bloqueo.
    CondicionesRetiroNoCumplidas = 4,
    /// Existe un autopréstamo pendiente que impide el retiro.
    PrestamoPendiente = 5,
    /// El usuario ya cuenta con un autopréstamo activo.
    PrestamoActivo = 6,
    /// El monto solicitado excede el 30% del saldo bloqueado.
    ExcedeLimitePrestamo = 7,
    /// Monto de préstamo menor al mínimo permitido (1 USDC).
    MontoPrestamoBajoMinimo = 8,
    /// El usuario no tiene un autopréstamo activo para pagar.
    NoTienePrestamoActivo = 9,
    /// El autopréstamo ya ha completado las 24 cuotas / se encuentra liquidado.
    PrestamoYaLiquidado = 10,
    /// La meta ingresada no es válida (debe ser mayor a 0).
    MetaInvalida = 11,
}

// Storage Keys

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

// Constantes del modelo de negocio

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

#[contractevent]
pub struct Deposito {
    #[topic]
    usuario: Address,
    monto: i128,
}

#[contractevent]
pub struct Retiro {
    #[topic]
    usuario: Address,
    monto: i128,
}

#[contractevent]
pub struct Prestamo {
    #[topic]
    usuario: Address,
    monto: i128,
}

#[contractevent]
pub struct PagoPrestamo {
    #[topic]
    usuario: Address,
    monto: i128,
}

// Contrato

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
    /// # Errors
    /// Retorna `Error::MontoBajoMinimo` si el monto es menor a `MIN_DEPOSIT`, o
    /// `Error::AniosBloqueoInvalidos` si `anios_bloqueo` está fuera del rango (1..=40).
    pub fn depositar(
        env: Env,
        usuario: Address,
        monto: i128,
        anios_bloqueo: u32,
    ) -> Result<(), Error> {
        usuario.require_auth();

        if monto < MIN_DEPOSIT {
            return Err(Error::MontoBajoMinimo);
        }
        if !(1..=40).contains(&anios_bloqueo) {
            return Err(Error::AniosBloqueoInvalidos);
        }

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
        Deposito {
            usuario: usuario.clone(),
            monto,
        }
        .publish(&env);

        Ok(())
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
    /// # Errors
    /// Retorna `Error::SinSaldo` si el usuario no tiene saldo,
    /// `Error::CondicionesRetiroNoCumplidas` si no cumple las condiciones de retiro, o
    /// `Error::PrestamoPendiente` si tiene un préstamo activo sin liquidar.
    pub fn retirar(env: Env, usuario: Address) -> Result<(), Error> {
        usuario.require_auth();

        let saldo: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::Balance(usuario.clone()))
            .unwrap_or(0);

        if saldo <= 0 {
            return Err(Error::SinSaldo);
        }

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

        if !meta_alcanzada && !tiempo_cumplido {
            return Err(Error::CondicionesRetiroNoCumplidas);
        }

        // Verificar que no hay préstamo pendiente
        let prestamo: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::Prestamo(usuario.clone()))
            .unwrap_or(0);
        if prestamo != 0 {
            return Err(Error::PrestamoPendiente);
        }

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
        Retiro {
            usuario: usuario.clone(),
            monto: monto_usuario,
        }
        .publish(&env);

        Ok(())
    }

    /// Solicita un autopréstamo de emergencia sobre el saldo bloqueado.
    /// Máximo 30% del saldo, interés 0.5% mensual, plazo hasta 24 meses.
    ///
    /// # Arguments
    /// * `monto` - Cantidad a solicitar en stroops (mínimo 1 USDC).
    ///
    /// # Errors
    /// Retorna `Error::SinSaldo` si el usuario no tiene saldo,
    /// `Error::PrestamoActivo` si ya tiene un préstamo activo,
    /// `Error::ExcedeLimitePrestamo` si excede el 30% del saldo, o
    /// `Error::MontoPrestamoBajoMinimo` si el monto es menor a 1 USDC.
    pub fn solicitar_prestamo(env: Env, usuario: Address, monto: i128) -> Result<(), Error> {
        usuario.require_auth();

        let saldo: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::Balance(usuario.clone()))
            .unwrap_or(0);

        if saldo <= 0 {
            return Err(Error::SinSaldo);
        }

        // Verificar que no hay préstamo activo
        let prestamo_activo: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::Prestamo(usuario.clone()))
            .unwrap_or(0);
        if prestamo_activo != 0 {
            return Err(Error::PrestamoActivo);
        }

        // Máximo 30% del saldo
        let max_prestamo = saldo * PRESTAMO_MAX_PCT / 100;
        if monto > max_prestamo {
            return Err(Error::ExcedeLimitePrestamo);
        }
        if monto < STROOP {
            return Err(Error::MontoPrestamoBajoMinimo);
        }

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
        Prestamo {
            usuario: usuario.clone(),
            monto,
        }
        .publish(&env);

        Ok(())
    }

    /// Paga la cuota mensual del autopréstamo activo.
    /// El pago incluye capital (saldo / meses restantes) + interés mensual.
    /// El interés se transfiere al administrador.
    ///
    /// # Errors
    /// Retorna `Error::NoTienePrestamoActivo` si el usuario no tiene un autopréstamo activo, o
    /// `Error::PrestamoYaLiquidado` si ya está liquidado.
    pub fn pagar_prestamo(env: Env, usuario: Address) -> Result<(), Error> {
        usuario.require_auth();

        let saldo_prestamo: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::Prestamo(usuario.clone()))
            .unwrap_or(0);

        if saldo_prestamo <= 0 {
            return Err(Error::NoTienePrestamoActivo);
        }

        let meses: u32 = env
            .storage()
            .persistent()
            .get(&DataKey::PrestamoMeses(usuario.clone()))
            .unwrap_or(0);

        if meses >= PRESTAMO_MAX_MESES {
            return Err(Error::PrestamoYaLiquidado);
        }

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

        PagoPrestamo {
            usuario: usuario.clone(),
            monto: pago_total,
        }
        .publish(&env);

        Ok(())
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
    /// # Errors
    /// Retorna `Error::MetaInvalida` si `nueva_meta` es 0 o negativo.
    pub fn actualizar_meta(env: Env, usuario: Address, nueva_meta: i128) -> Result<(), Error> {
        usuario.require_auth();
        if nueva_meta <= 0 {
            return Err(Error::MetaInvalida);
        }
        env.storage()
            .persistent()
            .set(&DataKey::Meta(usuario), &nueva_meta);

        Ok(())
    }
}

mod test;
