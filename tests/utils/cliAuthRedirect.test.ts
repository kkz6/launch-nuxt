import { describe, expect, it } from "vitest";
import { cliAuthRedirect } from "../../utils/cliAuthRedirect";

describe("CLI authentication return path", () => {
  it("allows only the device approval page", () => {
    expect(cliAuthRedirect("/cli/auth")).toBe("/cli/auth");
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
  ])("rejects untrusted redirect %j", (value) => {
    expect(cliAuthRedirect(value)).toBeUndefined();
  });
});
