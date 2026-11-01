import { describe, expect, it } from "vitest";

import { ApiError } from "@/api/client";

import { apiErrors } from "./apiErrors";

describe("apiErrors", () => {
  it("maps field errors and the general message", () => {
    const error = new ApiError(400, { iban: ["Bad IBAN"], id_number: ["Bad ID", "second"], detail: "Check the form" });
    expect(apiErrors(error, "fallback")).toEqual({
      fields: { iban: "Bad IBAN", id_number: "Bad ID" },
      general: "Check the form",
    });
  });

  it("uses the detail of a coded conflict and ignores the code", () => {
    expect(apiErrors(new ApiError(409, { code: "contract_conflict", detail: "Only a draft" }), "x")).toEqual({
      fields: {},
      general: "Only a draft",
    });
  });

  it("falls back when the body says nothing useful (network, 500)", () => {
    expect(apiErrors(new ApiError(500, undefined), "Try again").general).toBe("Try again");
    expect(apiErrors(new Error("boom"), "Try again").general).toBe("Try again");
    expect(apiErrors(null, "Try again")).toEqual({ fields: {}, general: null });
  });
});
