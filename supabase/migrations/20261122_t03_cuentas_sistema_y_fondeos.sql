-- T03 · Cuenta testnet lista al registrarse
--
-- Correr una vez en el editor SQL de Supabase. Es idempotente (IF NOT EXISTS).
-- Ninguna de las dos tablas tiene políticas RLS: solo la service role (que
-- salta RLS) puede leerlas o escribirlas. anon y authenticated no ven nada.

-- ─── Cuentas del sistema ────────────────────────────────────────────────────
-- Mismas cinco columnas de custodia que `usuarios`, para reutilizar
-- withSeed() sin cambios. El `id` es también el encryption context de KMS
-- ({ userId: id }), así que queda separado de los usuarios en CloudTrail.
create table if not exists public.cuentas_sistema (
  id                  text primary key check (id ~ '^[a-z0-9-]+$'),
  stellar_public_key  text not null unique,
  seed_ciphertext     text not null,
  seed_iv             text not null,
  seed_auth_tag       text not null,
  data_key_blob       text not null,
  key_scheme_version  integer not null,
  created_at          timestamptz not null default now()
);

alter table public.cuentas_sistema enable row level security;
revoke all on public.cuentas_sistema from anon, authenticated;

-- ─── Fondeo testnet: una fila por usuario ───────────────────────────────────
-- La clave primaria es el usuario: así "una sola vez por usuario" lo
-- garantiza la base de datos, no el código.
create table if not exists public.fondeos_testnet (
  usuario_id      uuid primary key references public.usuarios(id) on delete restrict,
  estado          text not null default 'en_proceso'
                    check (estado in ('en_proceso', 'completado')),
  paso            text not null default 'inicio'
                    check (paso in ('inicio', 'cuenta', 'trustline', 'pago_enviado', 'completado')),
  monto_usdc      numeric(20, 7) not null check (monto_usdc > 0),
  tx_trustline    text,
  -- Hash y sobre firmado del pago, guardados ANTES de enviarlo para que un
  -- reintento pueda verificar o reenviar el mismo sin pagar dos veces.
  tx_pago         text,
  pago_xdr        text,
  pago_vence_en   timestamptz,
  -- Lease contra dos peticiones simultáneas del mismo usuario.
  bloqueado_hasta timestamptz,
  error_code      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.fondeos_testnet enable row level security;
revoke all on public.fondeos_testnet from anon, authenticated;
