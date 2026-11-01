import { describe, expect, it } from "vitest";

import { ApiError } from "@/api";

import { routeErrors } from "./RouteEditorPage";

describe("routeErrors", () => {
  it("splits route fields from per-step errors", () => {
    const body = { priority: ["Taken."], steps: [{}, { role: ["Choose the role."] }] };
    const errors = routeErrors(new ApiError(400, body), "fallback");
    expect(errors.fields).toEqual({ priority: "Taken." });
    expect(errors.steps[1]).toEqual({ role: "Choose the role." });
    expect(errors.general).toBeNull();
  });

  it("keeps a message about the whole step list apart", () => {
    const errors = routeErrors(new ApiError(400, { steps: ["Add at least one step."] }), "fallback");
    expect(errors.stepsGeneral).toBe("Add at least one step.");
  });

  it("falls back when the error has no body", () => {
    expect(routeErrors(new Error("offline"), "fallback").general).toBe("fallback");
    expect(routeErrors(null, "fallback").general).toBeNull();
  });
});
