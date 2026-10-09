import { describe, expect, it } from "vitest";

import { resolveTransition } from "./case-transitions";

describe("case transitions", () => {
  it("maps supported officer actions", () => {
    expect(resolveTransition("OPEN", "MARK_IN_FIELD")).toEqual({
      ok: true,
      transition: { cedar: "mark_in_field", status: "IN_FIELD" },
    });
    expect(resolveTransition("ACTION_TAKEN", "CLOSE")).toEqual({
      ok: true,
      transition: { cedar: "close", status: "CLOSED" },
    });
  });

  it("rejects unsupported actions", () => {
    expect(resolveTransition("OPEN", "DELETE")).toEqual({ ok: false, code: "invalid_action" });
  });

  it("makes CLOSED a terminal state", () => {
    for (const action of ["APPROVE", "CHANGE", "REJECT", "MARK_IN_FIELD", "RECORD_ACTION_TAKEN", "CLOSE"]) {
      expect(resolveTransition("CLOSED", action)).toEqual({ ok: false, code: "case_closed" });
    }
  });
});
