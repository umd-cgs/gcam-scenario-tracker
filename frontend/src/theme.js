import { useState } from "react";

const STORAGE_KEY = "gcam-color-scheme";

export function initializeTheme() {
  let saved;
  try {
    saved = localStorage.getItem(STORAGE_KEY);
  } catch {
    // Theme switching still works when browser storage is unavailable.
  }
  const theme =
    saved === "light" || saved === "dark"
      ? saved
      : window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
  document.documentElement.dataset.theme = theme;
}

export function useTheme() {
  const [theme, setTheme] = useState(
    () => document.documentElement.dataset.theme || "light",
  );
  function toggleTheme() {
    const next = theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    setTheme(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Persistence is optional; do not interrupt the current session.
    }
  }
  return [theme, toggleTheme];
}
