/**
 * Backup nudge store.
 *
 * Shows a "Backup" button in the header when there has been a significant data
 * change (answers recorded, questions imported) since the last manual backup export.
 *
 * Two timestamps are persisted in localStorage:
 *  - lastBackupAt      — when the user last exported a backup
 *  - lastSignificantAt — when a significant change last happened
 *
 * The button is shown when lastSignificantAt > lastBackupAt (or no backup exists yet).
 */

import { writable, derived } from "svelte/store";

const STORAGE_KEY = "backupNudge";

interface NudgeState {
  lastBackupAt: number | null;
  lastSignificantAt: number | null;
}


const load = (): NudgeState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<NudgeState>) : {};
    return {
      lastBackupAt: typeof parsed.lastBackupAt === "number" ? parsed.lastBackupAt : null,
      lastSignificantAt: typeof parsed.lastSignificantAt === "number" ? parsed.lastSignificantAt : null,
    };
  } catch {
    return { lastBackupAt: null, lastSignificantAt: null };
  }
};

const save = (state: NudgeState) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

const createBackupNudgeStore = () => {
  const { subscribe, update } = writable<NudgeState>(load());

  const markBackupDone = () => {
    update((s) => {
      const next = { ...s, lastBackupAt: Date.now() };
      save(next);
      return next;
    });
  };

  const markSignificantChange = () => {
    update((s) => {
      const next = { ...s, lastSignificantAt: Date.now() };
      save(next);
      return next;
    });
  };

  return { subscribe, markBackupDone, markSignificantChange };
};

export const backupNudge = createBackupNudgeStore();

/**
 * True when a significant change has happened since the last backup export
 * (or no backup has ever been exported).
 */
export const shouldShowBackupButton = derived(backupNudge, ($nudge) => {
  if ($nudge.lastSignificantAt === null) return false;
  if ($nudge.lastBackupAt === null) return true;
  return $nudge.lastSignificantAt > $nudge.lastBackupAt;
});
