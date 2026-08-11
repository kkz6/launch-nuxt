export const installFocusModality = () => {
  const root = document.documentElement;
  const setKeyboard = () => {
    root.dataset.focusModality = "keyboard";
  };
  const setPointer = () => {
    root.dataset.focusModality = "pointer";
  };

  if (!root.dataset.focusModality) setPointer();

  window.addEventListener("keydown", setKeyboard, true);
  window.addEventListener("pointerdown", setPointer, true);

  return () => {
    window.removeEventListener("keydown", setKeyboard, true);
    window.removeEventListener("pointerdown", setPointer, true);
  };
};

export default defineNuxtPlugin(() => {
  const cleanup = installFocusModality();
  import.meta.hot?.dispose(cleanup);
});
