<script lang="ts">
  import type { Session, SessionQuestion } from "./types";
  import { QuestionType } from "./types";
  import MarkdownPreview from "../components/MarkdownPreview.svelte";

  let {
    question,
    index,
    session,
    totalQuestions,
    expandedQuestionId,
    candidateWindowOpen,
    scrollToQuestionId,
    onMoveUp,
    onMoveDown,
    onRemove,
    onSetActive,
    onToggleRecording,
    onSaveAnswer,
    onResetRecord,
  }: {
    question: SessionQuestion;
    index: number;
    session: Session;
    totalQuestions: number;
    expandedQuestionId: string | null;
    candidateWindowOpen: boolean;
    scrollToQuestionId: string | null;
    onMoveUp: (index: number) => void;
    onMoveDown: (index: number) => void;
    onRemove: (questionId: string) => void;
    onSetActive: (index: number) => void;
    onToggleRecording: (questionId: string) => void;
    onSaveAnswer: (question: SessionQuestion) => void;
    onResetRecord: (question: SessionQuestion) => void;
  } = $props();

  const isActive = $derived(index === session.currentQuestionIndex);
  const isExpanded = $derived(expandedQuestionId === question.id);
  const isAnswered = $derived(question.answer.trim().length > 0);
  const hasRecording = $derived(
    question.answer.trim().length > 0 ||
      question.note.trim().length > 0 ||
      question.questionRating > 0
  );

  let isQuestionExpanded = $state(false);
  let questionTextRef: HTMLDivElement | null = $state(null);
  let isQuestionTruncated = $state(false);
  let questionItemRef: HTMLDivElement | null = $state(null);

  $effect(() => {
    if (questionTextRef) {
      // Check if content is truncated
      isQuestionTruncated = questionTextRef.scrollHeight > 150;
    }
  });

  $effect(() => {
    // Only scroll when this specific question is marked for scrolling
    if (scrollToQuestionId === question.id && questionItemRef) {
      // Use requestAnimationFrame to ensure DOM is updated
      requestAnimationFrame(() => {
        if (!questionItemRef) return;

        // Scroll to the active question aligned with sidebar top position (6rem = 96px)
        const sidebarTopOffset = 96; // Same as sidebar's top: 6rem
        const elementPosition = questionItemRef.getBoundingClientRect().top;
        const offsetPosition = window.scrollY + elementPosition - sidebarTopOffset;

        window.scrollTo({
          top: offsetPosition,
          behavior: "smooth",
        });
      });
    }
  });

  function toggleQuestionExpanded() {
    isQuestionExpanded = !isQuestionExpanded;
  }
</script>

<div
  bind:this={questionItemRef}
  class="question-item"
  class:active={isActive}
  class:presented={question.isPresented}
  class:answered={question.answer.trim().length > 0}
  class:rated={question.questionRating > 0}
>
  <div class="question-header">
    <div class="question-meta">
      <span class="question-number">Q{index + 1}</span>
      <span
        class="question-type"
        class:rating={question.questionObj.questionType === QuestionType.Rating}
      >
        {question.questionObj.questionType}
      </span>
      {#if question.questionObj.difficulty && question.questionObj.difficulty.length > 0}
        <span class="difficulty-badge" title="Difficulty levels">
          Difficulty: {question.questionObj.difficulty.join(", ")}
        </span>
      {/if}
      {#if question.answer.trim().length > 0}
        <span class="status-badge answered">✓ Answered</span>
      {/if}
      {#if question.questionRating > 0}
        <span class="status-badge rated">★ {question.questionRating}/10</span>
      {/if}
    </div>
    <div class="header-right-actions">
      <button
        type="button"
        onclick={() => onSetActive(index)}
        class="action-btn-header present"
        class:answered={isAnswered && !isActive}
        class:showing={isActive && candidateWindowOpen}
      >
        {isActive && candidateWindowOpen ? "Showing" : "Present"}
      </button>
      <div class="question-actions-inline">
        <button
          type="button"
          onclick={() => onMoveUp(index)}
          class="icon-btn"
          disabled={index === 0}
          title="Move up"
        >
          ▲
        </button>
        <button
          type="button"
          onclick={() => onMoveDown(index)}
          class="icon-btn"
          disabled={index === totalQuestions - 1}
          title="Move down"
        >
          ▼
        </button>
        <button
          type="button"
          onclick={() => onRemove(question.id)}
          class="icon-btn delete"
          title="Remove question"
        >
          ✕
        </button>
      </div>
    </div>
  </div>

  <div class="question-content">
    <div class="question-text" class:expanded={isQuestionExpanded} bind:this={questionTextRef}>
      <MarkdownPreview md={question.questionObj.question} />
    </div>

    {#if isQuestionTruncated}
      <button type="button" class="expand-btn" onclick={toggleQuestionExpanded}>
        {isQuestionExpanded ? "▲ Show less" : "▼ See more"}
      </button>
    {/if}

    {#if question.questionObj.tags.length > 0}
      <div class="tags">
        {#each question.questionObj.tags as tag (tag)}
          <span class="tag">{tag}</span>
        {/each}
      </div>
    {/if}

    {#if question.questionObj.expectedAnswer}
      <details class="expected-answer">
        <summary>Expected Answer</summary>
        <div class="expected-answer-content">
          <MarkdownPreview md={question.questionObj.expectedAnswer} />
        </div>
      </details>
    {/if}
  </div>

  <div class="question-actions">
    <button
      type="button"
      onclick={() => onToggleRecording(question.id)}
      class="action-btn record"
      class:expanded={isExpanded}
      class:has-recording={hasRecording}
    >
      {#if hasRecording}
        {isExpanded ? "✓ ▼ Hide Answer" : "✓ ▶ Record Answer"}
      {:else}
        {isExpanded ? "▼ Hide Answer" : "▶ Record Answer"}
      {/if}
    </button>
  </div>

  {#if isExpanded}
    <div class="recording-form">
      <div class="form-group">
        <label for="answer-{question.id}">Candidate's Answer</label>
        <textarea
          id="answer-{question.id}"
          bind:value={question.answer}
          oninput={() => onSaveAnswer(question)}
          placeholder="Record what the candidate said..."
          rows="4"
        ></textarea>
      </div>

      <div class="form-group">
        <label for="rating-{question.id}">Rating (0-10)</label>
        <select
          id="rating-{question.id}"
          bind:value={question.questionRating}
          onchange={() => onSaveAnswer(question)}
        >
          <option value={0}>Not rated</option>
          <option value={1}>1 - Poor</option>
          <option value={2}>2</option>
          <option value={3}>3</option>
          <option value={4}>4</option>
          <option value={5}>5 - Average</option>
          <option value={6}>6</option>
          <option value={7}>7</option>
          <option value={8}>8</option>
          <option value={9}>9</option>
          <option value={10}>10 - Excellent</option>
        </select>
        {#if question.questionRating > 0}
          <div class="rating-display">{question.questionRating}/10</div>
        {/if}
      </div>

      <div class="form-group">
        <label for="notes-{question.id}">Interviewer Notes</label>
        <textarea
          id="notes-{question.id}"
          bind:value={question.note}
          oninput={() => onSaveAnswer(question)}
          placeholder="Add your notes, observations, or follow-up items..."
          rows="3"
        ></textarea>
      </div>

      <div class="save-indicator">
        <small>✓ Auto-saved</small>
        <button
          type="button"
          onclick={() => onResetRecord(question)}
          class="reset-answer-btn"
          title="Reset recorded answer, rating, and notes"
        >
          ✕ Reset Answer
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .question-item {
    padding: 1.5rem;
    border: 2px solid var(--color-border);
    border-radius: 8px;
    background: white;
    margin-bottom: 1rem;
    transition: all 0.2s;
  }

  .question-item:last-child {
    margin-bottom: 0;
  }

  .question-item.active {
    border: 3px solid var(--color-primary);
    background: #f0f8ff;
    box-shadow: 0 0 0 3px rgba(0, 102, 204, 0.1);
  }

  .question-item.presented {
    border-left: 4px solid #4caf50;
  }

  .question-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1rem;
    gap: 1rem;
  }

  .question-meta {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .question-number {
    padding: 0.25rem 0.75rem;
    background: var(--color-primary);
    color: white;
    border-radius: 4px;
    font-weight: bold;
    font-size: 0.85rem;
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

  .status-badge {
    padding: 0.25rem 0.5rem;
    border-radius: 3px;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .status-badge.answered {
    background: #e8f5e9;
    color: #2e7d32;
  }

  .status-badge.rated {
    background: #fff3e0;
    color: #f57c00;
  }

  .difficulty-badge {
    padding: 0.25rem 0.75rem;
    background: #f3e5f5;
    color: #7b1fa2;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .header-right-actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .question-actions-inline {
    display: flex;
    gap: 0.25rem;
  }

  .action-btn-header {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.85rem;
    font-weight: 600;
    transition: all 0.2s;
    white-space: nowrap;
  }

  .action-btn-header.present {
    background: var(--color-primary);
    color: white;
  }

  .action-btn-header.present:hover:not(:disabled) {
    background: var(--color-primary-hover);
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(0, 102, 204, 0.2);
  }

  .action-btn-header.present.answered {
    background: var(--color-bg-subtle);
    color: var(--color-text);
  }

  .action-btn-header.present.answered:hover {
    background: #e0e0e0;
  }

  .action-btn-header.present.showing {
    background: #757575;
    color: white;
    cursor: default;
  }

  .action-btn-header.present.showing:hover {
    background: #757575;
    transform: none;
    box-shadow: none;
  }

  .action-btn-header.present:disabled {
    background: #9e9e9e;
    opacity: 0.6;
    cursor: not-allowed;
  }

  .icon-btn {
    padding: 0.25rem 0.5rem;
    background: var(--color-bg-subtle);
    border: 1px solid var(--color-border);
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.85rem;
    transition: all 0.2s;
  }

  .icon-btn:hover:not(:disabled) {
    background: #e0e0e0;
  }

  .icon-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .icon-btn.delete {
    color: #d32f2f;
  }

  .icon-btn.delete:hover:not(:disabled) {
    background: #ffebee;
  }

  .question-content {
    margin-bottom: 1rem;
  }

  .question-text {
    margin-bottom: 0.5rem;
    max-height: 150px;
    overflow: hidden;
    position: relative;
    transition: max-height 0.3s ease;
  }

  .question-text.expanded {
    max-height: none;
  }

  .question-text::after {
    content: "";
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 40px;
    background: linear-gradient(to bottom, transparent, var(--color-bg));
    pointer-events: none;
    transition: opacity 0.3s ease;
  }

  .question-text.expanded::after {
    opacity: 0;
  }

  .question-item.active .question-text::after {
    background: linear-gradient(to bottom, transparent, #f0f8ff);
  }

  .expand-btn {
    width: 100%;
    padding: 0.5rem 0.75rem;
    background: var(--color-bg-subtle);
    border: 1px solid var(--color-border);
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.85rem;
    color: var(--color-primary);
    transition: all 0.2s;
    margin-bottom: 0.5rem;
    text-align: center;
    font-weight: 500;
  }

  .expand-btn:hover {
    background: #e0e0e0;
    border-color: var(--color-primary);
  }

  .question-text :global(.markdown-preview) {
    color: var(--color-text);
    font-size: 1rem;
  }

  .question-text :global(.markdown-preview h1),
  .question-text :global(.markdown-preview h2),
  .question-text :global(.markdown-preview h3) {
    font-size: 1.1rem;
    margin-top: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .question-text :global(.markdown-preview p:first-child),
  .question-text :global(.markdown-preview h1:first-child),
  .question-text :global(.markdown-preview h2:first-child),
  .question-text :global(.markdown-preview h3:first-child) {
    margin-top: 0;
  }

  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    margin-bottom: 0.75rem;
  }

  .tag {
    padding: 0.25rem 0.5rem;
    background: var(--color-bg-subtle);
    color: var(--color-text-secondary);
    border-radius: 3px;
    font-size: 0.75rem;
  }

  .expected-answer {
    margin-top: 1.5rem;
    padding-top: 1.5rem;
    border-top: 3px solid #e0e0e0;
  }

  .expected-answer summary {
    cursor: pointer;
    color: var(--color-primary);
    font-size: 0.9rem;
    font-weight: 500;
    padding: 0.5rem;
    background: var(--color-bg-subtle);
    border-radius: 4px;
  }

  .expected-answer summary:hover {
    text-decoration: underline;
  }

  .expected-answer-content {
    margin-top: 0.5rem;
    padding: 0.75rem;
    background: #f9f9f9;
    border-radius: 4px;
  }

  .expected-answer-content :global(.markdown-preview) {
    color: var(--color-text-secondary);
    font-size: 0.95rem;
  }

  .expected-answer-content :global(.markdown-preview h1),
  .expected-answer-content :global(.markdown-preview h2),
  .expected-answer-content :global(.markdown-preview h3) {
    font-size: 1rem;
    margin-top: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .question-actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 1.5rem;
    margin-bottom: 1rem;
  }

  .action-btn {
    flex: 1;
    padding: 0.75rem 1rem;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.9rem;
    font-weight: 500;
    transition: all 0.2s;
  }

  .action-btn.present {
    background: var(--color-primary);
    color: white;
  }

  .action-btn.present:hover:not(:disabled) {
    background: var(--color-primary-hover);
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(0, 102, 204, 0.2);
  }

  .action-btn.present.answered {
    background: var(--color-bg-subtle);
    color: var(--color-text);
  }

  .action-btn.present.answered:hover {
    background: #e0e0e0;
  }

  .action-btn.present.showing {
    background: #757575;
    color: white;
    cursor: default;
  }

  .action-btn.present.showing:hover {
    background: #757575;
    transform: none;
    box-shadow: none;
  }

  .action-btn.present:disabled {
    background: #9e9e9e;
    opacity: 0.6;
    cursor: not-allowed;
  }

  .action-btn.record {
    background: var(--color-bg-subtle);
    color: var(--color-text);
  }

  .action-btn.record:hover {
    background: #e0e0e0;
  }

  .action-btn.record.expanded {
    background: #e0e0e0;
  }

  .action-btn.record.has-recording {
    background: #e8f5e9;
    color: #2e7d32;
    font-weight: 600;
  }

  .action-btn.record.has-recording:hover {
    background: #c8e6c9;
  }

  .action-btn.record.has-recording.expanded {
    background: #c8e6c9;
  }

  .recording-form {
    padding: 1rem;
    background: #f9f9f9;
    border-radius: 6px;
    border: 1px solid #e0e0e0;
  }

  .form-group {
    margin-bottom: 1rem;
  }

  .form-group:last-of-type {
    margin-bottom: 0.5rem;
  }

  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    color: var(--color-text);
    font-size: 0.9rem;
  }

  .form-group textarea,
  .form-group select {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    font-size: 1rem;
    font-family: inherit;
    box-sizing: border-box;
  }

  .form-group textarea:focus,
  .form-group select:focus {
    outline: none;
    border-color: var(--color-primary);
  }

  .form-group textarea {
    resize: vertical;
  }

  .rating-display {
    margin-top: 0.5rem;
    font-size: 1.25rem;
    font-weight: bold;
    color: #f57c00;
  }

  .save-indicator {
    display: flex;
    justify-content: space-between;
    align-items: center;
    color: #4caf50;
  }

  .save-indicator small {
    font-size: 0.85rem;
  }

  .reset-answer-btn {
    padding: 0.5rem 1rem;
    background: #fff;
    border: 1px solid #d32f2f;
    border-radius: 4px;
    color: #d32f2f;
    cursor: pointer;
    font-size: 0.85rem;
    font-weight: 500;
    transition: all 0.2s;
  }

  .reset-answer-btn:hover {
    background: #ffebee;
    border-color: #c62828;
    color: #c62828;
  }

  :global([data-theme="dark"]) .question-item {
    background: var(--color-bg-dark-2);
    border-color: var(--color-border-dark);
  }

  :global([data-theme="dark"]) .question-item.active {
    background: #1a2a3a;
    border-color: var(--color-primary-dark);
    box-shadow: 0 0 0 3px rgba(77, 163, 255, 0.15);
  }

  :global([data-theme="dark"]) .difficulty-badge {
    background: #3a2a4a;
    color: #ce93d8;
  }

  :global([data-theme="dark"]) .action-btn.present:disabled {
    background: #616161;
    opacity: 0.5;
  }

  :global([data-theme="dark"]) .question-text::after {
    background: linear-gradient(to bottom, transparent, var(--color-bg-dark-2));
  }

  :global([data-theme="dark"]) .question-item.active .question-text::after {
    background: linear-gradient(to bottom, transparent, #1a2a3a);
  }

  :global([data-theme="dark"]) .expand-btn {
    background: #3a3a3a;
    border-color: #555;
    color: var(--color-primary-dark);
  }

  :global([data-theme="dark"]) .expand-btn:hover {
    background: #4a4a4a;
    border-color: var(--color-primary-dark);
  }

  :global([data-theme="dark"]) .question-text :global(.markdown-preview) {
    color: #ffffff;
  }

  :global([data-theme="dark"]) .question-text :global(.markdown-preview h1),
  :global([data-theme="dark"]) .question-text :global(.markdown-preview h2),
  :global([data-theme="dark"]) .question-text :global(.markdown-preview h3) {
    color: #ffffff;
  }

  :global([data-theme="dark"]) .tag {
    background: #3a3a3a;
    color: var(--color-text-muted);
  }

  :global([data-theme="dark"]) .expected-answer {
    border-top-color: var(--color-border-dark);
  }

  :global([data-theme="dark"]) .expected-answer summary {
    background: #3a3a3a;
  }

  :global([data-theme="dark"]) .expected-answer-content {
    background: var(--color-bg-dark);
  }

  :global([data-theme="dark"]) .expected-answer-content :global(.markdown-preview) {
    color: var(--color-text-muted);
  }

  :global([data-theme="dark"]) .expected-answer-content :global(.markdown-preview h1),
  :global([data-theme="dark"]) .expected-answer-content :global(.markdown-preview h2),
  :global([data-theme="dark"]) .expected-answer-content :global(.markdown-preview h3) {
    color: #ffffff;
  }

  :global([data-theme="dark"]) .icon-btn {
    background: #3a3a3a;
    border-color: #555;
    color: #ffffff;
  }

  :global([data-theme="dark"]) .icon-btn:hover:not(:disabled) {
    background: #4a4a4a;
  }

  :global([data-theme="dark"]) .action-btn.present.answered {
    background: #3a3a3a;
    color: #ffffff;
  }

  :global([data-theme="dark"]) .action-btn.present.answered:hover {
    background: #4a4a4a;
  }

  :global([data-theme="dark"]) .action-btn.present.showing {
    background: #616161;
    color: #ffffff;
  }

  :global([data-theme="dark"]) .action-btn.present.showing:hover {
    background: #616161;
  }

  :global([data-theme="dark"]) .action-btn-header.present.answered {
    background: #3a3a3a;
    color: #ffffff;
  }

  :global([data-theme="dark"]) .action-btn-header.present.answered:hover {
    background: #4a4a4a;
  }

  :global([data-theme="dark"]) .action-btn-header.present.showing {
    background: #616161;
    color: #ffffff;
  }

  :global([data-theme="dark"]) .action-btn-header.present.showing:hover {
    background: #616161;
  }

  :global([data-theme="dark"]) .action-btn-header.present:disabled {
    background: #616161;
    opacity: 0.5;
  }

  :global([data-theme="dark"]) .action-btn.record {
    background: #3a3a3a;
    color: #ffffff;
  }

  :global([data-theme="dark"]) .action-btn.record:hover {
    background: #4a4a4a;
  }

  :global([data-theme="dark"]) .action-btn.record.expanded {
    background: #4a4a4a;
  }

  :global([data-theme="dark"]) .action-btn.record.has-recording {
    background: #1b5e20;
    color: #a5d6a7;
    font-weight: 600;
  }

  :global([data-theme="dark"]) .action-btn.record.has-recording:hover {
    background: #2e7d32;
  }

  :global([data-theme="dark"]) .action-btn.record.has-recording.expanded {
    background: #2e7d32;
  }

  :global([data-theme="dark"]) .recording-form {
    background: var(--color-bg-dark);
    border-color: var(--color-border-dark);
  }

  :global([data-theme="dark"]) .form-group label {
    color: #ffffff;
  }

  :global([data-theme="dark"]) .form-group textarea,
  :global([data-theme="dark"]) .form-group select {
    background: var(--color-bg-dark-2);
    border-color: var(--color-border-dark);
    color: #ffffff;
  }

  :global([data-theme="dark"]) .reset-answer-btn {
    background: #2a2a2a;
    border-color: #ef5350;
    color: #ef5350;
  }

  :global([data-theme="dark"]) .reset-answer-btn:hover {
    background: #3a1a1a;
    border-color: #f44336;
    color: #f44336;
  }
</style>
