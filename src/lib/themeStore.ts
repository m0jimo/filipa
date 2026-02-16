import { writable } from "svelte/store";

export type Theme = "light" | "dark";

function createThemeStore() {
  const { subscribe, set, update } = writable<Theme>("light");

  return {
    subscribe,
    set,
    toggle: () => {
      update((current) => {
        const newTheme = current === "light" ? "dark" : "light";
        localStorage.setItem("theme", newTheme);
        applyTheme(newTheme);
        return newTheme;
      });
    },
    initialize: () => {
      // Load theme from localStorage or use system preference
      const savedTheme = localStorage.getItem("theme");
      if (savedTheme === "dark" || savedTheme === "light") {
        set(savedTheme);
        applyTheme(savedTheme);
      } else {
        // Check system preference
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        const theme = prefersDark ? "dark" : "light";
        set(theme);
        applyTheme(theme);
      }
    },
  };
}

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
}

export const themeStore = createThemeStore();
