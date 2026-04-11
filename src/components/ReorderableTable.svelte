<script lang="ts" generics="T">
  import type { Snippet } from "svelte";

  let {
    items,
    onMoveUp,
    onMoveDown,
    headerRow,
    bodyRow,
    tableClass = "",
  }: {
    items: T[];
    onMoveUp: (index: number) => void;
    onMoveDown: (index: number) => void;
    headerRow: Snippet;
    bodyRow: Snippet<[item: T, index: number, selected: boolean]>;
    tableClass?: string;
  } = $props();

  let selectedIndex = $state<number | null>(null);

  const selectRow = (index: number) => {
    selectedIndex = index;
  };

  const handleMoveUp = (index: number) => {
    onMoveUp(index);
    selectedIndex = index - 1;
  };

  const handleMoveDown = (index: number) => {
    onMoveDown(index);
    selectedIndex = index + 1;
  };

  const handleKeydown = (e: KeyboardEvent) => {
    if (selectedIndex === null) return;
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (selectedIndex > 0) handleMoveUp(selectedIndex);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (selectedIndex < items.length - 1) handleMoveDown(selectedIndex);
    } else if (e.key === "Escape") {
      selectedIndex = null;
    }
  };
</script>

<div class="table-wrapper">
  <table
    class="questions-table {tableClass}"
    role="grid"
    tabindex="0"
    onkeydown={handleKeydown}
    onblur={() => (selectedIndex = null)}
  >
    <thead>
      {@render headerRow()}
    </thead>
    <tbody>
      {#each items as item, index}
        <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
        <tr
          class:selected={selectedIndex === index}
          onclick={() => selectRow(index)}
        >
          {@render bodyRow(item, index, selectedIndex === index)}
          <td class="col-reorder">
            <button
              type="button"
              class="reorder-btn"
              onclick={(e) => { e.stopPropagation(); handleMoveUp(index); }}
              disabled={index === 0}
              title="Move up"
            >▲</button>
            <button
              type="button"
              class="reorder-btn"
              onclick={(e) => { e.stopPropagation(); handleMoveDown(index); }}
              disabled={index === items.length - 1}
              title="Move down"
            >▼</button>
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<style>
  .table-wrapper {
    box-sizing: border-box;
    width: 100%;
  }

  .col-reorder {
    width: 80px;
    text-align: center;
    white-space: nowrap;
  }

  .reorder-btn {
    background: none;
    border: 1px solid var(--color-border);
    border-radius: 3px;
    padding: 0.2rem 0.5rem;
    cursor: pointer;
    font-size: 0.75rem;
    color: var(--color-text-secondary);
    line-height: 1;
    transition: background 0.15s, border-color 0.15s, color 0.15s;
  }

  .reorder-btn:hover:not(:disabled) {
    background: #f0f0f0;
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  .reorder-btn:disabled {
    opacity: 0.2;
    cursor: default;
  }

  :global([data-theme="dark"]) .reorder-btn {
    border-color: var(--color-border-dark);
    color: #888;
  }

  :global([data-theme="dark"]) .reorder-btn:hover:not(:disabled) {
    background: var(--color-bg-dark-2);
    border-color: #66aaff;
    color: #66aaff;
  }
</style>
