import { describe, expect, it } from "vitest";

import { amountToWords } from "./amountToWords";

describe("amountToWords", () => {
  it("handles zero", () => {
    expect(amountToWords(0)).toBe("Rupees Zero Only");
  });

  it("omits paise when there are none", () => {
    expect(amountToWords(500)).toBe("Rupees Five Hundred Only");
  });

  it("includes paise when present", () => {
    expect(amountToWords(161.78)).toBe("Rupees One Hundred Sixty One and Seventy Eight Paise Only");
  });

  it("handles thousands", () => {
    expect(amountToWords(1234)).toBe("Rupees One Thousand Two Hundred Thirty Four Only");
  });

  it("handles lakhs and crores with Indian grouping", () => {
    expect(amountToWords(12345678)).toBe(
      "Rupees One Crore Twenty Three Lakh Forty Five Thousand Six Hundred Seventy Eight Only",
    );
  });

  it("handles a value under twenty", () => {
    expect(amountToWords(7)).toBe("Rupees Seven Only");
  });

  it("handles paise at the top of the range", () => {
    expect(amountToWords(99.99)).toBe("Rupees Ninety Nine and Ninety Nine Paise Only");
  });
});
