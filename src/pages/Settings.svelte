<script lang="ts">
  import { onMount } from "svelte";
  import Navigation from "../lib/Navigation.svelte";
  import Breadcrumbs from "../lib/Breadcrumbs.svelte";
  import { exportDatabase, importDatabase, clearDatabase } from "../lib/db";

  const LOCAL_STORAGE_KEYS = ["theme", "candidate-theme", "userSettings"] as const;

  interface Stats {
    questions: number;
    questionSets: number;
    candidates: number;
    sessions: number;
    storageUsed: string;
    storageQuota: string;
  }

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const gb = bytes / 1024 / 1024 / 1024;
    if (gb >= 1) return `${(Math.round(gb * 10) / 10).toLocaleString()} GB`;
    const mb = bytes / 1024 / 1024;
    if (mb >= 1) return `${(Math.round(mb * 10) / 10).toLocaleString()} MB`;
    const kb = bytes / 1024;
    return `${Math.round(kb)} KB`;
  };

  let stats = $state<Stats | null>(null);
  let statsError = $state<string | null>(null);
  let deleteConfirmInput = $state("");
  let fileInput: HTMLInputElement;
  let importError = $state<string | null>(null);
  let importSuccess = $state(false);
  let actionInProgress = $state(false);
  let showDangerZone = $state(false);

  const loadStats = async () => {
    try {
      const [dbData, storageEstimate] = await Promise.all([
        exportDatabase(),
        navigator.storage?.estimate?.() ?? Promise.resolve({ usage: 0, quota: 0 }),
      ]);
      stats = {
        questions: dbData["questions"]?.length ?? 0,
        questionSets: dbData["questionSets"]?.length ?? 0,
        candidates: dbData["candidates"]?.length ?? 0,
        sessions: dbData["sessions"]?.length ?? 0,
        storageUsed: formatBytes(storageEstimate.usage ?? 0),
        storageQuota: formatBytes(storageEstimate.quota ?? 0),
      };
    } catch (err) {
      statsError = err instanceof Error ? err.message : "Failed to load statistics";
    }
  };

  const clearUserPreferences = () => {
    LOCAL_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
    location.reload();
  };

  const exportBackup = async () => {
    actionInProgress = true;
    try {
      const dbData = await exportDatabase();
      const localStorageData: Record<string, string | null> = {};
      LOCAL_STORAGE_KEYS.forEach((key) => {
        localStorageData[key] = localStorage.getItem(key);
      });
      const backup = {
        version: 1,
        exportedAt: new Date().toISOString(),
        indexedDB: dbData,
        localStorage: localStorageData,
      };
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const dateStr = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `filipa-backup-${dateStr}.filipa`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      actionInProgress = false;
    }
  };

  const triggerImport = () => {
    importError = null;
    importSuccess = false;
    fileInput.click();
  };

  const handleImportFile = async (event: Event) => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    actionInProgress = true;
    importError = null;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data.indexedDB || !data.localStorage) {
        throw new Error("Invalid backup file format");
      }
      await importDatabase(data.indexedDB);
      LOCAL_STORAGE_KEYS.forEach((key) => {
        if (data.localStorage[key] != null) {
          localStorage.setItem(key, data.localStorage[key]);
        }
      });
      importSuccess = true;
      setTimeout(() => location.reload(), 1000);
    } catch (err) {
      importError = err instanceof Error ? err.message : "Failed to import backup";
    } finally {
      actionInProgress = false;
      input.value = "";
    }
  };

  const clearAllData = async () => {
    if (deleteConfirmInput !== "DELETE") return;
    actionInProgress = true;
    try {
      await clearDatabase();
      LOCAL_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
      location.reload();
    } finally {
      actionInProgress = false;
    }
  };

  onMount(() => {
    loadStats();
  });
</script>

<div class="page">
  <Navigation />
  <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Settings" }]} />

  <div class="page-content">
    <h1>Settings</h1>

    <section class="settings-section">
      <h2>Statistics</h2>
      {#if statsError}
        <p class="error">{statsError}</p>
      {:else if !stats}
        <p class="loading">Loading statistics…</p>
      {:else}
        <dl class="stats-grid">
          <dt>Questions</dt>
          <dd>{stats.questions}</dd>
          <dt>Question Sets</dt>
          <dd>{stats.questionSets}</dd>
          <dt>Candidates</dt>
          <dd>{stats.candidates}</dd>
          <dt>Sessions</dt>
          <dd>{stats.sessions}</dd>
          <dt>Storage Used</dt>
          <dd>{stats.storageUsed} / {stats.storageQuota}</dd>
        </dl>
      {/if}
    </section>

    <section class="settings-section">
      <h2>User Preferences</h2>
      <p>Resets theme selection and other user preferences stored in the browser.</p>
      <button class="secondary" onclick={clearUserPreferences}> Clear User Preferences </button>
    </section>

    <section class="settings-section">
      <h2>Backup &amp; Restore</h2>
      <p>Export all application data to a backup file or restore from a previous backup.</p>
      <div class="button-row">
        <button class="primary" onclick={exportBackup} disabled={actionInProgress}>
          Export Backup
        </button>
        <button class="secondary" onclick={triggerImport} disabled={actionInProgress}>
          Import Backup
        </button>
      </div>
      <input
        bind:this={fileInput}
        type="file"
        accept=".filipa"
        class="hidden-input"
        onchange={handleImportFile}
      />
      {#if importError}
        <p class="error">{importError}</p>
      {/if}
      {#if importSuccess}
        <p class="success">Backup imported successfully. Reloading…</p>
      {/if}
    </section>

    <button class="danger-zone-toggle" onclick={() => (showDangerZone = !showDangerZone)}>
      ⚠ Danger Zone
    </button>

    {#if showDangerZone}
      <section class="settings-section danger-zone">
        <h2>Danger Zone</h2>
        <p>
          Permanently deletes all application data including candidates, sessions, questions, and
          preferences. This action cannot be undone.
        </p>
        <div class="danger-confirm">
          <label for="delete-confirm">Type <strong>DELETE</strong> to confirm:</label>
          <input
            id="delete-confirm"
            type="text"
            bind:value={deleteConfirmInput}
            placeholder="DELETE"
            class="confirm-input"
          />
          <button
            class="danger"
            onclick={clearAllData}
            disabled={deleteConfirmInput !== "DELETE" || actionInProgress}
          >
            Clear All Application Data
          </button>
        </div>
      </section>
    {/if}
  </div>
</div>

<style>
  .page {
    width: 100%;
  }

  .page-content {
    padding: 2rem;
    max-width: 720px;
    margin: 0 auto;
  }

  h1 {
    font-size: 1.75rem;
    font-weight: 700;
    color: var(--color-primary);
    margin-bottom: 2rem;
  }

  .settings-section {
    background: #fff;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    padding: 1.5rem;
    margin-bottom: 1.5rem;
  }

  h2 {
    font-size: 1.1rem;
    font-weight: 600;
    margin-bottom: 0.75rem;
    color: #222;
  }

  p {
    color: #555;
    margin-bottom: 1rem;
    font-size: 0.95rem;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.4rem 1rem;
    margin: 0;
  }

  dt {
    color: var(--color-text-secondary);
    font-size: 0.9rem;
  }

  dd {
    font-weight: 600;
    color: #222;
    font-size: 0.9rem;
    margin: 0;
  }

  .button-row {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .hidden-input {
    display: none;
  }

  .error {
    color: #cc0000;
    font-size: 0.9rem;
    margin-top: 0.5rem;
    margin-bottom: 0;
  }

  .success {
    color: #007a00;
    font-size: 0.9rem;
    margin-top: 0.5rem;
    margin-bottom: 0;
  }

  .loading {
    color: #888;
    font-style: italic;
  }

  .danger-zone-toggle {
    background: none;
    border: 1px solid #cc0000;
    color: #cc0000;
    border-radius: 6px;
    padding: 0.5rem 1.25rem;
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    transition:
      background 0.2s,
      color 0.2s;
    margin-bottom: 1rem;
  }

  .danger-zone-toggle:hover {
    background: #fff0f0;
  }

  .danger-zone {
    border-color: #cc0000;
  }

  .danger-zone h2 {
    color: #cc0000;
  }

  .danger-confirm {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .danger-confirm label {
    font-size: 0.9rem;
    color: #555;
  }

  .confirm-input {
    width: 200px;
    padding: 0.4rem 0.75rem;
    border: 1px solid #ccc;
    border-radius: 6px;
    font-size: 0.9rem;
  }

  :global([data-theme="dark"]) .settings-section {
    background: #1e1e1e;
    border-color: var(--color-text);
  }

  :global([data-theme="dark"]) h1 {
    color: var(--color-primary-dark);
  }

  :global([data-theme="dark"]) h2 {
    color: #e0e0e0;
  }

  :global([data-theme="dark"]) p,
  :global([data-theme="dark"]) dt {
    color: var(--color-text-muted);
  }

  :global([data-theme="dark"]) dd {
    color: #e0e0e0;
  }

  :global([data-theme="dark"]) .confirm-input {
    background: var(--color-bg-dark-2);
    color: #e0e0e0;
    border-color: var(--color-border-dark);
  }

  :global([data-theme="dark"]) .danger-zone-toggle {
    border-color: #ff4444;
    color: #ff4444;
  }

  :global([data-theme="dark"]) .danger-zone-toggle:hover {
    background: #2a1010;
  }

  :global([data-theme="dark"]) .danger-zone {
    border-color: #ff4444;
  }

  :global([data-theme="dark"]) .danger-zone h2 {
    color: #ff4444;
  }

  :global([data-theme="dark"]) .danger-confirm label {
    color: var(--color-text-muted);
  }
</style>
