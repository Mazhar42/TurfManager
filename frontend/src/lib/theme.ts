export type ThemePreference = "system" | "light" | "dark";

const KEY = "turf.theme";

export function getStoredTheme(): ThemePreference {
  const v = localStorage.getItem(KEY);
  return v === "light" || v === "dark" ? v : "system";
}

export function applyTheme(pref: ThemePreference): void {
  const root = document.documentElement;
  if (pref === "system") {
    root.removeAttribute("data-theme");
    localStorage.removeItem(KEY);
  } else {
    root.setAttribute("data-theme", pref);
    localStorage.setItem(KEY, pref);
  }
}

export function initTheme(): void {
  applyTheme(getStoredTheme());
}
