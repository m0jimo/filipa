// Singleton that persists across SessionInterview component remounts (e.g. switching sessions).
// Plain module-level variables survive component unmount/remount because ES modules are cached.
// The activeQuestionId uses $state so Svelte's reactivity picks up changes automatically.

let _sharedCandidateWindow: Window | null = null;

export const activeQuestionId = $state<{ value: string | null }>({ value: null });
export const activeSessionId = $state<{ value: string | null }>({ value: null });

export const getSharedCandidateWindow = (): Window | null => _sharedCandidateWindow;
export const setSharedCandidateWindow = (w: Window | null) => {
  _sharedCandidateWindow = w;
};

export const setActiveQuestion = (sessionId: string, questionId: string | null) => {
  activeSessionId.value = sessionId;
  activeQuestionId.value = questionId;
};

export const clearActiveQuestion = () => {
  activeSessionId.value = null;
  activeQuestionId.value = null;
};
