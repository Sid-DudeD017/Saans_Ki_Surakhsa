import { describe, it, expect } from "vitest";
import { health } from "./health";

describe("health route", () => {
  it("returns 200 ok JSON", async () => {
    const res = await health();
    expect(res.statusCode).toBe(200);
    expect(res.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(res.body)).toEqual({ status: "ok" });
  });
});
