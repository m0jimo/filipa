<script lang="ts">
  import { QuestionType } from "../lib/types";

  let {
    searchQuery = $bindable(""),
    selectedTypes = $bindable<string[]>([]),
    selectedTags = $bindable<string[]>([]),
    selectedDifficulties = $bindable<number[]>([]),
    viewMode = $bindable<"cards" | "table">("cards"),
    allTags = [] as string[],
    tagCounts = {} as Record<string, number>,
    totalCount = 0,
    filteredCount = 0,
    showDifficultyFilter = true,
    showViewToggle = true,
  }: {
    searchQuery?: string;
    selectedTypes?: string[];
    selectedTags?: string[];
    selectedDifficulties?: number[];
    viewMode?: "cards" | "table";
    allTags?: string[];
    tagCounts?: Record<string, number>;
    totalCount?: number;
    filteredCount?: number;
    showDifficultyFilter?: boolean;
    showViewToggle?: boolean;
  } = $props();

  let showTypeDropdown = $state(false);
  let showDifficultyDropdown = $state(false);
  let tagSearch = $state("");
  let showAllTags = $state(false);

  const top10 = $derived(
    [...allTags].sort((a, b) => (tagCounts[b] ?? 0) - (tagCounts[a] ?? 0)).slice(0, 10).sort()
  );

  const displayedTags = $derived(
    (showAllTags || tagSearch ? allTags : top10).filter((t) =>
      t.toLowerCase().includes(tagSearch.toLowerCase())
    )
  );

  const hasActiveFilters = $derived(
    searchQuery !== "" ||
      selectedTypes.length > 0 ||
      selectedTags.length > 0 ||
      selectedDifficulties.length > 0
  );

  const toggleType = (type: string) => {
    selectedTypes = selectedTypes.includes(type)
      ? selectedTypes.filter((t) => t !== type)
      : [...selectedTypes, type];
  };

  const toggleTag = (tag: string) => {
    selectedTags = selectedTags.includes(tag)
      ? selectedTags.filter((t) => t !== tag)
      : [...selectedTags, tag];
  };

  const toggleDifficulty = (level: number) => {
    selectedDifficulties = selectedDifficulties.includes(level)
      ? selectedDifficulties.filter((d) => d !== level)
      : [...selectedDifficulties, level];
  };

  const clearFilters = () => {
    searchQuery = "";
    selectedTypes = [];
    selectedTags = [];
    selectedDifficulties = [];
  };

  const handleDocumentClick = (event: MouseEvent) => {
    const target = event.target as HTMLElement;
    if (!target.closest(".qfp-multiselect-container")) {
      showTypeDropdown = false;
      showDifficultyDropdown = false;
    }
  };
</script>

<svelte:document onclick={handleDocumentClick} />

<div class="qfp-filters">
  <div class="qfp-filter-row">
    <input
      type="text"
      bind:value={searchQuery}
      placeholder="Search questions..."
      class="qfp-search-input"
      autocomplete="off"
      data-lpignore="true"
      data-form-type="other"
    />

    <div class="qfp-multiselect-container">
      <button
        class="qfp-multiselect-trigger"
        onclick={() => {
          showTypeDropdown = !showTypeDropdown;
          showDifficultyDropdown = false;
        }}
        type="button"
      >
        {selectedTypes.length === 0 ? "All Types" : `${selectedTypes.length} selected`}
        <span class="qfp-dropdown-arrow">▼</span>
      </button>
      {#if showTypeDropdown}
        <div class="qfp-multiselect-dropdown">
          <label class="qfp-multiselect-option">
            <input
              type="checkbox"
              checked={selectedTypes.includes(QuestionType.Text)}
              onchange={() => toggleType(QuestionType.Text)}
            />
            <span>Text</span>
          </label>
          <label class="qfp-multiselect-option">
            <input
              type="checkbox"
              checked={selectedTypes.includes(QuestionType.Rating)}
              onchange={() => toggleType(QuestionType.Rating)}
            />
            <span>Rating</span>
          </label>
        </div>
      {/if}
    </div>

    {#if showDifficultyFilter}
      <div class="qfp-multiselect-container">
        <button
          class="qfp-multiselect-trigger"
          onclick={() => {
            showDifficultyDropdown = !showDifficultyDropdown;
            showTypeDropdown = false;
          }}
          type="button"
        >
          {selectedDifficulties.length === 0
            ? "All Levels"
            : [...selectedDifficulties].sort((a, b) => a - b).join(", ")}
          <span class="qfp-dropdown-arrow">▼</span>
        </button>
        {#if showDifficultyDropdown}
          <div class="qfp-multiselect-dropdown qfp-difficulty-dropdown">
            {#each [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as level (level)}
              <label class="qfp-multiselect-option">
                <input
                  type="checkbox"
                  checked={selectedDifficulties.includes(level)}
                  onchange={() => toggleDifficulty(level)}
                />
                <span>{level}</span>
              </label>
            {/each}
          </div>
        {/if}
      </div>
    {/if}

    {#if hasActiveFilters}
      <button onclick={clearFilters} class="qfp-clear-filters" type="button">Clear</button>
    {/if}

    <span class="qfp-results-count">{filteredCount} of {totalCount}</span>

    {#if showViewToggle}
      <div class="view-toggle">
        <button
          type="button"
          class="view-btn"
          class:active={viewMode === "cards"}
          onclick={() => (viewMode = "cards")}
          title="Card view">⊞</button
        >
        <button
          type="button"
          class="view-btn"
          class:active={viewMode === "table"}
          onclick={() => (viewMode = "table")}
          title="Table view">☰</button
        >
      </div>
    {/if}
  </div>

  {#if allTags.length > 0}
    <div class="qfp-tag-filter-row">
      <input
        type="text"
        class="qfp-tag-search-input"
        placeholder="Filter tags..."
        bind:value={tagSearch}
        autocomplete="off"
        data-lpignore="true"
        data-form-type="other"
      />
      <button
        type="button"
        class="qfp-tag-toggle-btn"
        onclick={() => (showAllTags = !showAllTags)}
      >
        {showAllTags ? "Show less" : `Show all ${allTags.length}`}
      </button>
      <div class="qfp-tag-chips">
        {#each displayedTags as tag (tag)}
          <button
            type="button"
            class="qfp-tag-chip"
            class:selected={selectedTags.includes(tag)}
            onclick={() => toggleTag(tag)}>{tag}</button
          >
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .qfp-filters {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-bottom: 1rem;
    padding: 1rem;
    background: var(--color-bg-subtle);
    border-radius: 8px;
  }

  .qfp-filter-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    align-items: center;
  }

  .qfp-search-input {
    padding: 0.5rem 1rem;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    font-size: 0.9rem;
    min-width: 200px;
    flex: 1;
  }

  .qfp-search-input:focus {
    outline: none;
    border-color: var(--color-primary);
  }

  .qfp-multiselect-container {
    position: relative;
  }

  .qfp-multiselect-trigger {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    font-size: 0.9rem;
    background: white;
    cursor: pointer;
    min-width: 130px;
    text-align: left;
  }

  .qfp-multiselect-trigger:hover {
    border-color: var(--color-primary);
  }

  .qfp-dropdown-arrow {
    font-size: 0.7rem;
    color: var(--color-text-secondary);
  }

  .qfp-multiselect-dropdown {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    background: white;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 1000;
    min-width: 150px;
  }

  .qfp-multiselect-option {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    cursor: pointer;
    user-select: none;
    transition: background 0.15s;
    font-size: 0.9rem;
  }

  .qfp-multiselect-option:hover {
    background: var(--color-bg-subtle);
  }

  .qfp-difficulty-dropdown {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    min-width: 200px;
  }

  .qfp-difficulty-dropdown .qfp-multiselect-option {
    justify-content: center;
    padding: 0.5rem 0.25rem;
  }

  .qfp-clear-filters {
    padding: 0.5rem 0.75rem;
    background: white;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.85rem;
    color: #555;
  }

  .qfp-clear-filters:hover {
    background: var(--color-bg-subtle);
    border-color: #aaa;
  }

  .qfp-results-count {
    color: var(--color-text-secondary);
    font-size: 0.85rem;
    font-weight: 500;
    white-space: nowrap;
  }

  .qfp-tag-filter-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
  }

  .qfp-tag-search-input {
    padding: 0.4rem 0.75rem;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    font-size: 0.85rem;
    width: 160px;
  }

  .qfp-tag-search-input:focus {
    outline: none;
    border-color: var(--color-primary);
  }

  .qfp-tag-toggle-btn {
    padding: 0.35rem 0.65rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-size: 0.8rem;
    background: white;
    cursor: pointer;
    color: #555;
    white-space: nowrap;
  }

  .qfp-tag-toggle-btn:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  .qfp-tag-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    flex: 1;
  }

  .qfp-tag-chip {
    padding: 0.2rem 0.6rem;
    border: 1px solid #ccc;
    border-radius: 12px;
    font-size: 0.8rem;
    background: white;
    cursor: pointer;
    transition:
      background 0.15s,
      border-color 0.15s,
      color 0.15s;
    color: var(--color-border-dark);
  }

  .qfp-tag-chip:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  .qfp-tag-chip.selected {
    background: var(--color-primary);
    border-color: var(--color-primary);
    color: white;
  }

  /* Dark mode */
  :global([data-theme="dark"]) .qfp-filters {
    background: var(--color-bg-dark-2);
  }

  :global([data-theme="dark"]) .qfp-search-input {
    background: var(--color-bg-dark);
    border-color: var(--color-border-dark);
    color: #ffffff;
  }

  :global([data-theme="dark"]) .qfp-multiselect-trigger {
    background: var(--color-bg-dark);
    border-color: var(--color-border-dark);
    color: #e0e0e0;
  }

  :global([data-theme="dark"]) .qfp-multiselect-dropdown {
    background: var(--color-bg-dark);
    border-color: var(--color-border-dark);
  }

  :global([data-theme="dark"]) .qfp-multiselect-option {
    color: #e0e0e0;
  }

  :global([data-theme="dark"]) .qfp-multiselect-option:hover {
    background: var(--color-bg-dark-2);
  }

  :global([data-theme="dark"]) .qfp-clear-filters {
    background: var(--color-bg-dark-2);
    border-color: #555;
    color: #ccc;
  }

  :global([data-theme="dark"]) .qfp-results-count {
    color: var(--color-text-muted);
  }

  :global([data-theme="dark"]) .qfp-tag-search-input {
    background: var(--color-bg-dark);
    border-color: var(--color-border-dark);
    color: #ffffff;
  }

  :global([data-theme="dark"]) .qfp-tag-toggle-btn {
    background: var(--color-bg-dark-2);
    border-color: #555;
    color: #ccc;
  }

  :global([data-theme="dark"]) .qfp-tag-chip {
    background: var(--color-bg-dark-2);
    border-color: #555;
    color: #ccc;
  }

  :global([data-theme="dark"]) .qfp-tag-chip.selected {
    background: var(--color-primary);
    border-color: var(--color-primary);
    color: white;
  }
</style>
