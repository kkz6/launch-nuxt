export type GhaStepsEmptyState = "waiting" | "unavailable" | null;

/**
 * Describe an empty GitHub Actions timeline without using the run URL as a
 * lifecycle signal. GitHub publishes that URL before jobs are discoverable,
 * so only an explicitly completed run is a terminal empty state.
 */
export const getGhaStepsEmptyState = (
  runStatus: string,
  jobCount: number,
): GhaStepsEmptyState => {
  if (jobCount > 0) return null;

  return runStatus.toLowerCase() === "completed" ? "unavailable" : "waiting";
};
