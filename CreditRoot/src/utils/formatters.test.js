import { describe, it, expect } from "vitest";
import {
  formatCurrencyUsd,
  formatCurrencyMxn,
  formatPercentage,
} from "./formatters";

describe("formatCurrencyUsd", () => {
  it("formats 0 as $0", () => {
    expect(formatCurrencyUsd(0)).toBe("$0");
  });

  it("formats 1000 as $1,000", () => {
    expect(formatCurrencyUsd(1000)).toBe("$1,000");
  });

  it("formats 1234567 as $1,234,567", () => {
    expect(formatCurrencyUsd(1234567)).toBe("$1,234,567");
  });

  it("rounds fractional cents to whole dollars", () => {
    expect(formatCurrencyUsd(99.5)).toBe("$100");
    expect(formatCurrencyUsd(99.4)).toBe("$99");
  });

  it("handles negative values", () => {
    expect(formatCurrencyUsd(-500)).toBe("-$500");
  });

  it("handles decimal input (ignored by maximumFractionDigits: 0)", () => {
    expect(formatCurrencyUsd(1234.56)).toBe("$1,235");
  });
});

describe("formatCurrencyMxn", () => {
  it("formats 0 as $0", () => {
    expect(formatCurrencyMxn(0)).toBe("$0");
  });

  it("formats 1000 as $1,000", () => {
    expect(formatCurrencyMxn(1000)).toBe("$1,000");
  });

  it("formats 1234567 as $1,234,567", () => {
    expect(formatCurrencyMxn(1234567)).toBe("$1,234,567");
  });

  it("rounds fractional cents to whole pesos", () => {
    expect(formatCurrencyMxn(99.5)).toBe("$100");
    expect(formatCurrencyMxn(99.4)).toBe("$99");
  });

  it("handles negative values", () => {
    expect(formatCurrencyMxn(-500)).toBe("-$500");
  });
});

describe("formatPercentage", () => {
  it("formats 0 as 0.0%", () => {
    expect(formatPercentage(0)).toBe("0.0%");
  });

  it("formats whole numbers with one decimal", () => {
    expect(formatPercentage(50)).toBe("50.0%");
    expect(formatPercentage(100)).toBe("100.0%");
  });

  it("rounds to one decimal place", () => {
    expect(formatPercentage(33.333)).toBe("33.3%");
    expect(formatPercentage(66.666)).toBe("66.7%");
  });

  it("handles negative percentages", () => {
    expect(formatPercentage(-5)).toBe("-5.0%");
  });

  it("handles fractional percentages", () => {
    expect(formatPercentage(0.5)).toBe("0.5%");
    expect(formatPercentage(0.05)).toBe("0.1%");
  });
});

describe("formatter consistency", () => {
  it("USD and MXN produce same numeric format for equal values", () => {
    expect(formatCurrencyUsd(1000)).toBe(formatCurrencyMxn(1000));
  });

  it("percentage formatter adds % suffix", () => {
    const result = formatPercentage(25);
    expect(result).toContain("%");
    expect(result).not.toContain("$");
  });
});
