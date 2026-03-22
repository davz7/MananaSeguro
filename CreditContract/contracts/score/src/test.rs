#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token, Address, Env,
};

// Helper para crear token USDC de prueba
fn crear_usdc(env: &Env, admin: &Address) -> Address {
    let token_id = env.register_stellar_asset_contract_v2(admin.clone());
    token_id.address()
}

fn setup() -> (Env, MananaSeguroContractClient<'static>, Address, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let usuario = Address::generate(&env);
    let usdc_addr = crear_usdc(&env, &admin);

    // Mintear USDC al usuario para pruebas
    let usdc_admin = token::StellarAssetClient::new(&env, &usdc_addr);
    usdc_admin.mint(&usuario, &1_000_000_000); // 100 USDC

    let contrato_id = env.register(MananaSeguroContract, ());
    let cliente = MananaSeguroContractClient::new(&env, &contrato_id);

    cliente.inicializar(&admin, &usdc_addr);

    (env, cliente, admin, usuario, usdc_addr)
}

#[test]
fn test_depositar_basico() {
    let (env, cliente, _admin, usuario, _usdc) = setup();

    // Depositar $10 USDC (10 * 10_000_000 = 100_000_000 stroops)
    let monto = 100_000_000i128;
    cliente.depositar(&usuario, &monto, &20);

    let balance = cliente.ver_balance(&usuario);
    assert_eq!(balance, monto);
    assert_eq!(cliente.ver_depositos(&usuario), 1);
}

#[test]
fn test_depositar_minimo() {
    let (env, cliente, _admin, usuario, _usdc) = setup();

    // Mínimo $2 USDC = 20_000_000 stroops
    let monto = 20_000_000i128;
    cliente.depositar(&usuario, &monto, &20);
    assert_eq!(cliente.ver_balance(&usuario), monto);
}

#[test]
#[should_panic(expected = "Mínimo $2 USDC")]
fn test_depositar_bajo_minimo() {
    let (env, cliente, _admin, usuario, _usdc) = setup();
    // $1 USDC = 10_000_000 stroops — debe fallar
    cliente.depositar(&usuario, &10_000_000, &20);
}

#[test]
fn test_multiples_depositos() {
    let (env, cliente, _admin, usuario, _usdc) = setup();

    cliente.depositar(&usuario, &100_000_000, &20);
    cliente.depositar(&usuario, &50_000_000, &20);
    cliente.depositar(&usuario, &25_000_000, &20);

    assert_eq!(cliente.ver_balance(&usuario), 175_000_000);
    assert_eq!(cliente.ver_depositos(&usuario), 3);
}

#[test]
fn test_fecha_retiro_se_establece() {
    let (env, cliente, _admin, usuario, _usdc) = setup();

    cliente.depositar(&usuario, &100_000_000, &20);
    let fecha = cliente.ver_retiro(&usuario);
    assert!(fecha > 0);
    // 20 años en segundos = 20 * 365 * 24 * 3600 = 630_720_000
    let esperado = env.ledger().timestamp() + 630_720_000;
    assert_eq!(fecha, esperado);
}

#[test]
fn test_retirar_meta_alcanzada() {
    let (env, cliente, _admin, usuario, usdc) = setup();

    // Depositar suficiente para alcanzar la meta (meta = 10x primer depósito)
    // Meta = 100_000_000 * 10 = 1_000_000_000
    // Necesitamos depositar suficiente para alcanzarla
    let primer_deposito = 100_000_000i128;
    cliente.depositar(&usuario, &primer_deposito, &1);

    // Meta = 1_000_000_000 — depositar más para alcanzarla
    // Mintear más USDC para el usuario
    let usdc_admin = token::StellarAssetClient::new(&env, &usdc);
    usdc_admin.mint(&usuario, &2_000_000_000);

    for _ in 0..9 {
        cliente.depositar(&usuario, &primer_deposito, &1);
    }

    let balance = cliente.ver_balance(&usuario);
    let meta = cliente.ver_meta(&usuario);
    assert!(balance >= meta, "Debe haber alcanzado la meta");

    // Retirar
    cliente.retirar(&usuario);

    // El saldo del contrato debe ser 0
    assert_eq!(cliente.ver_balance(&usuario), 0);
}

#[test]
fn test_retirar_tiempo_cumplido() {
    let (env, cliente, _admin, usuario, _usdc) = setup();

    cliente.depositar(&usuario, &100_000_000, &1);

    // Avanzar el tiempo 1 año + 1 segundo
    env.ledger().with_mut(|l| {
        l.timestamp += 365 * 24 * 3600 + 1;
    });

    // Debe poder retirar porque el tiempo se cumplió
    cliente.retirar(&usuario);
    assert_eq!(cliente.ver_balance(&usuario), 0);
}

#[test]
#[should_panic(expected = "Aún no alcanzas la meta")]
fn test_retirar_sin_cumplir_condiciones() {
    let (env, cliente, _admin, usuario, _usdc) = setup();

    cliente.depositar(&usuario, &100_000_000, &20);
    // Intentar retirar sin alcanzar meta ni tiempo
    cliente.retirar(&usuario);
}

#[test]
fn test_autoprestamo_solicitar() {
    let (env, cliente, _admin, usuario, _usdc) = setup();

    cliente.depositar(&usuario, &100_000_000, &20);

    // Solicitar 30% = 30_000_000 stroops = $3 USDC
    cliente.solicitar_prestamo(&usuario, &30_000_000);

    let (saldo_prestamo, meses) = cliente.ver_prestamo(&usuario);
    assert_eq!(saldo_prestamo, 30_000_000);
    assert_eq!(meses, 0);
}

#[test]
#[should_panic(expected = "Excede el 30%")]
fn test_autoprestamo_excede_limite() {
    let (env, cliente, _admin, usuario, _usdc) = setup();

    cliente.depositar(&usuario, &100_000_000, &20);
    // Solicitar 40% — debe fallar
    cliente.solicitar_prestamo(&usuario, &40_000_000);
}

#[test]
fn test_autoprestamo_pagar() {
    let (env, cliente, _admin, usuario, usdc) = setup();

    cliente.depositar(&usuario, &100_000_000, &20);
    cliente.solicitar_prestamo(&usuario, &30_000_000);

    // Mintear USDC adicional para pagar cuotas
    let usdc_admin = token::StellarAssetClient::new(&env, &usdc);
    usdc_admin.mint(&usuario, &100_000_000);

    // Pagar primera cuota
    cliente.pagar_prestamo(&usuario);

    let (saldo_prestamo, meses) = cliente.ver_prestamo(&usuario);
    assert_eq!(meses, 1);
    assert!(saldo_prestamo < 30_000_000);
}

#[test]
#[should_panic(expected = "Liquida tu autopréstamo")]
fn test_no_retirar_con_prestamo_activo() {
    let (env, cliente, _admin, usuario, usdc) = setup();

    cliente.depositar(&usuario, &100_000_000, &1);

    // Solicitar préstamo
    cliente.solicitar_prestamo(&usuario, &30_000_000);

    // Avanzar tiempo para cumplir bloqueo
    env.ledger().with_mut(|l| {
        l.timestamp += 365 * 24 * 3600 + 1;
    });

    // Intentar retirar con préstamo activo — debe fallar
    cliente.retirar(&usuario);
}
