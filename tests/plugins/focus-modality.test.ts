import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("focus modality", () => {
  beforeEach(() => {
    document.documentElement.removeAttribute("data-focus-modality");
    vi.resetModules();
    vi.stubGlobal("defineNuxtPlugin", (setup: () => unknown) => setup);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps pointer focus quiet and enables keyboard focus", async () => {
    const { installFocusModality } =
      await import("../../plugins/focus-modality.client");
    const cleanup = installFocusModality();

    expect(document.documentElement.dataset.focusModality).toBe("pointer");

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab" }));
    expect(document.documentElement.dataset.focusModality).toBe("keyboard");

    window.dispatchEvent(new Event("pointerdown"));
    expect(document.documentElement.dataset.focusModality).toBe("pointer");

    cleanup();
  });
});
