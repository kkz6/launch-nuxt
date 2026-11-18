/** Prevent late responses from publishing data into a different account or selection. */
export const createScopedRequest = (context: () => string) => {
  let generation = 0;
  let controller: AbortController | undefined;

  const cancel = () => {
    generation++;
    controller?.abort();
    controller = undefined;
  };

  const start = () => {
    cancel();
    controller = new AbortController();
    const current = controller;
    const version = generation;
    const scope = context();
    return {
      signal: current.signal,
      isCurrent: () =>
        !current.signal.aborted &&
        version === generation &&
        scope === context(),
    };
  };

  return { start, cancel };
};
