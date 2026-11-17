import { describe, expect, it } from "vitest";
import { authRedirect } from "../../utils/authRedirect";

describe("auth return paths", () => {
  it("allows the device approval page", () => {
    expect(authRedirect("/cli/auth")).toBe("/cli/auth");
  });

  it("returns to the requested server's provisioning status", () => {
    const path = "/servers?provision=01k123456789abcdefghjkmnpq";
    expect(authRedirect(path)).toBe(path);
  });

  it.each([
    undefined,
    null,
    ["/cli/auth"],
    "https://other.example",
    "//other.example",
    "/cli/auth?approve=true",
    "/dashboard",
    "/cli/auth/../other",
    "/servers?provision=../dashboard",
    "/servers?provision=01k123456789abcdefghjkmnpq&redirect=https://other.example",
    "//other.example/servers?provision=01k123456789abcdefghjkmnpq",
  ])("rejects untrusted redirect %j", (value) => {
    expect(authRedirect(value)).toBeUndefined();
  });
});
