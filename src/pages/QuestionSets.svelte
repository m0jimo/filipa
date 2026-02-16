<script lang="ts">
  import { onMount } from "svelte";
  import { link } from "svelte-spa-router";
  import { questionSetDB, questionDB, generateId, generateQuestionHash } from "../lib/db";
  import {
    QuestionType,
    type QuestionSet,
    type Question,
    type QuestionSetExport,
  } from "../lib/types";
  import { SvelteSet, SvelteMap } from "svelte/reactivity";
  import Navigation from "../lib/Navigation.svelte";
  import Breadcrumbs from "../lib/Breadcrumbs.svelte";
  import SessionModal from "../lib/SessionModal.svelte";

  let questionSets: QuestionSet[] = $state([]);
  let setsLoading = $state(true);
  let setsError = $state<string | null>(null);

  let showSetModal = $state(false);
  let editingSet: QuestionSet | null = $state(null);
  let setFormData = $state({ name: "", notes: "" });
  let savingSet = $state(false);
  let deleteSetConfirmId: string | null = $state(null);

  // Selection state
  let selectedSetIds = $state(new SvelteSet<string>());
  let selectAll = $state(false);

  // Export state
  let showExportModal = $state(false);
  let exportFormat = $state<"json" | "markdown">("json");
  let isExporting = $state(false);

  // Import state
  let showImportModal = $state(false);
  let importFileInput: HTMLInputElement | null = $state(null);
  let importInProgress = $state(false);
  let importResults = $state<{ success: number; errors: string[]; warnings: string[] } | null>(
    null
  );

  type DuplicateResolution = "skip" | "replace" | "new";

  type ImportPreviewSet = {
    name: string;
    notes: string;
    originalId: string;
    questionCount: number;
    isDuplicateName: boolean;
    duplicateResolution: DuplicateResolution;
    selected: boolean;
  };

  type ImportPreviewQuestion = {
    question: string;
    expectedAnswer: string;
    tags: string[];
    questionType: string;
    difficulty: number[];
    hash: string;
    originalId: string;
    isDuplicate: boolean;
    duplicateResolution: DuplicateResolution;
    selected: boolean;
  };

  type ImportPreview = {
    sets: ImportPreviewSet[];
    questions: ImportPreviewQuestion[];
    errors: string[];
    warnings: string[];
    fileType: string;
  };

  let importPreview = $state<ImportPreview | null>(null);

  const selectedCount = $derived(selectedSetIds.size);

  const loadSets = async () => {
    try {
      setsLoading = true;
      setsError = null;
      const all = await questionSetDB.list();
      all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      questionSets = all;
    } catch (err) {
      setsError = err instanceof Error ? err.message : "Failed to load question sets";
    } finally {
      setsLoading = false;
    }
  };

  const openCreateSetModal = () => {
    editingSet = null;
    setFormData = { name: "", notes: "" };
    showSetModal = true;
  };

  const openEditSetModal = (set: QuestionSet, event: MouseEvent) => {
    event.stopPropagation();
    editingSet = set;
    setFormData = { name: set.name, notes: set.notes };
    showSetModal = true;
  };

  const closeSetModal = () => {
    showSetModal = false;
    editingSet = null;
  };

  const handleSetSubmit = async (event: Event) => {
    event.preventDefault();
    if (!setFormData.name.trim()) return;
    try {
      savingSet = true;
      const now = new Date();
      if (editingSet) {
        const updated: QuestionSet = {
          id: editingSet.id,
          name: setFormData.name.trim(),
          notes: setFormData.notes.trim(),
          questionIds: [...editingSet.questionIds],
          createdAt: editingSet.createdAt,
          updatedAt: now,
        };
        await questionSetDB.update(updated);
      } else {
        const newSet: QuestionSet = {
          id: generateId(),
          name: setFormData.name.trim(),
          notes: setFormData.notes.trim(),
          questionIds: [],
          createdAt: now,
          updatedAt: now,
        };
        await questionSetDB.create(newSet);
      }
      await loadSets();
      closeSetModal();
    } catch (err) {
      alert(
        "Failed to save question set: " + (err instanceof Error ? err.message : "Unknown error")
      );
    } finally {
      savingSet = false;
    }
  };

  const handleSetDelete = async (setId: string) => {
    try {
      await questionSetDB.delete(setId);
      selectedSetIds = new SvelteSet([...selectedSetIds].filter((id) => id !== setId));
      await loadSets();
      deleteSetConfirmId = null;
    } catch (err) {
      alert(
        "Failed to delete question set: " + (err instanceof Error ? err.message : "Unknown error")
      );
    }
  };

  // Selection helpers
  const toggleSetSelection = (setId: string, event: Event) => {
    event.stopPropagation();
    const next = new SvelteSet(selectedSetIds);
    if (next.has(setId)) {
      next.delete(setId);
    } else {
      next.add(setId);
    }
    selectedSetIds = next;
    selectAll = questionSets.length > 0 && questionSets.every((s) => selectedSetIds.has(s.id));
  };

  const toggleSelectAll = () => {
    if (selectAll) {
      selectedSetIds = new SvelteSet();
      selectAll = false;
    } else {
      selectedSetIds = new SvelteSet(questionSets.map((s) => s.id));
      selectAll = true;
    }
  };

  // Export
  const openExportModal = () => {
    if (selectedSetIds.size === 0) return;
    exportFormat = "json";
    showExportModal = true;
  };

  const closeExportModal = () => {
    showExportModal = false;
  };

  const handleExport = async () => {
    try {
      isExporting = true;
      const setsToExport = questionSets.filter((s) => selectedSetIds.has(s.id));

      // Collect all unique question IDs
      const allQuestionIds = new SvelteSet<string>();
      setsToExport.forEach((s) => s.questionIds.forEach((id) => allQuestionIds.add(id)));

      // Load all questions
      const loadedQuestions: Question[] = [];
      for (const id of allQuestionIds) {
        const q = await questionDB.read(id);
        if (q) loadedQuestions.push(q);
      }

      let content: string;
      let filename: string;
      let mimeType: string;

      if (exportFormat === "json") {
        content = generateJsonExportSets(setsToExport, loadedQuestions);
        filename = `question-sets-${new Date().toISOString().slice(0, 10)}.json`;
        mimeType = "application/json";
      } else {
        content = generateMarkdownExportSets(setsToExport, loadedQuestions);
        filename = `question-sets-${new Date().toISOString().slice(0, 10)}.md`;
        mimeType = "text/markdown";
      }

      downloadFile(content, filename, mimeType);
      closeExportModal();
    } catch (err) {
      alert("Export failed: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      isExporting = false;
    }
  };

  const generateJsonExportSets = (sets: QuestionSet[], questions: Question[]): string => {
    const data: QuestionSetExport = {
      version: "1.0.0",
      exportedAt: new Date().toISOString(),
      type: "questionSets",
      questionSets: sets.map((s) => ({
        id: s.id,
        name: s.name,
        notes: s.notes,
        questionIds: [...s.questionIds],
        createdAt: new Date(s.createdAt).toISOString(),
        updatedAt: new Date(s.updatedAt).toISOString(),
      })),
      questions: questions.map((q) => ({
        id: q.id,
        question: q.question,
        expectedAnswer: q.expectedAnswer,
        tags: [...q.tags],
        questionType: q.questionType,
        difficulty: [...q.difficulty],
        hash: q.hash,
        createdAt: new Date(q.createdAt).toISOString(),
        updatedAt: new Date(q.updatedAt).toISOString(),
      })),
    };
    return JSON.stringify(data, null, 2);
  };

  const generateMarkdownExportSets = (sets: QuestionSet[], questions: Question[]): string => {
    const questionMap = new Map(questions.map((q) => [q.id, q]));
    const lines: string[] = [];

    lines.push("# Question Sets Export");
    lines.push("");
    lines.push(`Exported: ${new Date().toLocaleString()}`);
    lines.push(`Total Sets: ${sets.length}`);
    lines.push("");
    lines.push("---");
    lines.push("");

    sets.forEach((set, setIndex) => {
      lines.push(`## Question Set: ${set.name}`);
      lines.push(`Set ID: ${set.id}`);
      if (set.notes) {
        lines.push(`Notes: ${set.notes}`);
      }
      lines.push(`Questions: ${set.questionIds.length}`);
      lines.push("");

      set.questionIds.forEach((qId, qIndex) => {
        const q = questionMap.get(qId);
        if (!q) return;

        lines.push(`### Question ${qIndex + 1}`);
        lines.push(`Question ID: ${q.id}`);
        lines.push("");
        lines.push("#### Question");
        lines.push("");
        lines.push(q.question);
        lines.push("");
        lines.push("#### Expected Answer");
        lines.push("");
        lines.push(q.expectedAnswer || "*No expected answer provided.*");
        lines.push("");
        if (q.tags.length > 0) {
          lines.push(`Tags: ${q.tags.join(", ")}`);
        }
        if (q.difficulty && q.difficulty.length > 0) {
          lines.push(`Difficulty: [${q.difficulty.join(", ")}]`);
        }
        lines.push(`Type: ${q.questionType}`);
        lines.push("");
      });

      if (setIndex < sets.length - 1) {
        lines.push("---");
        lines.push("");
      }
    });

    return lines.join("\n");
  };

  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Import
  const openImportModal = () => {
    importResults = null;
    importPreview = null;
    showImportModal = true;
  };

  const closeImportModal = () => {
    showImportModal = false;
    importResults = null;
    importPreview = null;
  };

  const triggerFileUpload = () => importFileInput?.click();

  const handleFileUpload = async (event: Event) => {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    const ext = file.name.split(".").pop()?.toLowerCase();

    if (ext === "json") {
      await validateJsonImport(file);
    } else if (ext === "md") {
      await validateMarkdownImport(file);
    } else {
      alert("Unsupported file type. Please upload .json or .md files.");
    }

    input.value = "";
  };

  const validateJsonImport = async (file: File) => {
    importInProgress = true;
    importPreview = { sets: [], questions: [], errors: [], warnings: [], fileType: "JSON" };

    try {
      const text = await file.text();
      const data: QuestionSetExport = JSON.parse(text);

      if (data.type !== "questionSets") {
        importPreview.errors.push(
          "This JSON file does not appear to be a Question Sets export (missing type: \"questionSets\")."
        );
        return;
      }

      if (!Array.isArray(data.questionSets) || !Array.isArray(data.questions)) {
        importPreview.errors.push(
          "Invalid file structure: missing questionSets or questions arrays."
        );
        return;
      }

      // Validate and preview questions
      const allExistingSets = await questionSetDB.list();
      const existingSetNames = new Set(allExistingSets.map((s) => s.name.toLowerCase()));

      for (let i = 0; i < data.questions.length; i++) {
        const q = data.questions[i];
        if (!q.question || typeof q.question !== "string") {
          importPreview.errors.push(`Question ${i + 1}: Missing question text.`);
          continue;
        }

        const hash = generateQuestionHash(
          q.question,
          Array.isArray(q.tags) ? q.tags : [],
          q.questionType || "text"
        );

        const duplicates = await questionDB.listByHash(hash);
        const isDuplicate = duplicates.length > 0;

        if (isDuplicate) {
          importPreview.warnings.push(
            `Question ${i + 1}: Similar question already exists in catalog.`
          );
        }

        importPreview.questions.push({
          question: q.question,
          expectedAnswer: q.expectedAnswer || "",
          tags: Array.isArray(q.tags) ? q.tags : [],
          questionType: q.questionType || "text",
          difficulty: Array.isArray(q.difficulty) ? q.difficulty : [],
          hash,
          originalId: q.id || "",
          isDuplicate,
          duplicateResolution: isDuplicate ? "skip" : "new",
          selected: !isDuplicate,
        });
      }

      for (let i = 0; i < data.questionSets.length; i++) {
        const s = data.questionSets[i];
        if (!s.name) {
          importPreview.errors.push(`Set ${i + 1}: Missing name.`);
          continue;
        }

        const isDuplicateName = existingSetNames.has(s.name.toLowerCase());
        if (isDuplicateName) {
          importPreview.warnings.push(`Set "${s.name}": A set with this name already exists.`);
        }

        importPreview.sets.push({
          name: s.name,
          notes: s.notes || "",
          originalId: s.id || "",
          questionCount: Array.isArray(s.questionIds) ? s.questionIds.length : 0,
          isDuplicateName,
          duplicateResolution: isDuplicateName ? "skip" : "new",
          selected: !isDuplicateName,
        });
      }
    } catch (err) {
      importPreview.errors.push(
        `Failed to parse JSON: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    } finally {
      importInProgress = false;
    }
  };

  const validateMarkdownImport = async (file: File) => {
    importInProgress = true;
    importPreview = { sets: [], questions: [], errors: [], warnings: [], fileType: "Markdown" };

    try {
      const text = await file.text();

      // Split by "---" to get set sections
      const blocks = text.split(/^---$/m).filter((b) => b.trim());

      const allExistingSets = await questionSetDB.list();
      const existingSetNames = new Set(allExistingSets.map((s) => s.name.toLowerCase()));

      for (const block of blocks) {
        const setHeaderMatch = block.match(/^##\s+Question Set:\s+(.+)$/m);
        if (!setHeaderMatch) continue;

        const setName = setHeaderMatch[1].trim();
        const setIdMatch = block.match(/^Set ID:\s*(.*)$/m);
        const setNotesMatch = block.match(/^Notes:\s*(.*)$/m);

        const isDuplicateName = existingSetNames.has(setName.toLowerCase());
        if (isDuplicateName) {
          importPreview.warnings.push(`Set "${setName}": A set with this name already exists.`);
        }

        // Parse questions within this block
        const questionBlocks = block.split(/^###\s+Question\s+\d+/m).slice(1);

        for (let qi = 0; qi < questionBlocks.length; qi++) {
          const qBlock = questionBlocks[qi];

          const questionMatch = qBlock.match(/####\s+Question\s*\n([\s\S]*?)(?=####|Tags:|$)/i);
          const questionText = questionMatch?.[1]?.trim();

          if (!questionText) {
            importPreview.errors.push(
              `Set "${setName}", Question ${qi + 1}: Missing question text.`
            );
            continue;
          }

          const answerMatch = qBlock.match(
            /####\s+Expected Answer\s*\n([\s\S]*?)(?=####|Tags:|$)/i
          );
          const expectedAnswer = answerMatch?.[1]?.trim() || "";

          const tagsMatch = qBlock.match(/Tags:\s*(.+)/i);
          const tags =
            tagsMatch?.[1]
              ?.split(",")
              .map((t) => t.trim())
              .filter((t) => t) || [];

          const difficultyMatch = qBlock.match(/Difficulty:\s*\[([^\]]+)\]/i);
          const difficulty =
            difficultyMatch?.[1]
              ?.split(",")
              .map((r) => parseInt(r.trim()))
              .filter((r) => !isNaN(r)) || [];

          const typeMatch = qBlock.match(/Type:\s*(.+)/i);
          const questionType = typeMatch?.[1]?.trim() || "text";

          const qIdMatch = qBlock.match(/Question ID:\s*(.+)/i);
          const originalId = qIdMatch?.[1]?.trim() || "";

          const hash = generateQuestionHash(questionText, tags, questionType);
          const duplicates = await questionDB.listByHash(hash);
          const isDuplicate = duplicates.length > 0;

          if (isDuplicate) {
            importPreview.warnings.push(
              `Set "${setName}", Question ${qi + 1}: Similar question already exists in catalog.`
            );
          }

          importPreview.questions.push({
            question: questionText,
            expectedAnswer,
            tags,
            questionType,
            difficulty,
            hash,
            originalId,
            isDuplicate,
            duplicateResolution: isDuplicate ? "skip" : "new",
            selected: !isDuplicate,
          });
        }

        importPreview.sets.push({
          name: setName,
          notes: setNotesMatch?.[1]?.trim() || "",
          originalId: setIdMatch?.[1]?.trim() || "",
          questionCount: questionBlocks.length,
          isDuplicateName,
          duplicateResolution: isDuplicateName ? "skip" : "new",
          selected: !isDuplicateName,
        });
      }

      if (importPreview.sets.length === 0) {
        importPreview.errors.push(
          "No valid question sets found in this Markdown file. Check the format."
        );
      }
    } catch (err) {
      importPreview.errors.push(
        `Failed to parse Markdown: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    } finally {
      importInProgress = false;
    }
  };

  const confirmImport = async () => {
    if (!importPreview) return;

    const selectedSets = importPreview.sets.filter((s) => s.selected);
    if (selectedSets.length === 0) {
      alert("Please select at least one set to import.");
      return;
    }

    importInProgress = true;
    importResults = { success: 0, errors: [], warnings: [] };

    try {
      // Build a map from original question ID → new saved ID
      const questionIdMap = new SvelteMap<string, string>();

      // Save questions first
      for (let i = 0; i < importPreview.questions.length; i++) {
        const q = importPreview.questions[i];
        if (!q.selected) continue;

        try {
          const now = new Date();
          if (q.isDuplicate && q.duplicateResolution === "replace") {
            // Replace existing: find the existing question and update it
            const existing = await questionDB.listByHash(q.hash);
            if (existing.length > 0) {
              const updated: Question = {
                ...existing[0],
                question: q.question,
                expectedAnswer: q.expectedAnswer,
                tags: [...q.tags],
                questionType:
                  q.questionType.toLowerCase() === QuestionType.Rating
                    ? QuestionType.Rating
                    : QuestionType.Text,
                difficulty: q.difficulty ? [...q.difficulty] : [],
                hash: q.hash,
                updatedAt: now,
              };
              await questionDB.update(updated);
              questionIdMap.set(q.originalId, existing[0].id);
            }
          } else if (!q.isDuplicate || q.duplicateResolution === "new") {
            const newId = generateId();
            const newQuestion: Question = {
              id: newId,
              question: q.question,
              expectedAnswer: q.expectedAnswer,
              tags: [...q.tags],
              questionType:
                q.questionType.toLowerCase() === QuestionType.Rating
                  ? QuestionType.Rating
                  : QuestionType.Text,
              difficulty: q.difficulty ? [...q.difficulty] : [],
              hash:
                q.duplicateResolution === "new" && q.isDuplicate
                  ? generateQuestionHash(q.question + " (imported)", q.tags, q.questionType)
                  : q.hash,
              createdAt: now,
              updatedAt: now,
            };
            await questionDB.create(newQuestion);
            questionIdMap.set(q.originalId, newId);
          } else {
            // skip: map original ID to existing question ID (so sets can still reference it)
            const existing = await questionDB.listByHash(q.hash);
            if (existing.length > 0) {
              questionIdMap.set(q.originalId, existing[0].id);
            }
          }
        } catch (err) {
          importResults.errors.push(
            `Question ${i + 1}: ${err instanceof Error ? err.message : "Unknown error"}`
          );
        }
      }

      // Save sets, remapping question IDs
      for (let i = 0; i < selectedSets.length; i++) {
        const s = selectedSets[i];
        try {
          const now = new Date();
          // Remap questionIds using the map we built (only include IDs that were resolved)
          const remappedIds =
            s.questionCount > 0
              ? importPreview.questions
                  .filter((q) => q.selected || (q.isDuplicate && q.duplicateResolution === "skip"))
                  .map((q) => questionIdMap.get(q.originalId))
                  .filter((id): id is string => Boolean(id))
              : [];

          const newSet: QuestionSet = {
            id: generateId(),
            name:
              s.duplicateResolution === "new" && s.isDuplicateName
                ? `${s.name} (imported)`
                : s.name,
            notes: s.notes,
            questionIds: remappedIds,
            createdAt: now,
            updatedAt: now,
          };
          await questionSetDB.create(newSet);
          importResults.success++;
        } catch (err) {
          importResults.errors.push(
            `Set "${s.name}": ${err instanceof Error ? err.message : "Unknown error"}`
          );
        }
      }

      await loadSets();
      importPreview = null;
    } catch (err) {
      importResults.errors.push(
        `Import failed: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    } finally {
      importInProgress = false;
    }
  };

  const cancelPreview = () => {
    importPreview = null;
  };

  onMount(() => {
    loadSets();
  });
</script>

<div class="page question-sets">
  <Navigation />
  <Breadcrumbs
    items={[
      { label: "Home", href: "/" },
      { label: "Questions", href: "/questions" },
      { label: "Question Sets" },
    ]}
  />

  <header>
    <div class="header-left"></div>
    <div class="header-actions">
      {#if selectedCount > 0}
        <button onclick={openExportModal} class="export-btn">
          📤 Export Selected ({selectedCount})
        </button>
      {/if}
      <button onclick={openImportModal} class="secondary">Import Set</button>
      <button onclick={openCreateSetModal} class="primary">+ New Set</button>
    </div>
  </header>

  {#if setsLoading}
    <p class="loading">Loading question sets...</p>
  {:else if setsError}
    <p class="error">Error: {setsError}</p>
  {:else if questionSets.length === 0}
    <div class="empty-state">
      <h2>No question sets yet</h2>
      <p>Create your first question set to organise interview questions as templates.</p>
      <button onclick={openCreateSetModal} class="primary">+ New Set</button>
    </div>
  {:else}
    <div class="filters">
      <label class="select-all-checkbox">
        <input
          type="checkbox"
          checked={selectAll}
          indeterminate={selectedCount > 0 && !selectAll}
          onchange={toggleSelectAll}
        />
        Select All
      </label>
    </div>
    <div class="sets-grid">
      {#each questionSets as set (set.id)}
        <div class="set-card" class:selected={selectedSetIds.has(set.id)}>
          <div class="set-card-header">
            <h3 class="set-name">{set.name}</h3>
            <span class="set-count"
              >{set.questionIds.length} question{set.questionIds.length !== 1 ? "s" : ""}</span
            >
            <input
              type="checkbox"
              class="question-select"
              checked={selectedSetIds.has(set.id)}
              onchange={(e) => toggleSetSelection(set.id, e)}
              onclick={(e) => e.stopPropagation()}
              title="Select for export"
            />
          </div>
          {#if set.notes}
            <p class="set-notes">{set.notes}</p>
          {/if}
          <small class="set-date">Created {new Date(set.createdAt).toLocaleDateString()}</small>
          <div class="card-actions">
            <button
              class="action-btn delete-narrow"
              onclick={() => (deleteSetConfirmId = set.id)}
              title="Delete set">🗑️</button
            >
            <button class="action-btn edit" onclick={(e) => openEditSetModal(set, e)}>Edit</button>
            <a href="/question-sets/{set.id}" use:link class="action-btn select-interview">
              Open Set →
            </a>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- Create/Edit Set Modal -->
<SessionModal
  show={showSetModal}
  onClose={closeSetModal}
  title={editingSet ? "Edit Question Set" : "New Question Set"}
  size="medium"
>
  <form onsubmit={handleSetSubmit} autocomplete="off" data-form-type="other">
    <div class="form-group">
      <label for="setName">Name <span class="required">*</span></label>
      <input
        id="setName"
        name="set-name"
        type="text"
        bind:value={setFormData.name}
        placeholder="e.g. JavaScript Fundamentals"
        required
        autocomplete="off"
        data-lpignore="true"
        data-form-type="other"
      />
    </div>
    <div class="form-group">
      <label for="setNotes">Notes</label>
      <textarea
        id="setNotes"
        name="set-notes"
        bind:value={setFormData.notes}
        placeholder="Optional description or usage notes"
        rows={3}
      ></textarea>
    </div>
    <div class="modal-actions">
      <button type="button" onclick={closeSetModal} class="secondary" disabled={savingSet}
        >Cancel</button
      >
      <button type="submit" class="primary" disabled={savingSet}>
        {savingSet ? "Saving..." : editingSet ? "Update" : "Create"}
      </button>
    </div>
  </form>
</SessionModal>

<!-- Delete Set Confirmation Modal -->
<SessionModal
  show={!!deleteSetConfirmId}
  onClose={() => (deleteSetConfirmId = null)}
  title="Delete Question Set?"
  size="small"
>
  <p class="confirm-text">
    Are you sure you want to delete this question set? The questions themselves will not be deleted.
  </p>
  <div class="modal-actions">
    <button type="button" onclick={() => (deleteSetConfirmId = null)} class="secondary"
      >Cancel</button
    >
    <button
      type="button"
      onclick={() => deleteSetConfirmId && handleSetDelete(deleteSetConfirmId)}
      class="danger">Delete</button
    >
  </div>
</SessionModal>

<!-- Export Format Modal -->
<SessionModal
  show={showExportModal}
  onClose={closeExportModal}
  title="Export Question Sets"
  size="medium"
>
  <p class="export-description">
    Choose the export format for the selected {selectedCount} set{selectedCount !== 1 ? "s" : ""} with
    all their questions.
  </p>

  <div class="export-format-options">
    <label class="format-option">
      <input type="radio" name="export-format-sets" value="json" bind:group={exportFormat} />
      <div class="format-content">
        <strong>JSON Format</strong>
        <p>
          Structured data format, ideal for importing back into Filipa or processing with other
          tools.
        </p>
      </div>
    </label>

    <label class="format-option">
      <input type="radio" name="export-format-sets" value="markdown" bind:group={exportFormat} />
      <div class="format-content">
        <strong>Markdown Format</strong>
        <p>
          Human-readable document format, perfect for documentation and sharing with colleagues.
        </p>
      </div>
    </label>
  </div>

  <div class="modal-actions">
    <button type="button" onclick={closeExportModal} class="secondary" disabled={isExporting}>
      Cancel
    </button>
    <button type="button" onclick={handleExport} class="primary" disabled={isExporting}>
      {isExporting ? "Exporting..." : "Export"}
    </button>
  </div>
</SessionModal>

<!-- Import Modal -->
<SessionModal
  show={showImportModal}
  onClose={closeImportModal}
  title="Import Question Sets"
  size="large"
>
  <input
    bind:this={importFileInput}
    type="file"
    accept=".json,.md"
    onchange={handleFileUpload}
    style="display: none;"
  />

  {#if !importPreview && !importResults}
    <div class="import-intro">
      <p>
        Upload a Question Sets export file (<strong>JSON</strong> or <strong>Markdown</strong>).
      </p>
      <p class="import-note">
        The file must be a Question Sets export (not a Questions export or session export).
      </p>
      <div class="file-upload">
        <button
          type="button"
          class="secondary"
          onclick={triggerFileUpload}
          disabled={importInProgress}
        >
          {importInProgress ? "Parsing..." : "📂 Choose File (.json or .md)"}
        </button>
      </div>
    </div>
  {:else if importPreview}
    <div class="import-preview">
      <h3>Import Preview — {importPreview.fileType}</h3>

      {#if importPreview.errors.length > 0}
        <div class="import-feedback error-feedback">
          <strong>✗ {importPreview.errors.length} Error(s)</strong>
          <ul>
            {#each importPreview.errors as err, i (i)}
              <li>{err}</li>
            {/each}
          </ul>
        </div>
      {/if}

      {#if importPreview.warnings.length > 0}
        <div class="import-feedback warning-feedback">
          <strong>⚠ {importPreview.warnings.length} Warning(s)</strong>
          <ul>
            {#each importPreview.warnings as w, i (i)}
              <li>{w}</li>
            {/each}
          </ul>
        </div>
      {/if}

      {#if importPreview.sets.length > 0}
        <div class="preview-section">
          <h4>Sets to import ({importPreview.sets.length})</h4>
          {#each importPreview.sets as s (s.originalId)}
            <div class="preview-item" class:duplicate={s.isDuplicateName}>
              <label class="preview-item-check">
                <input type="checkbox" bind:checked={s.selected} />
                <span class="preview-item-name">{s.name}</span>
                <span class="preview-item-meta"
                  >{s.questionCount} question{s.questionCount !== 1 ? "s" : ""}</span
                >
                {#if s.isDuplicateName}
                  <span class="duplicate-badge">duplicate name</span>
                {/if}
              </label>
              {#if s.isDuplicateName && s.selected}
                <div class="resolution-options">
                  <span class="resolution-label">Conflict:</span>
                  <label class="radio-label small">
                    <input type="radio" bind:group={s.duplicateResolution} value="skip" />
                    Skip
                  </label>
                  <label class="radio-label small">
                    <input type="radio" bind:group={s.duplicateResolution} value="new" />
                    Import as new (renamed)
                  </label>
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}

      {#if importPreview.questions.length > 0}
        <div class="preview-section">
          <h4>Questions to import ({importPreview.questions.length})</h4>
          {#each importPreview.questions as q (q.hash)}
            <div class="preview-item" class:duplicate={q.isDuplicate}>
              <label class="preview-item-check">
                <input type="checkbox" bind:checked={q.selected} />
                <span class="preview-item-name"
                  >{q.question.substring(0, 80)}{q.question.length > 80 ? "..." : ""}</span
                >
                {#if q.isDuplicate}
                  <span class="duplicate-badge">exists in catalog</span>
                {/if}
              </label>
              {#if q.isDuplicate && q.selected}
                <div class="resolution-options">
                  <span class="resolution-label">Conflict:</span>
                  <label class="radio-label small">
                    <input type="radio" bind:group={q.duplicateResolution} value="skip" />
                    Use existing
                  </label>
                  <label class="radio-label small">
                    <input type="radio" bind:group={q.duplicateResolution} value="replace" />
                    Replace
                  </label>
                  <label class="radio-label small">
                    <input type="radio" bind:group={q.duplicateResolution} value="new" />
                    Import as new
                  </label>
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}

      <div class="modal-actions">
        <button type="button" onclick={cancelPreview} class="secondary" disabled={importInProgress}
          >Back</button
        >
        <button
          type="button"
          onclick={confirmImport}
          class="primary"
          disabled={importInProgress || importPreview.sets.filter((s) => s.selected).length === 0}
        >
          {importInProgress
            ? "Importing..."
            : `Import ${importPreview.sets.filter((s) => s.selected).length} Set(s)`}
        </button>
      </div>
    </div>
  {:else if importResults}
    <div class="import-results">
      {#if importResults.success > 0}
        <p class="success-msg">
          ✓ Successfully imported {importResults.success} set{importResults.success !== 1
            ? "s"
            : ""}.
        </p>
      {/if}
      {#if importResults.errors.length > 0}
        <div class="import-feedback error-feedback">
          <strong>✗ {importResults.errors.length} Error(s)</strong>
          <ul>
            {#each importResults.errors as err, i (i)}
              <li>{err}</li>
            {/each}
          </ul>
        </div>
      {/if}
      <div class="modal-actions">
        <button type="button" onclick={closeImportModal} class="primary">Done</button>
      </div>
    </div>
  {/if}
</SessionModal>

<style>
  .question-sets > header,
  .question-sets > :not(:global(.navigation-tabs)):not(:global(.breadcrumbs)):not(header) {
    padding: 1rem;
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .header-actions {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .filters {
    display: flex;
    gap: 1rem;
    align-items: flex-start;
    margin-bottom: 2rem;
    padding: 1.5rem;
    background: #f5f5f5;
    border-radius: 8px;
    flex-wrap: wrap;
  }

  .select-all-checkbox {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-left: auto;
    font-size: 0.9rem;
    font-weight: 500;
    color: #333;
    cursor: pointer;
    user-select: none;
  }

  .select-all-checkbox input[type="checkbox"] {
    cursor: pointer;
    width: 18px;
    height: 18px;
  }

  .sets-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 1.5rem;
    padding: 1rem;
  }

  .set-card {
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 1.5rem;
    background: white;
    transition:
      border-color 0.2s,
      box-shadow 0.2s;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .set-card:hover {
    border-color: #0066cc;
    box-shadow: 0 2px 8px rgba(0, 102, 204, 0.1);
  }

  .set-card.selected {
    border-color: #0066cc;
    box-shadow: 0 0 0 2px rgba(0, 102, 204, 0.2);
  }

  .set-card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 0.75rem;
  }

  .set-name {
    margin: 0;
    font-size: 1.1rem;
    color: #1a1a1a;
    font-weight: 600;
    flex: 1;
  }

  .set-count {
    background: #e3f2fd;
    color: #1976d2;
    padding: 0.2rem 0.6rem;
    border-radius: 12px;
    font-size: 0.8rem;
    font-weight: 600;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .set-notes {
    margin: 0;
    font-size: 0.9rem;
    color: #666;
    line-height: 1.5;
    flex: 1;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  .set-date {
    color: #999;
    font-size: 0.8rem;
  }

  .required {
    color: #d32f2f;
    margin-left: 0.25rem;
  }

  .confirm-text {
    line-height: 1.6;
    color: #666;
  }

  /* Export button */
  .export-btn {
    padding: 0.5rem 1rem !important;
    background: #4caf50 !important;
    color: white !important;
    border: none !important;
    border-radius: 4px !important;
    cursor: pointer;
    font-size: 0.9rem !important;
    font-weight: 500 !important;
    transition: background 0.2s !important;
  }

  .export-btn:hover {
    background: #45a049 !important;
  }

  /* Export modal */
  .export-description {
    margin-bottom: 1.5rem;
    color: #666;
    line-height: 1.6;
  }

  .export-format-options {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin: 1.5rem 0;
  }

  .format-option {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    padding: 1rem;
    border: 2px solid #ddd;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .format-option:hover {
    border-color: #0066cc;
    background: #f8f9fa;
  }

  .format-option input[type="radio"] {
    margin-top: 0.25rem;
    cursor: pointer;
    width: 20px;
    height: 20px;
    flex-shrink: 0;
  }

  .format-option input[type="radio"]:checked + .format-content {
    color: #0066cc;
  }

  .format-content {
    flex: 1;
  }

  .format-content strong {
    display: block;
    margin-bottom: 0.5rem;
    font-size: 1rem;
    color: #333;
  }

  .format-content p {
    margin: 0;
    font-size: 0.9rem;
    color: #666;
    line-height: 1.4;
  }

  /* Import resolution radio */
  .radio-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9rem;
    cursor: pointer;
  }

  .radio-label.small {
    font-size: 0.85rem;
  }

  /* Import modal */
  .file-upload {
    margin-top: 1.5rem;
  }

  .import-intro p {
    margin-bottom: 0.75rem;
    color: #555;
  }

  .import-note {
    font-size: 0.85rem;
    color: #888;
  }

  .import-preview h3 {
    margin: 0 0 1rem;
    font-size: 1rem;
  }

  .import-feedback {
    border-radius: 6px;
    padding: 0.75rem 1rem;
    margin-bottom: 0.75rem;
    font-size: 0.875rem;
  }

  .import-feedback ul {
    margin: 0.4rem 0 0;
    padding-left: 1.25rem;
  }

  .error-feedback {
    background: #fdecea;
    color: #c62828;
    border: 1px solid #ef9a9a;
  }

  .warning-feedback {
    background: #fff8e1;
    color: #e65100;
    border: 1px solid #ffcc80;
  }

  .preview-section {
    margin-bottom: 1rem;
  }

  .preview-section h4 {
    margin: 0 0 0.5rem;
    font-size: 0.9rem;
    color: #555;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .preview-item {
    padding: 0.5rem 0.75rem;
    border-radius: 6px;
    margin-bottom: 0.4rem;
    border: 1px solid #eee;
    font-size: 0.875rem;
  }

  .preview-item.duplicate {
    border-color: #ffcc80;
    background: #fffde7;
  }

  .preview-item-check {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    flex-wrap: wrap;
  }

  .preview-item-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .preview-item-meta {
    color: #888;
    font-size: 0.8rem;
    white-space: nowrap;
  }

  .duplicate-badge {
    background: #ffe082;
    color: #795548;
    padding: 0.1rem 0.4rem;
    border-radius: 10px;
    font-size: 0.75rem;
    white-space: nowrap;
  }

  .resolution-options {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-top: 0.4rem;
    padding-left: 1.5rem;
    flex-wrap: wrap;
  }

  .resolution-label {
    font-size: 0.8rem;
    color: #888;
  }

  .success-msg {
    color: #2e7d32;
    font-weight: 500;
    margin-bottom: 0.75rem;
  }

  /* Dark mode */
  :global([data-theme="dark"]) .set-card {
    background: #1a1a1a;
    border-color: #444;
  }

  :global([data-theme="dark"]) .set-card:hover {
    border-color: #0066cc;
  }

  :global([data-theme="dark"]) .set-card.selected {
    border-color: #0066cc;
  }

  :global([data-theme="dark"]) .set-name {
    color: #ffffff;
  }

  :global([data-theme="dark"]) .set-count {
    background: #1e3a5f;
    color: #64b5f6;
  }

  :global([data-theme="dark"]) .set-notes {
    color: #a0a0a0;
  }

  :global([data-theme="dark"]) .set-date {
    color: #666;
  }

  :global([data-theme="dark"]) .confirm-text {
    color: #a0a0a0;
  }

  :global([data-theme="dark"]) .filters {
    background: #2a2a2a;
  }

  :global([data-theme="dark"]) .select-all-checkbox {
    color: #ffffff;
  }

  :global([data-theme="dark"]) .export-btn {
    background: #2e7d32 !important;
    color: #ffffff !important;
  }

  :global([data-theme="dark"]) .export-btn:hover {
    background: #388e3c !important;
  }

  :global([data-theme="dark"]) .export-description {
    color: #a0a0a0;
  }

  :global([data-theme="dark"]) .format-option {
    border-color: #444;
    background: #2a2a2a;
  }

  :global([data-theme="dark"]) .format-option:hover {
    border-color: #0066cc;
    background: #333;
  }

  :global([data-theme="dark"]) .format-content strong {
    color: #ffffff;
  }

  :global([data-theme="dark"]) .format-content p {
    color: #a0a0a0;
  }

  :global([data-theme="dark"]) .import-intro p,
  :global([data-theme="dark"]) .confirm-text {
    color: #a0a0a0;
  }

  :global([data-theme="dark"]) .preview-item {
    border-color: #444;
    background: #1a1a1a;
  }

  :global([data-theme="dark"]) .preview-item.duplicate {
    border-color: #7c6000;
    background: #2a2000;
  }

  :global([data-theme="dark"]) .duplicate-badge {
    background: #5c4800;
    color: #ffcc80;
  }

  :global([data-theme="dark"]) .error-feedback {
    background: #3b1010;
    color: #ef9a9a;
    border-color: #7f2020;
  }

  :global([data-theme="dark"]) .warning-feedback {
    background: #2a1f00;
    color: #ffcc80;
    border-color: #7c5400;
  }

  :global([data-theme="dark"]) .preview-section h4 {
    color: #999;
  }
</style>
