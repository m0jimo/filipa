<script lang="ts">
  import type { Question } from "./types";
  import { QuestionType } from "./types";
  import QuestionFilterPanel from "../components/QuestionFilterPanel.svelte";
  import MarkdownPreview from "../components/MarkdownPreview.svelte";
  import QuestionPreviewModal from "../components/QuestionPreviewModal.svelte";
  import { SvelteSet } from "svelte/reactivity";

  let previewQuestion = $state<Question | null>(null);

  let {
    questions,
    existingQuestionIds = [],
    onAdd,
    onClose,
  }: {
    questions: Question[];
    existingQuestionIds?: string[];
    onAdd: (question: Question) => void;
    onClose: () => void;
  } = $props();

  let searchQuery = $state("");
  let selectedTypes = $state<string[]>([]);
  let selectedTags = $state<string[]>([]);
  let selectedDifficulties = $state<number[]>([]);
  let viewMode = $state<"cards" | "table">("cards");
  let tableSelected = $state(new SvelteSet<string>());

  const allTagsComputed = $derived(() => {
    const counts: Record<string, number> = {};
    questions.forEach((q) => q.tags.forEach((tag) => { counts[tag] = (counts[tag] ?? 0) + 1; }));
    return { allTags: Object.keys(counts).sort(), tagCounts: counts };
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

    if (selectedDifficulties.length > 0) {
      result = result.filter((q) => q.difficulty?.some((d) => selectedDifficulties.includes(d)));
    }

    return result;
  });

  const eligibleInView = $derived(
    filteredQuestions().filter((q) => !existingQuestionIds.includes(q.id))
  );

  const allEligibleSelected = $derived(
    eligibleInView.length > 0 && eligibleInView.every((q) => tableSelected.has(q.id))
  );

  const toggleTableRow = (id: string) => {
    const next = new SvelteSet(tableSelected);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    tableSelected = next;
  };

  const toggleSelectAll = () => {
    const next = new SvelteSet(tableSelected);
    if (allEligibleSelected) {
      eligibleInView.forEach((q) => next.delete(q.id));
    } else {
      eligibleInView.forEach((q) => next.add(q.id));
    }
    tableSelected = next;
  };

  const addSelected = () => {
    const toAdd = questions.filter((q) => tableSelected.has(q.id));
    toAdd.forEach((q) => onAdd(q));
    tableSelected = new SvelteSet();
  };

  const truncateWords = (text: string, max: number): string => {
    const words = text.trim().split(/\s+/);
    return words.length <= max ? text : words.slice(0, max).join(" ") + "…";
  };
</script>

<QuestionFilterPanel
    bind:searchQuery
    bind:selectedTypes
    bind:selectedTags
    bind:selectedDifficulties
    bind:viewMode
    allTags={allTagsComputed().allTags}
    tagCounts={allTagsComputed().tagCounts}
    totalCount={questions.length}
    filteredCount={filteredQuestions().length}
    showDifficultyFilter={true}
    showViewToggle={true}
  />

  {#if filteredQuestions().length === 0}
    <div class="empty-state">
      <p>No questions found. Try adjusting your filters.</p>
    </div>
  {:else if viewMode === "cards"}
    <div class="questions-grid">
      {#each filteredQuestions() as question (question.id)}
        {@const alreadyIn = existingQuestionIds.includes(question.id)}
        <div class="question-card" class:already-in-session={alreadyIn}>
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
            <div class="question-text">
              <MarkdownPreview md={question.question} />
            </div>
            {#if question.expectedAnswer}
              <details class="expected-answer">
                <summary>Expected Answer</summary>
                <div class="expected-answer-content">
                  <MarkdownPreview md={question.expectedAnswer} />
                </div>
              </details>
            {/if}
          </div>

          {#if question.difficulty && question.difficulty.length > 0}
            <div class="rating-info">
              <small>Difficulty: {question.difficulty.join(", ")}</small>
            </div>
          {/if}

          <div class="card-actions">
            <button
              type="button"
              class="action-btn preview"
              onclick={() => (previewQuestion = question)}
              title="Preview full question"
            >
              👁 Preview
            </button>
            {#if alreadyIn}
              <button type="button" class="action-btn add" disabled>Already in session</button>
            {:else}
              <button type="button" onclick={() => onAdd(question)} class="action-btn add">
                + Add to Session
              </button>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <div class="browser-table-wrap">
      <table class="questions-table">
        <thead>
          <tr>
            <th class="col-check">
              <input
                type="checkbox"
                checked={allEligibleSelected}
                indeterminate={tableSelected.size > 0 && !allEligibleSelected}
                onchange={toggleSelectAll}
                disabled={eligibleInView.length === 0}
              />
            </th>
            <th class="col-type">Type</th>
            <th class="col-difficulty">Difficulty</th>
            <th class="col-question">Question</th>
            <th class="col-action"></th>
          </tr>
        </thead>
        <tbody>
          {#each filteredQuestions() as question (question.id)}
            {@const alreadyIn = existingQuestionIds.includes(question.id)}
            <tr
              class:already-in-session={alreadyIn}
              class:row-selected={tableSelected.has(question.id)}
              onclick={() => !alreadyIn && toggleTableRow(question.id)}
              style={!alreadyIn ? "cursor:pointer" : ""}
            >
              <td class="col-check">
                <input
                  type="checkbox"
                  checked={tableSelected.has(question.id)}
                  disabled={alreadyIn}
                  onclick={(e) => e.stopPropagation()}
                  onchange={() => toggleTableRow(question.id)}
                />
              </td>
              <td class="col-type">
                <span class="question-type" class:rating={question.questionType === QuestionType.Rating}>
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
              <td class="col-action">
                {#if alreadyIn}
                  <span class="already-badge">In session</span>
                {:else}
                  <button
                    type="button"
                    onclick={(e) => { e.stopPropagation(); onAdd(question); }}
                    class="add-btn"
                  >
                    + Add
                  </button>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    {#if tableSelected.size > 0}
      <div class="table-bulk-actions">
        <button type="button" class="bulk-add-btn" onclick={addSelected}>
          + Add {tableSelected.size} Selected Question{tableSelected.size !== 1 ? "s" : ""}
        </button>
      </div>
    {/if}
  {/if}

<QuestionPreviewModal question={previewQuestion} onClose={() => (previewQuestion = null)} />

<style>
  /* Card grid */
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
    border: 1px solid var(--color-border);
    border-radius: 8px;
    background: white;
    transition: all 0.2s;
    display: flex;
    flex-direction: column;
    min-height: 280px;
  }

  .question-card:hover {
    border-color: var(--color-primary);
    box-shadow: 0 2px 8px rgba(0, 102, 204, 0.1);
  }

  .question-card.already-in-session {
    opacity: 0.6;
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
  }

  .tag {
    padding: 0.25rem 0.5rem;
    background: var(--color-bg-subtle);
    color: var(--color-text-secondary);
    border-radius: 3px;
    font-size: 0.75rem;
  }

  .question-content {
    margin-bottom: 1rem;
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .question-text {
    font-size: 0.95rem;
    max-height: 100px;
    overflow: hidden;
    position: relative;
  }

  .question-text::after {
    content: "";
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 30px;
    background: linear-gradient(to bottom, transparent, white);
    pointer-events: none;
  }

  .expected-answer {
    margin-top: 0.75rem;
  }

  .expected-answer summary {
    cursor: pointer;
    color: var(--color-primary);
    font-size: 0.85rem;
    font-weight: 500;
  }

  .expected-answer summary:hover {
    text-decoration: underline;
  }

  .expected-answer-content {
    margin-top: 0.5rem;
    padding: 0.5rem;
    background: #f9f9f9;
    border-radius: 4px;
    font-size: 0.9rem;
    color: var(--color-text-secondary);
  }

  .rating-info {
    margin-bottom: 1rem;
    color: var(--color-text-secondary);
    font-size: 0.85rem;
  }

  .card-actions {
    margin-top: auto;
    padding-top: 1rem;
    border-top: 1px solid #eee;
    display: flex;
    gap: 0.5rem;
    align-items: center;
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

  /* Table view */
  .browser-table-wrap {
    max-height: 55vh;
    overflow-y: auto;
  }

  .col-check {
    width: 36px;
    text-align: center;
    padding-left: 0.75rem;
  }

  .col-type {
    width: 80px;
  }

  .col-difficulty {
    width: 90px;
    text-align: center;
  }

  .col-question {
    color: var(--color-text);
    max-width: 500px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .col-action {
    width: 100px;
    text-align: right;
    white-space: nowrap;
  }

  .already-in-session {
    opacity: 0.55;
  }

  .row-selected {
    background: #f0f7ff;
  }

  .already-badge {
    display: inline-block;
    padding: 0.2rem 0.5rem;
    background: #f0f0f0;
    color: #999;
    border-radius: 4px;
    font-size: 0.75rem;
    white-space: nowrap;
  }

  .add-btn {
    padding: 0.3rem 0.75rem;
    background: #4caf50 !important;
    color: white !important;
    border: none !important;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.8rem;
    font-weight: 500;
    transition: background 0.15s;
  }

  .add-btn:hover {
    background: #45a049 !important;
    border-color: transparent !important;
  }

  .no-value {
    color: #bbb;
  }

  .table-bulk-actions {
    display: flex;
    justify-content: flex-end;
    padding: 0.75rem 0.5rem 0.25rem;
  }

  .bulk-add-btn {
    padding: 0.6rem 1.25rem;
    background: #4caf50 !important;
    color: white !important;
    border: none !important;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.9rem;
    font-weight: 500;
    transition: background 0.15s;
  }

  .bulk-add-btn:hover {
    background: #45a049 !important;
    border-color: transparent !important;
  }

  .empty-state {
    text-align: center;
    padding: 3rem;
    color: var(--color-text-secondary);
  }

  /* Dark mode */
  :global([data-theme="dark"]) .question-card {
    background: var(--color-bg-dark);
    border-color: var(--color-border-dark);
  }

  :global([data-theme="dark"]) .question-card:hover {
    border-color: #4da3ff;
  }

  :global([data-theme="dark"]) .question-text::after {
    background: linear-gradient(to bottom, transparent, #1a1a1a);
  }

  :global([data-theme="dark"]) .tag {
    background: #3a3a3a;
    color: var(--color-text-muted);
  }

  :global([data-theme="dark"]) .expected-answer-content {
    background: var(--color-bg-dark-2);
    color: var(--color-text-muted);
  }

  :global([data-theme="dark"]) .action-btn.add:disabled {
    background: #3a3a3a;
    color: var(--color-text-secondary);
  }

  :global([data-theme="dark"]) .already-badge {
    background: var(--color-bg-dark-3);
    color: #777;
  }

  :global([data-theme="dark"]) .add-btn {
    background: #2e7d32 !important;
  }

  :global([data-theme="dark"]) .add-btn:hover {
    background: #388e3c !important;
  }

  :global([data-theme="dark"]) .col-question {
    color: #ddd;
  }

  :global([data-theme="dark"]) .empty-state {
    color: var(--color-text-muted);
  }

  :global([data-theme="dark"]) .card-actions {
    border-top-color: #444;
  }

  :global([data-theme="dark"]) .row-selected {
    background: #1a2a3a;
  }

  :global([data-theme="dark"]) .bulk-add-btn {
    background: #2e7d32 !important;
  }

  :global([data-theme="dark"]) .bulk-add-btn:hover {
    background: #388e3c !important;
  }

  .action-btn.preview {
    background: none;
    border: 1px solid var(--color-border);
    color: var(--color-primary);
    font-size: 0.85rem;
    padding: 0.3rem 0.75rem;
    border-radius: 4px;
    cursor: pointer;
    flex-shrink: 0;
    transition:
      background 0.15s,
      border-color 0.15s;
  }

  .action-btn.preview:hover {
    background: var(--color-bg-subtle);
    border-color: var(--color-primary);
  }
</style>
