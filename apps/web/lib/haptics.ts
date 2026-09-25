// A light tap of haptic feedback for control presses. Android/Chrome has
// navigator.vibrate; iOS Safari doesn't, but since iOS 18 toggling a native
// <input type="checkbox" switch> plays the system "selection" haptic — so a
// throwaway, hidden one is clicked instead. Both are no-ops elsewhere, and
// both only work inside a user gesture (call this from a click handler).
export function haptic() {
  if (typeof window === "undefined") return;
  if (typeof navigator.vibrate === "function") {
    navigator.vibrate(10);
    return;
  }
  try {
    const label = document.createElement("label");
    label.ariaHidden = "true";
    label.style.display = "none";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.setAttribute("switch", "");
    label.appendChild(input);
    document.head.appendChild(label);
    label.click();
    label.remove();
  } catch {
    // Feedback is a nicety — never let it break the action it decorates.
  }
}
