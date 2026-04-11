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
    bodyRow: Snippet<[item: T, index: number, selected: boolean, moveUp: () => void, moveDown: () => void]>;
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
          {@render bodyRow(item, index, selectedIndex === index, () => handleMoveUp(index), () => handleMoveDown(index))}
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<style>
  .table-wrapper {
    box-sizing: border-box;
    width: 100%;
    overflow: hidden;
  }

</style>
