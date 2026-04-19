<script lang="ts">
  import { questionDB } from "./db";
  import { type Question } from "./types";
  import SessionModal from "./SessionModal.svelte";
  import QuestionFilterPanel from "../components/QuestionFilterPanel.svelte";
  import QuestionListView from "../components/QuestionListView.svelte";
  import QuestionPreviewModal from "../components/QuestionPreviewModal.svelte";
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
  let previewQuestion = $state<Question | null>(null);

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

  const handleAddSingle = async (question: Question) => {
    if (isAlreadyInSet(question.id)) return;
    try {
      confirming = true;
      await onConfirm([question.id]);
    } finally {
      confirming = false;
    }
  };


  const eligibleCount = $derived(filteredQuestions.filter((q) => !isAlreadyInSet(q.id)).length);
  const allEligibleSelected = $derived(
    eligibleCount > 0 &&
      filteredQuestions.filter((q) => !isAlreadyInSet(q.id)).every((q) => newlySelected.has(q.id))
  );


</script>

<SessionModal {show} {onClose} title="Add Questions to Set" size="large">
  <div class="modal-body">
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
      {:else}
        <QuestionListView
          questions={filteredQuestions}
          {viewMode}
          selectedSet={newlySelected}
          onToggleSelect={toggleSelection}
          alreadyInSetIds={existingQuestionIds}
          onToggleSelectAll={viewMode === "table" ? toggleSelectAllVisible : undefined}
          {allEligibleSelected}
          showStatusBadge={true}
          showCreatedDate={true}
          showExpectedAnswer={true}
          showSorting={true}
          clickableRows={true}
          onPreview={(q) => (previewQuestion = q)}
          onAddToSet={handleAddSingle}
        />
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

<QuestionPreviewModal question={previewQuestion} onClose={() => (previewQuestion = null)} />

<style>
  .modal-body {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }

  .modal-actions {
    margin-top: auto;
    padding-top: 1rem;
  }

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

  .picker-empty {
    padding: 2rem;
    text-align: center;
    color: #999;
  }

  :global([data-theme="dark"]) .select-all-label {
    color: #e0e0e0;
  }

  :global([data-theme="dark"]) .picker-empty {
    color: var(--color-text-secondary);
  }
</style>
