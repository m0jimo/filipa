<script lang="ts">
  import { onMount } from "svelte";
  import { link } from "svelte-spa-router";
  import candidateWindowSvg from "../assets/filipa-candidate-window.svg";
  import { questionDB, generateId, generateQuestionHash } from "../lib/db";
  import { QuestionType, type Question } from "../lib/types";
  import Navigation from "../lib/Navigation.svelte";
  import Breadcrumbs from "../lib/Breadcrumbs.svelte";
  import SessionModal from "../lib/SessionModal.svelte";
  import MarkdownEditor from "../components/MarkdownEditor.svelte";
  import MarkdownPreview from "../components/MarkdownPreview.svelte";
  import { userSettings, type QuestionViewMode, type EditorViewMode } from "../lib/userSettings";
  import { SvelteSet } from "svelte/reactivity";

  let questions: Question[] = $state([]);
  let filteredQuestions: Question[] = $state([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  // Filters
  let searchQuery = $state("");
  let selectedTypes = $state<string[]>([]);
  let selectedTags = $state<string[]>([]);
  let selectedDifficulties = $state<number[]>([]);
  let allTags: string[] = $state([]);
  let tagCounts: Record<string, number> = $state({});
  let showTypeDropdown = $state(false);
  let showDifficultyDropdown = $state(false);
  let tagSearch = $state("");
  let showAllTags = $state(false);
  let viewMode = $state<QuestionViewMode>("cards");

  type SortColumn = "type" | "difficulty" | "createdAt";
  type SortDir = "asc" | "desc";
  let sortCol = $state<SortColumn | null>(null);
  let sortDir = $state<SortDir>("asc");

  const toggleSort = (col: SortColumn) => {
    if (sortCol === col) {
      sortDir = sortDir === "asc" ? "desc" : "asc";
    } else {
      sortCol = col;
      sortDir = "asc";
    }
  };

  const tableSorted = $derived.by(() => {
    if (!sortCol) return filteredQuestions;
    return [...filteredQuestions].sort((a, b) => {
      let cmp: number;
      if (sortCol === "type") {
        cmp = a.questionType.localeCompare(b.questionType);
      } else if (sortCol === "difficulty") {
        const aMin = a.difficulty?.length ? Math.min(...a.difficulty) : Infinity;
        const bMin = b.difficulty?.length ? Math.min(...b.difficulty) : Infinity;
        cmp = aMin - bMin;
      } else {
        cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  });

  // Modal state
  let showModal = $state(false);
  let editingQuestion: Question | null = $state(null);
  let formData = $state({
    question: "",
    expectedAnswer: "",
    tags: "",
    questionType: QuestionType.Text,
    difficulty: "1,2,3,4,5,6,7,8,9,10",
  });
  let saving = $state(false);

  // Delete confirmation
  let deleteConfirmId: string | null = $state(null);
  let showBulkDeleteConfirm = $state(false);
  let isDeletingBulk = $state(false);

  // Import functionality
  let showImportModal = $state(false);
  let importResults = $state<{
    success: number;
    errors: string[];
    warnings: string[];
  } | null>(null);
  let importInProgress = $state(false);
  let importFileInput: HTMLInputElement | null = $state(null);

  const triggerFileUpload = () => importFileInput?.click();
  let importPreview = $state<{
    questions: Array<{
      question: string;
      expectedAnswer: string;
      tags: string[];
      questionType: string;
      difficulty: number[];
      hash: string;
      isDuplicate: boolean;
      selected: boolean;
    }>;
    errors: string[];
    warnings: string[];
    fileType: string;
  } | null>(null);
  let selectAll = $state(true);

  // Export functionality
  let selectedQuestionIds = $state(new SvelteSet<string>());
  let showExportModal = $state(false);
  let exportFormat: "json" | "md" = $state("json");
  let isExporting = $state(false);

  onMount(() => {
    const saved = $userSettings;
    selectedTypes = saved.questionFilters.selectedTypes;
    selectedTags = saved.questionFilters.selectedTags;
    selectedDifficulties = saved.questionFilters.selectedDifficulties;
    viewMode = saved.questionViewMode;
    loadQuestions();

    // Add click outside listener
    document.addEventListener("click", handleClickOutside);
    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  });

  async function loadQuestions() {
    try {
      loading = true;
      questions = await questionDB.list();
      questions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      // Extract all unique tags with counts
      const counts: Record<string, number> = {};
      questions.forEach((q) =>
        q.tags.forEach((tag) => {
          counts[tag] = (counts[tag] ?? 0) + 1;
        })
      );
      tagCounts = counts;
      allTags = Object.keys(counts).sort();

      applyFilters();
      loading = false;
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to load questions";
      loading = false;
    }
  }

  function applyFilters() {
    let result = [...questions];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (q) =>
          q.question.toLowerCase().includes(query) ||
          q.expectedAnswer.toLowerCase().includes(query) ||
          q.tags.some((tag) => tag.toLowerCase().includes(query))
      );
    }

    // Type filter - show only questions matching selected types
    if (selectedTypes.length > 0) {
      result = result.filter((q) => selectedTypes.includes(q.questionType));
    }

    // Tag filter - show only questions that have at least one of the selected tags
    if (selectedTags.length > 0) {
      result = result.filter((q) => q.tags.some((tag) => selectedTags.includes(tag)));
    }

    // Difficulty filter - show questions that have at least one matching difficulty level
    if (selectedDifficulties.length > 0) {
      result = result.filter((q) => q.difficulty?.some((d) => selectedDifficulties.includes(d)));
    }

    filteredQuestions = result;
  }

  // Reactive filters
  $effect(() => {
    if (
      searchQuery !== undefined ||
      selectedTypes !== undefined ||
      selectedTags !== undefined ||
      selectedDifficulties !== undefined
    ) {
      applyFilters();
      userSettings.setQuestionFilters({ selectedTypes, selectedTags, selectedDifficulties });
    }
  });

  function openCreateModal() {
    editingQuestion = null;
    formData = {
      question: "",
      expectedAnswer: "",
      tags: "",
      questionType: QuestionType.Text,
      difficulty: "1,2,3,4,5,6,7,8,9,10",
    };
    showModal = true;
  }

  function openEditModal(question: Question, event: MouseEvent) {
    event.stopPropagation();
    editingQuestion = question;
    formData = {
      question: question.question,
      expectedAnswer: question.expectedAnswer,
      tags: question.tags.join(", "),
      questionType: question.questionType,
      difficulty: question.difficulty ? question.difficulty.join(",") : "",
    };
    showModal = true;
  }

  function closeModal() {
    showModal = false;
    editingQuestion = null;
  }

  async function handleSubmit(event: Event) {
    event.preventDefault();

    if (!formData.question.trim()) {
      alert("Please enter a question");
      return;
    }

    try {
      saving = true;
      const now = new Date();
      const tagsList = formData.tags
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0);
      const difficultyList = formData.difficulty
        .split(",")
        .map((r) => parseInt(r.trim()))
        .filter((r) => !isNaN(r) && r >= 1 && r <= 10);

      if (editingQuestion) {
        // Update existing question
        const updated: Question = {
          ...editingQuestion,
          question: formData.question.trim(),
          expectedAnswer: formData.expectedAnswer.trim(),
          tags: tagsList,
          questionType: formData.questionType,
          difficulty: difficultyList,
          hash: generateQuestionHash(formData.question.trim(), tagsList, formData.questionType),
          updatedAt: now,
        };
        await questionDB.update(updated);
      } else {
        // Create new question
        const newQuestion: Question = {
          id: generateId(),
          question: formData.question.trim(),
          expectedAnswer: formData.expectedAnswer.trim(),
          tags: tagsList,
          questionType: formData.questionType,
          difficulty: difficultyList,
          hash: generateQuestionHash(formData.question.trim(), tagsList, formData.questionType),
          createdAt: now,
          updatedAt: now,
        };
        await questionDB.create(newQuestion);
      }

      await loadQuestions();
      closeModal();
    } catch (err) {
      alert("Failed to save question: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      saving = false;
    }
  }

  function confirmDelete(questionId: string, event: MouseEvent) {
    event.stopPropagation();
    deleteConfirmId = questionId;
  }

  async function handleDelete(questionId: string) {
    try {
      await questionDB.delete(questionId);
      await loadQuestions();
      deleteConfirmId = null;
    } catch (err) {
      alert("Failed to delete question: " + (err instanceof Error ? err.message : "Unknown error"));
    }
  }

  function cancelDelete() {
    deleteConfirmId = null;
  }

  function openBulkDeleteConfirm() {
    if (selectedQuestionIds.size === 0) {
      alert("Please select at least one question to delete");
      return;
    }
    showBulkDeleteConfirm = true;
  }

  function cancelBulkDelete() {
    showBulkDeleteConfirm = false;
  }

  async function handleBulkDelete() {
    if (selectedQuestionIds.size === 0) return;

    try {
      isDeletingBulk = true;
      const idsToDelete = Array.from(selectedQuestionIds);

      // Delete all selected questions
      for (const id of idsToDelete) {
        await questionDB.delete(id);
      }

      // Clear selection
      selectedQuestionIds = new SvelteSet();

      await loadQuestions();
      showBulkDeleteConfirm = false;
    } catch (err) {
      alert(
        "Failed to delete questions: " + (err instanceof Error ? err.message : "Unknown error")
      );
    } finally {
      isDeletingBulk = false;
    }
  }

  const truncateWords = (text: string, max: number): string => {
    const words = text.trim().split(/\s+/);
    return words.length <= max ? text : words.slice(0, max).join(" ") + "…";
  };

  function clearFilters() {
    searchQuery = "";
    selectedTypes = [];
    selectedTags = [];
    selectedDifficulties = [];
  }

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

  function toggleDifficulty(level: number) {
    if (selectedDifficulties.includes(level)) {
      selectedDifficulties = selectedDifficulties.filter((d) => d !== level);
    } else {
      selectedDifficulties = [...selectedDifficulties, level];
    }
  }

  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest(".multiselect-container")) {
      showTypeDropdown = false;
      showDifficultyDropdown = false;
    }
  }

  function openImportModal() {
    importResults = null;
    importPreview = null;
    showImportModal = true;
  }

  function closeImportModal() {
    showImportModal = false;
    importResults = null;
    importPreview = null;
  }

  async function handleFileUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    const fileExtension = file.name.split(".").pop()?.toLowerCase();

    if (fileExtension === "json") {
      await validateJsonFile(file);
    } else if (fileExtension === "md") {
      await validateMarkdownFile(file);
    } else {
      alert("Unsupported file type. Please upload .json or .md files.");
    }

    // Reset file input
    input.value = "";
  }

  async function validateJsonFile(file: File) {
    importInProgress = true;
    importPreview = { questions: [], errors: [], warnings: [], fileType: "JSON" };

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      // Handle both single question and array of questions
      const questionsToValidate = Array.isArray(data) ? data : [data];

      for (let i = 0; i < questionsToValidate.length; i++) {
        const q = questionsToValidate[i];

        // Validate required fields
        if (!q.question || typeof q.question !== "string") {
          importPreview.errors.push(`Question ${i + 1}: Missing or invalid 'question' field`);
          continue;
        }

        // Check for duplicate IDs
        if (q.id) {
          const existing = await questionDB.read(q.id);
          if (existing) {
            importPreview.warnings.push(
              `Question ${i + 1}: ID already exists, will generate new ID`
            );
          }
        }

        const hash = generateQuestionHash(
          q.question,
          Array.isArray(q.tags) ? q.tags : [],
          q.questionType || "text"
        );

        // Check if this question already exists
        const duplicates = await questionDB.listByHash(hash);
        const isDuplicate = duplicates.length > 0;

        if (isDuplicate) {
          importPreview.warnings.push(
            `Question ${i + 1}: Similar question already exists in catalog`
          );
        }

        importPreview.questions.push({
          question: q.question,
          expectedAnswer: q.expectedAnswer || "",
          tags: Array.isArray(q.tags) ? q.tags : [],
          questionType: q.questionType || "text",
          difficulty: Array.isArray(q.difficulty) ? q.difficulty : [],
          hash,
          isDuplicate,
          selected: !isDuplicate, // Auto-deselect duplicates
        });
      }
    } catch (err) {
      importPreview.errors.push(
        `Failed to parse JSON: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    } finally {
      importInProgress = false;
    }
  }

  async function validateMarkdownFile(file: File) {
    importInProgress = true;
    importPreview = { questions: [], errors: [], warnings: [], fileType: "Markdown" };

    try {
      const text = await file.text();

      // Split by "---" to separate sections
      const blocks = text.split(/^---$/m).filter((block) => block.trim());

      for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];

        // Skip blocks that don't contain question markers (like header sections)
        // A valid question block should have "## Question" header
        if (!block.match(/##\s*Question\s+\d+/i)) {
          continue;
        }

        // Extract question
        const questionMatch = block.match(/###\s*Question\s*\n([\s\S]*?)(?=###|Tags:|$)/i);
        const question = questionMatch?.[1]?.trim();

        if (!question) {
          importPreview.errors.push(`Question ${i + 1}: Missing question text`);
          continue;
        }

        // Extract expected answer
        const answerMatch = block.match(/###\s*Expected Answer\s*\n([\s\S]*?)(?=###|Tags:|$)/i);
        const expectedAnswer = answerMatch?.[1]?.trim() || "";

        // Extract tags
        const tagsMatch = block.match(/Tags:\s*(.+)/i);
        const tags =
          tagsMatch?.[1]
            ?.split(",")
            .map((t) => t.trim())
            .filter((t) => t) || [];

        // Extract difficulty
        const difficultyMatch = block.match(/Difficulty:\s*\[([^\]]+)\]/i);
        const difficulty =
          difficultyMatch?.[1]
            ?.split(",")
            .map((r) => parseInt(r.trim()))
            .filter((r) => !isNaN(r)) || [];

        // Extract type
        const typeMatch = block.match(/Type:\s*(.+)/i);
        const questionType = typeMatch?.[1]?.trim() || "text";

        const hash = generateQuestionHash(question, tags, questionType);

        // Check if this question already exists
        const duplicates = await questionDB.listByHash(hash);
        const isDuplicate = duplicates.length > 0;

        if (isDuplicate) {
          importPreview.warnings.push(
            `Question "${question.substring(0, 50)}...": Similar question already exists in catalog`
          );
        }

        importPreview.questions.push({
          question,
          expectedAnswer,
          tags,
          questionType,
          difficulty,
          hash,
          isDuplicate,
          selected: !isDuplicate, // Auto-deselect duplicates
        });
      }

      if (importPreview.questions.length === 0) {
        importPreview.errors.push("No valid questions found in markdown file. Check the format.");
      }
    } catch (err) {
      importPreview.errors.push(
        `Failed to parse Markdown: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    } finally {
      importInProgress = false;
    }
  }

  async function confirmImport() {
    if (!importPreview) return;

    const selectedQuestions = importPreview.questions.filter((q) => q.selected);
    if (selectedQuestions.length === 0) {
      alert("Please select at least one question to import");
      return;
    }

    importInProgress = true;
    importResults = { success: 0, errors: [], warnings: [] };

    try {
      for (let i = 0; i < selectedQuestions.length; i++) {
        try {
          const q = selectedQuestions[i];
          const now = new Date();

          // Create plain copies of arrays to avoid Svelte proxy issues with IndexedDB
          const newQuestion: Question = {
            id: generateId(),
            question: q.question,
            expectedAnswer: q.expectedAnswer,
            tags: [...q.tags],
            questionType:
              q.questionType.toLowerCase() === QuestionType.Rating
                ? QuestionType.Rating
                : QuestionType.Text,
            difficulty: q.difficulty ? [...q.difficulty] : [],
            hash: q.hash,
            createdAt: now,
            updatedAt: now,
          };

          await questionDB.create(newQuestion);
          importResults.success++;
        } catch (err) {
          importResults.errors.push(
            `Question ${i + 1}: ${err instanceof Error ? err.message : "Unknown error"}`
          );
        }
      }

      await loadQuestions();
      importPreview = null;
    } catch (err) {
      importResults.errors.push(
        `Import failed: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    } finally {
      importInProgress = false;
    }
  }

  function cancelPreview() {
    importPreview = null;
  }

  function toggleSelectAll() {
    if (!importPreview) return;
    selectAll = !selectAll;
    importPreview.questions.forEach((q) => (q.selected = selectAll));
  }

  function toggleQuestionSelection(index: number) {
    if (!importPreview) return;
    importPreview.questions[index].selected = !importPreview.questions[index].selected;
    // Update selectAll checkbox
    selectAll = importPreview.questions.every((q) => q.selected);
  }

  function getSelectedCount() {
    return importPreview?.questions.filter((q) => q.selected).length || 0;
  }

  // Export functions
  function toggleQuestionForExport(questionId: string) {
    const newSet = new SvelteSet(selectedQuestionIds);
    if (newSet.has(questionId)) {
      newSet.delete(questionId);
    } else {
      newSet.add(questionId);
    }
    selectedQuestionIds = newSet;
  }

  function toggleSelectAllForExport() {
    // Check if all filtered questions are currently selected
    const allSelected = filteredQuestions.every((q) => selectedQuestionIds.has(q.id));

    if (allSelected) {
      // Deselect all filtered questions
      const newSet = new SvelteSet(selectedQuestionIds);
      filteredQuestions.forEach((q) => newSet.delete(q.id));
      selectedQuestionIds = newSet;
    } else {
      // Select all filtered questions (add them to existing selection)
      const newSet = new SvelteSet(selectedQuestionIds);
      filteredQuestions.forEach((q) => newSet.add(q.id));
      selectedQuestionIds = newSet;
    }
  }

  function openExportModal() {
    if (selectedQuestionIds.size === 0) {
      alert("Please select at least one question to export");
      return;
    }
    exportFormat = "json";
    showExportModal = true;
  }

  function closeExportModal() {
    showExportModal = false;
    exportFormat = "json";
  }

  async function handleExport() {
    if (selectedQuestionIds.size === 0) {
      alert("Please select at least one question to export");
      return;
    }

    try {
      isExporting = true;

      // Get selected questions
      const questionsToExport = questions.filter((q) => selectedQuestionIds.has(q.id));

      // Generate export content based on format
      let content: string;
      let filename: string;
      let mimeType: string;

      if (exportFormat === "json") {
        content = generateJsonExport(questionsToExport);
        filename = `questions-export-${new Date().toISOString().split("T")[0]}.json`;
        mimeType = "application/json";
      } else {
        content = generateMarkdownExport(questionsToExport);
        filename = `questions-export-${new Date().toISOString().split("T")[0]}.md`;
        mimeType = "text/markdown";
      }

      // Create and download file
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      closeExportModal();
      // Clear selection after export
      selectedQuestionIds = new SvelteSet();
    } catch (err) {
      alert(
        "Failed to export questions: " + (err instanceof Error ? err.message : "Unknown error")
      );
    } finally {
      isExporting = false;
    }
  }

  function generateJsonExport(questions: Question[]): string {
    const exportData = questions.map((q) => ({
      id: q.id,
      question: q.question,
      expectedAnswer: q.expectedAnswer,
      tags: q.tags,
      questionType: q.questionType,
      difficulty: q.difficulty,
      hash: q.hash,
      createdAt: q.createdAt.toISOString(),
      updatedAt: q.updatedAt.toISOString(),
    }));

    return JSON.stringify(exportData, null, 2);
  }

  function generateMarkdownExport(questions: Question[]): string {
    const lines: string[] = [];

    lines.push("# Questions Export");
    lines.push("");
    lines.push(`Exported: ${new Date().toLocaleString()}`);
    lines.push(`Total Questions: ${questions.length}`);
    lines.push("");
    lines.push("---");
    lines.push("");

    questions.forEach((q, index) => {
      lines.push(`## Question ${index + 1}`);
      lines.push("");

      if (q.id) {
        lines.push(`Question ID: ${q.id}`);
      }

      lines.push("");
      lines.push("### Question");
      lines.push("");
      lines.push(q.question);
      lines.push("");

      lines.push("### Expected Answer");
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

      if (index < questions.length - 1) {
        lines.push("---");
        lines.push("");
      }
    });

    return lines.join("\n");
  }
</script>

<div class="page question-catalog">
  <Navigation />
  <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Questions" }]} />

  <header>
    <div class="header-left">
      <a href="/question-sets" use:link class="question-sets-link">
        <img src={candidateWindowSvg} alt="" class="question-sets-icon" />
        Question Sets
      </a>
    </div>
    <div class="header-actions">
      {#if !loading}
        {#if selectedQuestionIds.size > 0}
          <button onclick={openBulkDeleteConfirm} class="delete-btn">
            🗑️ Delete {selectedQuestionIds.size} Question{selectedQuestionIds.size !== 1 ? "s" : ""}
          </button>
          <button onclick={openExportModal} class="export-btn">
            📤 Export {selectedQuestionIds.size} Question{selectedQuestionIds.size !== 1 ? "s" : ""}
          </button>
        {/if}
        <button onclick={openImportModal} class="secondary">📥 Import Questions</button>
        <button onclick={openCreateModal} class="primary">+ Add Question</button>
      {/if}
    </div>
  </header>

  {#if loading}
    <p class="loading">Loading questions...</p>
  {:else if error}
    <p class="error">Error: {error}</p>
  {:else}
    <!-- Filters -->
    <div class="filters">
      <div class="filter-group">
        <input
          id="searchQuestions"
          name="input-search-questions"
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
            <span class="dropdown-arrow">▼</span>
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
        <label>Difficulty:</label>
        <div class="multiselect-container">
          <button
            class="multiselect-trigger"
            onclick={() => (showDifficultyDropdown = !showDifficultyDropdown)}
            type="button"
          >
            {selectedDifficulties.length === 0
              ? "All Levels"
              : [...selectedDifficulties].sort((a, b) => a - b).join(", ")}
            <span class="dropdown-arrow">▼</span>
          </button>
          {#if showDifficultyDropdown}
            <div class="multiselect-dropdown difficulty-dropdown">
              {#each [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as level (level)}
                <label class="multiselect-option">
                  <input
                    type="checkbox"
                    checked={selectedDifficulties.includes(level)}
                    onchange={() => toggleDifficulty(level)}
                  />
                  <span>{level}</span>
                </label>
              {/each}
            </div>
          {/if}
        </div>
      </div>

      <div class="filter-group tag-filter-group">
        {#if allTags.length === 0}
          <span class="tag-filter-empty">No tags available</span>
        {:else}
          {@const top10 = [...allTags]
            .sort((a, b) => (tagCounts[b] ?? 0) - (tagCounts[a] ?? 0))
            .slice(0, 10)
            .sort()}
          {@const filtered = (showAllTags || tagSearch ? allTags : top10).filter((t) =>
            t.toLowerCase().includes(tagSearch.toLowerCase())
          )}
          <div class="tag-filter-panel">
            <div class="tag-filter-controls">
              <input
                type="text"
                class="tag-search-input"
                placeholder="Filter tags..."
                bind:value={tagSearch}
                autocomplete="off"
                data-lpignore="true"
                data-form-type="other"
              />
              <button
                type="button"
                class="tag-toggle-btn"
                onclick={() => (showAllTags = !showAllTags)}
                >{showAllTags ? "Show less" : `Show all ${allTags.length}`}</button
              >
            </div>
            <div class="tag-chips">
              {#each filtered as tag (tag)}
                <button
                  type="button"
                  class="tag-chip"
                  class:selected={selectedTags.includes(tag)}
                  onclick={() => toggleTag(tag)}>{tag}</button
                >
              {/each}
            </div>
          </div>
        {/if}
      </div>

      {#if searchQuery || selectedTypes.length > 0 || selectedTags.length > 0 || selectedDifficulties.length > 0}
        <button onclick={clearFilters} class="clear-filters">Clear Filters</button>
      {/if}

      <div class="results-count">
        {filteredQuestions.length} of {questions.length} questions
      </div>

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

      {#if filteredQuestions.length > 0}
        <label class="select-all-checkbox">
          <input
            type="checkbox"
            checked={filteredQuestions.length > 0 &&
              filteredQuestions.every((q) => selectedQuestionIds.has(q.id))}
            indeterminate={filteredQuestions.some((q) => selectedQuestionIds.has(q.id)) &&
              !filteredQuestions.every((q) => selectedQuestionIds.has(q.id))}
            onchange={toggleSelectAllForExport}
          />
          Select All
        </label>
      {/if}
    </div>

    {#if questions.length === 0}
      <div class="empty-state">
        <h2>No questions yet</h2>
        <p>Create your first question to get started.</p>
        <button onclick={openCreateModal} class="primary">+ Add Question</button>
      </div>
    {:else if filteredQuestions.length === 0}
      <div class="empty-state">
        <h2>No questions found</h2>
        <p>Try adjusting your filters.</p>
        <button onclick={clearFilters} class="secondary">Clear Filters</button>
      </div>
    {:else if viewMode === "cards"}
      <div class="questions-grid">
        {#each filteredQuestions as question (question.id)}
          <div class="question-card" class:selected={selectedQuestionIds.has(question.id)}>
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
              <input
                type="checkbox"
                class="question-select"
                checked={selectedQuestionIds.has(question.id)}
                onchange={() => toggleQuestionForExport(question.id)}
                title="Select for export"
              />
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

            <div class="question-meta">
              <small title="Updated: {new Date(question.updatedAt).toLocaleString()}">
                Created: {new Date(question.createdAt).toLocaleDateString()}
              </small>
            </div>

            <div class="card-actions">
              <button
                onclick={(e) => confirmDelete(question.id, e)}
                class="action-btn delete-narrow"
                title="Delete question"
              >
                🗑️
              </button>
              <button
                onclick={(e) => openEditModal(question, e)}
                class="action-btn edit"
                title="Edit question"
              >
                Edit
              </button>
            </div>
          </div>
        {/each}
      </div>
    {:else}
      <table class="questions-table">
        <thead>
          <tr>
            <th class="col-check"></th>
            <th class="col-type col-sortable" onclick={() => toggleSort("type")}>
              Type {#if sortCol === "type"}<span class="sort-arrow"
                  >{sortDir === "asc" ? "▲" : "▼"}</span
                >{:else}<span class="sort-arrow inactive">⇅</span>{/if}
            </th>
            <th class="col-difficulty col-sortable" onclick={() => toggleSort("difficulty")}>
              Difficulty {#if sortCol === "difficulty"}<span class="sort-arrow"
                  >{sortDir === "asc" ? "▲" : "▼"}</span
                >{:else}<span class="sort-arrow inactive">⇅</span>{/if}
            </th>
            <th class="col-question">Question</th>
            <th class="col-created col-sortable" onclick={() => toggleSort("createdAt")}>
              Created {#if sortCol === "createdAt"}<span class="sort-arrow"
                  >{sortDir === "asc" ? "▲" : "▼"}</span
                >{:else}<span class="sort-arrow inactive">⇅</span>{/if}
            </th>
            <th class="col-actions"></th>
          </tr>
        </thead>
        <tbody>
          {#each tableSorted as question (question.id)}
            <tr class:selected={selectedQuestionIds.has(question.id)}>
              <td class="col-check">
                <input
                  type="checkbox"
                  checked={selectedQuestionIds.has(question.id)}
                  onchange={() => toggleQuestionForExport(question.id)}
                  title="Select for export"
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
              <td class="col-created">
                <span title="Updated: {new Date(question.updatedAt).toLocaleString()}">
                  {new Date(question.createdAt).toLocaleDateString()}
                </span>
              </td>
              <td class="col-actions">
                <button
                  onclick={(e) => openEditModal(question, e)}
                  class="icon-btn edit-icon"
                  title="Edit question">✎ Edit</button
                >
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  {/if}
</div>

<!-- Question Modal -->
<SessionModal
  show={showModal}
  onClose={closeModal}
  title={editingQuestion ? "Edit Question" : "New Question"}
  size="large"
>
  <form onsubmit={handleSubmit} autocomplete="off" data-form-type="other">
    <div class="form-group">
      <MarkdownEditor
        bind:value={formData.question}
        id="questionText"
        name="question-text-content"
        label="Question"
        required={true}
        placeholder="Enter the question text"
        rows={3}
        initialViewMode={($userSettings.editorViewModes["questionText"] ?? "raw") as EditorViewMode}
        onViewModeChange={(mode) => userSettings.setEditorViewMode("questionText", mode)}
      />
    </div>

    <div class="form-group">
      <MarkdownEditor
        bind:value={formData.expectedAnswer}
        id="expectedAnswer"
        name="question-expected-answer"
        label="Expected Answer"
        placeholder="Enter the expected answer (visible only to interviewer)"
        rows={5}
        helpText="This will be visible only to the interviewer during the interview"
        initialViewMode={($userSettings.editorViewModes["expectedAnswer"] ?? "raw") as EditorViewMode}
        onViewModeChange={(mode) => userSettings.setEditorViewMode("expectedAnswer", mode)}
      />
    </div>

    <div class="form-row">
      <div class="form-group">
        <label for="questionType">Question Type <span class="required">*</span></label>
        <select
          id="questionType"
          name="question-type"
          bind:value={formData.questionType}
          required
          autocomplete="off"
          data-lpignore="true"
          data-form-type="other"
        >
          <option value={QuestionType.Text}>Text</option>
          <option value={QuestionType.Rating}>Rating</option>
        </select>
      </div>

      <div class="form-group">
        <label for="questionTags">Tags</label>
        <input
          id="questionTags"
          name="question-tags"
          type="text"
          bind:value={formData.tags}
          placeholder="javascript, react, frontend"
          autocomplete="off"
          data-lpignore="true"
          data-form-type="other"
        />
        <small>Separate tags with commas</small>
      </div>
    </div>

    <div class="form-group">
      <label for="questionDifficulty">Difficulty</label>
      <input
        id="questionDifficulty"
        name="question-difficulty-levels"
        type="text"
        bind:value={formData.difficulty}
        placeholder="1,2,3,4,5,6,7,8,9,10"
        autocomplete="off"
        data-lpignore="true"
        data-form-type="other"
      />
      <small
        >Comma-separated numbers (1-10) indicating which difficulty levels this question applies to</small
      >
    </div>

    <div class="modal-actions">
      <button type="button" onclick={closeModal} class="secondary" disabled={saving}>
        Cancel
      </button>
      <button type="submit" class="primary" disabled={saving}>
        {saving ? "Saving..." : editingQuestion ? "Update" : "Create"}
      </button>
    </div>
  </form>
</SessionModal>

<!-- Delete Confirmation Modal -->
<SessionModal show={!!deleteConfirmId} onClose={cancelDelete} title="Delete Question?" size="small">
  <p class="confirm-text">
    Are you sure you want to delete this question? This action cannot be undone.
  </p>
  <div class="modal-actions">
    <button type="button" onclick={cancelDelete} class="secondary">Cancel</button>
    <button
      type="button"
      onclick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
      class="danger">Delete</button
    >
  </div>
</SessionModal>

<!-- Bulk Delete Confirmation Modal -->
<SessionModal
  show={showBulkDeleteConfirm}
  onClose={cancelBulkDelete}
  title="Delete Selected Questions?"
  size="small"
>
  <p class="confirm-text">
    Are you sure you want to delete <strong>{selectedQuestionIds.size}</strong> selected question{selectedQuestionIds.size !==
    1
      ? "s"
      : ""}? This action cannot be undone.
  </p>
  <div class="modal-actions">
    <button type="button" onclick={cancelBulkDelete} class="secondary" disabled={isDeletingBulk}>
      Cancel
    </button>
    <button type="button" onclick={handleBulkDelete} class="danger" disabled={isDeletingBulk}>
      {isDeletingBulk ? "Deleting..." : "Delete"}
    </button>
  </div>
</SessionModal>

<!-- Import Modal -->
<SessionModal
  show={showImportModal}
  onClose={closeImportModal}
  title="Import Questions"
  size="large"
>
  {#if !importPreview && !importResults}
    <div class="import-instructions">
      <p>Upload a <strong>JSON</strong> or <strong>Markdown</strong> file containing questions.</p>

      <div class="format-examples">
        <details>
          <summary>JSON Format Example</summary>
          <pre><code
              >{JSON.stringify(
                {
                  question: "What is TypeScript?",
                  expectedAnswer: "TypeScript is...",
                  tags: ["typescript", "javascript"],
                  questionType: "text",
                  difficulty: [3, 4, 5],
                },
                null,
                2
              )}</code
            ></pre>
        </details>

        <details>
          <summary>Markdown Format Example</summary>
          <pre><code
              >### Question
What is TypeScript?

### Expected Answer
TypeScript is a typed superset of JavaScript...

Tags: typescript, javascript
Difficulty: [3, 4, 5]
Type: text

---

### Question
What is a closure in JavaScript?

### Expected Answer
A closure is a function that has access to variables...

Tags: javascript, closures, advanced
Difficulty: [4, 5, 6]
Type: text

---

### Question
Explain React hooks.

### Expected Answer
React hooks are functions that let you use state...

Tags: react, javascript, frontend
Difficulty: [5, 6, 7, 8]
Type: text</code
            ></pre>
          <p>
            <small
              ><strong>Note:</strong> Separate multiple questions with <code>---</code> on its own line</small
            >
          </p>
        </details>
      </div>

      <div class="file-upload">
        <input
          bind:this={importFileInput}
          type="file"
          accept=".json,.md"
          onchange={handleFileUpload}
          disabled={importInProgress}
          autocomplete="off"
          style="display: none"
        />
        <button
          type="button"
          class="secondary"
          onclick={triggerFileUpload}
          disabled={importInProgress}
        >
          {importInProgress ? "Validating..." : "📂 Choose File (.json or .md)"}
        </button>
      </div>
    </div>
  {:else if importPreview}
    <div class="import-preview">
      <h3>Import Preview - {importPreview.fileType}</h3>

      {#if importPreview.errors.length > 0}
        <div class="result-item error">
          <strong>✗ {importPreview.errors.length} Error(s)</strong>
          <ul>
            {#each importPreview.errors as error, i (i)}
              <li>{error}</li>
            {/each}
          </ul>
        </div>
      {/if}

      {#if importPreview.warnings.length > 0}
        <div class="result-item warning">
          <strong>⚠ {importPreview.warnings.length} Warning(s)</strong>
          <ul>
            {#each importPreview.warnings as warning, i (i)}
              <li>{warning}</li>
            {/each}
          </ul>
        </div>
      {/if}

      {#if importPreview.questions.length > 0}
        <div class="result-item success">
          <strong>✓ {importPreview.questions.length} Valid Question(s)</strong>
          {#if importPreview.questions.some((q) => q.isDuplicate)}
            <small>
              ({importPreview.questions.filter((q) => q.isDuplicate).length} duplicate(s) found)</small
            >
          {/if}
        </div>

        <div class="preview-questions">
          <div class="preview-questions-header">
            <h4>Questions to Import:</h4>
            <label class="select-all-label">
              <input type="checkbox" checked={selectAll} onchange={toggleSelectAll} />
              Select All
            </label>
          </div>

          {#each importPreview.questions as q, index (index)}
            <div
              class="preview-question-card"
              class:duplicate={q.isDuplicate}
              class:selected={q.selected}
            >
              <div class="preview-header">
                <span class="preview-number">#{index + 1}</span>
                <span class="preview-type">{q.questionType}</span>
                {#if q.isDuplicate}
                  <span class="duplicate-badge">⚠ Duplicate</span>
                {/if}
                {#if q.tags.length > 0}
                  <div class="preview-tags">
                    {#each q.tags as tag (tag)}
                      <span class="tag">{tag}</span>
                    {/each}
                  </div>
                {/if}
                <input
                  type="checkbox"
                  class="preview-checkbox"
                  checked={q.selected}
                  onchange={() => toggleQuestionSelection(index)}
                  title="Select for import"
                />
              </div>
              <div class="preview-content">
                <p class="preview-question-text">{q.question}</p>
                {#if q.difficulty && q.difficulty.length > 0}
                  <p class="preview-rating"><small>Difficulty: {q.difficulty.join(", ")}</small></p>
                {/if}
              </div>
            </div>
          {/each}
        </div>

        <div class="modal-actions">
          <button onclick={cancelPreview} class="secondary">Cancel</button>
          <button
            onclick={confirmImport}
            class="primary"
            disabled={importInProgress || getSelectedCount() === 0}
          >
            {importInProgress
              ? "Importing..."
              : `Import ${getSelectedCount()} Selected Question(s)`}
          </button>
        </div>
      {:else}
        <div class="modal-actions">
          <button onclick={cancelPreview} class="secondary">Close</button>
        </div>
      {/if}
    </div>
  {:else if importResults}
    <div class="import-results">
      <h3>Import Complete</h3>

      <div class="result-summary">
        <div class="result-item success">
          <strong>✓ {importResults.success}</strong> questions imported successfully
        </div>

        {#if importResults.errors.length > 0}
          <div class="result-item error">
            <strong>✗ {importResults.errors.length}</strong> errors
            <ul>
              {#each importResults.errors as error, i (i)}
                <li>{error}</li>
              {/each}
            </ul>
          </div>
        {/if}

        {#if importResults.warnings.length > 0}
          <div class="result-item warning">
            <strong>⚠ {importResults.warnings.length}</strong> warnings
            <ul>
              {#each importResults.warnings as warning, i (i)}
                <li>{warning}</li>
              {/each}
            </ul>
          </div>
        {/if}
      </div>

      <div class="modal-actions">
        <button type="button" onclick={closeImportModal} class="primary">Done</button>
      </div>
    </div>
  {/if}
</SessionModal>

<!-- Export Modal -->
<SessionModal
  show={showExportModal}
  onClose={closeExportModal}
  title="Export Questions"
  size="medium"
>
  <p class="export-description">
    Choose the export format for the selected {selectedQuestionIds.size} question{selectedQuestionIds.size !==
    1
      ? "s"
      : ""}.
  </p>

  <div class="export-format-options">
    <label class="format-option">
      <input type="radio" name="export-format" value="json" bind:group={exportFormat} />
      <div class="format-content">
        <strong>JSON Format</strong>
        <p>
          Structured data format, ideal for importing back into Filipa or processing with other
          tools.
        </p>
      </div>
    </label>

    <label class="format-option">
      <input type="radio" name="export-format" value="md" bind:group={exportFormat} />
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

<style>

  .required {
    color: #d32f2f;
    margin-left: 0.25rem;
  }

  .confirm-text {
    line-height: 1.6;
    color: var(--color-text-secondary);
  }

  .confirm-text strong {
    color: #d32f2f;
    font-weight: 600;
  }

  :global([data-theme="dark"]) .confirm-text {
    color: var(--color-text-muted);
  }

  :global([data-theme="dark"]) .confirm-text strong {
    color: #ff8a80;
  }

  .question-catalog > header,
  .question-catalog > :not(:global(.navigation-tabs)):not(:global(.breadcrumbs)):not(header) {
    padding: 1rem;
  }

  .filters {
    display: flex;
    gap: 1rem;
    align-items: flex-start;
    margin-bottom: 2rem;
    padding: 1.5rem;
    background: var(--color-bg-subtle);
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
    color: var(--color-text-secondary);
    font-size: 0.9rem;
    white-space: nowrap;
  }

  .tag-filter-group {
    align-items: flex-start;
    flex: 1 1 100%;
  }

  .tag-filter-panel {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    flex: 1;
  }

  .tag-filter-controls {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .tag-search-input {
    padding: 0.4rem 0.75rem;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    font-size: 0.85rem;
    width: 180px;
  }

  .tag-search-input:focus {
    outline: none;
    border-color: var(--color-primary);
  }

  .tag-toggle-btn {
    padding: 0.4rem 0.75rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-size: 0.8rem;
    background: white;
    cursor: pointer;
    color: #555;
    white-space: nowrap;
  }

  .tag-toggle-btn:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  .tag-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }

  .tag-chip {
    padding: 0.25rem 0.65rem;
    border: 1px solid #ccc;
    border-radius: 12px;
    font-size: 0.8rem;
    background: white;
    cursor: pointer;
    transition:
      background 0.15s,
      border-color 0.15s,
      color 0.15s;
    color: #444;
  }

  .tag-chip:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  .tag-chip.selected {
    background: var(--color-primary);
    border-color: var(--color-primary);
    color: white;
  }

  .tag-filter-empty {
    font-size: 0.9rem;
    color: #999;
  }

  .search-input {
    padding: 0.5rem 1rem;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    font-size: 1rem;
    min-width: 250px;
  }

  .search-input:focus {
    outline: none;
    border-color: var(--color-primary);
  }

  select {
    padding: 0.5rem 1rem;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    font-size: 0.9rem;
    background: white;
    cursor: pointer;
  }

  select:focus {
    outline: none;
    border-color: var(--color-primary);
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
    border: 1px solid var(--color-border);
    border-radius: 4px;
    font-size: 0.9rem;
    background: white;
    cursor: pointer;
    min-width: 150px;
    text-align: left;
  }

  .multiselect-trigger:hover {
    border-color: var(--color-primary);
  }

  .dropdown-arrow {
    font-size: 0.7rem;
    color: var(--color-text-secondary);
  }

  .multiselect-dropdown {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    background: white;
    border: 1px solid var(--color-border);
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
    background: var(--color-bg-subtle);
  }

  .multiselect-option input[type="checkbox"] {
    cursor: pointer;
    margin: 0;
  }

  .multiselect-option span {
    flex: 1;
    font-size: 0.9rem;
  }

  .difficulty-dropdown {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    min-width: 200px;
  }

  .difficulty-dropdown .multiselect-option {
    justify-content: center;
    padding: 0.5rem 0.25rem;
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
    border: 1px solid var(--color-border);
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.9rem;
  }

  .clear-filters:hover {
    background: var(--color-bg-subtle);
  }

  .results-count {
    color: var(--color-text-secondary);
    font-size: 0.9rem;
    font-weight: 500;
    align-self: center;
  }

  .select-all-checkbox {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-left: auto;
    font-size: 0.9rem;
    font-weight: 500;
    color: var(--color-text);
    cursor: pointer;
    user-select: none;
  }

  .select-all-checkbox input[type="checkbox"] {
    cursor: pointer;
    width: 18px;
    height: 18px;
  }

  .delete-btn {
    padding: 0.5rem 1rem !important;
    background: #f44336 !important;
    color: white !important;
    border: none !important;
    border-radius: 4px !important;
    cursor: pointer;
    font-size: 0.9rem !important;
    font-weight: 500 !important;
    transition: background 0.2s !important;
  }

  .delete-btn:hover {
    background: #d32f2f !important;
  }

  :global([data-theme="dark"]) .delete-btn {
    background: #c62828 !important;
    color: #ffffff !important;
  }

  :global([data-theme="dark"]) .delete-btn:hover {
    background: #b71c1c !important;
  }

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

  :global([data-theme="dark"]) .export-btn {
    background: #2e7d32 !important;
    color: #ffffff !important;
  }

  :global([data-theme="dark"]) .export-btn:hover {
    background: #388e3c !important;
  }

  .questions-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
    gap: 1.5rem;
  }

  .questions-table thead th {
    color: #555;
    white-space: nowrap;
  }

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
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .col-actions {
    width: 72px;
    text-align: right;
    white-space: nowrap;
  }

  .no-value {
    color: #bbb;
  }

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

  .icon-btn.delete-icon:hover {
    background: #fdecea;
  }

  /* Base question-card styles now in app.css - keeping component-specific transitions */
  .question-card {
    transition: all 0.2s;
    height: 280px;
    display: flex;
    flex-direction: column;
  }

  .question-card:hover {
    border-color: var(--color-primary);
    box-shadow: 0 2px 8px rgba(0, 102, 204, 0.1);
  }

  .question-card.selected {
    border-color: #4caf50;
    background: #f1f8f4;
    box-shadow: 0 2px 8px rgba(76, 175, 80, 0.15);
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

  .rating-info {
    margin-bottom: 1rem;
    color: var(--color-text-secondary);
  }

  .question-meta {
    margin-bottom: 0.5rem;
    color: #999;
    font-size: 0.75rem;
  }

  .col-created {
    white-space: nowrap;
    color: var(--color-text-secondary);
    font-size: 0.85rem;
  }

  /* Base action-btn, edit, delete styles now in app.css */
  .card-actions {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid #eee;
  }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  /* Import Modal Styles */
  .import-instructions {
    margin-bottom: 1.5rem;
  }

  .import-instructions p {
    margin-bottom: 1rem;
    color: var(--color-text-secondary);
  }

  .format-examples {
    margin: 1.5rem 0;
  }

  .format-examples details {
    margin-bottom: 1rem;
    padding: 0.5rem;
    border: 1px solid var(--color-border);
    border-radius: 4px;
  }

  .format-examples summary {
    cursor: pointer;
    font-weight: 500;
    color: var(--color-primary);
    padding: 0.5rem;
  }

  .format-examples summary:hover {
    background: var(--color-bg-subtle);
  }

  .import-instructions pre {
    background: var(--color-bg-subtle);
    padding: 1rem;
    border-radius: 4px;
    overflow-x: auto;
    margin-bottom: 1rem;
    text-align: left;
  }

  .import-instructions code {
    font-family: "Courier New", monospace;
    font-size: 0.85rem;
    color: var(--color-text);
    text-align: left;
    display: block;
  }

  .file-upload {
    margin-top: 1.5rem;
  }

  .import-results {
    padding: 1rem 0;
  }

  .import-results h3 {
    margin: 0 0 1.5rem 0;
    color: var(--color-text);
  }

  .result-summary {
    margin-bottom: 1.5rem;
  }

  .result-item {
    padding: 1rem;
    margin-bottom: 1rem;
    border-radius: 4px;
  }

  .result-item.success {
    background: #e8f5e9;
    color: #2e7d32;
    border: 1px solid #a5d6a7;
  }

  .result-item.error {
    background: #ffebee;
    color: #c62828;
    border: 1px solid #ef9a9a;
  }

  .result-item.warning {
    background: #fff3e0;
    color: #e65100;
    border: 1px solid #ffcc80;
  }

  .result-item strong {
    display: block;
    margin-bottom: 0.5rem;
  }

  .result-item ul {
    margin: 0.5rem 0 0 1.5rem;
    padding: 0;
  }

  .result-item li {
    margin-bottom: 0.25rem;
    font-size: 0.9rem;
  }

  /* Import Preview Styles */
  .import-preview {
    padding: 1rem 0;
  }

  .import-preview h3 {
    margin: 0 0 1.5rem 0;
    color: var(--color-text);
  }

  .import-preview h4 {
    margin: 1.5rem 0 1rem 0;
    color: var(--color-text);
  }

  .preview-questions {
    max-height: 400px;
    overflow-y: auto;
    margin: 1rem 0;
  }

  .preview-questions-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid #ddd;
  }

  .select-all-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9rem;
    font-weight: 500;
    color: var(--color-text);
    cursor: pointer;
    user-select: none;
  }

  .select-all-label input[type="checkbox"] {
    cursor: pointer;
    width: 18px;
    height: 18px;
  }

  .preview-question-card {
    padding: 1.5rem;
    margin-bottom: 1rem;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    background: white;
    transition: all 0.2s;
  }

  .preview-question-card:hover {
    border-color: var(--color-primary);
    box-shadow: 0 2px 8px rgba(0, 102, 204, 0.1);
  }

  .preview-question-card.selected {
    border-color: #4caf50;
    background: #f1f8f4;
    box-shadow: 0 2px 8px rgba(76, 175, 80, 0.15);
  }

  .preview-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 1rem;
    flex-wrap: wrap;
  }

  .preview-number {
    padding: 0.25rem 0.5rem;
    background: #e3f2fd;
    color: #1976d2;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .preview-type {
    padding: 0.25rem 0.75rem;
    background: #e3f2fd;
    color: #1976d2;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
  }

  .preview-checkbox {
    cursor: pointer;
    width: 20px;
    height: 20px;
    flex-shrink: 0;
    margin-left: auto;
  }

  .preview-tags {
    display: flex;
    gap: 0.25rem;
    flex-wrap: wrap;
  }

  .preview-content {
    margin-top: 0.5rem;
  }

  .preview-question-text {
    margin: 0 0 0.5rem 0;
    color: var(--color-text);
    font-size: 1rem;
    line-height: 1.4;
  }

  .preview-rating {
    margin: 0;
    color: var(--color-text-secondary);
  }

  .duplicate-badge {
    padding: 0.25rem 0.5rem;
    background: #ffebee;
    color: #d32f2f;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 600;
  }

  /* Export Modal Styles */
  .export-description {
    margin-bottom: 1.5rem;
    color: var(--color-text-secondary);
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
    border: 2px solid var(--color-border);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .format-option:hover {
    border-color: var(--color-primary);
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
    color: var(--color-primary);
  }

  .format-content {
    flex: 1;
  }

  .format-content strong {
    display: block;
    margin-bottom: 0.5rem;
    font-size: 1rem;
    color: var(--color-text);
  }

  .format-content p {
    margin: 0;
    font-size: 0.9rem;
    color: var(--color-text-secondary);
    line-height: 1.4;
  }

  /* Responsive Design */
  @media (max-width: 768px) {
    .question-catalog > header,
    .question-catalog > :not(:global(.navigation-tabs)):not(:global(.breadcrumbs)):not(header) {
      padding: 1.5rem;
    }

    .filters {
      flex-direction: column;
      align-items: stretch;
    }

    .filter-group {
      width: 100%;
    }

    .search-input {
      min-width: 100%;
    }
  }

  :global([data-theme="dark"]) .filters {
    background: var(--color-bg-dark-2);
  }

  :global([data-theme="dark"]) .filter-group label {
    color: var(--color-text-muted);
  }

  :global([data-theme="dark"]) .search-input {
    background: var(--color-bg-dark);
    border-color: var(--color-border-dark);
    color: #ffffff;
  }

  :global([data-theme="dark"]) select {
    background: var(--color-bg-dark);
    border-color: var(--color-border-dark);
    color: #ffffff;
  }

  :global([data-theme="dark"]) .tag-search-input {
    background: var(--color-bg-dark);
    border-color: var(--color-border-dark);
    color: #ffffff;
  }

  :global([data-theme="dark"]) .tag-search-input:focus {
    border-color: var(--color-primary);
  }

  :global([data-theme="dark"]) .tag-toggle-btn {
    background: var(--color-bg-dark-2);
    border-color: #555;
    color: #ccc;
  }

  :global([data-theme="dark"]) .tag-toggle-btn:hover {
    border-color: var(--color-primary);
    color: #66aaff;
  }

  :global([data-theme="dark"]) .tag-chip {
    background: var(--color-bg-dark-2);
    border-color: #555;
    color: #ccc;
  }

  :global([data-theme="dark"]) .tag-chip:hover {
    border-color: var(--color-primary);
    color: #66aaff;
  }

  :global([data-theme="dark"]) .tag-chip.selected {
    background: var(--color-primary);
    border-color: var(--color-primary);
    color: white;
  }

  :global([data-theme="dark"]) .tag-filter-empty {
    color: var(--color-text-secondary);
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
    color: var(--color-text-muted);
  }

  :global([data-theme="dark"]) .col-sortable:hover {
    color: #66aaff;
  }

  :global([data-theme="dark"]) .col-question {
    color: #ddd;
  }

  :global([data-theme="dark"]) .icon-btn:hover {
    background: var(--color-bg-dark-2);
  }

  :global([data-theme="dark"]) .icon-btn.delete-icon:hover {
    background: #3a1a1a;
  }

  /* Question-card dark theme styles now in app.css */

  :global([data-theme="dark"]) .question-content h3 {
    color: #ffffff;
  }

  :global([data-theme="dark"]) .question-text::after {
    background: linear-gradient(to bottom, transparent, #1a1a1a);
  }

  :global([data-theme="dark"]) .question-card.selected .question-text::after {
    background: linear-gradient(to bottom, transparent, #2d3d2f);
  }

  :global([data-theme="dark"]) .expected-answer-content {
    background: var(--color-bg-dark-2);
  }

  :global([data-theme="dark"]) .expected-answer-content :global(.markdown-preview) {
    color: var(--color-text-muted);
  }

  /* Action btn dark theme now in app.css */

  :global([data-theme="dark"]) .select-all-checkbox {
    color: #ffffff;
  }

  :global([data-theme="dark"]) .question-card.selected {
    background: #2d3d2f;
    border-color: #4caf50;
  }

  :global([data-theme="dark"]) .export-description {
    color: var(--color-text-muted);
  }

  :global([data-theme="dark"]) .format-option {
    border-color: var(--color-border-dark);
    background: var(--color-bg-dark-2);
  }

  :global([data-theme="dark"]) .format-option:hover {
    border-color: var(--color-primary);
    background: #333;
  }

  :global([data-theme="dark"]) .format-content strong {
    color: #ffffff;
  }

  :global([data-theme="dark"]) .format-content p {
    color: var(--color-text-muted);
  }

  :global([data-theme="dark"]) .import-instructions p {
    color: var(--color-text-muted);
  }

  :global([data-theme="dark"]) .format-examples details {
    border-color: var(--color-border-dark);
    background: var(--color-bg-dark-2);
  }

  :global([data-theme="dark"]) .format-examples summary {
    color: #5c9fd6;
  }

  :global([data-theme="dark"]) .format-examples summary:hover {
    background: #333;
  }

  :global([data-theme="dark"]) .import-instructions pre {
    background: var(--color-bg-dark);
    border: 1px solid #444;
  }

  :global([data-theme="dark"]) .import-instructions code {
    color: #e0e0e0;
  }

  :global([data-theme="dark"]) .import-preview h3,
  :global([data-theme="dark"]) .import-preview h4,
  :global([data-theme="dark"]) .import-results h3 {
    color: #ffffff;
  }

  :global([data-theme="dark"]) .preview-question-card {
    background: var(--color-bg-dark-2);
    border-color: var(--color-border-dark);
  }

  :global([data-theme="dark"]) .preview-question-card:hover {
    border-color: var(--color-primary);
    box-shadow: 0 2px 8px rgba(0, 102, 204, 0.2);
  }

  :global([data-theme="dark"]) .preview-question-card.selected {
    background: #2d3d2f;
    border-color: #4caf50;
    box-shadow: 0 2px 8px rgba(76, 175, 80, 0.2);
  }

  :global([data-theme="dark"]) .preview-question-text {
    color: #ffffff;
  }

  :global([data-theme="dark"]) .preview-rating {
    color: var(--color-text-muted);
  }

  :global([data-theme="dark"]) .preview-number {
    background: #1e3a5f;
    color: #64b5f6;
  }

  :global([data-theme="dark"]) .preview-type {
    background: #1e3a5f;
    color: #64b5f6;
  }

  :global([data-theme="dark"]) .duplicate-badge {
    background: #5a1a1a;
    color: #ff8a80;
  }

  :global([data-theme="dark"]) .preview-questions-header {
    border-bottom-color: var(--color-border-dark);
  }

  :global([data-theme="dark"]) .select-all-label {
    color: #ffffff;
  }

  :global([data-theme="dark"]) .result-item.success {
    background: #1b3a1b;
    color: #81c784;
    border-color: #2e7d32;
  }

  :global([data-theme="dark"]) .result-item.error {
    background: #3a1b1b;
    color: #ef9a9a;
    border-color: #c62828;
  }

  :global([data-theme="dark"]) .result-item.warning {
    background: #3a2e1b;
    color: #ffcc80;
    border-color: #e65100;
  }

  .header-left {
    display: flex;
    align-items: center;
  }

  .question-sets-link {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.4rem 0.85rem;
    border: 1px solid #d0d0d0;
    border-radius: 6px;
    color: #444;
    text-decoration: none;
    font-size: 0.9rem;
    font-weight: 500;
    background: var(--color-bg-subtle);
    transition:
      background 0.15s,
      border-color 0.15s,
      color 0.15s;
  }

  .question-sets-link:hover {
    background: #e8f0fe;
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  .question-sets-icon {
    width: 20px;
    height: 20px;
    flex-shrink: 0;
  }

  :global([data-theme="dark"]) .question-sets-link {
    background: var(--color-bg-dark-2);
    border-color: var(--color-border-dark);
    color: #ccc;
  }

  :global([data-theme="dark"]) .question-sets-link:hover {
    background: #1a2a3a;
    border-color: var(--color-primary-dark);
    color: var(--color-primary-dark);
  }
</style>
