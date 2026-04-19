<script lang="ts">
  import { QuestionType, type Question } from "../lib/types";
  import SessionModal from "../lib/SessionModal.svelte";
  import MarkdownPreview from "./MarkdownPreview.svelte";

  let {
    question = null,
    onClose,
  }: {
    question: Question | null;
    onClose: () => void;
  } = $props();
</script>

<SessionModal show={question !== null} {onClose} title="Question Preview" size="large" focusCancel={true}>
  {#if question}
    <div class="preview-body">
      <div class="preview-meta">
        <span class="question-type" class:rating={question.questionType === QuestionType.Rating}>
          {question.questionType}
        </span>
        {#if question.difficulty && question.difficulty.length > 0}
          <span class="meta-item">Difficulty: {question.difficulty.join(", ")}</span>
        {/if}
        {#if question.tags.length > 0}
          <div class="tags">
            {#each question.tags as tag (tag)}
              <span class="tag">{tag}</span>
            {/each}
          </div>
        {/if}
      </div>

      <section class="preview-section">
        <h3 class="section-label">Question</h3>
        <div class="section-content">
          <MarkdownPreview md={question.question} />
        </div>
      </section>

      {#if question.expectedAnswer}
        <section class="preview-section">
          <h3 class="section-label">Expected Answer</h3>
          <div class="section-content answer-content">
            <MarkdownPreview md={question.expectedAnswer} />
          </div>
        </section>
      {/if}

      <div class="modal-actions">
        <button type="button" class="secondary" onclick={onClose}>Close</button>
      </div>
    </div>
  {/if}
</SessionModal>

<style>
  .preview-body {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding-bottom: 0.5rem;
    flex: 1;
  }

  .modal-actions {
    margin-top: auto;
    padding-top: 1rem;
  }

  .preview-meta {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.5rem;
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

  .meta-item {
    font-size: 0.85rem;
    color: var(--color-text-secondary);
  }

  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }

  .tag {
    padding: 0.2rem 0.5rem;
    background: var(--color-bg-subtle);
    color: var(--color-text-secondary);
    border-radius: 3px;
    font-size: 0.75rem;
  }

  .preview-section {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .section-label {
    margin: 0;
    font-size: 0.8rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-secondary);
  }

  .section-content {
    padding: 1rem;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    background: var(--color-bg);
  }

  .answer-content {
    background: var(--color-bg-subtle);
  }

  :global([data-theme="dark"]) .question-type {
    background: #1a3a5c;
    color: #90caf9;
  }

  :global([data-theme="dark"]) .question-type.rating {
    background: #3e2800;
    color: #ffb74d;
  }

  :global([data-theme="dark"]) .tag {
    background: var(--color-bg-dark-3);
    color: var(--color-text-muted);
  }

  :global([data-theme="dark"]) .answer-content {
    background: #1e1e1e;
  }
</style>
