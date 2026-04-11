<script lang="ts">
  import type { Question } from "./types";
  import { QuestionType } from "./types";
  import SessionModal from "./SessionModal.svelte";
  import QuestionFilterPanel from "../components/QuestionFilterPanel.svelte";

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

    return result;
  });
</script>

<SessionModal {show} title="Add Questions from Catalog" size="large" onClose={onClose}>
  <QuestionFilterPanel
    bind:searchQuery
    bind:selectedTypes
    bind:selectedTags
    selectedDifficulties={[]}
    allTags={allTagsComputed().allTags}
    tagCounts={allTagsComputed().tagCounts}
    totalCount={questions.length}
    filteredCount={filteredQuestions().length}
    showDifficultyFilter={false}
    showViewToggle={false}
  />

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
    background: var(--color-bg-subtle);
    color: var(--color-text-secondary);
    border-radius: 3px;
    font-size: 0.75rem;
  }

  .question-content {
    margin-bottom: 1rem;
  }

  .question-content h3 {
    margin: 0 0 0.5rem 0;
    color: var(--color-text);
    font-size: 1rem;
    line-height: 1.4;
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

  .expected-answer p {
    margin: 0.5rem 0 0 0;
    color: var(--color-text-secondary);
    font-size: 0.9rem;
    line-height: 1.5;
  }

  .rating-info {
    margin-bottom: 1rem;
    color: var(--color-text-secondary);
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
    color: var(--color-text-secondary);
  }

  :global([data-theme="dark"]) .question-card {
    background: var(--color-bg-dark);
    border-color: var(--color-border-dark);
  }

  :global([data-theme="dark"]) .question-card:hover {
    border-color: #4da3ff;
  }

  :global([data-theme="dark"]) .question-content h3 {
    color: #ffffff;
  }

  :global([data-theme="dark"]) .tag {
    background: #3a3a3a;
    color: var(--color-text-muted);
  }

  :global([data-theme="dark"]) .expected-answer p {
    color: var(--color-text-muted);
  }

  :global([data-theme="dark"]) .action-btn.add:disabled {
    background: #3a3a3a;
    color: var(--color-text-secondary);
  }

  :global([data-theme="dark"]) .empty-state {
    color: var(--color-text-muted);
  }
</style>
