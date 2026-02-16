<script lang="ts">
  import { onMount } from "svelte";
  import { push } from "svelte-spa-router";
  import { questionSetDB, questionDB } from "../lib/db";
  import type { QuestionSet, Question } from "../lib/types";
  import { QuestionType } from "../lib/types";
  import Navigation from "../lib/Navigation.svelte";
  import Breadcrumbs from "../lib/Breadcrumbs.svelte";
  import SessionModal from "../lib/SessionModal.svelte";
  import MarkdownPreview from "../components/MarkdownPreview.svelte";
  import AddQuestionsModal from "../lib/AddQuestionsModal.svelte";
  import { userSettings, type QuestionViewMode } from "../lib/userSettings";

  let { params }: { params: { setId: string } } = $props();

  let set: QuestionSet | null = $state(null);
  let questions: Question[] = $state([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  let viewMode = $state<QuestionViewMode>($userSettings.questionViewMode);

  let showEditModal = $state(false);
  let editFormData = $state({ name: "", notes: "" });
  let savingEdit = $state(false);

  let showDeleteConfirm = $state(false);
  let deleting = $state(false);

  let removeConfirmId: string | null = $state(null);

  let showAddModal = $state(false);

  onMount(() => {
    loadSetAndQuestions();
  });

  const loadSetAndQuestions = async () => {
    try {
      loading = true;
      error = null;
      const loaded = await questionSetDB.read(params.setId);
      if (!loaded) {
        error = "Question set not found.";
        loading = false;
        return;
      }
      set = loaded;
      const resolved: Question[] = [];
      for (const id of set.questionIds) {
        const q = await questionDB.read(id);
        if (q) resolved.push(q);
      }
      questions = resolved;
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to load question set";
    } finally {
      loading = false;
    }
  };

  const openEditModal = () => {
    if (!set) return;
    editFormData = { name: set.name, notes: set.notes };
    showEditModal = true;
  };

  const handleEditSubmit = async (event: Event) => {
    event.preventDefault();
    if (!set || !editFormData.name.trim()) return;
    try {
      savingEdit = true;
      const updated: QuestionSet = {
        id: set.id,
        name: editFormData.name.trim(),
        notes: editFormData.notes.trim(),
        questionIds: [...set.questionIds],
        createdAt: set.createdAt,
        updatedAt: new Date(),
      };
      await questionSetDB.update(updated);
      set = updated;
      showEditModal = false;
    } catch (err) {
      alert("Failed to save: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      savingEdit = false;
    }
  };

  const handleDeleteSet = async () => {
    if (!set) return;
    try {
      deleting = true;
      await questionSetDB.delete(set.id);
      push("/questions");
    } catch (err) {
      alert("Failed to delete: " + (err instanceof Error ? err.message : "Unknown error"));
      deleting = false;
    }
  };

  // Build a plain (non-proxy) QuestionSet safe for IndexedDB
  const plainSet = (base: QuestionSet, questionIds: string[]): QuestionSet => ({
    id: base.id,
    name: base.name,
    notes: base.notes,
    questionIds: [...questionIds],
    createdAt: base.createdAt,
    updatedAt: new Date(),
  });

  const handleRemoveQuestion = async (questionId: string) => {
    if (!set) return;
    const updated = plainSet(
      set,
      set.questionIds.filter((id) => id !== questionId)
    );
    await questionSetDB.update(updated);
    set = updated;
    questions = questions.filter((q) => q.id !== questionId);
    removeConfirmId = null;
  };

  const moveUp = async (index: number) => {
    if (!set || index === 0) return;
    const newIds = [...set.questionIds];
    [newIds[index - 1], newIds[index]] = [newIds[index], newIds[index - 1]];
    const updated = plainSet(set, newIds);
    await questionSetDB.update(updated);
    set = updated;
    const newQs = [...questions];
    [newQs[index - 1], newQs[index]] = [newQs[index], newQs[index - 1]];
    questions = newQs;
  };

  const moveDown = async (index: number) => {
    if (!set || index >= questions.length - 1) return;
    const newIds = [...set.questionIds];
    [newIds[index], newIds[index + 1]] = [newIds[index + 1], newIds[index]];
    const updated = plainSet(set, newIds);
    await questionSetDB.update(updated);
    set = updated;
    const newQs = [...questions];
    [newQs[index], newQs[index + 1]] = [newQs[index + 1], newQs[index]];
    questions = newQs;
  };

  const handleQuestionsAdded = async (selectedIds: string[]) => {
    if (!set) return;
    const existing = new Set(set.questionIds);
    const toAdd = selectedIds.filter((id) => !existing.has(id));
    if (toAdd.length === 0) {
      showAddModal = false;
      return;
    }
    const newIds = [...set.questionIds, ...toAdd];
    const updated = plainSet(set, newIds);
    await questionSetDB.update(updated);
    set = updated;
    const newQs: Question[] = [];
    for (const id of toAdd) {
      const q = await questionDB.read(id);
      if (q) newQs.push(q);
    }
    questions = [...questions, ...newQs];
    showAddModal = false;
  };

  const truncateWords = (text: string, max: number): string => {
    const words = text.trim().split(/\s+/);
    return words.length <= max ? text : words.slice(0, max).join(" ") + "…";
  };
</script>

<div class="page question-set-detail">
  <Navigation />
  <Breadcrumbs
    items={[
      { label: "Home", href: "/" },
      { label: "Questions", href: "/questions" },
      { label: "Question Sets", href: "/question-sets" },
      { label: set?.name ?? "…" },
    ]}
  />

  {#if loading}
    <p class="loading">Loading...</p>
  {:else if error}
    <p class="error">{error}</p>
  {:else if set}
    <header>
      <div class="header-info">
        <div class="header-title-row">
          <h1>{set.name}</h1>
          <span class="question-count-badge"
            >{questions.length} question{questions.length !== 1 ? "s" : ""}</span
          >
        </div>
        {#if set.notes}
          <p class="set-notes">{set.notes}</p>
        {/if}
      </div>
      <div class="header-actions">
        <button onclick={openEditModal} class="secondary">Edit Set</button>
        <button onclick={() => (showDeleteConfirm = true)} class="danger">Delete Set</button>
      </div>
    </header>

    <div class="section-toolbar">
      <h2>Questions</h2>
      <div class="toolbar-right">
        <div class="view-toggle">
          <button
            type="button"
            class="view-btn"
            class:active={viewMode === "cards"}
            onclick={() => {
              viewMode = "cards";
              userSettings.setQuestionViewMode("cards");
            }}
            title="Card view">⊞</button
          >
          <button
            type="button"
            class="view-btn"
            class:active={viewMode === "table"}
            onclick={() => {
              viewMode = "table";
              userSettings.setQuestionViewMode("table");
            }}
            title="Table view">☰</button
          >
        </div>
        <button onclick={() => (showAddModal = true)} class="primary">+ Add Questions</button>
      </div>
    </div>

    {#if questions.length === 0}
      <div class="empty-state">
        <h2>No questions yet</h2>
        <p>Add questions from the catalog to build this set.</p>
        <button onclick={() => (showAddModal = true)} class="primary">+ Add Questions</button>
      </div>
    {:else if viewMode === "cards"}
      <div class="questions-grid">
        {#each questions as question, index (question.id)}
          <div class="question-card set-question-card">
            <div class="reorder-controls">
              <button
                type="button"
                class="reorder-btn"
                onclick={() => moveUp(index)}
                disabled={index === 0}
                title="Move up">▲</button
              >
              <span class="order-label">{index + 1}</span>
              <button
                type="button"
                class="reorder-btn"
                onclick={() => moveDown(index)}
                disabled={index === questions.length - 1}
                title="Move down">▼</button
              >
            </div>
            <div class="question-main">
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
                  onclick={() => (removeConfirmId = question.id)}
                  class="action-btn delete-narrow"
                  title="Remove from set">🗑️ Remove</button
                >
              </div>
            </div>
          </div>
        {/each}
      </div>
    {:else}
      <table class="questions-table">
        <thead>
          <tr>
            <th class="col-order">#</th>
            <th class="col-type">Type</th>
            <th class="col-difficulty">Difficulty</th>
            <th class="col-question">Question</th>
            <th class="col-reorder">Order</th>
            <th class="col-actions"></th>
          </tr>
        </thead>
        <tbody>
          {#each questions as question, index (question.id)}
            <tr>
              <td class="col-order">{index + 1}</td>
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
              <td class="col-reorder">
                <button
                  class="icon-btn"
                  onclick={() => moveUp(index)}
                  disabled={index === 0}
                  title="Move up">▲</button
                >
                <button
                  class="icon-btn"
                  onclick={() => moveDown(index)}
                  disabled={index === questions.length - 1}
                  title="Move down">▼</button
                >
              </td>
              <td class="col-actions">
                <button
                  onclick={() => (removeConfirmId = question.id)}
                  class="icon-btn"
                  title="Remove from set">🗑️</button
                >
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  {/if}
</div>

<!-- Edit Set Modal -->
<SessionModal
  show={showEditModal}
  onClose={() => (showEditModal = false)}
  title="Edit Question Set"
  size="medium"
>
  <form onsubmit={handleEditSubmit} autocomplete="off" data-form-type="other">
    <div class="form-group">
      <label for="editSetName">Name <span class="required">*</span></label>
      <input
        id="editSetName"
        type="text"
        bind:value={editFormData.name}
        required
        autocomplete="off"
        data-lpignore="true"
        data-form-type="other"
      />
    </div>
    <div class="form-group">
      <label for="editSetNotes">Notes</label>
      <textarea id="editSetNotes" bind:value={editFormData.notes} rows={3}></textarea>
    </div>
    <div class="modal-actions">
      <button
        type="button"
        onclick={() => (showEditModal = false)}
        class="secondary"
        disabled={savingEdit}>Cancel</button
      >
      <button type="submit" class="primary" disabled={savingEdit}
        >{savingEdit ? "Saving..." : "Update"}</button
      >
    </div>
  </form>
</SessionModal>

<!-- Delete Set Confirmation -->
<SessionModal
  show={showDeleteConfirm}
  onClose={() => (showDeleteConfirm = false)}
  title="Delete Question Set?"
  size="small"
>
  <p class="confirm-text">
    Are you sure you want to delete <strong>{set?.name}</strong>? The questions in the catalog will
    not be affected.
  </p>
  <div class="modal-actions">
    <button
      type="button"
      onclick={() => (showDeleteConfirm = false)}
      class="secondary"
      disabled={deleting}>Cancel</button
    >
    <button type="button" onclick={handleDeleteSet} class="danger" disabled={deleting}
      >{deleting ? "Deleting..." : "Delete"}</button
    >
  </div>
</SessionModal>

<!-- Remove Question Confirmation -->
<SessionModal
  show={!!removeConfirmId}
  onClose={() => (removeConfirmId = null)}
  title="Remove Question?"
  size="small"
>
  <p class="confirm-text">
    Remove this question from the set? It will remain in the question catalog.
  </p>
  <div class="modal-actions">
    <button type="button" onclick={() => (removeConfirmId = null)} class="secondary">Cancel</button>
    <button
      type="button"
      onclick={() => removeConfirmId && handleRemoveQuestion(removeConfirmId)}
      class="danger">Remove</button
    >
  </div>
</SessionModal>

<!-- Add Questions Picker Modal -->
<AddQuestionsModal
  show={showAddModal}
  existingQuestionIds={set?.questionIds ?? []}
  onClose={() => (showAddModal = false)}
  onConfirm={handleQuestionsAdded}
/>

<style>
  .question-set-detail {
    width: 100%;
  }

  .question-set-detail > header,
  .question-set-detail > :not(:global(.navigation-tabs)):not(:global(.breadcrumbs)):not(header) {
    padding: 1rem;
  }

  header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .header-info {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .header-title-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  h1 {
    margin: 0;
    font-size: 1.75rem;
    color: #1a1a1a;
  }

  .question-count-badge {
    display: inline-block;
    padding: 0.25rem 0.75rem;
    background: #e3f2fd;
    color: #1976d2;
    border-radius: 12px;
    font-size: 0.85rem;
    font-weight: 600;
  }

  .set-notes {
    margin: 0;
    color: #666;
    font-size: 0.95rem;
    max-width: 600px;
  }

  .section-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 1rem 1rem;
  }

  .section-toolbar h2 {
    margin: 0;
    font-size: 1.1rem;
    color: #333;
  }

  .toolbar-right {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .view-toggle {
    display: flex;
    gap: 2px;
    border: 1px solid #ddd;
    border-radius: 4px;
    overflow: hidden;
  }

  .view-btn {
    padding: 0.35rem 0.6rem;
    background: white;
    border: none;
    cursor: pointer;
    font-size: 1rem;
    color: #888;
    line-height: 1;
  }

  .view-btn:hover {
    background: #f0f0f0;
    color: #333;
  }

  .view-btn.active {
    background: #0066cc;
    color: white;
  }

  .questions-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
    gap: 1.5rem;
    padding: 0 1rem;
  }

  .set-question-card {
    display: flex;
    flex-direction: row;
    gap: 0.75rem;
    height: auto;
    min-height: 160px;
  }

  .reorder-controls {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    gap: 0.25rem;
    padding-top: 0.25rem;
    flex-shrink: 0;
  }

  .reorder-btn {
    background: none;
    border: 1px solid #ddd;
    border-radius: 3px;
    padding: 0.2rem 0.45rem;
    cursor: pointer;
    font-size: 0.65rem;
    color: #888;
    line-height: 1;
    transition:
      background 0.15s,
      border-color 0.15s,
      color 0.15s;
  }

  .reorder-btn:hover:not(:disabled) {
    background: #f0f0f0;
    border-color: #0066cc;
    color: #0066cc;
  }

  .reorder-btn:disabled {
    opacity: 0.25;
    cursor: default;
  }

  .order-label {
    font-size: 0.7rem;
    color: #aaa;
    font-weight: 600;
    line-height: 1;
    padding: 0.1rem 0;
  }

  .question-main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
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

  .question-text {
    font-size: 0.95rem;
    flex: 1;
    overflow: hidden;
    max-height: 100px;
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

  .expected-answer-content {
    margin-top: 0.5rem;
    padding: 0.5rem;
    background: #f9f9f9;
    border-radius: 4px;
    font-size: 0.9rem;
  }

  .expected-answer-content :global(.markdown-preview) {
    font-size: 0.9rem;
    color: #666;
  }

  .rating-info {
    margin-top: 0.5rem;
    color: #888;
  }

  .card-actions {
    margin-top: 0.75rem;
    padding-top: 0.75rem;
    border-top: 1px solid #eee;
  }

  /* Table styles */
  .questions-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9rem;
    table-layout: fixed;
  }

  .questions-table thead th {
    text-align: left;
    padding: 0.5rem 0.75rem;
    border-bottom: 2px solid #ddd;
    font-weight: 600;
    color: #555;
    white-space: nowrap;
  }

  .questions-table tbody tr {
    border-bottom: 1px solid #eee;
    transition: background 0.1s;
  }

  .questions-table tbody tr:hover {
    background: #f8f8f8;
  }

  .questions-table td {
    padding: 0.5rem 0.75rem;
    vertical-align: middle;
  }

  .col-order {
    width: 36px;
    text-align: center;
    color: #aaa;
    font-size: 0.85rem;
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
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .col-reorder {
    width: 56px;
    text-align: center;
    white-space: nowrap;
  }

  .col-actions {
    width: 40px;
    text-align: center;
  }

  .no-value {
    color: #bbb;
  }

  .icon-btn {
    background: none;
    border: none;
    cursor: pointer;
    padding: 0.2rem 0.35rem;
    font-size: 0.9rem;
    border-radius: 3px;
    line-height: 1;
    opacity: 0.6;
    transition:
      opacity 0.15s,
      background 0.15s;
  }

  .icon-btn:hover:not(:disabled) {
    opacity: 1;
    background: #f0f0f0;
  }

  .icon-btn:disabled {
    opacity: 0.2;
    cursor: default;
  }

  .required {
    color: #d32f2f;
    margin-left: 0.25rem;
  }

  .confirm-text {
    line-height: 1.6;
    color: #666;
  }

  .confirm-text strong {
    color: #d32f2f;
    font-weight: 600;
  }

  /* Dark mode */
  :global([data-theme="dark"]) h1 {
    color: #ffffff;
  }

  :global([data-theme="dark"]) .question-count-badge {
    background: #1e3a5f;
    color: #64b5f6;
  }

  :global([data-theme="dark"]) .set-notes {
    color: #a0a0a0;
  }

  :global([data-theme="dark"]) .section-toolbar h2 {
    color: #e0e0e0;
  }

  :global([data-theme="dark"]) .view-toggle {
    border-color: #444;
  }

  :global([data-theme="dark"]) .view-btn {
    background: #1a1a1a;
    color: #888;
  }

  :global([data-theme="dark"]) .view-btn:hover {
    background: #2a2a2a;
    color: #ccc;
  }

  :global([data-theme="dark"]) .view-btn.active {
    background: #0066cc;
    color: white;
  }

  :global([data-theme="dark"]) .reorder-btn {
    border-color: #444;
    color: #888;
  }

  :global([data-theme="dark"]) .reorder-btn:hover:not(:disabled) {
    background: #2a2a2a;
    border-color: #66aaff;
    color: #66aaff;
  }

  :global([data-theme="dark"]) .order-label {
    color: #666;
  }

  :global([data-theme="dark"]) .question-type {
    background: #1e3a5f;
    color: #64b5f6;
  }

  :global([data-theme="dark"]) .question-type.rating {
    background: #3a2500;
    color: #ffb74d;
  }

  :global([data-theme="dark"]) .tag {
    background: #333;
    color: #a0a0a0;
  }

  :global([data-theme="dark"]) .question-text::after {
    background: linear-gradient(to bottom, transparent, #1a1a1a);
  }

  :global([data-theme="dark"]) .expected-answer summary {
    color: #4da3ff;
  }

  :global([data-theme="dark"]) .expected-answer-content {
    background: #2a2a2a;
  }

  :global([data-theme="dark"]) .expected-answer-content :global(.markdown-preview) {
    color: #a0a0a0;
  }

  :global([data-theme="dark"]) .rating-info {
    color: #888;
  }

  :global([data-theme="dark"]) .card-actions {
    border-top-color: #333;
  }

  :global([data-theme="dark"]) .questions-table thead th {
    border-color: #444;
    color: #a0a0a0;
  }

  :global([data-theme="dark"]) .questions-table tbody tr {
    border-color: #2a2a2a;
  }

  :global([data-theme="dark"]) .questions-table tbody tr:hover {
    background: #1e1e1e;
  }

  :global([data-theme="dark"]) .questions-table td {
    color: #ddd;
  }

  :global([data-theme="dark"]) .col-question {
    color: #ddd;
  }

  :global([data-theme="dark"]) .col-order {
    color: #666;
  }

  :global([data-theme="dark"]) .icon-btn:hover:not(:disabled) {
    background: #2a2a2a;
  }

  :global([data-theme="dark"]) .confirm-text {
    color: #a0a0a0;
  }

  :global([data-theme="dark"]) .confirm-text strong {
    color: #ff8a80;
  }
</style>
