import { writable } from "svelte/store";

const STORAGE_KEY = "userSettings";
const SESSION_VIEW_MODE_KEY = "questionViewMode";

export interface QuestionFilters {
  selectedTypes: string[];
  selectedTags: string[];
  selectedDifficulties: number[];
}

export type QuestionViewMode = "cards" | "table";
export type EditorViewMode = "raw" | "split" | "preview";

export interface UserSettings {
  questionFilters: QuestionFilters;
  questionViewMode: QuestionViewMode;
  editorViewModes: Record<string, EditorViewMode>;
}

const defaults: UserSettings = {
  questionFilters: {
    selectedTypes: [],
    selectedTags: [],
    selectedDifficulties: [],
  },
  questionViewMode: "cards",
  editorViewModes: {},
};

const VALID_EDITOR_MODES: EditorViewMode[] = ["raw", "split", "preview"];

const loadViewMode = (): QuestionViewMode => {
  const val = sessionStorage.getItem(SESSION_VIEW_MODE_KEY);
  return val === "table" ? "table" : "cards";
};

const saveViewMode = (mode: QuestionViewMode) => {
  sessionStorage.setItem(SESSION_VIEW_MODE_KEY, mode);
};

const load = (): UserSettings => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<UserSettings>) : {};
    const editorViewModes: Record<string, EditorViewMode> = {};
    if (parsed.editorViewModes && typeof parsed.editorViewModes === "object") {
      for (const [key, val] of Object.entries(parsed.editorViewModes)) {
        if (VALID_EDITOR_MODES.includes(val as EditorViewMode)) {
          editorViewModes[key] = val as EditorViewMode;
        }
      }
    }
    return {
      questionFilters: {
        selectedTypes: parsed.questionFilters?.selectedTypes ?? [],
        selectedTags: parsed.questionFilters?.selectedTags ?? [],
        selectedDifficulties: parsed.questionFilters?.selectedDifficulties ?? [],
      },
      questionViewMode: loadViewMode(),
      editorViewModes,
    };
  } catch {
    return structuredClone(defaults);
  }
};

const save = (settings: UserSettings) => {
  const { questionViewMode, ...rest } = settings;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rest));
  saveViewMode(questionViewMode);
};

const createUserSettingsStore = () => {
  const { subscribe, update, set } = writable<UserSettings>(load());

  return {
    subscribe,
    set: (settings: UserSettings) => {
      save(settings);
      set(settings);
    },
    update: (fn: (s: UserSettings) => UserSettings) => {
      update((current) => {
        const next = fn(current);
        save(next);
        return next;
      });
    },
    setQuestionFilters: (filters: Partial<QuestionFilters>) => {
      update((current) => {
        const next = {
          ...current,
          questionFilters: { ...current.questionFilters, ...filters },
        };
        save(next);
        return next;
      });
    },
    setQuestionViewMode: (mode: QuestionViewMode) => {
      saveViewMode(mode);
      update((current) => {
        const next = { ...current, questionViewMode: mode };
        save(next);
        return next;
      });
    },
    setEditorViewMode: (editorId: string, mode: EditorViewMode) => {
      update((current) => {
        const next = {
          ...current,
          editorViewModes: { ...current.editorViewModes, [editorId]: mode },
        };
        save(next);
        return next;
      });
    },
  };
};

export const userSettings = createUserSettingsStore();
