import { useState } from 'react'
import { AppHeader } from '../components/layout/AppHeader'
import { AppFooter } from '../components/layout/AppFooter'
import { LandingScreen } from '../screens/LandingScreen'
import { AuthScreen } from '../screens/AuthScreen'
import { HomeScreen } from '../screens/HomeScreen'
import { PlannerScreen } from '../screens/PlannerScreen'
import { DashboardScreen } from '../screens/DashboardScreen'
import { WithdrawalScreen } from '../screens/WithdrawalScreen'

export function AppShell() {
  const [pantalla, setPantalla] = useState('landing')
  const [usuario, setUsuario] = useState(null)

  function handleAuth(datos) {
    setUsuario(datos)
    setPantalla('app')
  }

  if (pantalla === 'landing') {
    return <LandingScreen onLogin={() => setPantalla('login')} onRegister={() => setPantalla('register')} />
  }

  if (pantalla === 'login' || pantalla === 'register') {
    return <AuthScreen modo={pantalla} onAuth={handleAuth} onVolver={() => setPantalla('landing')} />
  }

  return (
    <div className="app-shell">
      <AppHeader usuario={usuario} />
      <main>
        <HomeScreen />
        <PlannerScreen />
        <DashboardScreen />
        <WithdrawalScreen />
      </main>
      <AppFooter />
    </div>
  )
}
