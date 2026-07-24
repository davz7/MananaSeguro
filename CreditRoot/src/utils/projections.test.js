import { describe, it, expect } from "vitest";
import {
  calculateRetirementProjection,
  calculateCycles,
  calculateLoan,
} from "../utils/projections";

describe("calculateRetirementProjection", () => {
  it("returns correct projection for known inputs: $25/month, 20 years, 4.7% APY", () => {
    const result = calculateRetirementProjection({
      monthlyDepositUsd: 25,
      yearsToRetirement: 20,
      annualYieldRate: 4.7,
    });

    expect(result.investedAmount).toBe(6000);
    expect(result.projectedBalance).toBeGreaterThan(6000);
    expect(result.estimatedMonthlyIncome).toBeGreaterThan(0);
  });

  it("handles minimum deposit $2 with short period", () => {
    const result = calculateRetirementProjection({
      monthlyDepositUsd: 2,
      yearsToRetirement: 1,
      annualYieldRate: 4.7,
    });

    expect(result.investedAmount).toBe(24);
    expect(result.projectedBalance).toBeGreaterThanOrEqual(
      result.investedAmount,
    );
  });

  it("handles maximum years (40) with minimum deposit", () => {
    const result = calculateRetirementProjection({
      monthlyDepositUsd: 2,
      yearsToRetirement: 40,
      annualYieldRate: 4.7,
    });

    expect(result.investedAmount).toBe(960);
    expect(result.projectedBalance).toBeGreaterThan(result.investedAmount);
  });

  it("handles zero yield rate", () => {
    const result = calculateRetirementProjection({
      monthlyDepositUsd: 25,
      yearsToRetirement: 20,
      annualYieldRate: 0,
    });

    expect(result.investedAmount).toBe(6000);
    expect(result.projectedBalance).toBe(6000);
    expect(result.growthAmount).toBe(0);
    expect(result.estimatedMonthlyIncome).toBe(20);
  });

  it("calculates incentives for fidelity scenario (5-year cycles)", () => {
    const resultDefault = calculateRetirementProjection({
      monthlyDepositUsd: 25,
      yearsToRetirement: 5,
      annualYieldRate: 4.7,
      incentiveScenario: "solo_fidelidad",
    });

    expect(resultDefault.totalIncentives).toBeGreaterThan(0);
    expect(resultDefault.incentivePct).toBe(5);
  });

  it("calculates higher incentives for fidelidad_constancia (7%)", () => {
    const result = calculateRetirementProjection({
      monthlyDepositUsd: 25,
      yearsToRetirement: 10,
      annualYieldRate: 4.7,
      incentiveScenario: "fidelidad_constancia",
    });

    expect(result.incentivePct).toBe(7);
    expect(result.totalIncentives).toBeGreaterThan(0);
  });

  it("calculates incentives every 5-year cycle correctly", () => {
    const cycles5 = calculateCycles(25, 5, 4.7, 5);
    const cycles10 = calculateCycles(25, 10, 4.7, 5);
    const cycles15 = calculateCycles(25, 15, 4.7, 5);

    expect(cycles5).toHaveLength(1);
    expect(cycles10).toHaveLength(2);
    expect(cycles15).toHaveLength(3);

    cycles10.forEach((cycle, i) => {
      expect(cycle.cycle).toBe(i + 1);
      expect(cycle.incentiveAmount).toBeGreaterThan(0);
    });
  });

  it("returns correct structure with all required fields", () => {
    const result = calculateRetirementProjection({
      monthlyDepositUsd: 25,
      yearsToRetirement: 20,
      annualYieldRate: 4.7,
    });

    expect(result).toHaveProperty("investedAmount");
    expect(result).toHaveProperty("projectedBalance");
    expect(result).toHaveProperty("growthAmount");
    expect(result).toHaveProperty("estimatedMonthlyIncome");
    expect(result).toHaveProperty("totalIncentives");
    expect(result).toHaveProperty("incentivePct");
  });

  it("handles different referral incentive scenarios", () => {
    const result1Refer = calculateRetirementProjection({
      monthlyDepositUsd: 25,
      yearsToRetirement: 10,
      annualYieldRate: 4.7,
      incentiveScenario: "fidelidad_1_referido",
    });

    const result2Refer = calculateRetirementProjection({
      monthlyDepositUsd: 25,
      yearsToRetirement: 10,
      annualYieldRate: 4.7,
      incentiveScenario: "fidelidad_2_referidos",
    });

    expect(result1Refer.incentivePct).toBe(6);
    expect(result2Refer.incentivePct).toBe(7);
    expect(result2Refer.totalIncentives).toBeGreaterThanOrEqual(
      result1Refer.totalIncentives,
    );
  });
});

describe("calculateCycles", () => {
  it("handles zero yield rate (0% APY)", () => {
    const cycles = calculateCycles(25, 5, 0, 5);

    expect(cycles).toHaveLength(1);
    expect(cycles[0].totalYield).toBe(0);
    expect(cycles[0].startBalance).toBe(0);
    expect(cycles[0].endBalance).toBe(1500); // 25 * 60 months
    expect(cycles[0].incentiveAmount).toBe(0); // 0% of 0
  });

  it("handles typical CETES rate (~10% APY)", () => {
    const cycles = calculateCycles(100, 5, 10, 5);

    expect(cycles).toHaveLength(1);
    expect(cycles[0].totalYield).toBeGreaterThan(0);
    expect(cycles[0].incentiveAmount).toBeGreaterThan(0);
    // At 10%, 100/month for 5 years should yield substantial interest
    expect(cycles[0].endBalance).toBeGreaterThan(6000); // base 100*60 = 6000
  });

  it("handles edge case: 1 year period (no complete 5-year cycle)", () => {
    const cycles = calculateCycles(100, 1, 4.7, 5);

    expect(cycles).toHaveLength(0); // Less than 5 years = no complete cycles
  });

  it("handles edge case: exactly 40 years (8 complete 5-year cycles)", () => {
    const cycles = calculateCycles(50, 40, 4.7, 5);

    expect(cycles).toHaveLength(8);
    cycles.forEach((cycle, index) => {
      expect(cycle.cycle).toBe(index + 1);
      expect(cycle.yearStart).toBe(index * 5 + 1);
      expect(cycle.yearEnd).toBe((index + 1) * 5);
      expect(cycle.endBalance).toBeGreaterThan(cycle.startBalance);
    });
  });

  it("handles edge monthly amount: $40", () => {
    const cycles = calculateCycles(40, 10, 4.7, 5);

    expect(cycles).toHaveLength(2);
    expect(cycles[0].startBalance).toBe(0);
    // After first 5-year cycle with $40/month
    expect(cycles[0].endBalance).toBeGreaterThan(2400); // 40 * 60 months
  });

  it("handles edge monthly amount: $5,000", () => {
    const cycles = calculateCycles(5000, 10, 4.7, 5);

    expect(cycles).toHaveLength(2);
    // After first 5-year cycle with $5,000/month
    expect(cycles[0].endBalance).toBeGreaterThan(300000); // 5000 * 60 months
    expect(cycles[1].startBalance).toBe(cycles[0].endBalance);
  });

  it("correctly chains cycles (endBalance of cycle N = startBalance of cycle N+1)", () => {
    const cycles = calculateCycles(100, 15, 4.7, 5);

    expect(cycles).toHaveLength(3);
    expect(cycles[1].startBalance).toBe(cycles[0].endBalance);
    expect(cycles[2].startBalance).toBe(cycles[1].endBalance);
  });

  it("generates yearly breakdown for each cycle", () => {
    const cycles = calculateCycles(50, 10, 4.7, 5);

    expect(cycles).toHaveLength(2);
    cycles.forEach((cycle) => {
      expect(cycle.yearlyBreakdown).toHaveLength(5);
      cycle.yearlyBreakdown.forEach((year, idx) => {
        expect(year.year).toBe(idx + 1);
        expect(year.endBalance).toBeGreaterThan(0);
        expect(year.yearlyYield).toBeGreaterThanOrEqual(0); // Can be 0 in first month
      });
    });
  });

  it("applies incentive correctly based on incentive percentage", () => {
    const cycles5pct = calculateCycles(100, 5, 4.7, 5);
    const cycles7pct = calculateCycles(100, 5, 4.7, 7);

    // With same parameters except incentivePct, cycle 1 endBalance should differ
    // 7% incentive should add more than 5%
    expect(cycles7pct[0].endBalance).toBeGreaterThan(cycles5pct[0].endBalance);
  });

  it("handles multiple cycles with consistent structure", () => {
    const cycles = calculateCycles(75, 20, 6, 5);

    expect(cycles).toHaveLength(4);
    cycles.forEach((cycle, idx) => {
      expect(cycle).toHaveProperty("cycle", idx + 1);
      expect(cycle).toHaveProperty("yearStart");
      expect(cycle).toHaveProperty("yearEnd");
      expect(cycle).toHaveProperty("startBalance");
      expect(cycle).toHaveProperty("endBalance");
      expect(cycle).toHaveProperty("totalYield");
      expect(cycle).toHaveProperty("incentiveAmount");
      expect(cycle).toHaveProperty("yearlyBreakdown");
    });
  });
});

describe("calculateLoan", () => {
  it("calculates standard 30% loan correctly", () => {
    const lockedBalance = 10000;
    const requestedAmount = 5000;

    const loan = calculateLoan(lockedBalance, requestedAmount);

    expect(loan.maxLoan).toBe(3000); // 30% of 10000
    // Since requested > maxLoan, amount should be capped
    expect(loan.amount).toBe(3000);
  });

  it("respects max loan cap (30% of locked balance)", () => {
    const lockedBalance = 10000;
    const requestedAmount = 4000; // More than 30%

    const loan = calculateLoan(lockedBalance, requestedAmount);

    expect(loan.maxLoan).toBe(3000);
    expect(loan.amount).toBe(3000);
  });

  it("handles edge case: zero locked balance", () => {
    const loan = calculateLoan(0, 100);

    expect(loan.maxLoan).toBe(0);
    expect(loan.amount).toBe(0);
    expect(loan.monthlyPayment).toBe(0);
    expect(loan.totalFees).toBe(0);
    expect(loan.totalRepaid).toBe(0);
    expect(loan.schedule).toHaveLength(24);
  });

  it("handles edge case: maximum locked balance", () => {
    const maxBalance = 1000000; // 1 million
    const requestedAmount = 500000;

    const loan = calculateLoan(maxBalance, requestedAmount);

    expect(loan.maxLoan).toBe(300000); // 30% of 1,000,000
    expect(loan.amount).toBe(300000);
    expect(loan.monthlyPayment).toBeGreaterThan(0);
  });

  it("generates 24-month payment schedule", () => {
    const loan = calculateLoan(10000, 2000);

    expect(loan.schedule).toHaveLength(24);
    loan.schedule.forEach((payment, idx) => {
      expect(payment.month).toBe(idx + 1);
      expect(payment.payment).toBeGreaterThan(0);
      expect(payment.principal).toBeGreaterThan(0);
      expect(payment.fee).toBeGreaterThan(0);
      expect(payment.remaining).toBeGreaterThanOrEqual(0);
    });
  });

  it("correctly calculates total fees and repaid amount", () => {
    const loan = calculateLoan(10000, 2000);

    const sumFees = loan.schedule.reduce((sum, p) => sum + p.fee, 0);
    const sumPrincipal = loan.schedule.reduce((sum, p) => sum + p.principal, 0);

    expect(sumFees).toBeCloseTo(loan.totalFees, 2);
    expect(sumPrincipal).toBeCloseTo(loan.amount, 2);
    expect(loan.totalRepaid).toBeCloseTo(loan.amount + loan.totalFees, 2);
  });

  it("payments decrease as the balance goes down", () => {
      const loan = calculateLoan(20000, 4000);

      expect(loan.monthlyPayment).toBeCloseTo(loan.schedule[0].payment, 5);

      // El capital se recalcula sobre el saldo y meses restantes.
      loan.schedule.forEach((p, i) => {
        if (i > 0) {
          expect(p.payment).toBeLessThan(loan.schedule[i - 1].payment);
        }
      });
  });

  it("matches the contract schedule at stroop precision", () => {
    const expected = [
      [8333333, 1000000, 9333333, 191666668],
      [8333333, 958333, 9291666, 183333335],
      [8333333, 916666, 9249999, 175000002],
      [8333333, 875000, 9208333, 166666669],
      [8333333, 833333, 9166666, 158333336],
      [8333333, 791666, 9124999, 150000003],
      [8333333, 750000, 9083333, 141666670],
      [8333333, 708333, 9041666, 133333337],
      [8333333, 666666, 8999999, 125000004],
      [8333333, 625000, 8958333, 116666671],
      [8333333, 583333, 8916666, 108333338],
      [8333333, 541666, 8874999, 100000005],
      [8333333, 500000, 8833333, 91666672],
      [8333333, 458333, 8791666, 83333339],
      [8333333, 416666, 8749999, 75000006],
      [8333334, 375000, 8708334, 66666672],
      [8333334, 333333, 8666667, 58333338],
      [8333334, 291666, 8625000, 50000004],
      [8333334, 250000, 8583334, 41666670],
      [8333334, 208333, 8541667, 33333336],
      [8333334, 166666, 8500000, 25000002],
      [8333334, 125000, 8458334, 16666668],
      [8333334, 83333, 8416667, 8333334],
      [8333334, 41666, 8375000, 0],
    ];

    const loan = calculateLoan(100, 20.0000001);
    const actual = loan.schedule.map(({ principal, fee, payment, remaining }) => [
      principal,
      fee,
      payment,
      remaining,
    ].map(value => Math.round(value * 10_000_000)));

    expect(actual).toEqual(expected);
    expect(actual.reduce((sum, row) => sum + row[0], 0)).toBe(200000001);
    expect(actual.reduce((sum, row) => sum + row[1], 0)).toBe(12499992);
    expect(actual.reduce((sum, row) => sum + row[2], 0)).toBe(212499993);
    expect(Math.round(loan.totalFees * 10_000_000)).toBe(12499992);
    expect(Math.round(loan.totalRepaid * 10_000_000)).toBe(212499993);
  });

  it("ending balance correctly decreases to zero", () => {
    const loan = calculateLoan(15000, 3000);

    expect(
      loan.schedule[loan.schedule.length - 1].remaining,
    ).toBeLessThanOrEqual(0.01); // Allow tiny rounding error
  });

  it("handles small loan amount (minimum)", () => {
    const loan = calculateLoan(100, 20);

    expect(loan.amount).toBe(20);
    expect(loan.schedule).toHaveLength(24);
    expect(loan.totalRepaid).toBeGreaterThan(loan.amount); // With fees
  });

  it("returns correct loan structure with all fields", () => {
    const loan = calculateLoan(10000, 2000);

    expect(loan).toHaveProperty("amount");
    expect(loan).toHaveProperty("maxLoan");
    expect(loan).toHaveProperty("monthlyPayment");
    expect(loan).toHaveProperty("totalFees");
    expect(loan).toHaveProperty("totalRepaid");
    expect(loan).toHaveProperty("schedule");
  });
});
