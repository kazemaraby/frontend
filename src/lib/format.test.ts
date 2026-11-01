import { describe, expect, it } from "vitest";

import { formatDate, formatDateRange, formatHijri, formatNumber, formatTime, formatTimeRange, parseDate } from "./format";

describe("money and numbers", () => {
  it("formats decimal strings exactly, never through a float", () => {
    expect(formatNumber("1000000.63", "en", 2)).toBe("1,000,000.63");
    expect(formatNumber("9007199254740993.10", "en", 2)).toBe("9,007,199,254,740,993.10"); // beyond float precision
    expect(formatNumber("0.10", "en", [0, 2])).toBe("0.1");
  });

  it("uses Western digits in Arabic, as the designs do", () => {
    expect(formatNumber("149735", "ar")).toBe("149,735");
    expect(formatNumber("43.12", "ar", [0, 2])).toBe("43.12");
  });
});

describe("dates", () => {
  it("parses ISO dates as local days (no UTC shift)", () => {
    const day = parseDate("2026-10-21");
    expect([day.getFullYear(), day.getMonth(), day.getDate()]).toEqual([2026, 9, 21]);
  });

  it("shows Gregorian dates in both languages", () => {
    expect(formatDate("2026-10-21", "ar")).toBe("21 أكتوبر 2026");
    expect(formatDate("2026-10-21", "en")).toBe("21 October 2026");
    expect(formatDate("2026-10-21", "ar", "monthYear")).toBe("أكتوبر 2026");
  });

  it("can show the Hijri date alongside (iqama and contract dates)", () => {
    expect(formatHijri("2026-10-21", "en")).toMatch(/1448 AH$/);
    expect(formatHijri("2026-10-21", "ar")).toMatch(/1448/);
  });

  it("formats ranges like the designs", () => {
    expect(formatDateRange("2026-10-19", "2026-10-29", "ar")).toBe("19 أكتوبر – 29 أكتوبر 2026");
    expect(formatDateRange("2026-12-28", "2027-01-03", "en")).toBe("28 December 2026 – 3 January 2027");
    expect(formatDateRange("2026-10-21", "2026-10-21", "en")).toBe("21 October 2026");
  });

  it("formats times with the Arabic day period", () => {
    expect(formatTime("08:30", "ar")).toBe("08:30 ص");
    expect(formatTime("16:00", "ar")).toBe("04:00 م");
    expect(formatTimeRange("08:00", "16:00", "en")).toMatch(/^08:00\s?am – 04:00\s?pm$/);
  });
});

describe("dates from the API", () => {
  it("formats plain dates and full timestamps", () => {
    expect(formatDate("2026-10-21", "en")).toBe("21 October 2026");
    expect(formatDate("2026-10-21T09:30:00+03:00", "en")).toBe("21 October 2026");
  });
});
