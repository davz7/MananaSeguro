import pytest

from bot import calcular_proyeccion


def test_carlos_scenario_projection_is_stable():
    result = calcular_proyeccion(25, 20)

    assert result["balance_final"] == pytest.approx(10269.15, abs=0.01)


def test_minimum_deposit_five_years():
    result = calcular_proyeccion(2, 5)

    assert result["balance_final"] == pytest.approx(136.02, abs=0.01)
    assert result["incentivos"] > 0


def test_maximum_deposit_forty_years():
    result = calcular_proyeccion(500, 40)

    assert result["balance_final"] == pytest.approx(761597.59, abs=0.01)
    assert result["balance_final"] > result["total_aportado"]


def test_total_aportado_formula_matches_input():
    mensual = 37.5
    anios = 13

    result = calcular_proyeccion(mensual, anios)

    assert result["total_aportado"] == pytest.approx(mensual * anios * 12, abs=0.01)


def test_zero_incentive_removes_incentive_amount():
    result = calcular_proyeccion(25, 20, incentivo_pct=0)

    assert result["incentivos"] == pytest.approx(0.0, abs=0.01)


def test_max_incentive_beats_zero_incentive_same_inputs():
    zero = calcular_proyeccion(25, 20, incentivo_pct=0)
    max_incentive = calcular_proyeccion(25, 20, incentivo_pct=9)

    assert max_incentive["incentivos"] > zero["incentivos"]
    assert max_incentive["balance_final"] > zero["balance_final"]


def test_projection_response_contains_expected_keys():
    result = calcular_proyeccion(25, 20)

    assert set(result.keys()) == {
        "balance_final",
        "total_aportado",
        "rendimiento",
        "incentivos",
        "en_pesos",
        "ingreso_mensual",
    }
