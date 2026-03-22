// ─── Mañana Seguro — Constantes del modelo de negocio ───────────────────────

export const MANANA_SEGURO_RATES = {
  cetesRate: 5.7,
  userRate: 4.7,
  platformRate: 1.0,
  platformRateFloor: 0.5,
  cetesFloorTrigger: 4.0,
  loanMaxPct: 0.30,
  loanMonthlyFee: 0.5,
  loanMaxMonths: 24,
  loanPenaltyPerMonth: 0.01,
  loanMinUserRate: 3.0,
  minDeposit: 2,
  constancyMinDeposit: 20,
}

// Incentivos cada 5 años — máximo 7%
export const INCENTIVE_SCENARIOS = [
  { key: 'solo_fidelidad',        label: 'Solo fidelidad',                    pct: 5, description: 'Mantienes tu ahorro sin retirar' },
  { key: 'fidelidad_constancia',  label: 'Fidelidad + constancia ($20/mes)',  pct: 7, description: '+$20 USDC mensuales mínimo' },
  { key: 'fidelidad_1_referido',  label: 'Fidelidad + 1 referido (6 meses)', pct: 6, description: '1 amigo activo 6 meses' },
  { key: 'fidelidad_2_referidos', label: 'Fidelidad + 2 referidos (6 meses)',pct: 7, description: '2 amigos activos 6 meses' },
]

export const plannerDefaults = {
  monthlyDepositUsd: 25,
  yearsToRetirement: 20,
  incentiveScenario: 'fidelidad_constancia',
}

export const retirementStats = [
  { label: 'Mexicanos sin pensión', value: '32M', caption: 'Trabajadores informales sin acceso al sistema tradicional.', tone: 'accent' },
  { label: 'Rendimiento vía Etherfuse', value: '4.7%', caption: 'APY en USDC que recibe el usuario. Respaldado por CETES.', tone: 'brand' },
  { label: 'Para empezar', value: '$2 USDC', caption: 'Depósito mínimo. Sin burocracia, sin banco, sin papeleo.', tone: 'green' },
]

export const retirementInsights = [
  'Mañana Seguro no sustituye la AFORE. La complementa con ahorro voluntario en USDC.',
  'Los fondos se bloquean en contrato inteligente hasta alcanzar tu meta.',
  'El flujo: depositar → bloquear → rendir → incentivos cada 5 años → retirar meta.',
]
