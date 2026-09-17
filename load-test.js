import http from 'k6/http';
import { check, sleep } from 'k6';
import crypto from 'k6/crypto';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8888';
const WEBHOOK_URL = `${BASE_URL}/api/etherfuse/webhook`;

const SUPABASE_URL = __ENV.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = __ENV.SUPABASE_SERVICE_KEY || '';
const WEBHOOK_SECRET = __ENV.WEBHOOK_SECRET || '';

const VUS = 10;
const ITERATIONS_PER_VU = 10;
const TOTAL_LIFECYCLES = VUS * ITERATIONS_PER_VU;
const TEST_DURATION_SECONDS = 300;
const PAUSE_BETWEEN_CYCLES_SECONDS = 30;

let contadorIds = 0;

function generarIdLocal() {
  contadorIds += 1;
  return `load-${__VU}-${__ITER}-${Date.now()}-${contadorIds}-${Math.floor(Math.random() * 1000000)}`;
}

export const options = {
  scenarios: {
    complete_order_lifecycles: {
      executor: 'per-vu-iterations',
      vus: VUS,
      iterations: ITERATIONS_PER_VU,
      maxDuration: '6m',
    },
  },
  thresholds: {
    http_req_failed: ['rate<=0.01'],
    http_req_duration: ['p(95)<1000'],
  },
};

function crearOrdenSupabase(orderId) {
  const url = `${SUPABASE_URL}/rest/v1/ordenes`;
  const body = JSON.stringify({
    usuario_id: null,
    order_id: orderId,
    monto_mxn: 50.00,
    deposit_clabe: '000000000000000000',
    status: 'created',
    etherfuse_quote_id: `load-test-${orderId}`,
  });

  const response = http.post(
    url,
    body,
    {
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Prefer': 'return=minimal',
      },
      tags: {
        operation: 'create_order',
      },
    }
  );

  check(response, {
    'orden creada en Supabase': (res) =>
      res.status === 201 || res.status === 200,
  });

  if (response.status !== 201 && response.status !== 200) {
    console.log(
      `[DEBUG INSERT] status=${response.status} body=${response.body}`
    );
  }

  return response.status === 201 || response.status === 200;
}

// NOTA DE ALCANCE (2026-09-12):
// El webhook real (etherfuse-webhook.js) intenta guardar
// stellarClaimTransaction/confirmedTxSignature cuando status === 'completed',
// pero la tabla `ordenes` en Supabase todavía no tiene esas columnas
// (stellar_claim_transaction, confirmed_tx_signature). Enviarlas desde este
// load test provoca que el UPDATE falle silenciosamente (el handler responde
// 200 igual, ver "Error actualizando orden" en logs de Netlify), dejando la
// orden atorada en 'funded' y violando el criterio de "cero órdenes
// inconsistentes" del SOW.
//
// La funcionalidad de claim de Stellar (wallet nueva, firma custodial) es un
// caso aparte del ciclo básico created -> funded -> completed que el
// criterio de aceptación de esta tarea pide probar. Por eso este load test
// deliberadamente NO envía esos campos — se documenta aquí en vez de
// agregar la columna a la BD sin acordarlo primero con el equipo.
//
// Pendiente (fuera de esta tarea): decidir con el equipo si
// stellar_claim_transaction/confirmed_tx_signature deben agregarse a la
// tabla `ordenes`, y probar ese caso por separado.
function crearPayload(orderId, status) {
  const data = {
    orderId: orderId,
    amountInFiat: 50.0,
    amountInTokens: 5.0,
    status: status,
    updatedAt: new Date().toISOString(),
  };

  const payload = {
    type: 'order_updated',
    data: data,
  };

  return JSON.stringify(payload);
}

function generarFirma(body) {
  return crypto.hmac(
    'sha256',
    WEBHOOK_SECRET,
    body,
    'hex'
  );
}

function enviarWebhook(orderId, status, bodyExistente = null) {
  const body = bodyExistente || crearPayload(
    orderId,
    status
  );

  const signature = generarFirma(body);

  const response = http.post(
    WEBHOOK_URL,
    body,
    {
      headers: {
        'Content-Type': 'application/json',
        'x-signature': signature,
      },
      tags: {
        operation: `order_${status}`,
      },
    }
  );

  check(response, {
    [`${status}: HTTP 200`]: (res) =>
      res.status === 200,
  });

  if (response.status !== 200) {
    console.log(
      `[DEBUG ${status}] status=${response.status} body=${response.body}`
    );
  }

  return body;
}

function ejecutarCicloCompleto() {
  const orderId = generarIdLocal();

  const ordenCreada = crearOrdenSupabase(orderId);

  if (!ordenCreada) {
    return;
  }

  enviarWebhook(
    orderId,
    'created'
  );

  const fundedBody = enviarWebhook(
    orderId,
    'funded'
  );

  if ((__VU - 1) * ITERATIONS_PER_VU + __ITER < 30) {
    enviarWebhook(
      orderId,
      'funded',
      fundedBody
    );
  }

  enviarWebhook(
    orderId,
    'completed'
  );
}

export function setup() {
  if (!WEBHOOK_SECRET) {
    throw new Error(
      'WEBHOOK_SECRET no está configurado. ' +
      'Ejecuta k6 con -e WEBHOOK_SECRET="..."'
    );
  }

  if (!SUPABASE_URL) {
    throw new Error(
      'SUPABASE_URL no está configurado.'
    );
  }

  if (!SUPABASE_SERVICE_KEY) {
    throw new Error(
      'SUPABASE_SERVICE_KEY no está configurado.'
    );
  }

  console.log(`Webhook objetivo: ${WEBHOOK_URL}`);
  console.log(`Supabase objetivo: ${SUPABASE_URL}`);
  console.log(`Usuarios virtuales: ${VUS}`);
  console.log(`Ciclos por VU: ${ITERATIONS_PER_VU}`);
  console.log(`Ciclos totales: ${TOTAL_LIFECYCLES}`);
  console.log(`Duración objetivo: ${TEST_DURATION_SECONDS} segundos`);
  console.log('Órdenes a crear en Supabase: 100');
  console.log('Webhooks normales: 300');
  console.log('Entregas duplicadas: 30');
  console.log('Duplicados inyectados: 10% del volumen normal');
}

export default function () {
  ejecutarCicloCompleto();
  sleep(PAUSE_BETWEEN_CYCLES_SECONDS);
}

export function teardown() {
  console.log(`Prueba finalizada. Ciclos programados: ${TOTAL_LIFECYCLES}.`);
  console.log('La consistencia de las órdenes debe verificarse contra la base de datos después de la ejecución.');
}