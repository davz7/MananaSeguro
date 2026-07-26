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

fn setup() -> (
    Env,
    MananaSeguroContractClient<'static>,
    Address,
    Address,
    Address,
) {
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
    let (_env, cliente, _admin, usuario, _usdc) = setup();

    // Depositar $10 USDC (10 * 10_000_000 = 100_000_000 stroops)
    let monto = 100_000_000i128;
    cliente.depositar(&usuario, &monto, &20);

    let balance = cliente.ver_balance(&usuario);
    assert_eq!(balance, monto);
    assert_eq!(cliente.ver_depositos(&usuario), 1);
}

#[test]
fn test_depositar_minimo() {
    let (_env, cliente, _admin, usuario, _usdc) = setup();

    // Mínimo $2 USDC = 20_000_000 stroops
    let monto = 20_000_000i128;
    cliente.depositar(&usuario, &monto, &20);
    assert_eq!(cliente.ver_balance(&usuario), monto);
}

#[test]
fn test_depositar_bajo_minimo() {
    let (_env, cliente, _admin, usuario, _usdc) = setup();
    // $1 USDC = 10_000_000 stroops, debe fallar con MontoBajoMinimo
    let res = cliente.try_depositar(&usuario, &10_000_000, &20);
    assert_eq!(res, Err(Ok(Error::MontoBajoMinimo)));
}

#[test]
fn test_depositar_anios_bloqueo_invalidos() {
    let (_env, cliente, _admin, usuario, _usdc) = setup();
    // Bloqueo 0 años, debe fallar con AniosBloqueoInvalidos
    let res_cero = cliente.try_depositar(&usuario, &20_000_000, &0);
    assert_eq!(res_cero, Err(Ok(Error::AniosBloqueoInvalidos)));

    // Bloqueo 41 años, debe fallar con AniosBloqueoInvalidos
    let res_excede = cliente.try_depositar(&usuario, &20_000_000, &41);
    assert_eq!(res_excede, Err(Ok(Error::AniosBloqueoInvalidos)));
}

#[test]
fn test_multiples_depositos() {
    let (_env, cliente, _admin, usuario, _usdc) = setup();

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
    let primer_deposito = 100_000_000i128;
    cliente.depositar(&usuario, &primer_deposito, &1);

    // Meta = 1_000_000_000, depositar más para alcanzarla
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
fn test_retirar_sin_saldo() {
    let (_env, cliente, _admin, usuario, _usdc) = setup();
    // Intentar retirar sin depositar antes
    let res = cliente.try_retirar(&usuario);
    assert_eq!(res, Err(Ok(Error::SinSaldo)));
}

#[test]
fn test_retirar_sin_cumplir_condiciones() {
    let (_env, cliente, _admin, usuario, _usdc) = setup();

    cliente.depositar(&usuario, &100_000_000, &20);
    // Intentar retirar sin alcanzar meta ni tiempo
    let res = cliente.try_retirar(&usuario);
    assert_eq!(res, Err(Ok(Error::CondicionesRetiroNoCumplidas)));
}

#[test]
fn test_autoprestamo_solicitar() {
    let (_env, cliente, _admin, usuario, _usdc) = setup();

    cliente.depositar(&usuario, &100_000_000, &20);

    // Solicitar 30% = 30_000_000 stroops = $3 USDC
    cliente.solicitar_prestamo(&usuario, &30_000_000);

    let (saldo_prestamo, meses) = cliente.ver_prestamo(&usuario);
    assert_eq!(saldo_prestamo, 30_000_000);
    assert_eq!(meses, 0);
}

#[test]
fn test_autoprestamo_excede_limite() {
    let (_env, cliente, _admin, usuario, _usdc) = setup();

    cliente.depositar(&usuario, &100_000_000, &20);
    // Solicitar 40%, debe fallar con ExcedeLimitePrestamo
    let res = cliente.try_solicitar_prestamo(&usuario, &40_000_000);
    assert_eq!(res, Err(Ok(Error::ExcedeLimitePrestamo)));
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
fn test_no_retirar_con_prestamo_activo() {
    let (env, cliente, _admin, usuario, _usdc) = setup();

    cliente.depositar(&usuario, &100_000_000, &1);

    // Solicitar préstamo
    cliente.solicitar_prestamo(&usuario, &30_000_000);

    // Avanzar tiempo para cumplir bloqueo
    env.ledger().with_mut(|l| {
        l.timestamp += 365 * 24 * 3600 + 1;
    });

    // Intentar retirar con préstamo activo, debe fallar con PrestamoPendiente
    let res = cliente.try_retirar(&usuario);
    assert_eq!(res, Err(Ok(Error::PrestamoPendiente)));
}

#[test]
fn test_actualizar_meta_exito() {
    let (_env, cliente, _admin, usuario, _usdc) = setup();
    cliente.actualizar_meta(&usuario, &150_000_000);
    assert_eq!(cliente.ver_meta(&usuario), 150_000_000);
}

#[test]
fn test_actualizar_meta_cero_panica() {
    let (_env, cliente, _admin, usuario, _usdc) = setup();
    let res = cliente.try_actualizar_meta(&usuario, &0);
    assert_eq!(res, Err(Ok(Error::MetaInvalida)));
}

#[test]
fn test_autoprestamo_ciclo_completo() {
    let (_env, cliente, _admin, usuario, _usdc) = setup();

    cliente.depositar(&usuario, &100_000_000, &20);
    // Solicitar préstamo del 30% (30 USDC)
    cliente.solicitar_prestamo(&usuario, &30_000_000);

    // Pagar las 24 cuotas
    for i in 0..24 {
        let (saldo_prestamo, meses) = cliente.ver_prestamo(&usuario);
        assert!(saldo_prestamo > 0);
        assert_eq!(meses, i);
        cliente.pagar_prestamo(&usuario);
    }

    // Verificar que el préstamo ha sido liquidado y eliminado del storage
    let (saldo_prestamo, meses) = cliente.ver_prestamo(&usuario);
    assert_eq!(saldo_prestamo, 0);
    assert_eq!(meses, 0);
}

#[test]
fn test_autoprestamo_cronograma_coincide_con_frontend() {
    let (env, cliente, admin, usuario, usdc) = setup();
    let token_client = token::Client::new(&env, &usdc);
    let prestamo = 200_000_001i128;
    let esperado = [
        (8_333_333, 1_000_000, 9_333_333, 191_666_668),
        (8_333_333, 958_333, 9_291_666, 183_333_335),
        (8_333_333, 916_666, 9_249_999, 175_000_002),
        (8_333_333, 875_000, 9_208_333, 166_666_669),
        (8_333_333, 833_333, 9_166_666, 158_333_336),
        (8_333_333, 791_666, 9_124_999, 150_000_003),
        (8_333_333, 750_000, 9_083_333, 141_666_670),
        (8_333_333, 708_333, 9_041_666, 133_333_337),
        (8_333_333, 666_666, 8_999_999, 125_000_004),
        (8_333_333, 625_000, 8_958_333, 116_666_671),
        (8_333_333, 583_333, 8_916_666, 108_333_338),
        (8_333_333, 541_666, 8_874_999, 100_000_005),
        (8_333_333, 500_000, 8_833_333, 91_666_672),
        (8_333_333, 458_333, 8_791_666, 83_333_339),
        (8_333_333, 416_666, 8_749_999, 75_000_006),
        (8_333_334, 375_000, 8_708_334, 66_666_672),
        (8_333_334, 333_333, 8_666_667, 58_333_338),
        (8_333_334, 291_666, 8_625_000, 50_000_004),
        (8_333_334, 250_000, 8_583_334, 41_666_670),
        (8_333_334, 208_333, 8_541_667, 33_333_336),
        (8_333_334, 166_666, 8_500_000, 25_000_002),
        (8_333_334, 125_000, 8_458_334, 16_666_668),
        (8_333_334, 83_333, 8_416_667, 8_333_334),
        (8_333_334, 41_666, 8_375_000, 0),
    ];

    cliente.depositar(&usuario, &666_666_670, &20);
    cliente.solicitar_prestamo(&usuario, &prestamo);

    let mut capital_total = 0i128;
    let mut interes_total = 0i128;
    let mut pago_total = 0i128;

    for (mes, &(capital, interes, pago, saldo)) in esperado.iter().enumerate() {
        let saldo_antes = cliente.ver_prestamo(&usuario).0;
        let usuario_antes = token_client.balance(&usuario);
        let admin_antes = token_client.balance(&admin);

        cliente.pagar_prestamo(&usuario);

        let saldo_despues = cliente.ver_prestamo(&usuario).0;
        assert_eq!(saldo_antes - saldo_despues, capital);
        assert_eq!(admin_antes + interes, token_client.balance(&admin));
        assert_eq!(usuario_antes - pago, token_client.balance(&usuario));
        assert_eq!(saldo_despues, saldo);
        if mes < 23 {
            assert_eq!(cliente.ver_prestamo(&usuario).1, mes as u32 + 1);
        }

        capital_total += capital;
        interes_total += interes;
        pago_total += pago;
    }

    assert_eq!(capital_total, prestamo);
    assert_eq!(interes_total, 12_499_992);
    assert_eq!(pago_total, 212_499_993);
}

#[test]
fn test_retirar_math_comision() {
    let (env, cliente, admin, usuario, usdc) = setup();
    let token_client = token::Client::new(&env, &usdc);

    // Depositar 100 USDC (100_000_000 stroops)
    let saldo = 100_000_000i128;
    cliente.depositar(&usuario, &saldo, &1);

    // Avanzar tiempo para cumplir bloqueo (1 año + 1 segundo)
    env.ledger().with_mut(|l| {
        l.timestamp += 365 * 24 * 3600 + 1;
    });

    let balance_usuario_antes = token_client.balance(&usuario);
    let balance_admin_antes = token_client.balance(&admin);

    cliente.retirar(&usuario);

    let comision_esperada = saldo * 1 / 100; // 1%
    let monto_usuario_esperado = saldo - comision_esperada;

    let balance_usuario_despues = token_client.balance(&usuario);
    let balance_admin_despues = token_client.balance(&admin);

    assert_eq!(
        balance_usuario_despues,
        balance_usuario_antes + monto_usuario_esperado
    );
    assert_eq!(
        balance_admin_despues,
        balance_admin_antes + comision_esperada
    );
    assert_eq!(token_client.balance(&cliente.address), 0);
}

#[test]
fn test_solicitar_segundo_prestamo_panica() {
    let (_env, cliente, _admin, usuario, _usdc) = setup();

    cliente.depositar(&usuario, &100_000_000, &20);
    cliente.solicitar_prestamo(&usuario, &10_000_000);
    let res = cliente.try_solicitar_prestamo(&usuario, &10_000_000);
    assert_eq!(res, Err(Ok(Error::PrestamoActivo)));
}

#[test]
fn test_pagar_sin_prestamo_activo_panica() {
    let (_env, cliente, _admin, usuario, _usdc) = setup();
    let res = cliente.try_pagar_prestamo(&usuario);
    assert_eq!(res, Err(Ok(Error::NoTienePrestamoActivo)));
}

#[test]
fn test_solicitar_prestamo_bajo_minimo_panica() {
    let (_env, cliente, _admin, usuario, _usdc) = setup();

    cliente.depositar(&usuario, &100_000_000, &20);
    let res = cliente.try_solicitar_prestamo(&usuario, &9_999_999);
    assert_eq!(res, Err(Ok(Error::MontoPrestamoBajoMinimo)));
}

#[test]
fn test_meta_defecto_diez_veces_primer_deposito() {
    let (_env, cliente, _admin, usuario, _usdc) = setup();

    let primer_deposito = 50_000_000i128;
    cliente.depositar(&usuario, &primer_deposito, &1);

    let meta = cliente.ver_meta(&usuario);
    assert_eq!(meta, primer_deposito * 10);
}