<script lang="ts">
  type Tab = {
    id: string;
    label: string;
    tabClass?: string;
  };

  let {
    tabs,
    activeTab = $bindable(),
    onTabChange,
    isTabActive,
    onClose,
  }: {
    tabs: Tab[];
    activeTab: string;
    onTabChange?: (id: string) => void;
    isTabActive?: (id: string) => boolean;
    onClose?: () => void;
  } = $props();

  const tabIsActive = (id: string) => isTabActive ? isTabActive(id) : activeTab === id;
</script>

<div class="tabs" role="tablist">
  {#each tabs as tab (tab.id)}
    <button
      type="button"
      role="tab"
      class="tab-btn {tab.tabClass ?? ''}"
      class:active={tabIsActive(tab.id)}
      aria-selected={tabIsActive(tab.id)}
      onclick={() => { activeTab = tab.id; onTabChange?.(tab.id); }}
    >
      {tab.label}
    </button>
  {/each}
  {#if onClose}
    <button
      type="button"
      class="tab-close"
      onclick={onClose}
      title="Collapse"
    >✕</button>
  {/if}
</div>

<style>
  .tabs {
    display: inline-flex;
    background: var(--color-bg-subtle);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    padding: 3px;
    gap: 2px;
    margin-bottom: 1.25rem;
  }

  .tab-btn {
    padding: 0.45rem 1.1rem;
    background: transparent;
    border: none;
    outline: 1px solid transparent;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.9rem;
    font-weight: 500;
    color: var(--color-text-secondary);
    transition: background 0.15s, color 0.15s, outline-color 0.15s;
    white-space: nowrap;
  }

  .tab-btn:hover:not(.active) {
    color: var(--color-text);
    background: rgba(0, 0, 0, 0.05);
  }

  .tab-btn.active {
    background: var(--color-bg);
    color: var(--color-primary);
    outline-color: var(--color-border);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
  }

  :global([data-theme="dark"]) .tabs {
    background: var(--color-bg-dark-2);
    border-color: var(--color-border-dark);
  }

  :global([data-theme="dark"]) .tab-btn {
    color: var(--color-text-muted);
  }

  :global([data-theme="dark"]) .tab-btn:hover:not(.active) {
    color: rgba(255, 255, 255, 0.87);
    background: rgba(255, 255, 255, 0.07);
  }

  :global([data-theme="dark"]) .tab-btn.active {
    background: var(--color-bg-dark-3);
    color: var(--color-primary-dark);
    outline-color: var(--color-border-dark);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
  }

  .tab-close {
    margin-left: auto;
    padding: 0.25rem 0.5rem;
    background: transparent;
    border: 1px solid transparent;
    cursor: pointer;
    font-size: 0.8rem;
    color: var(--color-text-secondary);
    border-radius: 6px;
    transition: all 0.15s;
  }

  .tab-close:hover {
    background: var(--color-bg);
    border-color: var(--color-border);
    color: var(--color-text);
  }

  :global([data-theme="dark"]) .tab-close {
    color: var(--color-text-muted);
  }

  :global([data-theme="dark"]) .tab-close:hover {
    background: var(--color-bg-dark-3);
    border-color: var(--color-border-dark);
    color: #ffffff;
  }
</style>
