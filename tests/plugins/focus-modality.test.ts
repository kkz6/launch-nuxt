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

  it("does not show keyboard focus for modifiers or system shortcuts", async () => {
    const { installFocusModality } =
      await import("../../plugins/focus-modality.client");
    const cleanup = installFocusModality();

    for (const event of [
      { key: "Meta" },
      { key: "Shift" },
      { key: "Control" },
      { key: "Alt" },
      { key: "4", metaKey: true, shiftKey: true },
      { key: "c", ctrlKey: true },
      { key: "ArrowLeft", altKey: true },
    ]) {
      window.dispatchEvent(new KeyboardEvent("keydown", event));
      expect(document.documentElement.dataset.focusModality).toBe("pointer");
    }

    cleanup();
  });

  it("preserves keyboard navigation and activation after ignoring modifiers", async () => {
    const { installFocusModality } =
      await import("../../plugins/focus-modality.client");
    const cleanup = installFocusModality();

    for (const event of [
      { key: "Tab", shiftKey: true },
      { key: " " },
      { key: "Enter" },
      { key: "ArrowDown" },
    ]) {
      window.dispatchEvent(new Event("pointerdown"));
      window.dispatchEvent(new KeyboardEvent("keydown", event));
      expect(document.documentElement.dataset.focusModality).toBe("keyboard");
    }

    cleanup();
  });
});
