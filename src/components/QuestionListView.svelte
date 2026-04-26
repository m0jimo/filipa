<script lang="ts">
  import { QuestionType, type Question } from "../lib/types";
  import MarkdownPreview from "./MarkdownPreview.svelte";
  import QuestionTextExpand from "./QuestionTextExpand.svelte";
  import IconEye from "./IconEye.svelte";
  import { SvelteSet } from "svelte/reactivity";

  type SortColumn = "type" | "difficulty" | "createdAt";

  let {
    questions,
    viewMode,
    selectedSet,
    onToggleSelect,
    sortCol = null,
    sortDir = "asc",
    onToggleSort,
    onEdit,
    onDelete,
    onPreview,
    onAddToSet,
    alreadyInSetIds = [],
    showSorting = false,
    showActions = false,
    showCreatedDate = false,
    showExpectedAnswer = false,
    showStatusBadge = false,
    clickableRows = false,
    allEligibleSelected = false,
    onToggleSelectAll,
  }: {
    questions: Question[];
    viewMode: "cards" | "table";
    selectedSet: SvelteSet<string>;
    onToggleSelect: (id: string) => void;
    sortCol?: SortColumn | null;
    sortDir?: "asc" | "desc";
    onToggleSort?: (col: SortColumn) => void;
    onEdit?: (question: Question, event: MouseEvent) => void;
    onDelete?: (questionId: string, event: MouseEvent) => void;
    onPreview?: (question: Question) => void;
    onAddToSet?: (question: Question) => void;
    alreadyInSetIds?: string[];
    showSorting?: boolean;
    showActions?: boolean;
    showCreatedDate?: boolean;
    showExpectedAnswer?: boolean;
    showStatusBadge?: boolean;
    clickableRows?: boolean;
    allEligibleSelected?: boolean;
    onToggleSelectAll?: () => void;
  } = $props();

  const isAlreadyInSet = (id: string) => alreadyInSetIds.includes(id);
</script>

{#if viewMode === "cards"}
  <div class="questions-grid" class:picker-grid={clickableRows}>
    {#each questions as question (question.id)}
      {@const alreadyIn = isAlreadyInSet(question.id)}
      {@const selected = selectedSet.has(question.id)}
      <div
        class="question-card"
        class:picker-card={clickableRows}
        class:selected={selected && !alreadyIn}
        class:already-in-set={alreadyIn}
      >
        <div class="question-header">
          <span class="question-type" class:rating={question.questionType === QuestionType.Rating}>
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
              onchange={() => onToggleSelect(question.id)}
              onclick={(e) => e.stopPropagation()}
              title="Select"
            />
          {/if}
        </div>

        <div class="question-content">
          {#if clickableRows}
            <QuestionTextExpand md={question.question} />
          {:else}
            <div class="question-text">
              <MarkdownPreview md={question.question} />
            </div>
          {/if}
          {#if showExpectedAnswer && question.expectedAnswer}
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

        {#if showCreatedDate}
          <div class="question-meta">
            <small title="Updated: {new Date(question.updatedAt).toLocaleString()}">
              Created: {new Date(question.createdAt).toLocaleDateString()}
            </small>
          </div>
        {/if}

        {#if showActions && onEdit && onDelete}
          <div class="card-actions">
            {#if onPreview}
              <button
                onclick={(e) => { e.stopPropagation(); onPreview(question); }}
                class="action-btn preview"
                title="Preview full question"
              >
                <IconEye />
              </button>
            {/if}
            <button
              onclick={(e) => onDelete!(question.id, e)}
              class="action-btn delete-narrow"
              title="Delete question"
            >
              🗑️
            </button>
            <button
              onclick={(e) => onEdit!(question, e)}
              class="action-btn edit"
              title="Edit question"
            >
              Edit
            </button>
          </div>
        {:else if onPreview || onAddToSet}
          <div class="card-actions">
            {#if onPreview}
              <button
                onclick={(e) => { e.stopPropagation(); onPreview(question); }}
                class="action-btn preview"
                title="Preview full question"
              >
                <IconEye /> Preview
              </button>
            {/if}
            {#if onAddToSet}
              {#if alreadyIn}
                <span class="already-badge card-already-badge">Already in set</span>
              {:else}
                <button
                  type="button"
                  onclick={(e) => { e.stopPropagation(); onAddToSet(question); }}
                  class="action-btn add-to-set"
                >
                  + Add to Set
                </button>
              {/if}
            {/if}
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
            {#if onToggleSelectAll}
              <input
                type="checkbox"
                checked={allEligibleSelected}
                onchange={onToggleSelectAll}
                title="Select all eligible"
              />
            {/if}
          </th>
          <th
            class="col-type"
            class:col-sortable={showSorting}
            onclick={showSorting ? () => onToggleSort?.("type") : undefined}
          >
            Type
            {#if showSorting}
              {#if sortCol === "type"}
                <span class="sort-arrow">{sortDir === "asc" ? "▲" : "▼"}</span>
              {:else}
                <span class="sort-arrow inactive">⇅</span>
              {/if}
            {/if}
          </th>
          <th
            class="col-difficulty"
            class:col-sortable={showSorting}
            onclick={showSorting ? () => onToggleSort?.("difficulty") : undefined}
          >
            Difficulty
            {#if showSorting}
              {#if sortCol === "difficulty"}
                <span class="sort-arrow">{sortDir === "asc" ? "▲" : "▼"}</span>
              {:else}
                <span class="sort-arrow inactive">⇅</span>
              {/if}
            {/if}
          </th>
          <th class="col-question">Question</th>
          {#if showCreatedDate}
            <th
              class="col-created"
              class:col-sortable={showSorting}
              onclick={showSorting ? () => onToggleSort?.("createdAt") : undefined}
            >
              Created
              {#if showSorting}
                {#if sortCol === "createdAt"}
                  <span class="sort-arrow">{sortDir === "asc" ? "▲" : "▼"}</span>
                {:else}
                  <span class="sort-arrow inactive">⇅</span>
                {/if}
              {/if}
            </th>
          {/if}
          {#if showActions}
            <th class="col-actions"></th>
          {/if}
          {#if showStatusBadge}
            <th class="col-status"></th>
          {/if}
        </tr>
      </thead>
      <tbody>
        {#each questions as question (question.id)}
          {@const alreadyIn = isAlreadyInSet(question.id)}
          {@const selected = selectedSet.has(question.id) || alreadyIn}
          <tr
            class:selected={selected && !alreadyIn}
            class:already-in-set={alreadyIn}
          >
            <td class="col-check">
              <input
                type="checkbox"
                checked={selected}
                disabled={alreadyIn}
                onchange={() => onToggleSelect(question.id)}
                onclick={(e) => e.stopPropagation()}
                title="Select"
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
            <td class="col-question">
              <div class="table-question-text">
                <MarkdownPreview md={question.question} />
              </div>
            </td>
            {#if showCreatedDate}
              <td class="col-created">
                <span title="Updated: {new Date(question.updatedAt).toLocaleString()}">
                  {new Date(question.createdAt).toLocaleDateString()}
                </span>
              </td>
            {/if}
            {#if showActions && onEdit}
              <td class="col-actions">
                {#if onPreview}
                  <button
                    onclick={(e) => { e.stopPropagation(); onPreview(question); }}
                    class="icon-btn preview-icon"
                    title="Preview question"
                  ><IconEye size={15} /></button>
                {/if}
                <button
                  onclick={(e) => onEdit!(question, e)}
                  class="icon-btn edit-icon"
                  title="Edit question">✎ Edit</button
                >
              </td>
            {/if}
            {#if showStatusBadge}
              <td class="col-status">
                {#if onPreview}
                  <button
                    onclick={(e) => { e.stopPropagation(); onPreview(question); }}
                    class="icon-btn preview-icon"
                    title="Preview question"
                  ><IconEye size={15} /></button>
                {/if}
                {#if alreadyIn}
                  <span class="already-badge">In set</span>
                {:else if onAddToSet}
                  <button
                    type="button"
                    onclick={(e) => { e.stopPropagation(); onAddToSet(question); }}
                    class="icon-btn add-icon"
                    title="Add to set"
                  >+ Add</button>
                {/if}
              </td>
            {/if}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}

<style>
  /* Card grid variants */
  .questions-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
    gap: 1.5rem;
  }

  .picker-grid {
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1rem;
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    align-content: start;
    margin-bottom: 0.5rem;
  }

  /* Picker card overrides */
  .picker-card {
    cursor: default;
    height: auto;
    display: flex;
    flex-direction: column;
    transition:
      border-color 0.15s,
      box-shadow 0.15s;
  }

  .picker-card .card-actions {
    margin-top: auto;
  }


  /* Catalog card: fixed height, hover */
  .question-card:not(.picker-card) {
    height: 280px;
    display: flex;
    flex-direction: column;
    transition: all 0.2s;
  }

  .question-card:not(.picker-card):hover {
    border-color: var(--color-primary);
    box-shadow: 0 2px 8px rgba(0, 102, 204, 0.1);
  }

  .question-card {
    --question-text-fade-color: white;
  }

  .question-card.selected {
    border-color: #4caf50;
    background: #f1f8f4;
    box-shadow: 0 2px 8px rgba(76, 175, 80, 0.15);
    --question-text-fade-color: #f1f8f4;
  }

  .question-card.already-in-set {
    opacity: 0.55;
    cursor: default;
  }

  /* Header row */
  .question-header {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
    flex-wrap: wrap;
  }

  .question-card:not(.picker-card) .question-header {
    justify-content: space-between;
    margin-bottom: 1rem;
    gap: 1rem;
  }

  /* Type badge */
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

  .question-card:not(.picker-card) .question-type {
    padding: 0.25rem 0.75rem;
  }

  .question-type.rating {
    background: #fff3e0;
    color: #f57c00;
  }

  /* Tags */
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

  .question-card:not(.picker-card) .tag {
    padding: 0.25rem 0.5rem;
  }

  /* Already-in-set badge */
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

  /* Question content */
  .question-content {
    margin-bottom: 1rem;
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .question-text {
    font-size: 0.95rem;
    overflow: hidden;
    position: relative;
  }

  .question-card:not(.picker-card) .question-text {
    max-height: 100px;
  }

  .picker-card .question-content {
    overflow: visible;
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

  .question-card:not(.picker-card) .question-text::after {
    height: 30px;
  }

  .question-card.selected .question-text::after {
    background: linear-gradient(to bottom, transparent, #f1f8f4);
  }

  .question-text :global(.markdown-preview) {
    font-size: 0.95rem;
  }

  .question-text :global(.markdown-preview h1),
  .question-text :global(.markdown-preview h2),
  .question-text :global(.markdown-preview h3) {
    font-size: 1rem;
    margin-top: 0.5rem;
    margin-bottom: 0.25rem;
  }

  /* Expected answer */
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
  }

  .expected-answer-content :global(.markdown-preview) {
    font-size: 0.9rem;
    color: var(--color-text-secondary);
  }

  .expected-answer-content :global(.markdown-preview h1),
  .expected-answer-content :global(.markdown-preview h2),
  .expected-answer-content :global(.markdown-preview h3) {
    font-size: 0.95rem;
    margin-top: 0.5rem;
    margin-bottom: 0.25rem;
  }

  /* Difficulty / rating */
  .rating-info {
    margin-top: 0.5rem;
    color: var(--color-text-secondary);
    font-size: 0.8rem;
  }

  .question-card:not(.picker-card) .rating-info {
    margin-bottom: 1rem;
  }

  /* Created date */
  .question-meta {
    margin-bottom: 0.5rem;
    color: #999;
    font-size: 0.75rem;
  }

  /* Card actions */
  .card-actions {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid #eee;
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .action-btn.preview {
    background: none;
    border: 1px solid var(--color-border);
    color: var(--color-primary);
    font-size: 0.85rem;
    padding: 0.3rem 0.5rem;
    border-radius: 4px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    transition:
      background 0.15s,
      border-color 0.15s;
  }

  .action-btn.preview:hover {
    background: var(--color-bg-subtle);
    border-color: var(--color-primary);
  }

  .action-btn.add-to-set {
    flex: 1;
    padding: 0.4rem 0.75rem;
    background: #4caf50;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.85rem;
    font-weight: 500;
    transition: background 0.15s;
  }

  .action-btn.add-to-set:hover {
    background: #45a049;
  }

  .card-already-badge {
    flex: 1;
    text-align: center;
  }

  /* Icon buttons (table) */
  .icon-btn {
    background: none;
    border: none;
    cursor: pointer;
    padding: 0.25rem;
    font-size: 0.95rem;
    border-radius: 3px;
    line-height: 1;
    opacity: 0.6;
    transition:
      opacity 0.15s,
      background 0.15s;
  }

  .icon-btn:hover {
    opacity: 1;
    background: #f0f0f0;
  }

  .icon-btn.add-icon {
    opacity: 1;
    background: #4caf50;
    color: white;
    padding: 0.25rem 0.5rem;
    font-size: 0.8rem;
    font-weight: 500;
  }

  .icon-btn.add-icon:hover {
    background: #45a049;
  }

  /* Table wrapper */
  .picker-table-wrap {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    margin-bottom: 0.5rem;
  }

  /* Sortable columns */
  .col-sortable {
    cursor: pointer;
    user-select: none;
  }

  .col-sortable:hover {
    color: var(--color-primary);
  }

  .sort-arrow {
    font-size: 0.7rem;
    margin-left: 0.25rem;
  }

  .sort-arrow.inactive {
    opacity: 0.35;
  }

  /* Column widths */
  .col-check {
    width: 32px;
    text-align: center;
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
    max-width: 400px;
  }

  .table-question-text {
    max-height: 3.5rem;
    overflow: hidden;
    position: relative;
  }

  .table-question-text::after {
    content: "";
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 1.5rem;
    background: linear-gradient(to bottom, transparent, white);
    pointer-events: none;
  }

  .table-question-text :global(.markdown-preview) {
    font-size: 0.9rem;
  }

  .table-question-text :global(.markdown-preview p) {
    margin: 0;
  }

  :global([data-theme="dark"]) .table-question-text::after {
    background: linear-gradient(to bottom, transparent, #1a1a1a);
  }

  :global(.questions-table) tbody tr.selected .table-question-text::after {
    background: linear-gradient(to bottom, transparent, #f1f8f4);
  }

  :global([data-theme="dark"]) :global(.questions-table) tbody tr.selected .table-question-text::after {
    background: linear-gradient(to bottom, transparent, #2d3d2f);
  }

  .col-created {
    white-space: nowrap;
    color: var(--color-text-secondary);
    font-size: 0.85rem;
  }

  .col-actions {
    width: 72px;
    text-align: right;
    white-space: nowrap;
  }

  .col-status {
    width: 100px;
    text-align: right;
    white-space: nowrap;
  }

  .no-value {
    color: #bbb;
  }

  /* Clickable table rows */
  :global(.questions-table) tbody tr.already-in-set {
    opacity: 0.55;
    cursor: default;
  }

  /* Dark mode */
  :global([data-theme="dark"]) .question-card {
    --question-text-fade-color: #1a1a1a;
  }

  :global([data-theme="dark"]) .question-card.selected {
    background: #2d3d2f;
    border-color: #4caf50;
    --question-text-fade-color: #2d3d2f;
  }

  :global([data-theme="dark"]) .question-card.selected .question-text::after {
    background: linear-gradient(to bottom, transparent, #2d3d2f);
  }

  :global([data-theme="dark"]) .question-card.already-in-set .question-text::after {
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

  :global([data-theme="dark"]) .expected-answer-content {
    background: #1e1e1e;
  }

  :global([data-theme="dark"]) .card-actions {
    border-top-color: #444;
  }

  :global([data-theme="dark"]) .icon-btn:hover {
    background: #2a2a2a;
  }

  :global([data-theme="dark"]) .icon-btn.add-icon {
    background: #2e7d32;
  }

  :global([data-theme="dark"]) .icon-btn.add-icon:hover {
    background: #388e3c;
  }

  :global([data-theme="dark"]) .action-btn.add-to-set {
    background: #2e7d32;
  }

  :global([data-theme="dark"]) .action-btn.add-to-set:hover {
    background: #388e3c;
  }

  :global([data-theme="dark"]) .col-question {
    color: #ddd;
  }
</style>
