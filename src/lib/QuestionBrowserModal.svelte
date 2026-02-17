<script lang="ts">
  import type { Question } from "./types";
  import { QuestionType } from "./types";
  import { SvelteSet } from "svelte/reactivity";
  import SessionModal from "./SessionModal.svelte";

  let {
    show = false,
    questions,
    existingQuestionIds = [],
    onAdd,
    onClose,
  }: {
    show: boolean;
    questions: Question[];
    existingQuestionIds?: string[];
    onAdd: (question: Question) => void;
    onClose: () => void;
  } = $props();

  let searchQuery = $state("");
  let selectedTypes = $state<string[]>([]);
  let selectedTags = $state<string[]>([]);
  let showTypeDropdown = $state(false);
  let showTagDropdown = $state(false);

  const allTags = $derived(() => {
    const tagSet = new SvelteSet<string>();
    questions.forEach((q) => q.tags.forEach((tag) => tagSet.add(tag)));
    return Array.from(tagSet).sort();
  });

  const filteredQuestions = $derived(() => {
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

    if (selectedTypes.length > 0) {
      result = result.filter((q) => selectedTypes.includes(q.questionType));
    }

    if (selectedTags.length > 0) {
      result = result.filter((q) => q.tags.some((tag) => selectedTags.includes(tag)));
    }

    return result;
  });

  function toggleType(type: string) {
    if (selectedTypes.includes(type)) {
      selectedTypes = selectedTypes.filter((t) => t !== type);
    } else {
      selectedTypes = [...selectedTypes, type];
    }
  }

  function toggleTag(tag: string) {
    if (selectedTags.includes(tag)) {
      selectedTags = selectedTags.filter((t) => t !== tag);
    } else {
      selectedTags = [...selectedTags, tag];
    }
  }

  function clearFilters() {
    searchQuery = "";
    selectedTypes = [];
    selectedTags = [];
  }

  function handleWindowClick(event: MouseEvent) {
    if (!(event.target as HTMLElement).closest(".multiselect-container")) {
      showTypeDropdown = false;
      showTagDropdown = false;
    }
  }
</script>

<svelte:window onclick={handleWindowClick} />

<SessionModal {show} title="Add Questions from Catalog" size="large" onClose={onClose}>
  <div class="filters">
    <div class="filter-group">
      <input
        id="searchQuestionsBrowser"
        name="input-search-questions-browser"
        type="text"
        bind:value={searchQuery}
        placeholder="Search questions..."
        class="search-input"
        autocomplete="off"
        data-lpignore="true"
        data-form-type="other"
      />
    </div>

    <div class="filter-group multiselect-wrapper">
      <label>Type:</label>
      <div class="multiselect-container">
        <button
          class="multiselect-trigger"
          onclick={() => (showTypeDropdown = !showTypeDropdown)}
          type="button"
        >
          {selectedTypes.length === 0 ? "All Types" : `${selectedTypes.length} selected`}
          <span class="dropdown-arrow">&#9660;</span>
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

    <div class="filter-group multiselect-wrapper">
      <label>Tag:</label>
      <div class="multiselect-container">
        <button
          class="multiselect-trigger"
          onclick={() => (showTagDropdown = !showTagDropdown)}
          type="button"
        >
          {selectedTags.length === 0 ? "All Tags" : `${selectedTags.length} selected`}
          <span class="dropdown-arrow">&#9660;</span>
        </button>
        {#if showTagDropdown}
          <div class="multiselect-dropdown">
            {#if allTags().length === 0}
              <div class="multiselect-empty">No tags available</div>
            {:else}
              {#each allTags() as tag (tag)}
                <label class="multiselect-option">
                  <input
                    type="checkbox"
                    checked={selectedTags.includes(tag)}
                    onchange={() => toggleTag(tag)}
                  />
                  <span>{tag}</span>
                </label>
              {/each}
            {/if}
          </div>
        {/if}
      </div>
    </div>

    {#if searchQuery || selectedTypes.length > 0 || selectedTags.length > 0}
      <button type="button" onclick={clearFilters} class="clear-filters">Clear Filters</button>
    {/if}

    <div class="results-count">
      {filteredQuestions().length} of {questions.length} questions
    </div>
  </div>

  <div class="questions-grid">
    {#each filteredQuestions() as question (question.id)}
      <div class="question-card">
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
        </div>

        <div class="question-content">
          <h3>{question.question}</h3>
          {#if question.expectedAnswer}
            <details class="expected-answer">
              <summary>Expected Answer</summary>
              <p>{question.expectedAnswer}</p>
            </details>
          {/if}
        </div>

        {#if question.difficulty && question.difficulty.length > 0}
          <div class="rating-info">
            <small>Difficulty: {question.difficulty.join(", ")}</small>
          </div>
        {/if}

        <div class="card-actions">
          {#if existingQuestionIds.includes(question.id)}
            <button type="button" class="action-btn add" disabled> Already in session </button>
          {:else}
            <button type="button" onclick={() => onAdd(question)} class="action-btn add">
              + Add to Session
            </button>
          {/if}
        </div>
      </div>
    {/each}

    {#if filteredQuestions().length === 0}
      <div class="empty-state">
        <p>No questions found. Try adjusting your filters.</p>
      </div>
    {/if}
  </div>
</SessionModal>

<style>
  .filters {
    display: flex;
    gap: 1rem;
    align-items: center;
    margin-bottom: 1.5rem;
    padding: 1rem;
    background: #f5f5f5;
    border-radius: 8px;
    flex-wrap: wrap;
  }

  .filter-group {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .filter-group label {
    font-weight: 500;
    color: #666;
    font-size: 0.9rem;
  }

  .search-input {
    flex: 1;
    min-width: 200px;
    padding: 0.5rem 1rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 1rem;
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
    min-width: 150px;
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
    right: 0;
    background: white;
    border: 1px solid #ddd;
    border-radius: 4px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 1000;
    max-height: 250px;
    overflow-y: auto;
  }

  .multiselect-option {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    cursor: pointer;
    user-select: none;
    transition: background 0.15s;
  }

  .multiselect-option:hover {
    background: #f5f5f5;
  }

  .multiselect-option input[type="checkbox"] {
    cursor: pointer;
    margin: 0;
  }

  .multiselect-option span {
    flex: 1;
    font-size: 0.9rem;
  }

  .multiselect-empty {
    padding: 1rem;
    text-align: center;
    color: #999;
    font-size: 0.9rem;
  }

  .clear-filters {
    padding: 0.5rem 1rem;
    background: white;
    border: 1px solid #ddd;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.9rem;
  }

  .clear-filters:hover {
    background: #f5f5f5;
  }

  .results-count {
    color: #666;
    font-size: 0.9rem;
    font-weight: 500;
    margin-left: auto;
  }

  .questions-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 1.5rem;
    max-height: 60vh;
    overflow-y: auto;
    padding: 0.5rem;
  }

  .question-card {
    padding: 1.5rem;
    border: 1px solid #ddd;
    border-radius: 8px;
    background: white;
    transition: all 0.2s;
    display: flex;
    flex-direction: column;
    min-height: 280px;
  }

  .question-card:hover {
    border-color: #0066cc;
    box-shadow: 0 2px 8px rgba(0, 102, 204, 0.1);
  }

  .question-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1rem;
    gap: 1rem;
  }

  .question-type {
    padding: 0.25rem 0.75rem;
    background: #e3f2fd;
    color: #1976d2;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
  }

  .question-type.rating {
    background: #fff3e0;
    color: #f57c00;
  }

  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }

  .tag {
    padding: 0.25rem 0.5rem;
    background: #f5f5f5;
    color: #666;
    border-radius: 3px;
    font-size: 0.75rem;
  }

  .question-content {
    margin-bottom: 1rem;
  }

  .question-content h3 {
    margin: 0 0 0.5rem 0;
    color: #333;
    font-size: 1rem;
    line-height: 1.4;
  }

  .expected-answer {
    margin-top: 0.75rem;
  }

  .expected-answer summary {
    cursor: pointer;
    color: #0066cc;
    font-size: 0.85rem;
    font-weight: 500;
  }

  .expected-answer summary:hover {
    text-decoration: underline;
  }

  .expected-answer p {
    margin: 0.5rem 0 0 0;
    color: #666;
    font-size: 0.9rem;
    line-height: 1.5;
  }

  .rating-info {
    margin-bottom: 1rem;
    color: #666;
  }

  .card-actions {
    margin-top: auto;
    padding-top: 1rem;
    border-top: 1px solid #eee;
  }

  .action-btn {
    width: 100%;
    padding: 0.75rem 1rem;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.9rem;
    font-weight: 500;
    transition: all 0.2s;
  }

  .action-btn.add {
    background: #4caf50;
    color: white;
  }

  .action-btn.add:hover:not(:disabled) {
    background: #45a049;
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(76, 175, 80, 0.2);
  }

  .action-btn.add:disabled {
    background: #e0e0e0;
    color: #999;
    cursor: not-allowed;
  }

  .empty-state {
    grid-column: 1 / -1;
    text-align: center;
    padding: 3rem;
    color: #666;
  }

  :global([data-theme="dark"]) .filters {
    background: #2a2a2a;
  }

  :global([data-theme="dark"]) .filter-group label {
    color: #a0a0a0;
  }

  :global([data-theme="dark"]) .search-input {
    background: #1a1a1a;
    border-color: #444;
    color: #ffffff;
  }

  :global([data-theme="dark"]) .multiselect-trigger {
    background: #1a1a1a;
    border-color: #444;
    color: #ffffff;
  }

  :global([data-theme="dark"]) .multiselect-trigger:hover {
    border-color: #0066cc;
  }

  :global([data-theme="dark"]) .dropdown-arrow {
    color: #a0a0a0;
  }

  :global([data-theme="dark"]) .multiselect-dropdown {
    background: #1a1a1a;
    border-color: #444;
  }

  :global([data-theme="dark"]) .multiselect-option:hover {
    background: #2a2a2a;
  }

  :global([data-theme="dark"]) .multiselect-option span {
    color: #ffffff;
  }

  :global([data-theme="dark"]) .multiselect-empty {
    color: #666;
  }

  :global([data-theme="dark"]) .clear-filters {
    background: #3a3a3a;
    border-color: #555;
    color: #ffffff;
  }

  :global([data-theme="dark"]) .clear-filters:hover {
    background: #4a4a4a;
  }

  :global([data-theme="dark"]) .results-count {
    color: #a0a0a0;
  }

  :global([data-theme="dark"]) .question-card {
    background: #1a1a1a;
    border-color: #444;
  }

  :global([data-theme="dark"]) .question-card:hover {
    border-color: #4da3ff;
  }

  :global([data-theme="dark"]) .question-content h3 {
    color: #ffffff;
  }

  :global([data-theme="dark"]) .tag {
    background: #3a3a3a;
    color: #a0a0a0;
  }

  :global([data-theme="dark"]) .expected-answer p {
    color: #a0a0a0;
  }

  :global([data-theme="dark"]) .action-btn.add:disabled {
    background: #3a3a3a;
    color: #666;
  }

  :global([data-theme="dark"]) .empty-state {
    color: #a0a0a0;
  }
</style>
