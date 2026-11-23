# Netlify Functions API Documentation

This directory contains 9 Netlify serverless functions that power the Mañana Seguro application. Each function is documented below with HTTP methods, path mappings, request/response schemas, error codes, and required environment variables.

## Running Functions Locally

### Prerequisites

Install Netlify CLI globally:

```bash
npm install -g netlify-cli
```

### Setup Local Environment

Create a `.env` file in the project root with the following variables:

```bash
# Supabase Configuration
SUPABASE_URL=https://XXX-REDACTED.supabase.co
SUPABASE_SERVICE_KEY=eyJXXX-REDACTED

# Google Authentication
GOOGLE_CLIENT_ID=XXX-REDACTED.apps.googleusercontent.com

# Wallet Encryption (AES-256 key in hex, 64 characters)
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
WALLET_ENCRYPTION_KEY=XXX-REDACTED64CHARHEXKEYXXX-REDACTED

# Banxico API (for financial rates)
BANXICO_TOKEN=XXX-REDACTED

# Etherfuse Configuration
ETHERFUSE_API_KEY=XXX-REDACTED
ETHERFUSE_ENV=sandbox  # or 'production'

# Webhook Configuration
WEBHOOK_SECRET=XXX-REDACTED
WEBHOOK_SECRET_2=XXX-REDACTED  # Optional, for multiple event types
WEBHOOK_URL=https://XXX-REDACTED.ngrok-free.app  # Use ngrok in dev, Netlify URL in prod
```

### Start Local Development Server

```bash
netlify dev
```

The functions will be available at:
- Frontend: http://localhost:8888
- API endpoints: http://localhost:8888/api/*

---

## Function Documentation

### auth-google

Google OAuth authentication handler. Verifies Google ID tokens, creates/updates user records in Supabase, and generates Stellar wallets for new users.

- **HTTP Method**: `POST`
- **Path Mapping**: `/api/auth/google` → `/.netlify/functions/auth-google`
- **CORS**: Allows POST from any origin

#### Request Schema

```json
{
  "idToken": "string (required) - Google OAuth ID token"
}
```

#### Success Response Schema

**Status 200** (existing user):
```json
{
  "usuario": {
    "id": "uuid",
    "email": "string",
    "nombre": "string",
    "customerId": "uuid",
    "bankAccountId": "uuid",
    "stellarPublicKey": "string (Stellar public key)",
    "kycStatus": "pending|approved|rejected",
    "bankAccountStatus": "pending|active"
  },
  "esNuevo": false
}
```

**Status 201** (new user):
```json
{
  "usuario": {
    "id": "uuid",
    "email": "string",
    "nombre": "string",
    "customerId": "uuid",
    "bankAccountId": "uuid",
    "stellarPublicKey": "string (Stellar public key)",
    "kycStatus": "pending",
    "bankAccountStatus": "pending"
  },
  "esNuevo": true
}
```

#### Error Codes

- **400 Bad Request**: Invalid request body or missing `idToken`
- **401 Unauthorized**: Google token is invalid, expired, or email not verified
- **405 Method Not Allowed**: Non-POST request
- **500 Internal Server Error**: Missing environment variables or database error

#### Required Environment Variables

- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_KEY` - Supabase service role key (bypasses RLS)
- `WALLET_ENCRYPTION_KEY` - AES-256 encryption key in hex (64 characters)
- `GOOGLE_CLIENT_ID` - Google OAuth client ID for audience validation

---

### cetes-rate

Fetches the current CETES 28-day interest rate from Banxico SIE API, subtracts Etherfuse's spread (~0.9%), and returns the net rate for users.

- **HTTP Method**: `GET`
- **Path Mapping**: `/api/cetes-rate` → `/.netlify/functions/cetes-rate`
- **CORS**: Allows GET from any origin

#### Request Schema

No request body or query parameters required.

#### Success Response Schema

**Status 200**:
```json
{
  "rate": 6.5,
  "tasaBruta": 6.5,
  "tasaUsuarioEtherfuse": 5.6,
  "fecha": "2026-05-04",
  "source": "banxico"
}
```

On failure, returns fallback data:
```json
{
  "rate": 6.5,
  "tasaBruta": 6.5,
  "tasaUsuarioEtherfuse": 5.6,
  "source": "fallback",
  "error": "string (error message)"
}
```

#### Error Codes

- **200 OK** (with fallback data): Banxico API failed, using hardcoded fallback rate

#### Required Environment Variables

- `BANXICO_TOKEN` - Banxico SIE API token

---

### cuenta-preparar

Prepara la cuenta testnet del usuario de la sesión para que pueda depositar en el contrato (T03).

**Endpoint**: `POST /api/cuenta/preparar` · **Sesión**: sí · **Cuerpo**: ninguno

Pasos, todos reanudables:

1. Crea la cuenta con XLM (Friendbot) si no existe.
2. Crea la trustline a USDC de Circle, firmada con la llave custodial del usuario.
3. Envía 5 USDC desde la cuenta tesorera (`cuentas_sistema`, id `tesoreria-testnet`).

**Controles**:

- Solo opera en testnet. Sin `STELLAR_NETWORK_PASSPHRASE` igual a la de testnet, o si Horizon o el RPC responden con otra red, se niega **antes** de descifrar cualquier llave.
- Una sola vez por usuario y con monto fijo: `fondeos_testnet` tiene al usuario como clave primaria. Llamarlo de nuevo tras éxito devuelve el mismo resultado con `replayed: true`.
- El pago se firma y se guarda (hash y XDR) antes de enviarse. Un reintento verifica ese hash en la red y, si no ha vencido, reenvía el mismo sobre. Nunca arma un segundo pago mientras el primero pueda entrar.
- Si la tesorería no tiene al menos 5 USDC, responde `TREASURY_LOW` sin firmar nada. Por debajo de 25 USDC se registra un aviso.

**Respuesta 200**:

```json
{ "ok": true, "cuenta": "G...", "montoUsdc": "5", "trustlineHash": "...", "pagoHash": "..." }
```

**Errores** (`code`): `IN_PROGRESS` 409 · `ACCOUNT_NOT_FOUND` 404 · `ACCOUNT_DEACTIVATED` / `KEY_DESTROYED` 403 · `NETWORK_NOT_TESTNET` / `TREASURY_NOT_CONFIGURED` / `TREASURY_LOW` 503 · `SUBMISSION_FAILED` 502 · `TIMEOUT` 504 · `INTERNAL` 500. Los tres 503 muestran el mismo mensaje al usuario.

**Puesta en marcha (una vez)**:

1. Correr `supabase/migrations/20261122_t03_cuentas_sistema_y_fondeos.sql` en el editor SQL de Supabase.
2. Definir `STELLAR_NETWORK_PASSPHRASE=Test SDF Network ; September 2015` en Netlify. Es obligatoria aunque `soroban.js` use testnet por defecto.
3. `node scripts/crear-tesoreria.mjs`: genera la llave con KMS (contexto `{ userId: 'tesoreria-testnet' }`), la guarda, la fondea con XLM y crea la trustline. No sobrescribe una tesorería existente.
4. Mandar USDC de testnet a la dirección que imprime, desde el faucet de Circle.
5. `node scripts/ver-tesoreria.mjs` para ver saldo y cuántos fondeos alcanza.

### etherfuse-deposit

Creates a deposit order in Etherfuse, generates a unique CLABE for SPEI transfer, and saves the order to Supabase. Requires approved KYC and active bank account.

- **HTTP Method**: `POST`
- **Path Mapping**: `/api/etherfuse/deposit` → `/.netlify/functions/etherfuse-deposit`
- **CORS**: Allows POST from any origin

#### Request Schema

```json
{
  "usuarioId": "uuid (required)",
  "montoMxn": "number (required, 40-100,000 MXN)"
}
```

#### Success Response Schema

**Status 200**:
```json
{
  "orderId": "uuid",
  "depositClabe": "string (18-digit CLABE)",
  "depositBankName": "STP",
  "depositAccountHolder": "Etherfuse MX",
  "montoExactoMxn": 1000,
  "targetAmount": "string (estimated CETES to receive)",
  "feeAmount": "string (Etherfuse fee)",
  "status": "created",
  "instruccion": "Transfiere exactamente $1,000 MXN desde tu banco a la CLABE indicada. El monto debe ser exacto."
}
```

#### Error Codes

- **400 Bad Request**: Invalid request body, missing fields, or amount out of range (40-100,000 MXN)
- **403 Forbidden**: KYC not approved or bank account not active
- **404 Not Found**: User not found in database
- **405 Method Not Allowed**: Non-POST request
- **500 Internal Server Error**: Missing environment variables, Etherfuse API error, or database error

#### Required Environment Variables

- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_KEY` - Supabase service role key
- `ETHERFUSE_API_KEY` - Etherfuse API key
- `ETHERFUSE_ENV` - Environment: `sandbox` or `production`

---

### etherfuse-onboarding

Generates a presigned URL for Etherfuse KYC onboarding flow. Users complete identity verification through this URL, and results are sent via webhook.

- **HTTP Method**: `POST`
- **Path Mapping**: `/api/etherfuse/onboarding` → `/.netlify/functions/etherfuse-onboarding`
- **CORS**: Allows POST from any origin

#### Request Schema

```json
{
  "usuarioId": "uuid (required)"
}
```

#### Success Response Schema

**Status 200** (onboarding already completed):
```json
{
  "yaCompletado": true,
  "kycStatus": "approved",
  "bankAccountStatus": "active",
  "mensaje": "El usuario ya completó el onboarding"
}
```

**Status 200** (new onboarding URL):
```json
{
  "onboardingUrl": "string (presigned URL)",
  "expiraEn": "2026-05-26T23:14:00.000Z",
  "kycStatus": "pending"
}
```

#### Error Codes

- **400 Bad Request**: Invalid request body or missing `usuarioId`
- **404 Not Found**: User not found in database
- **405 Method Not Allowed**: Non-POST request
- **500 Internal Server Error**: Missing environment variables or Etherfuse API error

#### Required Environment Variables

- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_KEY` - Supabase service role key
- `ETHERFUSE_API_KEY` - Etherfuse API key
- `ETHERFUSE_ENV` - Environment: `sandbox` or `production`
- `WEBHOOK_URL` - Public URL for webhook callbacks (ngrok in dev, Netlify URL in prod)

---

### etherfuse-ramp

General proxy for Etherfuse Ramp API endpoints. Handles authentication and CORS for multiple Ramp operations.

- **HTTP Method**: `GET`, `POST`
- **Path Mapping**: `/api/etherfuse-ramp` → `/.netlify/functions/etherfuse-ramp`
- **CORS**: Allows GET, POST from any origin

#### Request Schema

All operations use the `action` query parameter:

**GET /api/etherfuse-ramp?action=assets** - List available Stellar assets
- Query: `action=assets`
- No body required

**POST /api/etherfuse-ramp?action=quote** - Get quote for MXN → crypto conversion
- Query: `action=quote`
- Body:
```json
{
  "walletAddress": "string (required)",
  "amountMxn": "number (required)",
  "targetAsset": "string (required, e.g., 'USDC:GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5')",
  "customerId": "string (required)"
}
```

**POST /api/etherfuse-ramp?action=order** - Create order and get CLABE
- Query: `action=order`
- Body:
```json
{
  "quoteId": "uuid (required)",
  "bankAccountId": "uuid (required)",
  "cryptoWalletId": "uuid (required)"
}
```

**GET /api/etherfuse-ramp?action=order-status&orderId=xxx** - Get order status
- Query: `action=order-status&orderId=uuid`
- No body required

**POST /api/etherfuse-ramp?action=kyc-url** - Get hosted KYC URL
- Query: `action=kyc-url`
- Body:
```json
{
  "walletAddress": "string (required)",
  "email": "string (required)"
}
```

**GET /api/etherfuse-ramp?action=kyc-status&customerId=xxx&walletAddress=xxx** - Get KYC status
- Query: `action=kyc-status&customerId=uuid&walletAddress=string`
- No body required

#### Success Response Schema

Returns the raw response from Etherfuse API for each action.

#### Error Codes

- **400 Bad Request**: Invalid action, missing required fields, or invalid request body
- **500 Internal Server Error**: Missing API key or Etherfuse API error

#### Required Environment Variables

- `ETHERFUSE_API_KEY` - Etherfuse API key
- `ETHERFUSE_ENV` - Environment: `sandbox` or `production`
- `URL` - Netlify site URL (auto-injected in production)

---

### etherfuse-webhook

Handles webhook callbacks from Etherfuse for KYC updates and order status changes. Verifies HMAC-SHA256 signature for security.

- **HTTP Method**: `POST`
- **Path Mapping**: `/api/etherfuse/webhook` → `/.netlify/functions/etherfuse-webhook`
- **CORS**: No CORS (server-to-server only)

#### Request Schema

Headers:
- `X-Signature`: HMAC-SHA256 signature in hex

Body (event types):
```json
{
  "type": "kyc_updated",
  "data": {
    "customerId": "uuid",
    "kycStatus": "approved|rejected|pending",
    "bankAccountId": "uuid",
    "bankAccountStatus": "active|pending"
  }
}
```

```json
{
  "type": "order_updated",
  "data": {
    "orderId": "uuid",
    "status": "created|funded|completed",
    "stellarClaimTransaction": "string (XDR, optional)"
  }
}
```

#### Success Response Schema

**Status 200**:
```json
{
  "received": true
}
```

#### Error Codes

- **400 Bad Request**: Invalid JSON body or missing `type` field
- **401 Unauthorized**: Invalid HMAC signature
- **405 Method Not Allowed**: Non-POST request
- **500 Internal Server Error**: Missing environment variables or database error

#### Required Environment Variables

- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_KEY` - Supabase service role key
- `WEBHOOK_SECRET` - HMAC secret for signature verification (from Etherfuse webhook creation)
- `WEBHOOK_SECRET_2` - Optional second secret for different event types

---

### exchange-rate

Fetches the current USD → MXN exchange rate from Banxico SIE API (FIX rate published daily on business days).

- **HTTP Method**: `GET`
- **Path Mapping**: `/api/exchange-rate` → `/.netlify/functions/exchange-rate`
- **CORS**: Allows GET from any origin

#### Request Schema

No request body or query parameters required.

#### Success Response Schema

**Status 200**:
```json
{
  "usdMxn": 17.5000,
  "fecha": "2026-05-26",
  "source": "banxico"
}
```

On failure, returns fallback data:
```json
{
  "usdMxn": 17.50,
  "source": "fallback",
  "error": "string (error message)"
}
```

#### Error Codes

- **200 OK** (with fallback data): Banxico API failed, using hardcoded fallback rate

#### Required Environment Variables

- `BANXICO_TOKEN` - Banxico SIE API token

---

### metas

CRUD operations for savings goals (metas). Supports listing, creating, updating, and deleting goals with validation and security checks.

- **HTTP Method**: `GET`, `POST`, `PATCH`, `DELETE`
- **Path Mapping**: `/api/metas` → `/.netlify/functions/metas`
- **CORS**: Allows GET, POST, PATCH, DELETE from any origin

#### Request Schema

**GET /api/metas?usuarioId=xxx** - List user's goals
- Query: `usuarioId=uuid` (required)
- No body required

**POST /api/metas** - Create new goal
- Body:
```json
{
  "usuarioId": "uuid (required)",
  "nombre": "string (required, max 60 chars)",
  "descripcion": "string (optional)",
  "monto_objetivo_mxn": "number (required, 1,000-50,000,000)",
  "ahorro_mensual_mxn": "number (required, 40-100,000)",
  "anos_al_retiro": "number (required, 1-40)"
}
```

**PATCH /api/metas?id=xxx** - Update goal
- Query: `id=uuid` (required)
- Body (all fields optional):
```json
{
  "usuarioId": "uuid (required)",
  "nombre": "string (max 60 chars)",
  "descripcion": "string",
  "monto_objetivo_mxn": "number (1,000-50,000,000)",
  "ahorro_mensual_mxn": "number (40-100,000)",
  "anos_al_retiro": "number (1-40)"
}
```

**DELETE /api/metas?id=xxx** - Delete goal
- Query: `id=uuid` (required)
- Body:
```json
{
  "usuarioId": "uuid (required)"
}
```

#### Success Response Schema

**GET** (Status 200):
```json
{
  "metas": [
    {
      "id": "uuid",
      "nombre": "string",
      "descripcion": "string|null",
      "monto_objetivo_mxn": 1000000,
      "ahorro_mensual_mxn": 5000,
      "anos_al_retiro": 30,
      "es_principal": true,
      "created_at": "2026-05-26T00:00:00.000Z",
      "updated_at": "2026-05-26T00:00:00.000Z"
    }
  ]
}
```

**POST** (Status 201):
```json
{
  "meta": {
    "id": "uuid",
    "nombre": "string",
    "descripcion": "string|null",
    "monto_objetivo_mxn": 1000000,
    "ahorro_mensual_mxn": 5000,
    "anos_al_retiro": 30,
    "es_principal": true,
    "created_at": "2026-05-26T00:00:00.000Z",
    "updated_at": "2026-05-26T00:00:00.000Z"
  }
}
```

**PATCH** (Status 200):
```json
{
  "meta": {
    "id": "uuid",
    "nombre": "string",
    "descripcion": "string|null",
    "monto_objetivo_mxn": 1000000,
    "ahorro_mensual_mxn": 5000,
    "anos_al_retiro": 30,
    "es_principal": true,
    "created_at": "2026-05-26T00:00:00.000Z",
    "updated_at": "2026-05-26T00:00:00.000Z"
  }
}
```

**DELETE** (Status 200):
```json
{
  "eliminado": true
}
```

#### Error Codes

- **400 Bad Request**: Missing required fields, validation errors, or no fields to update
- **404 Not Found**: Goal not found or doesn't belong to user
- **405 Method Not Allowed**: Invalid HTTP method
- **409 Conflict**: Attempting to create duplicate primary goal or delete only goal
- **500 Internal Server Error**: Missing environment variables or database error

#### Required Environment Variables

- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_KEY` - Supabase service role key
- `ETHERFUSE_ENV` - Environment (used for error detail exposure in sandbox)

---

### order-status

Queries order status from Supabase. Supports two modes: single order lookup (for polling) or all orders for a user (for dashboard).

- **HTTP Method**: `GET`
- **Path Mapping**: `/api/etherfuse/order-status` → `/.netlify/functions/order-status`
- **CORS**: Allows GET from any origin

#### Request Schema

**Mode 1: Single order**
- Query: `orderId=uuid` (required)

**Mode 2: All user orders**
- Query: `usuarioId=uuid` (required)

#### Success Response Schema

**Mode 1: Single order** (Status 200):
```json
{
  "orderId": "uuid",
  "status": "created|funded|completed",
  "montoMxn": 1000,
  "updatedAt": "2026-05-26T00:00:00.000Z"
}
```

**Mode 2: All user orders** (Status 200):
```json
{
  "ordenes": [
    {
      "order_id": "uuid",
      "status": "completed",
      "monto_mxn": 1000,
      "deposit_clabe": "string",
      "created_at": "2026-05-26T00:00:00.000Z",
      "updated_at": "2026-05-26T00:00:00.000Z"
    }
  ],
  "totalMxn": 1000,
  "totalCompletadas": 1
}
```

#### Error Codes

- **400 Bad Request**: Missing both `orderId` and `usuarioId` query parameters
- **404 Not Found**: Order not found (single order mode)
- **405 Method Not Allowed**: Non-GET request
- **500 Internal Server Error**: Database error

#### Required Environment Variables

- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_KEY` - Supabase service role key

---

## Common Error Patterns

### CORS Errors
All functions include CORS headers. If you encounter CORS issues in development, ensure:
- The frontend is running on the same origin or the function allows cross-origin requests
- OPTIONS preflight requests are handled (all functions handle this)

### Environment Variable Errors
Functions return **500 Internal Server Error** with message "Error de configuración del servidor" when required environment variables are missing. Check your `.env` file or Netlify dashboard environment variables.

### Database Errors
Functions return **500 Internal Server Error** for database connection or query errors. Check Supabase logs for details.

### Authentication Errors
- **auth-google**: 401 for invalid Google tokens
- **etherfuse-webhook**: 401 for invalid HMAC signatures

### Validation Errors
Most functions return **400 Bad Request** with descriptive error messages for invalid input. Check the response body for specific validation details.

---

## Security Notes

1. **Service Role Keys**: All functions use `SUPABASE_SERVICE_KEY` which bypasses Row Level Security (RLS). This is intentional for server-side operations but must never be exposed to clients.

2. **Wallet Encryption**: Stellar secret keys are encrypted with AES-256-GCM before storage. The encryption key must be kept secure and never committed to version control.

3. **Webhook Verification**: The `etherfuse-webhook` function verifies HMAC-SHA256 signatures to ensure requests are genuinely from Etherfuse.

4. **KYC Checks**: The `etherfuse-deposit` function blocks deposits for users without approved KYC and active bank accounts.

5. **Input Validation**: All functions validate input ranges (e.g., deposit amounts 40-100,000 MXN) to prevent abuse.

---

## Development Tips

- Use `netlify dev` to test functions locally with hot reload
- Use ngrok for webhook testing in development: `ngrok http 8888`
- Check Netlify function logs in the dashboard for production debugging
- All functions log errors to console for debugging
- The `ETHERFUSE_ENV=sandbox` setting enables detailed error messages in responses for development
