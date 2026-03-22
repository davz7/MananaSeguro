import * as StellarSdk from "@stellar/stellar-sdk"

const server = new StellarSdk.Horizon.Server("https://horizon-testnet.stellar.org")
export const networkPassphrase = StellarSdk.Networks.TESTNET
const rpc = new StellarSdk.rpc.Server("https://soroban-testnet.stellar.org")

// ⚠️ Actualiza este ID después de desplegar el contrato nuevo
export const CONTRACT_ID = "CA4M25CNPPXIPLXZLJZQBPAOKY5REKUOFNJVTMGJ4RKK4QYNIYIG6NLP"

// USDC en Stellar testnet (Circle testnet issuer)
export const USDC_ASSET = new StellarSdk.Asset(
  "USDC",
  "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"
)

// 1 USDC = 10_000_000 stroops (7 decimales Stellar)
export const STROOP = 10_000_000

// ─── Helper: construir, simular y retornar tx ─────────────────────────────────
async function buildAndSimulate(account, operations) {
  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase,
  })
  for (const op of operations) {
    tx.addOperation(op)
  }
  const built = tx.setTimeout(30).build()
  const sim = await rpc.simulateTransaction(built)
  if (StellarSdk.rpc.Api.isSimulationError(sim)) {
    throw new Error(`Simulación falló: ${sim.error}`)
  }
  return StellarSdk.rpc.assembleTransaction(built, sim).build()
}

// ─── Balances de la wallet ────────────────────────────────────────────────────
export async function getBalances(publicKey) {
  const account = await server.loadAccount(publicKey)
  return account.balances
}

// ─── Depositar USDC y bloquear ────────────────────────────────────────────────
export async function lockFunds(sourcePublicKey, amountUSDC, aniosBloqueo = 20) {
  const contract = new StellarSdk.Contract(CONTRACT_ID)
  const account = await rpc.getAccount(sourcePublicKey)
  const montoStroops = Math.floor(amountUSDC * STROOP)

  return buildAndSimulate(account, [
    contract.call(
      "depositar",
      StellarSdk.nativeToScVal(sourcePublicKey, { type: "address" }),
      StellarSdk.nativeToScVal(montoStroops, { type: "i128" }),
      StellarSdk.nativeToScVal(aniosBloqueo, { type: "u32" }),
    )
  ])
}

// ─── Ver saldo bloqueado en el contrato ───────────────────────────────────────
export async function verBalanceContrato(publicKey) {
  const contract = new StellarSdk.Contract(CONTRACT_ID)
  const account = await rpc.getAccount(publicKey)

  const tx = await buildAndSimulate(account, [
    contract.call(
      "ver_balance",
      StellarSdk.nativeToScVal(publicKey, { type: "address" }),
    )
  ])

  const sim = await rpc.simulateTransaction(tx)
  const raw = StellarSdk.scValToNative(sim.result?.retval)
  // Convertir stroops a USDC
  return Number(raw) / STROOP
}

// ─── Ver fecha de retiro ──────────────────────────────────────────────────────
export async function verFechaRetiro(publicKey) {
  const contract = new StellarSdk.Contract(CONTRACT_ID)
  const account = await rpc.getAccount(publicKey)

  const tx = await buildAndSimulate(account, [
    contract.call(
      "ver_retiro",
      StellarSdk.nativeToScVal(publicKey, { type: "address" }),
    )
  ])

  const sim = await rpc.simulateTransaction(tx)
  const timestamp = StellarSdk.scValToNative(sim.result?.retval)

  if (!timestamp || timestamp === 0) return 'Pendiente de primer depósito'

  return new Date(Number(timestamp) * 1000).toLocaleDateString('es-MX', {
    year: 'numeric', month: 'long', day: 'numeric'
  })
}

// ─── Ver meta de retiro ───────────────────────────────────────────────────────
export async function verMeta(publicKey) {
  const contract = new StellarSdk.Contract(CONTRACT_ID)
  const account = await rpc.getAccount(publicKey)

  const tx = await buildAndSimulate(account, [
    contract.call(
      "ver_meta",
      StellarSdk.nativeToScVal(publicKey, { type: "address" }),
    )
  ])

  const sim = await rpc.simulateTransaction(tx)
  const raw = StellarSdk.scValToNative(sim.result?.retval)
  return Number(raw) / STROOP
}

// ─── Ver número de depósitos ──────────────────────────────────────────────────
export async function verDepositos(publicKey) {
  const contract = new StellarSdk.Contract(CONTRACT_ID)
  const account = await rpc.getAccount(publicKey)

  const tx = await buildAndSimulate(account, [
    contract.call(
      "ver_depositos",
      StellarSdk.nativeToScVal(publicKey, { type: "address" }),
    )
  ])

  const sim = await rpc.simulateTransaction(tx)
  return Number(StellarSdk.scValToNative(sim.result?.retval))
}

// ─── Retirar fondos al llegar la meta ────────────────────────────────────────
export async function retirarFondos(publicKey) {
  const contract = new StellarSdk.Contract(CONTRACT_ID)
  const account = await rpc.getAccount(publicKey)

  return buildAndSimulate(account, [
    contract.call(
      "retirar",
      StellarSdk.nativeToScVal(publicKey, { type: "address" }),
    )
  ])
}

// ─── Solicitar autopréstamo ───────────────────────────────────────────────────
export async function solicitarPrestamo(publicKey, amountUSDC) {
  const contract = new StellarSdk.Contract(CONTRACT_ID)
  const account = await rpc.getAccount(publicKey)
  const montoStroops = Math.floor(amountUSDC * STROOP)

  return buildAndSimulate(account, [
    contract.call(
      "solicitar_prestamo",
      StellarSdk.nativeToScVal(publicKey, { type: "address" }),
      StellarSdk.nativeToScVal(montoStroops, { type: "i128" }),
    )
  ])
}

// ─── Pagar cuota del autopréstamo ─────────────────────────────────────────────
export async function pagarPrestamo(publicKey) {
  const contract = new StellarSdk.Contract(CONTRACT_ID)
  const account = await rpc.getAccount(publicKey)

  return buildAndSimulate(account, [
    contract.call(
      "pagar_prestamo",
      StellarSdk.nativeToScVal(publicKey, { type: "address" }),
    )
  ])
}

// ─── Ver estado del autopréstamo ──────────────────────────────────────────────
export async function verPrestamo(publicKey) {
  const contract = new StellarSdk.Contract(CONTRACT_ID)
  const account = await rpc.getAccount(publicKey)

  const tx = await buildAndSimulate(account, [
    contract.call(
      "ver_prestamo",
      StellarSdk.nativeToScVal(publicKey, { type: "address" }),
    )
  ])

  const sim = await rpc.simulateTransaction(tx)
  const [saldoRaw, meses] = StellarSdk.scValToNative(sim.result?.retval)
  return {
    saldo: Number(saldoRaw) / STROOP,
    meses: Number(meses),
  }
}

// ─── Enviar transacción firmada ───────────────────────────────────────────────
export async function enviarTransaccion(signedXdr) {
  const tx = StellarSdk.TransactionBuilder.fromXDR(signedXdr, networkPassphrase)
  const result = await server.submitTransaction(tx)
  return result.hash
}
