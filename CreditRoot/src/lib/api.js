// src/lib/api.js
//
// Cliente para las APIs protegidas del backend (metas, order-status,
// etherfuse-*). El backend exige el token de sesión que emite
// /api/auth/google en el header Authorization; sin él responde 401.

const SESION_KEY = 'ms_sesion'
export const SESION_EXPIRADA_EVENT = 'ms:sesion-expirada'

export function guardarSesion(sesion) {
  if (sesion?.token) localStorage.setItem(SESION_KEY, JSON.stringify(sesion))
}

export function limpiarSesion() {
  localStorage.removeItem(SESION_KEY)
}

function obtenerToken() {
  try {
    const sesion = JSON.parse(localStorage.getItem(SESION_KEY) || 'null')
    if (!sesion?.token) return null
    if (sesion.expiresAt && new Date(sesion.expiresAt) <= new Date()) return null
    return sesion.token
  } catch {
    return null
  }
}

/**
 * fetch con el token de sesión. Si el backend responde 401 la sesión ya no
 * sirve: se avisa a la app (AppShell) para que cierre sesión y mande al login.
 */
export async function apiFetch(url, options = {}) {
  const headers = new Headers(options.headers)
  const token = obtenerToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const res = await fetch(url, { ...options, headers })
  if (res.status === 401) {
    limpiarSesion()
    window.dispatchEvent(new Event(SESION_EXPIRADA_EVENT))
  }
  return res
}
