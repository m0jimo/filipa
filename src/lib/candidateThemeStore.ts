import { writable } from "svelte/store";

export type CandidateTheme = "light" | "dark";

function createCandidateThemeStore() {
  const { subscribe, set, update } = writable<CandidateTheme>("light");

  return {
    subscribe,
    set,
    toggle: () => {
      update((current) => {
        const newTheme = current === "light" ? "dark" : "light";
        localStorage.setItem("candidate-theme", newTheme);
        applyCandidateTheme(newTheme);
        return newTheme;
      });
    },
    initialize: () => {
      // Load theme from localStorage with a different key
      const savedTheme = localStorage.getItem("candidate-theme");
      if (savedTheme === "dark" || savedTheme === "light") {
        set(savedTheme);
        applyCandidateTheme(savedTheme);
      } else {
        // Check system preference as fallback
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        const theme = prefersDark ? "dark" : "light";
        set(theme);
        applyCandidateTheme(theme);
      }
    },
  };
}

function applyCandidateTheme(theme: CandidateTheme) {
  if (theme === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
}

export const candidateThemeStore = createCandidateThemeStore();
