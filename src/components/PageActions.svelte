<script lang="ts">
  interface Props {
    isReorderMode: boolean;
    onToggleReorder: () => void;
  }

  const { isReorderMode, onToggleReorder }: Props = $props();
</script>

<div class="page-actions">
  <button
    type="button"
    class="page-action-btn"
    class:active={isReorderMode}
    onclick={onToggleReorder}
    title={isReorderMode ? "Exit reorder mode (arrows will scroll normally)" : "Enter reorder mode (use ↑↓ to reorder selected question)"}
  >
    ⇅ Reorder
  </button>
</div>

<style>
  .page-actions {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .page-action-btn {
    padding: 0.35rem 0.75rem;
    font-size: 0.8rem;
    font-weight: 600;
    border: 1px solid var(--color-border, #ddd);
    border-radius: 4px;
    background: var(--color-bg-subtle, #f5f5f5);
    color: var(--color-text-secondary, #666);
    cursor: pointer;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
  }

  .page-action-btn:hover {
    border-color: var(--color-primary, #0066cc);
    color: var(--color-primary, #0066cc);
  }

  .page-action-btn.active {
    background: var(--color-primary, #0066cc);
    border-color: var(--color-primary, #0066cc);
    color: #fff;
  }

  :global([data-theme="dark"]) .page-action-btn {
    background: var(--color-bg-subtle, #2a2a2a);
    border-color: var(--color-border, #444);
    color: var(--color-text-secondary, #aaa);
  }

  :global([data-theme="dark"]) .page-action-btn.active {
    background: var(--color-primary, #4d9fff);
    border-color: var(--color-primary, #4d9fff);
    color: #fff;
  }
</style>
