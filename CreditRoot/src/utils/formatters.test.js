import { describe, it, expect } from "vitest";
import {
  formatCurrencyUsd,
  formatCurrencyMxn,
  formatPercentage,
} from "./formatters";

describe("formatCurrencyUsd", () => {
  it("formats positive integers with dollar sign and thousands separator", () => {
    expect(formatCurrencyUsd(1234)).toBe("$1,234");
    expect(formatCurrencyUsd(1000)).toBe("$1,000");
    expect(formatCurrencyUsd(1000000)).toBe("$1,000,000");
  });

  it("formats zero correctly", () => {
    expect(formatCurrencyUsd(0)).toBe("$0");
  });

  it("formats negative values with dollar sign", () => {
    expect(formatCurrencyUsd(-500)).toBe("-$500");
  });

  it("formats large values correctly", () => {
    expect(formatCurrencyUsd(1234567)).toBe("$1,234,567");
  });
});

describe("formatCurrencyMxn", () => {
  it("formats positive integers with MXN symbol", () => {
    expect(formatCurrencyMxn(1234)).toContain("1,234");
    expect(formatCurrencyMxn(1000)).toContain("1,000");
  });

  it("formats zero correctly", () => {
    expect(formatCurrencyMxn(0)).toContain("$");
  });

  it("formats negative values", () => {
    const result = formatCurrencyMxn(-500);
    expect(result).toContain("500");
  });

  it("uses es-MX locale formatting", () => {
    const result = formatCurrencyMxn(10000);
    // es-MX uses "." as thousands separator for MXN
    expect(result).toMatch(/[\$MN]|MXN/);
  });
});

describe("formatPercentage", () => {
  it("formats with one decimal place", () => {
    expect(formatPercentage(4.7)).toBe("4.7%");
    expect(formatPercentage(5)).toBe("5.0%");
    expect(formatPercentage(10)).toBe("10.0%");
  });

  it("formats zero correctly", () => {
    expect(formatPercentage(0)).toBe("0.0%");
  });

  it("formats negative values", () => {
    expect(formatPercentage(-3.5)).toBe("-3.5%");
  });

  it("formats decimal values with rounding", () => {
    expect(formatPercentage(3.333)).toBe("3.3%");
    expect(formatPercentage(9.99)).toBe("10.0%");
  });
});
