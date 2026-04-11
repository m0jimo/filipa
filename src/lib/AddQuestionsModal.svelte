<script lang="ts">
  import { questionDB } from "./db";
  import { QuestionType, type Question } from "./types";
  import SessionModal from "./SessionModal.svelte";
  import MarkdownPreview from "../components/MarkdownPreview.svelte";
  import QuestionFilterPanel from "../components/QuestionFilterPanel.svelte";
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

  const handleConfirm = async () => {
    if (newlySelected.size === 0) return;
    try {
      confirming = true;
      await onConfirm(Array.from(newlySelected));
    } finally {
      confirming = false;
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
  <div>
    {#if loading}
      <p class="loading">Loading questions...</p>
    {:else}
      <!-- Filters -->
      {#key show}
        <QuestionFilterPanel
          bind:searchQuery
          bind:selectedTypes
          bind:selectedTags
          bind:selectedDifficulties
          bind:viewMode
          {allTags}
          {tagCounts}
          totalCount={questions.length}
          filteredCount={filteredQuestions.length}
          showDifficultyFilter={true}
          showViewToggle={true}
        />
      {/key}

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
  .select-all-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--color-text);
    cursor: pointer;
    user-select: none;
    margin-left: auto;
  }

  .select-all-label input[type="checkbox"] {
    cursor: pointer;
    width: 16px;
    height: 16px;
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
    border-color: var(--color-primary);
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
    background: var(--color-bg-subtle);
    color: var(--color-text-secondary);
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
    color: var(--color-text);
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
  :global([data-theme="dark"]) .select-all-label {
    color: #e0e0e0;
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
    background: var(--color-bg-dark-3);
    color: var(--color-text-muted);
  }

  :global([data-theme="dark"]) .already-badge {
    background: var(--color-bg-dark-3);
    color: #777;
  }

  :global([data-theme="dark"]) .questions-table tbody tr:hover:not(.already-in-set) {
    background: #1e1e1e;
  }

  :global([data-theme="dark"]) .col-question {
    color: #ddd;
  }

  :global([data-theme="dark"]) .picker-empty {
    color: var(--color-text-secondary);
  }
</style>
