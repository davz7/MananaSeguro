// src/app/AppShell.jsx
import { useCallback, useEffect, useState } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { LandingScreen } from '../screens/LandingScreen'
import { AuthScreen } from '../screens/AuthScreen'
import { SignInScreen } from '../screens/SignInScreen'
import { MainScreen } from '../screens/MainScreen'
import { PerfilMetaScreen } from '../screens/PerfilMetaScreen'
import { GoalEstablishedScreen } from '../screens/GoalEstablishedScreen'
import { IncentivesScreen } from '../screens/IncentivesScreen'
import { ProfileInfoScreen } from '../screens/ProfileInfoScreen'
import { QuickConnectScreen } from '../screens/QuickConnectScreen'
import { EmergencyWithdrawalScreen } from '../screens/EmergencyWithdrawalScreen'
import { SettingsScreen } from '../screens/SettingsScreen'
import { DataProfile } from '../screens/DataProfile'
import { DataAccount } from '../screens/DataAccount'
import { DepositsScreen } from '../screens/DepositsScreen'
import { AboutScreen } from '../screens/AboutScreen'
import {
  SESION_EXPIRADA_EVENT,
  expirarSesion,
  leerSesion,
  limpiarSesion,
  sesionVigente,
} from '../lib/api'

const USUARIO_KEY = 'ms_usuario'
const SESION_KEY = 'ms_sesion'

// El usuario guardado solo vale si su token sigue vigente. Si no, se limpia
// todo al arrancar: así nadie "parece" logueado con una sesión vencida.
function cargarUsuarioInicial() {
  try {
    if (!sesionVigente()) {
      localStorage.removeItem(USUARIO_KEY)
      limpiarSesion()
      return null
    }
    const stored = localStorage.getItem(USUARIO_KEY)
    return stored ? JSON.parse(stored) : null
  } catch {
    return null
  }
}

function guardarUsuario(usuario) {
  try {
    if (usuario) localStorage.setItem(USUARIO_KEY, JSON.stringify(usuario))
    else localStorage.removeItem(USUARIO_KEY)
  } catch { /* storage no disponible */ }
}

export function AppShell() {
  const navigate = useNavigate()
  const [usuario, setUsuario] = useState(cargarUsuarioInicial)

  // Sincroniza entre pestañas: si otra pestaña cierra sesión, esta también.
  useEffect(() => {
    function onStorage(e) {
      if (e.key === USUARIO_KEY) {
        try { setUsuario(e.newValue ? JSON.parse(e.newValue) : null) } catch { setUsuario(null) }
      }
      if (e.key === SESION_KEY && !e.newValue) setUsuario(null)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // Sesión expirada (401 de una API, o llegó la hora de expiresAt).
  useEffect(() => {
    function onSesionExpirada() {
      setUsuario(null)
      guardarUsuario(null)
      navigate('/signin', { replace: true, state: { sesionExpirada: true } })
    }
    window.addEventListener(SESION_EXPIRADA_EVENT, onSesionExpirada)
    return () => window.removeEventListener(SESION_EXPIRADA_EVENT, onSesionExpirada)
  }, [navigate])

  // Cierra la sesión justo cuando vence el token (24 h, sin refresh).
  useEffect(() => {
    if (!usuario) return
    const expiresAt = leerSesion()?.expiresAt
    if (!expiresAt) return
    const restante = new Date(expiresAt).getTime() - Date.now()
    if (restante <= 0) {
      expirarSesion()
      return
    }
    // setTimeout no acepta más de ~24.8 días
    const id = setTimeout(expirarSesion, Math.min(restante, 2 ** 31 - 1))
    return () => clearTimeout(id)
  }, [usuario])

  // Login con Google. Un usuario nuevo completa su registro; uno existente
  // va directo a su cuenta.
  const handleAuth = useCallback((datos, { esNuevo = false } = {}) => {
    setUsuario(datos)
    guardarUsuario(datos)
    navigate(esNuevo ? '/datos-personales' : '/main', { replace: true })
  }, [navigate])

  // Mezcla cambios en el usuario guardado (p. ej. kycStatus tras el KYC).
  const actualizarUsuario = useCallback((cambios) => {
    setUsuario((prev) => {
      if (!prev) return prev
      const siguiente = { ...prev, ...cambios }
      guardarUsuario(siguiente)
      return siguiente
    })
  }, [])

  function handleLogout() {
    setUsuario(null)
    guardarUsuario(null)
    limpiarSesion()
    navigate('/')
  }

  const estaAutenticado = !!usuario
  const privada = (elemento) => (estaAutenticado ? elemento : <Navigate to="/signin" replace />)
  const soloInvitado = (elemento) => (estaAutenticado ? <Navigate to="/main" replace /> : elemento)

  return (
    <Routes>
      {/*  Públicas  */}
      <Route path="/" element={
        <LandingScreen
          onLogin={() => navigate('/signin')}
          onRegister={() => navigate('/register')}
        />
      } />
      <Route path="/about" element={<AboutScreen />} />
      <Route path="/register" element={soloInvitado(
        <AuthScreen
          onVolver={() => navigate('/')}
          onAuth={handleAuth}
          onLogin={() => navigate('/signin')}
        />
      )} />
      <Route path="/signin" element={soloInvitado(
        <SignInScreen
          onAuth={handleAuth}
          onVolver={() => navigate('/')}
          onRegister={() => navigate('/register')}
        />
      )} />

      {/*  Registro (después del login con Google)  */}
      <Route path="/datos-personales" element={privada(<DataProfile usuario={usuario} />)} />
      <Route path="/perfil-meta" element={privada(<PerfilMetaScreen />)} />
      <Route path="/datos-cuenta" element={privada(<DataAccount />)} />
      <Route path="/conexion-rapida" element={privada(<QuickConnectScreen />)} />

      {/*  Regreso desde el KYC de Etherfuse  */}
      {/* etherfuse-onboarding redirige a {WEBHOOK_URL}/dashboard al terminar. */}
      <Route path="/dashboard" element={<Navigate to="/main?kyc=done" replace />} />

      {/*  App  */}
      <Route path="/main" element={privada(
        <MainScreen usuario={usuario} onLogout={handleLogout} onUsuarioActualizado={actualizarUsuario} />
      )} />
      <Route path="/deposits" element={privada(
        <DepositsScreen usuario={usuario} onUsuarioActualizado={actualizarUsuario} />
      )} />
      <Route path="/profile-info" element={privada(<ProfileInfoScreen />)} />
      <Route path="/settings" element={privada(<SettingsScreen usuario={usuario} onLogout={handleLogout} />)} />
      <Route path="/emergency" element={privada(<EmergencyWithdrawalScreen usuario={usuario} />)} />
      <Route path="/incentives" element={privada(<IncentivesScreen usuario={usuario} />)} />
      <Route path="/goal" element={privada(<GoalEstablishedScreen />)} />

      <Route path="/*" element={<Navigate to={estaAutenticado ? '/main' : '/signin'} replace />} />
    </Routes>
  )
}
