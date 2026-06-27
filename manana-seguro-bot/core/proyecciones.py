USER_RATE = 4.7
PLATFORM_RATE = 1.0
CETES_RATE = 5.7
MIN_DEPOSIT = 2

MONTHS_PER_YEAR = 12
YEARS_PER_CYCLE = 5
MONTHS_PER_CYCLE = YEARS_PER_CYCLE * MONTHS_PER_YEAR
DEFAULT_INCENTIVE_PCT = 7
USD_TO_MXN_RATE = 17
SAFE_WITHDRAWAL_RATE = 0.04

INCENTIVE_SCENARIOS = {
    "solo_fidelidad":        {"label": "Solo fidelidad",                   "pct": 5},
    "fidelidad_constancia":  {"label": "Fidelidad + constancia ($20/mes)", "pct": 7},
    "fidelidad_1_referido":  {"label": "Fidelidad + 1 referido",           "pct": 6},
    "fidelidad_2_referidos": {"label": "Fidelidad + 2 referidos",          "pct": 7},
}


def calcular_proyeccion(mensual, anios, tasa=USER_RATE, incentivo_pct=DEFAULT_INCENTIVE_PCT):
    monthly_rate = tasa / 100 / MONTHS_PER_YEAR
    balance = 0.0
    total_yield = 0.0
    incentivos = 0.0

    for _ in range(anios // YEARS_PER_CYCLE):
        ciclo_yield = 0.0
        for _ in range(MONTHS_PER_CYCLE):
            interest = balance * monthly_rate
            balance += mensual + interest
            ciclo_yield += interest
            total_yield += interest
        inc = ciclo_yield * incentivo_pct / 100
        balance += inc
        incentivos += inc

    for _ in range((anios % YEARS_PER_CYCLE) * MONTHS_PER_YEAR):
        interest = balance * monthly_rate
        balance += mensual + interest
        total_yield += interest

    return {
        "balance_final":   round(balance, 2),
        "total_aportado":  round(mensual * anios * MONTHS_PER_YEAR, 2),
        "rendimiento":     round(total_yield, 2),
        "incentivos":      round(incentivos, 2),
        "en_pesos":        round(balance * USD_TO_MXN_RATE, 0),
        "ingreso_mensual": round(balance * SAFE_WITHDRAWAL_RATE / MONTHS_PER_YEAR, 2),
    }


def usd(n):
    return f"${n:,.2f} USDC"


def mxn(n):
    return f"${n:,.0f} pesos"
