// Singleton that persists across SessionInterview component remounts (e.g. switching sessions).
// A plain module-level variable survives component unmount/remount because ES modules are cached.
let _sharedCandidateWindow: Window | null = null;

export const getSharedCandidateWindow = (): Window | null => _sharedCandidateWindow;
export const setSharedCandidateWindow = (w: Window | null) => {
  _sharedCandidateWindow = w;
};
