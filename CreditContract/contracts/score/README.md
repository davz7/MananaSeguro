# Score Contract (`contracts/score`)

This README documents the **score** contract (the retirement savings contract with deposit, withdrawal, and emergency auto-loan logic), not the older Soroban scaffold under `retiro_chain`.

## Overview

The score contract implements a locked retirement savings model in USDC on Soroban:

- Users deposit USDC into locked savings.
- Funds are withdrawable only when the lock period is reached **or** the target goal (`Meta`) is reached.
- Withdrawals charge a 1% platform fee sent to admin.
- Users can request one emergency auto-loan against savings (up to 30%), then repay monthly with interest.

## Units and Business Rules

- **Token amount unit:** stroops (`1 USDC = 10_000_000 stroops`).
- **Percent/fee unit:** basis points where used (`10_000 bps = 100%`).

Business constants in code:

- Minimum deposit: `20_000_000` stroops (`$2` USDC).
- Platform fee on withdrawal: `100` bps (`1%`).
- Max emergency loan: `30%` of locked balance.
- Loan monthly interest: `50` bps (`0.5%` per month).
- Max loan term: `24` months.

## Error Handling

The contract defines typed contract errors using `#[contracterror]` (`Error` enum):

| Code | Variant | Description | Triggered by |
|---|---|---|---|
| `1` | `MontoBajoMinimo` | Monto de depósito menor al mínimo de $2 USDC (`20_000_000` stroops). | `depositar` |
| `2` | `AniosBloqueoInvalidos` | Años de bloqueo fuera del rango permitido (1 a 40 años). | `depositar` |
| `3` | `SinSaldo` | El usuario no posee saldo bloqueado en el contrato. | `retirar`, `solicitar_prestamo` |
| `4` | `CondicionesRetiroNoCumplidas` | Aún no se cumple el tiempo de bloqueo ni se alcanzó la meta. | `retirar` |
| `5` | `PrestamoPendiente` | Existe un autopréstamo pendiente de liquidación. | `retirar` |
| `6` | `PrestamoActivo` | El usuario ya tiene un autopréstamo activo en curso. | `solicitar_prestamo` |
| `7` | `ExcedeLimitePrestamo` | El monto solicitado excede el 30% del saldo bloqueado. | `solicitar_prestamo` |
| `8` | `MontoPrestamoBajoMinimo` | Monto de préstamo menor al mínimo de $1 USDC (`10_000_000` stroops). | `solicitar_prestamo` |
| `9` | `NoTienePrestamoActivo` | Intento de pago cuando no existe un autopréstamo activo. | `pagar_prestamo` |
| `10` | `PrestamoYaLiquidado` | El préstamo ya ha cumplido las 24 cuotas / se encuentra liquidado. | `pagar_prestamo` |
| `11` | `MetaInvalida` | La meta ingresada no es válida (debe ser mayor a 0). | `actualizar_meta` |

## Entrypoints

| Entrypoint | Parameters | Return | What it does | Errors / Authorization |
|---|---|---|---|---|
| `inicializar` | `env: Env`, `admin: Address`, `usdc_token: Address` | `()` | Sets admin and USDC token addresses in instance storage. | Requires `admin.require_auth()`. |
| `depositar` | `env: Env`, `usuario: Address`, `monto: i128`, `anios_bloqueo: u32` | `Result<(), Error>` | Authenticates user, transfers USDC from user to contract, updates locked balance + deposit counter, sets first lock date and default goal (`10x` first deposit), emits `deposito`. | Requires `usuario.require_auth()`. Returns `MontoBajoMinimo` or `AniosBloqueoInvalidos`. |
| `ver_balance` | `env: Env`, `usuario: Address` | `i128` | Returns locked balance in stroops. | Returns `0` if missing. |
| `ver_retiro` | `env: Env`, `usuario: Address` | `u64` | Returns withdrawal timestamp (`unix u64`). | Returns `0` if missing. |
| `ver_meta` | `env: Env`, `usuario: Address` | `i128` | Returns goal amount in stroops. | Returns `0` if missing. |
| `ver_depositos` | `env: Env`, `usuario: Address` | `u32` | Returns number of deposits. | Returns `0` if missing. |
| `retirar` | `env: Env`, `usuario: Address` | `Result<(), Error>` | Allows withdrawal when time lock or goal condition is satisfied, charges 1% fee to admin, transfers net to user, clears user savings state, emits `retiro`. | Requires `usuario.require_auth()`. Returns `SinSaldo`, `CondicionesRetiroNoCumplidas`, or `PrestamoPendiente`. |
| `solicitar_prestamo` | `env: Env`, `usuario: Address`, `monto: i128` | `Result<(), Error>` | Creates emergency auto-loan, stores principal + month counter, transfers loan amount to user, emits `prestamo`. | Requires `usuario.require_auth()`. Returns `SinSaldo`, `PrestamoActivo`, `ExcedeLimitePrestamo`, or `MontoPrestamoBajoMinimo`. |
| `pagar_prestamo` | `env: Env`, `usuario: Address` | `Result<(), Error>` | Charges one monthly payment (`capital + monthly interest`), sends interest to admin, updates/clears loan state, emits `pago_prestamo`. | Requires `usuario.require_auth()`. Returns `NoTienePrestamoActivo` or `PrestamoYaLiquidado`. |
| `ver_prestamo` | `env: Env`, `usuario: Address` | `(i128, u32)` | Returns `(loan_balance_stroops, months_paid)`. | Returns `(0, 0)` if missing. |
| `actualizar_meta` | `env: Env`, `usuario: Address`, `nueva_meta: i128` | `Result<(), Error>` | Lets user set a custom retirement goal in stroops. | Requires `usuario.require_auth()`. Returns `MetaInvalida`. |

## Storage Model

`DataKey` variants used by the contract:

- `Balance(Address)`: user locked savings balance in **stroops**.
- `DepositCount(Address)`: number of user deposits (`u32` counter).
- `RetiroFecha(Address)`: allowed withdrawal time as Unix timestamp (`u64`, seconds).
- `Meta(Address)`: user retirement target in **stroops**.
- `Prestamo(Address)`: current auto-loan outstanding principal in **stroops**.
- `PrestamoMeses(Address)`: number of paid loan months (`u32`).
- `Admin`: admin address receiving platform fee and loan interest.
- `UsdcToken`: USDC token contract address used for transfers.

## Local Workflow (`contracts/score`)

Run commands from `CreditContract/contracts/score/`.

### Build

```bash
# Soroban WASM build (requires stellar CLI)
stellar contract build

# Rust crate build
cargo build
```

### Test

```bash
cargo test
```

