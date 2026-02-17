<script lang="ts">
  import { questionDB } from "./db";
  import { QuestionType, type Question } from "./types";
  import SessionModal from "./SessionModal.svelte";
  import MarkdownPreview from "../components/MarkdownPreview.svelte";
  import { SvelteSet } from "svelte/reactivity";

  let {
    show = false,
    existingQuestionIds = [],
    onClose,
    onConfirm,
  }: {
    show: boolean;
    existingQuestionIds: string[];
    onClose: () => void;
    onConfirm: (selectedIds: string[]) => Promise<void>;
  } = $props();

  let questions: Question[] = $state([]);
  let filteredQuestions: Question[] = $state([]);
  let loading = $state(false);
  let allTags: string[] = $state([]);
  let tagCounts: Record<string, number> = $state({});

  let searchQuery = $state("");
  let selectedTypes = $state<string[]>([]);
  let selectedTags = $state<string[]>([]);
  let selectedDifficulties = $state<number[]>([]);
  let showTypeDropdown = $state(false);
  let showDifficultyDropdown = $state(false);
  let tagSearch = $state("");
  let showAllTags = $state(false);
  let viewMode = $state<"cards" | "table">("cards");

  let newlySelected = $state(new SvelteSet<string>());
  let confirming = $state(false);

  const selectedCount = $derived(newlySelected.size);

  $effect(() => {
    if (show) {
      newlySelected = new SvelteSet();
      searchQuery = "";
      selectedTypes = [];
      selectedTags = [];
      selectedDifficulties = [];
      tagSearch = "";
      showAllTags = false;
      loadQuestions();
    }
  });

  const loadQuestions = async () => {
    loading = true;
    try {
      const all = await questionDB.list();
      all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      questions = all;
      const counts: Record<string, number> = {};
      all.forEach((q) =>
        q.tags.forEach((tag) => {
          counts[tag] = (counts[tag] ?? 0) + 1;
        })
      );
      tagCounts = counts;
      allTags = Object.keys(counts).sort();
      applyFilters();
    } finally {
      loading = false;
    }
  };

  const applyFilters = () => {
    let result = [...questions];
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (q) =>
          q.question.toLowerCase().includes(query) ||
          q.expectedAnswer.toLowerCase().includes(query) ||
          q.tags.some((tag) => tag.toLowerCase().includes(query))
      );
    }
    if (selectedTypes.length > 0)
      result = result.filter((q) => selectedTypes.includes(q.questionType));
    if (selectedTags.length > 0)
      result = result.filter((q) => q.tags.some((tag) => selectedTags.includes(tag)));
    if (selectedDifficulties.length > 0)
      result = result.filter((q) => q.difficulty?.some((d) => selectedDifficulties.includes(d)));
    filteredQuestions = result;
  };

  $effect(() => {
    void searchQuery;
    void selectedTypes;
    void selectedTags;
    void selectedDifficulties;
    if (questions.length > 0) applyFilters();
  });

  const isAlreadyInSet = (id: string): boolean => existingQuestionIds.includes(id);
  const isSelected = (id: string): boolean => isAlreadyInSet(id) || newlySelected.has(id);

  const toggleSelection = (id: string) => {
    if (isAlreadyInSet(id)) return;
    const next = new SvelteSet(newlySelected);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    newlySelected = next;
  };

  const toggleSelectAllVisible = () => {
    const eligible = filteredQuestions.filter((q) => !isAlreadyInSet(q.id));
    const allEligibleSelected = eligible.every((q) => newlySelected.has(q.id));
    const next = new SvelteSet(newlySelected);
    if (allEligibleSelected) {
      eligible.forEach((q) => next.delete(q.id));
    } else {
      eligible.forEach((q) => next.add(q.id));
    }
    newlySelected = next;
  };

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

  const handleConfirm = async () => {
    if (newlySelected.size === 0) return;
    try {
      confirming = true;
      await onConfirm(Array.from(newlySelected));
    } finally {
      confirming = false;
    }
  };

  const handleClickOutside = (event: MouseEvent) => {
    const target = event.target as HTMLElement;
    if (!target.closest(".multiselect-container")) {
      showTypeDropdown = false;
      showDifficultyDropdown = false;
    }
  };

  const eligibleCount = $derived(filteredQuestions.filter((q) => !isAlreadyInSet(q.id)).length);
  const allEligibleSelected = $derived(
    eligibleCount > 0 &&
      filteredQuestions.filter((q) => !isAlreadyInSet(q.id)).every((q) => newlySelected.has(q.id))
  );

  const truncateWords = (text: string, max: number): string => {
    const words = text.trim().split(/\s+/);
    return words.length <= max ? text : words.slice(0, max).join(" ") + "…";
  };
</script>

<SessionModal {show} {onClose} title="Add Questions to Set" size="large">
  <div onclick={handleClickOutside}>
    {#if loading}
      <p class="loading">Loading questions...</p>
    {:else}
      <!-- Filters -->
      <div class="picker-filters">
        <div class="filter-row">
          <input
            type="text"
            bind:value={searchQuery}
            placeholder="Search questions..."
            class="search-input"
            autocomplete="off"
            data-lpignore="true"
            data-form-type="other"
          />

          <div class="multiselect-wrapper">
            <div class="multiselect-container">
              <button
                class="multiselect-trigger"
                onclick={() => {
                  showTypeDropdown = !showTypeDropdown;
                  showDifficultyDropdown = false;
                }}
                type="button"
              >
                {selectedTypes.length === 0 ? "All Types" : `${selectedTypes.length} selected`}
                <span class="dropdown-arrow">▼</span>
              </button>
              {#if showTypeDropdown}
                <div class="multiselect-dropdown">
                  <label class="multiselect-option">
                    <input
                      type="checkbox"
                      checked={selectedTypes.includes(QuestionType.Text)}
                      onchange={() => toggleType(QuestionType.Text)}
                    />
                    <span>Text</span>
                  </label>
                  <label class="multiselect-option">
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
          </div>

          <div class="multiselect-wrapper">
            <div class="multiselect-container">
              <button
                class="multiselect-trigger"
                onclick={() => {
                  showDifficultyDropdown = !showDifficultyDropdown;
                  showTypeDropdown = false;
                }}
                type="button"
              >
                {selectedDifficulties.length === 0
                  ? "All Levels"
                  : [...selectedDifficulties].sort((a, b) => a - b).join(", ")}
                <span class="dropdown-arrow">▼</span>
              </button>
              {#if showDifficultyDropdown}
                <div class="multiselect-dropdown difficulty-dropdown">
                  {#each [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as level (level)}
                    <label class="multiselect-option">
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
          </div>

          {#if searchQuery || selectedTypes.length > 0 || selectedTags.length > 0 || selectedDifficulties.length > 0}
            <button onclick={clearFilters} class="clear-filters" type="button">Clear</button>
          {/if}

          <span class="results-count">{filteredQuestions.length} of {questions.length}</span>

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

          {#if eligibleCount > 0}
            <label class="select-all-label">
              <input
                type="checkbox"
                checked={allEligibleSelected}
                onchange={toggleSelectAllVisible}
              />
              Select all
            </label>
          {/if}
        </div>

        {#if allTags.length > 0}
          {@const top10 = [...allTags]
            .sort((a, b) => (tagCounts[b] ?? 0) - (tagCounts[a] ?? 0))
            .slice(0, 10)
            .sort()}
          {@const filtered = (showAllTags || tagSearch ? allTags : top10).filter((t) =>
            t.toLowerCase().includes(tagSearch.toLowerCase())
          )}
          <div class="tag-filter-row">
            <input
              type="text"
              class="tag-search-input"
              placeholder="Filter tags..."
              bind:value={tagSearch}
              autocomplete="off"
              data-lpignore="true"
              data-form-type="other"
            />
            <button
              type="button"
              class="tag-toggle-btn"
              onclick={() => (showAllTags = !showAllTags)}
            >
              {showAllTags ? "Show less" : `Show all ${allTags.length}`}
            </button>
            <div class="tag-chips">
              {#each filtered as tag (tag)}
                <button
                  type="button"
                  class="tag-chip"
                  class:selected={selectedTags.includes(tag)}
                  onclick={() => toggleTag(tag)}>{tag}</button
                >
              {/each}
            </div>
          </div>
        {/if}
      </div>

      <!-- Question list -->
      {#if filteredQuestions.length === 0}
        <p class="picker-empty">No questions match your filters.</p>
      {:else if viewMode === "cards"}
        <div class="picker-grid">
          {#each filteredQuestions as question (question.id)}
            {@const alreadyIn = isAlreadyInSet(question.id)}
            {@const selected = isSelected(question.id)}
            <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
            <div
              class="question-card picker-card"
              class:selected={selected && !alreadyIn}
              class:already-in-set={alreadyIn}
              onclick={() => toggleSelection(question.id)}
            >
              <div class="question-header">
                <span
                  class="question-type"
                  class:rating={question.questionType === QuestionType.Rating}
                >
                  {question.questionType}
                </span>
                {#if question.tags.length > 0}
                  <div class="tags">
                    {#each question.tags as tag (tag)}
                      <span class="tag">{tag}</span>
                    {/each}
                  </div>
                {/if}
                {#if alreadyIn}
                  <span class="already-badge">Already in set</span>
                {:else}
                  <input
                    type="checkbox"
                    class="question-select"
                    checked={selected}
                    onchange={() => toggleSelection(question.id)}
                    onclick={(e) => e.stopPropagation()}
                  />
                {/if}
              </div>
              <div class="question-text">
                <MarkdownPreview md={question.question} />
              </div>
              {#if question.difficulty && question.difficulty.length > 0}
                <div class="rating-info">
                  <small>Difficulty: {question.difficulty.join(", ")}</small>
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {:else}
        <div class="picker-table-wrap">
          <table class="questions-table">
            <thead>
              <tr>
                <th class="col-check">
                  <input
                    type="checkbox"
                    checked={allEligibleSelected}
                    onchange={toggleSelectAllVisible}
                    title="Select all eligible"
                  />
                </th>
                <th class="col-type">Type</th>
                <th class="col-difficulty">Difficulty</th>
                <th class="col-question">Question</th>
                <th class="col-status"></th>
              </tr>
            </thead>
            <tbody>
              {#each filteredQuestions as question (question.id)}
                {@const alreadyIn = isAlreadyInSet(question.id)}
                {@const selected = isSelected(question.id)}
                <tr
                  class:selected={selected && !alreadyIn}
                  class:already-in-set={alreadyIn}
                  onclick={() => toggleSelection(question.id)}
                >
                  <td class="col-check">
                    <input
                      type="checkbox"
                      checked={selected}
                      disabled={alreadyIn}
                      onchange={() => toggleSelection(question.id)}
                      onclick={(e) => e.stopPropagation()}
                    />
                  </td>
                  <td class="col-type">
                    <span
                      class="question-type"
                      class:rating={question.questionType === QuestionType.Rating}
                    >
                      {question.questionType}
                    </span>
                  </td>
                  <td class="col-difficulty">
                    {#if question.difficulty && question.difficulty.length > 0}
                      {question.difficulty.join(", ")}
                    {:else}
                      <span class="no-value">—</span>
                    {/if}
                  </td>
                  <td class="col-question">{truncateWords(question.question, 50)}</td>
                  <td class="col-status">
                    {#if alreadyIn}
                      <span class="already-badge">In set</span>
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}

      <div class="modal-actions">
        <button type="button" onclick={onClose} class="secondary" disabled={confirming}
          >Cancel</button
        >
        <button
          type="button"
          onclick={handleConfirm}
          class="primary"
          disabled={confirming || selectedCount === 0}
        >
          {confirming
            ? "Adding..."
            : selectedCount === 0
              ? "Select questions to add"
              : `Add ${selectedCount} Question${selectedCount !== 1 ? "s" : ""}`}
        </button>
      </div>
    {/if}
  </div>
</SessionModal>

<style>
  .picker-filters {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-bottom: 1rem;
    padding: 1rem;
    background: #f5f5f5;
    border-radius: 8px;
  }

  .filter-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    align-items: center;
  }

  .search-input {
    padding: 0.5rem 1rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 0.9rem;
    min-width: 200px;
    flex: 1;
  }

  .search-input:focus {
    outline: none;
    border-color: #0066cc;
  }

  .multiselect-wrapper {
    position: relative;
  }

  .multiselect-container {
    position: relative;
  }

  .multiselect-trigger {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 0.9rem;
    background: white;
    cursor: pointer;
    min-width: 130px;
    text-align: left;
  }

  .multiselect-trigger:hover {
    border-color: #0066cc;
  }

  .dropdown-arrow {
    font-size: 0.7rem;
    color: #666;
  }

  .multiselect-dropdown {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    background: white;
    border: 1px solid #ddd;
    border-radius: 4px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 1000;
    min-width: 150px;
  }

  .multiselect-option {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    cursor: pointer;
    user-select: none;
    transition: background 0.15s;
    font-size: 0.9rem;
  }

  .multiselect-option:hover {
    background: #f5f5f5;
  }

  .difficulty-dropdown {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    min-width: 200px;
  }

  .difficulty-dropdown .multiselect-option {
    justify-content: center;
    padding: 0.5rem 0.25rem;
  }

  .clear-filters {
    padding: 0.5rem 0.75rem;
    background: white;
    border: 1px solid #ddd;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.85rem;
    color: #555;
  }

  .clear-filters:hover {
    background: #f5f5f5;
    border-color: #aaa;
  }

  .results-count {
    color: #666;
    font-size: 0.85rem;
    font-weight: 500;
    white-space: nowrap;
  }

  .select-all-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.85rem;
    font-weight: 500;
    color: #333;
    cursor: pointer;
    user-select: none;
    margin-left: auto;
  }

  .select-all-label input[type="checkbox"] {
    cursor: pointer;
    width: 16px;
    height: 16px;
  }

  .tag-filter-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
  }

  .tag-search-input {
    padding: 0.4rem 0.75rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 0.85rem;
    width: 160px;
  }

  .tag-search-input:focus {
    outline: none;
    border-color: #0066cc;
  }

  .tag-toggle-btn {
    padding: 0.35rem 0.65rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-size: 0.8rem;
    background: white;
    cursor: pointer;
    color: #555;
    white-space: nowrap;
  }

  .tag-toggle-btn:hover {
    border-color: #0066cc;
    color: #0066cc;
  }

  .tag-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    flex: 1;
  }

  .tag-chip {
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
    color: #444;
  }

  .tag-chip:hover {
    border-color: #0066cc;
    color: #0066cc;
  }

  .tag-chip.selected {
    background: #0066cc;
    border-color: #0066cc;
    color: white;
  }

  .picker-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1rem;
    max-height: 45vh;
    overflow-y: auto;
    margin-bottom: 0.5rem;
  }

  .picker-card {
    cursor: pointer;
    user-select: none;
    min-height: unset;
    height: auto;
    transition:
      border-color 0.15s,
      box-shadow 0.15s;
  }

  .picker-card:hover:not(.already-in-set) {
    border-color: #0066cc;
    box-shadow: 0 2px 8px rgba(0, 102, 204, 0.1);
  }

  .picker-card.selected {
    border-color: #4caf50;
    background: #f1f8f4;
    box-shadow: 0 2px 8px rgba(76, 175, 80, 0.15);
  }

  .picker-card.already-in-set {
    opacity: 0.55;
    cursor: default;
  }

  .question-header {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
    flex-wrap: wrap;
  }

  .question-type {
    padding: 0.2rem 0.6rem;
    background: #e3f2fd;
    color: #1976d2;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    flex-shrink: 0;
  }

  .question-type.rating {
    background: #fff3e0;
    color: #f57c00;
  }

  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    flex: 1;
  }

  .tag {
    padding: 0.2rem 0.5rem;
    background: #f5f5f5;
    color: #666;
    border-radius: 3px;
    font-size: 0.75rem;
  }

  .already-badge {
    display: inline-block;
    padding: 0.2rem 0.5rem;
    background: #f0f0f0;
    color: #999;
    border-radius: 4px;
    font-size: 0.75rem;
    white-space: nowrap;
    margin-left: auto;
    flex-shrink: 0;
  }

  .question-select {
    cursor: pointer;
    width: 18px;
    height: 18px;
    flex-shrink: 0;
    margin-left: auto;
  }

  .question-text {
    font-size: 0.9rem;
    overflow: hidden;
    max-height: 80px;
    position: relative;
  }

  .question-text::after {
    content: "";
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 24px;
    background: linear-gradient(to bottom, transparent, white);
    pointer-events: none;
  }

  .picker-card.selected .question-text::after {
    background: linear-gradient(to bottom, transparent, #f1f8f4);
  }

  .picker-card.already-in-set .question-text::after {
    background: linear-gradient(to bottom, transparent, white);
  }

  .rating-info {
    margin-top: 0.5rem;
    color: #888;
    font-size: 0.8rem;
  }

  .picker-table-wrap {
    max-height: 45vh;
    overflow-y: auto;
    margin-bottom: 0.5rem;
  }

  .questions-table tbody tr {
    cursor: pointer;
  }

  .questions-table tbody tr.already-in-set {
    opacity: 0.55;
    cursor: default;
  }

  .col-check {
    width: 32px;
    text-align: center;
  }

  .col-type {
    width: 80px;
  }

  .col-difficulty {
    width: 80px;
    text-align: center;
  }

  .col-question {
    color: #333;
    max-width: 400px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .col-status {
    width: 70px;
    text-align: right;
  }

  .no-value {
    color: #bbb;
  }

  .picker-empty {
    padding: 2rem;
    text-align: center;
    color: #999;
  }

  /* Dark mode */
  :global([data-theme="dark"]) .picker-filters {
    background: #2a2a2a;
  }

  :global([data-theme="dark"]) .search-input {
    background: #1a1a1a;
    border-color: #444;
    color: #ffffff;
  }

  :global([data-theme="dark"]) .multiselect-trigger {
    background: #1a1a1a;
    border-color: #444;
    color: #e0e0e0;
  }

  :global([data-theme="dark"]) .multiselect-dropdown {
    background: #1a1a1a;
    border-color: #444;
  }

  :global([data-theme="dark"]) .multiselect-option {
    color: #e0e0e0;
  }

  :global([data-theme="dark"]) .multiselect-option:hover {
    background: #2a2a2a;
  }

  :global([data-theme="dark"]) .clear-filters {
    background: #2a2a2a;
    border-color: #555;
    color: #ccc;
  }

  :global([data-theme="dark"]) .results-count {
    color: #a0a0a0;
  }

  :global([data-theme="dark"]) .select-all-label {
    color: #e0e0e0;
  }

  :global([data-theme="dark"]) .tag-search-input {
    background: #1a1a1a;
    border-color: #444;
    color: #ffffff;
  }

  :global([data-theme="dark"]) .tag-toggle-btn {
    background: #2a2a2a;
    border-color: #555;
    color: #ccc;
  }

  :global([data-theme="dark"]) .tag-chip {
    background: #2a2a2a;
    border-color: #555;
    color: #ccc;
  }

  :global([data-theme="dark"]) .tag-chip.selected {
    background: #0066cc;
    border-color: #0066cc;
    color: white;
  }

  :global([data-theme="dark"]) .picker-card.selected {
    background: #2d3d2f;
    border-color: #4caf50;
  }

  :global([data-theme="dark"]) .picker-card.selected .question-text::after {
    background: linear-gradient(to bottom, transparent, #2d3d2f);
  }

  :global([data-theme="dark"]) .picker-card.already-in-set .question-text::after {
    background: linear-gradient(to bottom, transparent, #1a1a1a);
  }

  :global([data-theme="dark"]) .question-text::after {
    background: linear-gradient(to bottom, transparent, #1a1a1a);
  }

  :global([data-theme="dark"]) .tag {
    background: #333;
    color: #a0a0a0;
  }

  :global([data-theme="dark"]) .already-badge {
    background: #333;
    color: #777;
  }

  :global([data-theme="dark"]) .questions-table tbody tr:hover:not(.already-in-set) {
    background: #1e1e1e;
  }

  :global([data-theme="dark"]) .col-question {
    color: #ddd;
  }

  :global([data-theme="dark"]) .picker-empty {
    color: #666;
  }
</style>
