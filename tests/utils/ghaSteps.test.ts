import { describe, expect, it } from "vitest";

import { getGhaStepsEmptyState } from "~/utils/ghaSteps";

describe("getGhaStepsEmptyState", () => {
  it.each(["pending", "queued", "in_progress", "waiting_for_runner"])(
    "keeps an empty %s run in the waiting state",
    (status) => {
      expect(getGhaStepsEmptyState(status, 0)).toBe("waiting");
    },
  );

  it("marks only a completed empty run as unavailable", () => {
    expect(getGhaStepsEmptyState("completed", 0)).toBe("unavailable");
  });

  it("clears the empty state as soon as jobs arrive", () => {
    expect(getGhaStepsEmptyState("in_progress", 1)).toBeNull();
    expect(getGhaStepsEmptyState("completed", 1)).toBeNull();
  });
});
