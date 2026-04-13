<script lang="ts">
  import { onMount } from "svelte";
  import Router from "svelte-spa-router";
  import Home from "./pages/Home.svelte";
  import CandidateList from "./pages/CandidateList.svelte";
  import CandidateDetail from "./pages/CandidateDetail.svelte";
  import SessionInterview from "./pages/SessionInterview.svelte";
  import CandidateView from "./pages/CandidateView.svelte";
  import QuestionCatalog from "./pages/QuestionCatalog.svelte";
  import About from "./pages/About.svelte";
  import Settings from "./pages/Settings.svelte";
  import QuestionSetDetail from "./pages/QuestionSetDetail.svelte";
  import QuestionSets from "./pages/QuestionSets.svelte";
  import Help from "./pages/Help.svelte";
  import { themeStore } from "./lib/themeStore";
  import { initDB, openDBAtStoredVersion, exportFromDB, listSnapshots, restoreSnapshot } from "./lib/db";

  // DB_VERSION is the version this build knows about (from db.ts constant)
  const APP_DB_VERSION = 6;
  // Oldest DB version this build can migrate from (keep last 3 versions)
  const MIN_SUPPORTED_DB_VERSION = APP_DB_VERSION - 3;

  type DbErrorKind = "version-too-new" | "version-too-old" | "unknown";

  interface DbError {
    kind: DbErrorKind;
    storedVersion: number | null;
    message: string;
  }

  const routes = {
    "/": Home,
    "/candidates": CandidateList,
    "/questions": QuestionCatalog,
    "/candidate/:candidateId": CandidateDetail,
    "/session/:sessionId": SessionInterview,
    "/candidate-view": CandidateView,
    "/candidate-view/:sessionId": CandidateView,
    "/about": About,
    "/settings": Settings,
    "/question-sets": QuestionSets,
    "/question-sets/:setId": QuestionSetDetail,
    "/help": Help,
  };

  let dbError = $state<DbError | null>(null);
  let rescueExporting = $state(false);
  let rescueExported = $state(false);
  let rescueError = $state<string | null>(null);

  // Snapshot recovery
  let availableSnapshots = $state<string[]>([]);
  let snapshotRestoring = $state(false);
  let snapshotRestoreResult = $state<{ ok: boolean; message: string } | null>(null);

  const formatSnapshotDate = (name: string): string => {
    const prefix = "FilipaDB_snapshot_";
    const ts = name.slice(prefix.length).replace(/T(\d{2})-(\d{2})-(\d{2})-\d+Z$/, "T$1:$2:$3Z");
    try {
      return new Date(ts).toLocaleString();
    } catch {
      return name.slice(prefix.length);
    }
  };

  const handleRestoreSnapshot = async (name: string) => {
    snapshotRestoring = true;
    snapshotRestoreResult = null;
    try {
      await restoreSnapshot(name);
      snapshotRestoreResult = { ok: true, message: "Snapshot restored. Click \"Reload now\" to continue." };
    } catch (err) {
      snapshotRestoreResult = { ok: false, message: err instanceof Error ? err.message : "Restore failed" };
    } finally {
      snapshotRestoring = false;
    }
  };

  const extractStoredVersion = (errorMsg: string): number | null => {
    const match = errorMsg.match(/requested version \((\d+)\) is less than the existing version \((\d+)\)/i)
      ?? errorMsg.match(/existing version.*?(\d+)/i);
    if (match) {
      // "less than existing" → stored is the 2nd capture group
      const full = errorMsg.match(/requested version \((\d+)\) is less than the existing version \((\d+)\)/i);
      if (full) return parseInt(full[2], 10);
      return parseInt(match[1], 10);
    }
    return null;
  };

  const handleRescueExport = async () => {
    rescueExporting = true;
    rescueError = null;
    try {
      const db = await openDBAtStoredVersion();
      const data = await exportFromDB(db);
      db.close();
      const blob = new Blob([JSON.stringify({
        version: 1,
        exportedAt: new Date().toISOString(),
        indexedDB: data,
        localStorage: {},
      }, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `filipa-rescue-${new Date().toISOString().slice(0, 10)}.filipa`;
      a.click();
      URL.revokeObjectURL(url);
      rescueExported = true;
    } catch (err) {
      rescueError = err instanceof Error ? err.message : "Export failed";
    } finally {
      rescueExporting = false;
    }
  };

  onMount(async () => {
    themeStore.initialize();
    try {
      await initDB();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.startsWith("DB_VERSION_CONFLICT")) {
        const stored = extractStoredVersion(msg);
        if (stored !== null && stored > APP_DB_VERSION) {
          dbError = { kind: "version-too-new", storedVersion: stored, message: msg };
        } else if (stored !== null && stored < MIN_SUPPORTED_DB_VERSION) {
          dbError = { kind: "version-too-old", storedVersion: stored, message: msg };
        } else {
          dbError = { kind: "unknown", storedVersion: stored, message: msg };
        }
      } else {
        dbError = { kind: "unknown", storedVersion: null, message: msg };
      }
      // Load available snapshots to offer recovery
      try {
        availableSnapshots = await listSnapshots();
      } catch {
        availableSnapshots = [];
      }
    }
  });
</script>

{#if dbError}
  <div class="db-error-screen">
    <div class="db-error-card">
      <div class="db-error-icon">⚠</div>
      <h1>Cannot open your data</h1>

      {#if dbError.kind === "version-too-new"}
        <p class="db-error-lead">
          Your data was saved by a <strong>newer version of Filipa</strong> (database version {dbError.storedVersion})
          and cannot be opened by this build (version {APP_DB_VERSION}).
        </p>
        <ol class="db-error-steps">
          <li>
            <strong>Export your data now</strong> so you don't lose anything:
            <div class="rescue-export">
              <button class="primary" onclick={handleRescueExport} disabled={rescueExporting || rescueExported}>
                {rescueExporting ? "Exporting…" : rescueExported ? "Exported" : "Export data to file"}
              </button>
              {#if rescueError}<p class="rescue-error">{rescueError}</p>{/if}
              {#if rescueExported}<p class="rescue-ok">Saved as <em>filipa-rescue-*.filipa</em> — keep this file safe.</p>{/if}
            </div>
          </li>
          <li>
            <strong>Download the latest version</strong> of Filipa from
            <a href="https://github.com/m0jimo/filipa/releases" target="_blank" rel="noopener">github.com/m0jimo/filipa/releases</a>
            and open it instead of this file.
          </li>
          <li>
            Your exported <em>.filipa</em> file can be re-imported from <strong>Settings → Import Backup</strong>.
          </li>
        </ol>
      {:else if dbError.kind === "version-too-old"}
        <p class="db-error-lead">
          Your data (database version {dbError.storedVersion}) is too old to be automatically migrated
          by this build. This build supports migrations from version {MIN_SUPPORTED_DB_VERSION} and newer.
        </p>
        <ol class="db-error-steps">
          <li>
            <strong>Export your data now</strong> so you don't lose anything:
            <div class="rescue-export">
              <button class="primary" onclick={handleRescueExport} disabled={rescueExporting || rescueExported}>
                {rescueExporting ? "Exporting…" : rescueExported ? "Exported" : "Export data to file"}
              </button>
              {#if rescueError}<p class="rescue-error">{rescueError}</p>{/if}
              {#if rescueExported}<p class="rescue-ok">Saved as <em>filipa-rescue-*.filipa</em> — keep this file safe.</p>{/if}
            </div>
          </li>
          <li>
            Download <strong>Filipa v{dbError.storedVersion}.x</strong> from
            <a href="https://github.com/m0jimo/filipa/releases" target="_blank" rel="noopener">github.com/m0jimo/filipa/releases</a>
            to open your data with a compatible version.
          </li>
          <li>
            From that version, export a fresh backup, then re-import it into the latest Filipa.
          </li>
        </ol>
      {:else}
        <p class="db-error-lead">
          An unexpected error prevented Filipa from opening your database.
        </p>
        <ol class="db-error-steps">
          <li>
            Try <strong>refreshing the page</strong> (F5 / Cmd+R).
          </li>
          <li>
            If the problem persists, try to export your data:
            <div class="rescue-export">
              <button class="primary" onclick={handleRescueExport} disabled={rescueExporting || rescueExported}>
                {rescueExporting ? "Exporting…" : rescueExported ? "Exported" : "Export data to file"}
              </button>
              {#if rescueError}<p class="rescue-error">{rescueError}</p>{/if}
              {#if rescueExported}<p class="rescue-ok">Saved as <em>filipa-rescue-*.filipa</em></p>{/if}
            </div>
          </li>
          <li>
            Report the issue at
            <a href="https://github.com/m0jimo/filipa/issues" target="_blank" rel="noopener">github.com/m0jimo/filipa/issues</a>
            with the error detail below.
          </li>
        </ol>
        <details class="db-error-detail">
          <summary>Technical detail</summary>
          <code>{dbError.message}</code>
        </details>
      {/if}

      {#if availableSnapshots.length > 0}
        <div class="snapshot-recovery">
          <h2>Restore from snapshot</h2>
          <p>
            The following automatic snapshots are available. Restoring a snapshot will replace
            your current database with the snapshot data.
          </p>
          {#if snapshotRestoreResult}
            <p class:rescue-ok={snapshotRestoreResult.ok} class:rescue-error={!snapshotRestoreResult.ok}>
              {snapshotRestoreResult.message}
            </p>
            {#if snapshotRestoreResult.ok}
              <button class="primary" onclick={() => location.reload()}>Reload now</button>
            {/if}
          {:else}
            <ul class="snapshot-recovery-list">
              {#each availableSnapshots as name (name)}
                <li class="snapshot-recovery-item">
                  <span>Snapshot – {formatSnapshotDate(name)}</span>
                  <button
                    class="primary"
                    onclick={() => handleRestoreSnapshot(name)}
                    disabled={snapshotRestoring}
                  >
                    {snapshotRestoring ? "Restoring…" : "Restore this snapshot"}
                  </button>
                </li>
              {/each}
            </ul>
          {/if}
        </div>
      {/if}
    </div>
  </div>
{:else}
  <main>
    <Router {routes} />
  </main>
{/if}

<span class="app-version">v{__APP_VERSION__}</span>

<style>
  main {
    width: 100%;
    min-height: 100vh;
    background-color: inherit;
    color: inherit;
  }

  .app-version {
    position: fixed;
    bottom: 0.5rem;
    right: 0.75rem;
    font-size: 0.7rem;
    color: color-mix(in srgb, currentColor 30%, transparent);
    pointer-events: none;
    user-select: none;
    z-index: 9999;
  }

  .db-error-screen {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f5f5f5;
    padding: 2rem;
  }

  .db-error-card {
    background: #fff;
    border: 1px solid #e0e0e0;
    border-radius: 12px;
    padding: 2.5rem;
    max-width: 600px;
    width: 100%;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
  }

  .db-error-icon {
    font-size: 2.5rem;
    margin-bottom: 0.75rem;
  }

  .db-error-card h1 {
    font-size: 1.5rem;
    font-weight: 700;
    color: #cc0000;
    margin-bottom: 1rem;
  }

  .db-error-lead {
    color: #333;
    margin-bottom: 1.25rem;
    line-height: 1.6;
  }

  .db-error-steps {
    color: #333;
    line-height: 1.7;
    padding-left: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .db-error-steps a {
    color: #0066cc;
  }

  .rescue-export {
    margin-top: 0.5rem;
  }

  .rescue-error {
    color: #cc0000;
    font-size: 0.9rem;
    margin-top: 0.4rem;
  }

  .rescue-ok {
    color: #007a00;
    font-size: 0.9rem;
    margin-top: 0.4rem;
  }

  .db-error-detail {
    margin-top: 1.5rem;
    font-size: 0.85rem;
    color: #555;
  }

  .db-error-detail summary {
    cursor: pointer;
    color: #888;
    margin-bottom: 0.5rem;
  }

  .db-error-detail code {
    display: block;
    background: #f0f0f0;
    border-radius: 6px;
    padding: 0.75rem;
    word-break: break-all;
    font-size: 0.8rem;
    color: #333;
  }

  button.primary {
    background: var(--color-primary, #0066cc);
    color: #fff;
    border: none;
    border-radius: 6px;
    padding: 0.5rem 1.25rem;
    font-size: 0.95rem;
    font-weight: 500;
    cursor: pointer;
  }

  button.primary:disabled {
    opacity: 0.6;
    cursor: default;
  }

  .snapshot-recovery {
    margin-top: 2rem;
    padding-top: 1.5rem;
    border-top: 1px solid #e0e0e0;
  }

  .snapshot-recovery h2 {
    font-size: 1.1rem;
    font-weight: 600;
    color: #333;
    margin-bottom: 0.5rem;
  }

  .snapshot-recovery p {
    color: #555;
    font-size: 0.9rem;
    margin-bottom: 0.75rem;
  }

  .snapshot-recovery-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .snapshot-recovery-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.6rem 0.75rem;
    background: #f9f9f9;
    border: 1px solid #e0e0e0;
    border-radius: 6px;
    font-size: 0.9rem;
    color: #333;
    flex-wrap: wrap;
  }

  .snapshot-recovery-item button {
    flex-shrink: 0;
  }
</style>
