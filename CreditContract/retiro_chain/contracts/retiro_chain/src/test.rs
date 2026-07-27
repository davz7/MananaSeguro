#![cfg(test)]
use super::*;
use soroban_sdk::testutils::Ledger;
use soroban_sdk::{symbol_short, Env};

const SEGUNDOS_POR_ANO: u64 = 365 * 24 * 60 * 60;

fn deploy(env: &Env) -> RetiroChainClient<'_> {
    let contract_id = env.register(RetiroChain, ());
    RetiroChainClient::new(env, &contract_id)
}

// Core tests

// inicializar computes ver_retiro = now + anos * seconds_per_year
#[test]
fn test_inicializar_computes_retiro() {
    let env = Env::default();
    let client = deploy(&env);

    let ahora = env.ledger().timestamp();
    let anos: u64 = 5;

    client.inicializar(&symbol_short!("owner"), &anos);

    assert_eq!(client.ver_retiro(), ahora + anos * SEGUNDOS_POR_ANO);
}

// ver_balance returns 0 before any deposit
#[test]
fn test_ver_balance_starts_at_zero() {
    let env = Env::default();
    let client = deploy(&env);

    client.inicializar(&symbol_short!("owner"), &10);

    assert_eq!(client.ver_balance(), 0);
}

// depositar accumulates across multiple calls and returns the running total each time
#[test]
fn test_depositar_accumulates_and_returns_new_balance() {
    let env = Env::default();
    let client = deploy(&env);

    client.inicializar(&symbol_short!("owner"), &10);

    assert_eq!(client.depositar(&100), 100);
    assert_eq!(client.depositar(&250), 350);
    assert_eq!(client.depositar(&50), 400);
    assert_eq!(client.ver_balance(), 400);
}

// puede_retirar is false before the retirement date
#[test]
fn test_puede_retirar_false_before_date() {
    let env = Env::default();
    let client = deploy(&env);

    client.inicializar(&symbol_short!("owner"), &10);

    assert!(!client.puede_retirar());
}

// puede_retirar is true after advancing the ledger timestamp past the retirement date
#[test]
fn test_puede_retirar_true_after_date() {
    let env = Env::default();
    let client = deploy(&env);

    client.inicializar(&symbol_short!("owner"), &10);

    let fecha_retiro = client.ver_retiro();

    env.ledger().with_mut(|l| {
        l.timestamp = fecha_retiro + 1;
    });

    assert!(client.puede_retirar());
}

// Edge cases

// anos = 0 → retirement date equals the current timestamp
// the >= check means puede_retirar is immediately true
#[test]
fn test_anos_cero_retiro_inmediato() {
    let env = Env::default();
    let client = deploy(&env);

    let ahora = env.ledger().timestamp();
    client.inicializar(&symbol_short!("owner"), &0);

    assert_eq!(client.ver_retiro(), ahora);
    assert!(client.puede_retirar());
}

// boundary: timestamp exactly equal to fecha_retiro satisfies >= and unlocks
#[test]
fn test_puede_retirar_exactamente_en_fecha() {
    let env = Env::default();
    let client = deploy(&env);

    client.inicializar(&symbol_short!("owner"), &10);
    let fecha_retiro = client.ver_retiro();

    env.ledger().with_mut(|l| {
        l.timestamp = fecha_retiro; // at, not past
    });

    assert!(client.puede_retirar());
}

// one second before the retirement date → still locked
#[test]
fn test_puede_retirar_un_segundo_antes() {
    let env = Env::default();
    let client = deploy(&env);

    client.inicializar(&symbol_short!("owner"), &10);
    let fecha_retiro = client.ver_retiro();

    env.ledger().with_mut(|l| {
        l.timestamp = fecha_retiro - 1;
    });

    assert!(!client.puede_retirar());
}

// depositing 0 is a no-op: balance and return value are both unchanged
#[test]
fn test_depositar_cero_no_cambia_balance() {
    let env = Env::default();
    let client = deploy(&env);

    client.inicializar(&symbol_short!("owner"), &10);
    client.depositar(&500);

    assert_eq!(client.depositar(&0), 500);
    assert_eq!(client.ver_balance(), 500);
}

// ver_balance falls back to 0 via unwrap_or before inicializar is called
#[test]
fn test_ver_balance_sin_inicializar() {
    let env = Env::default();
    let client = deploy(&env);

    assert_eq!(client.ver_balance(), 0);
}

// depositar also works before inicializar , unwrap_or(0) seeds the missing balance key
#[test]
fn test_depositar_sin_inicializar() {
    let env = Env::default();
    let client = deploy(&env);

    assert_eq!(client.depositar(&200), 200);
    assert_eq!(client.ver_balance(), 200);
}

// re-calling inicializar overwrites the retirement date because there is no
// re-initialization guard , this test documents that behaviour so it is explicit
#[test]
fn test_inicializar_sobrescribe_retiro() {
    let env = Env::default();
    let client = deploy(&env);

    client.inicializar(&symbol_short!("owner"), &20);
    let primera_fecha = client.ver_retiro();

    // advance time so the two resulting dates are distinguishable
    env.ledger().with_mut(|l| {
        l.timestamp += 1_000;
    });

    client.inicializar(&symbol_short!("owner"), &20);
    let segunda_fecha = client.ver_retiro();

    assert!(
        segunda_fecha > primera_fecha,
        "re-init should push retiro date forward"
    );
}

// 10 sequential deposits of 1..=10 must accumulate to exactly 55 (triangular number)
#[test]
fn test_muchos_depositos_acumulan_correctamente() {
    let env = Env::default();
    let client = deploy(&env);

    client.inicializar(&symbol_short!("owner"), &10);

    let mut expected: u64 = 0;
    for i in 1u64..=10 {
        expected += i;
        assert_eq!(client.depositar(&i), expected);
    }

    assert_eq!(client.ver_balance(), 55); // 1+2+...+10 = 55
}
