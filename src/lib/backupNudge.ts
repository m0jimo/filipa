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
 *
 * When autoSnapshot is enabled (default: true), the first markSignificantChange call
 * in a new nudge cycle triggers a DB snapshot automatically.
 */

import { writable, derived } from "svelte/store";
import { createSnapshot, pruneOldSnapshots } from "./db";

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

const readAutoSnapshotSettings = (): { autoSnapshot: boolean; maxSnapshots: number } => {
  try {
    const raw = localStorage.getItem("userSettings");
    const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    const autoSnapshot = parsed["autoSnapshot"] !== false;
    const rawMax = parsed["maxSnapshots"];
    const maxSnapshots = typeof rawMax === "number" && rawMax >= 1 && rawMax <= 2 ? rawMax : 2;
    return { autoSnapshot, maxSnapshots };
  } catch {
    return { autoSnapshot: true, maxSnapshots: 2 };
  }
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
    let shouldSnapshot = false;

    update((s) => {
      // Only snapshot on the first trigger of a new nudge cycle
      // (i.e. when we transition from "not nudging" to "nudging")
      const wasAlreadyNudging =
        s.lastSignificantAt !== null &&
        (s.lastBackupAt === null || s.lastSignificantAt > s.lastBackupAt);
      if (!wasAlreadyNudging) {
        shouldSnapshot = true;
      }
      const next = { ...s, lastSignificantAt: Date.now() };
      save(next);
      return next;
    });

    if (shouldSnapshot) {
      const { autoSnapshot, maxSnapshots } = readAutoSnapshotSettings();
      if (autoSnapshot) {
        createSnapshot()
          .then(() => pruneOldSnapshots(maxSnapshots))
          .catch((err) => console.warn("Auto-snapshot failed:", err));
      }
    }
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
