export const installFocusModality = () => {
  const root = document.documentElement;
  const setKeyboard = (event: KeyboardEvent) => {
    if (
      event.metaKey || event.ctrlKey || event.altKey ||
      ["Meta", "Control", "Alt", "Shift", "CapsLock", "NumLock", "ScrollLock"].includes(event.key)
    ) return;
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
