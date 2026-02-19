<script lang="ts">
  import { onMount } from "svelte";
  import { link } from "svelte-spa-router";
  import {
    candidateDB,
    sessionDB,
    sessionQuestionDB,
    questionDB,
    generateId,
    generateQuestionHash,
  } from "../lib/db";
  import type { Candidate, Session, SessionQuestion } from "../lib/types";
  import { QuestionType } from "../lib/types";

  interface SessionSummary {
    total: number;
    answered: number;
    ratedCount: number;
    ratingSum: number;
    textAnsweredCount: number;
  }
  import Navigation from "../lib/Navigation.svelte";
  import Breadcrumbs from "../lib/Breadcrumbs.svelte";
  import SessionModal from "../lib/SessionModal.svelte";

  let { params = { candidateId: "" } }: { params: { candidateId: string } } = $props();

  interface ImportQuestionNested {
    question: string;
    tags?: string[];
    questionType?: string;
    expectedAnswer?: string;
    rating?: number[];
  }

  interface ImportQuestionData {
    question: string | ImportQuestionNested;
    expectedAnswer?: string;
    answer?: string;
    note?: string;
    tags?: string[];
    rating?: number[];
    questionType?: string;
    isPresented?: boolean;
    questionRating?: number;
  }

  interface ImportSessionData {
    session: {
      name?: string;
      date?: Date | string;
      interviewers?: string[];
      notes?: string;
    };
    questions: ImportQuestionData[];
  }

  let candidate: Candidate | null = $state(null);
  let sessions: Session[] = $state([]);
  let sessionSummaries: Record<string, SessionSummary> = $state({});
  let loading = $state(true);
  let error = $state<string | null>(null);

  // Modal state for sessions
  let showSessionModal = $state(false);
  let editingSession: Session | null = $state(null);
  let sessionFormData = $state({
    name: "",
    date: new Date().toISOString().split("T")[0],
    interviewers: "",
    notes: "",
  });
  let saving = $state(false);

  // Delete confirmation
  let deleteConfirmSessionId: string | null = $state(null);

  // Edit candidate modal
  let showEditCandidateModal = $state(false);
  let candidateFormData = $state({ displayName: "", notes: "" });

  // Export session modal
  let showExportModal = $state(false);
  let exportingSessionId: string | null = $state(null);
  let exportFormat: "json" | "md" = $state("json");
  let isExporting = $state(false);

  // Import session modal
  let showImportModal = $state(false);
  let isImporting = $state(false);
  let importFile: File | null = $state(null);
  let importError = $state<string | null>(null);
  let importFileInput: HTMLInputElement | null = $state(null);

  const triggerImportFileSelect = () => importFileInput?.click();

  onMount(async () => {
    await loadData();
  });

  async function loadData() {
    try {
      loading = true;
      const candidateId = params.candidateId;
      candidate = await candidateDB.read(candidateId);

      if (!candidate) {
        error = "Candidate not found";
        loading = false;
        return;
      }

      sessions = await sessionDB.listByCandidateId(candidateId);

      // Load stats for each session
      const summaries: Record<string, SessionSummary> = {};
      await Promise.all(
        sessions.map(async (session) => {
          const questions = await sessionQuestionDB.listBySessionId(session.id);
          summaries[session.id] = computeSessionSummary(questions);
        })
      );
      sessionSummaries = summaries;

      loading = false;
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to load candidate";
      loading = false;
    }
  }

  const computeSessionSummary = (questions: SessionQuestion[]): SessionSummary => {
    const total = questions.length;
    const answered = questions.filter(
      (q) => (q.answer && q.answer.trim().length > 0) || q.questionRating > 0 || (q.note && q.note.trim().length > 0)
    ).length;
    const rated = questions.filter((q) => q.questionRating > 0);
    const ratedCount = rated.length;
    const ratingSum = rated.reduce((sum, q) => sum + q.questionRating, 0);
    const textAnsweredCount = questions.filter(
      (q) =>
        q.questionObj.questionType === QuestionType.Text &&
        q.answer &&
        q.answer.trim().length > 0
    ).length;
    return { total, answered, ratedCount, ratingSum, textAnsweredCount };
  };

  const aggregateStats = $derived.by(() => {
    const summaryList = Object.values(sessionSummaries);
    const totalSessions = sessions.length;
    const totalQuestions = summaryList.reduce((s, x) => s + x.total, 0);
    const totalAnswered = summaryList.reduce((s, x) => s + x.answered, 0);
    const totalRatedCount = summaryList.reduce((s, x) => s + x.ratedCount, 0);
    const totalRatingSum = summaryList.reduce((s, x) => s + x.ratingSum, 0);
    const avgRating = totalRatedCount > 0 ? totalRatingSum / totalRatedCount : null;
    return { totalSessions, totalQuestions, totalAnswered, avgRating };
  });

  function openCreateSessionModal() {
    editingSession = null;
    sessionFormData = {
      name: "",
      date: new Date().toISOString().split("T")[0],
      interviewers: "",
      notes: "",
    };
    showSessionModal = true;
  }

  function openEditSessionModal(session: Session, event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    editingSession = session;
    sessionFormData = {
      name: session.name,
      date: new Date(session.date).toISOString().split("T")[0],
      interviewers: session.interviewers.join(", "),
      notes: session.notes,
    };
    showSessionModal = true;
  }

  function closeSessionModal() {
    showSessionModal = false;
    editingSession = null;
  }

  async function handleSessionSubmit(event: Event) {
    event.preventDefault();

    if (!sessionFormData.name.trim()) {
      alert("Please enter a session name");
      return;
    }

    try {
      saving = true;
      const now = new Date();
      const interviewersList = sessionFormData.interviewers
        .split(",")
        .map((i) => i.trim())
        .filter((i) => i.length > 0);

      if (editingSession) {
        // Update existing session
        const updated: Session = {
          ...editingSession,
          name: sessionFormData.name.trim(),
          date: new Date(sessionFormData.date),
          interviewers: interviewersList,
          notes: sessionFormData.notes.trim(),
          updatedAt: now,
        };
        await sessionDB.update(updated);
      } else {
        // Create new session
        const newSession: Session = {
          id: generateId(),
          candidateId: params.candidateId,
          name: sessionFormData.name.trim(),
          date: new Date(sessionFormData.date),
          interviewers: interviewersList,
          notes: sessionFormData.notes.trim(),
          currentQuestionIndex: -1,
          sortOrder: sessions.length,
          createdAt: now,
          updatedAt: now,
        };
        await sessionDB.create(newSession);
      }

      await loadData();
      closeSessionModal();
    } catch (err) {
      alert("Failed to save session: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      saving = false;
    }
  }

  function confirmDeleteSession(sessionId: string, event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    deleteConfirmSessionId = sessionId;
  }

  async function handleDeleteSession(sessionId: string) {
    try {
      await sessionDB.delete(sessionId);
      await loadData();
      deleteConfirmSessionId = null;
    } catch (err) {
      alert("Failed to delete session: " + (err instanceof Error ? err.message : "Unknown error"));
    }
  }

  function cancelDeleteSession() {
    deleteConfirmSessionId = null;
  }

  async function moveSession(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= sessions.length) return;

    // Get a plain (non-proxy) snapshot of the sessions array
    const updated: Session[] = $state.snapshot(sessions);
    [updated[index], updated[targetIndex]] = [updated[targetIndex], updated[index]];

    // Reassign sortOrder to match current array positions and persist
    for (let idx = 0; idx < updated.length; idx++) {
      updated[idx].sortOrder = idx;
    }
    await Promise.all(updated.map((s) => sessionDB.update(s)));
    sessions = updated;
  }

  function closeEditCandidateModal() {
    showEditCandidateModal = false;
  }

  async function handleCandidateSubmit(event: Event) {
    event.preventDefault();

    if (!candidateFormData.displayName.trim()) {
      alert("Please enter a display name");
      return;
    }

    try {
      saving = true;
      if (candidate) {
        const updated: Candidate = {
          ...candidate,
          displayName: candidateFormData.displayName.trim(),
          notes: candidateFormData.notes.trim(),
          updatedAt: new Date(),
        };
        await candidateDB.update(updated);
        candidate = updated;
      }
      closeEditCandidateModal();
    } catch (err) {
      alert(
        "Failed to update candidate: " + (err instanceof Error ? err.message : "Unknown error")
      );
    } finally {
      saving = false;
    }
  }

  function openExportModal(sessionId: string, event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    exportingSessionId = sessionId;
    exportFormat = "json";
    showExportModal = true;
  }

  function closeExportModal() {
    showExportModal = false;
    exportingSessionId = null;
    exportFormat = "json";
  }

  async function handleExport() {
    if (!exportingSessionId || !candidate) {
      return;
    }

    try {
      isExporting = true;

      // Find the session
      const session = sessions.find((s) => s.id === exportingSessionId);
      if (!session) {
        alert("Session not found");
        return;
      }

      // Get all session questions
      const sessionQuestions = await sessionQuestionDB.listBySessionId(exportingSessionId);
      sessionQuestions.sort((a, b) => a.order - b.order);

      // Generate export content based on format
      let content: string;
      let filename: string;
      let mimeType: string;

      if (exportFormat === "json") {
        content = generateJsonExport(candidate, session, sessionQuestions);
        filename = `interview-${candidate.displayName.replace(/\s+/g, "-")}-${session.name.replace(/\s+/g, "-")}-${new Date().toISOString().split("T")[0]}.json`;
        mimeType = "application/json";
      } else {
        content = generateMarkdownExport(candidate, session, sessionQuestions);
        filename = `interview-${candidate.displayName.replace(/\s+/g, "-")}-${session.name.replace(/\s+/g, "-")}-${new Date().toISOString().split("T")[0]}.md`;
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
    } catch (err) {
      alert("Failed to export session: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      isExporting = false;
    }
  }

  function generateJsonExport(
    candidate: Candidate,
    session: Session,
    sessionQuestions: SessionQuestion[]
  ): string {
    const exportData = {
      version: "1.0.0",
      exportedAt: new Date().toISOString(),
      candidate: {
        id: candidate.id,
        displayName: candidate.displayName,
        notes: candidate.notes,
        createdAt: candidate.createdAt.toISOString(),
        updatedAt: candidate.updatedAt.toISOString(),
      },
      session: {
        id: session.id,
        candidateId: session.candidateId,
        name: session.name,
        date: session.date.toISOString(),
        interviewers: session.interviewers,
        notes: session.notes,
        currentQuestionIndex: session.currentQuestionIndex,
        createdAt: session.createdAt.toISOString(),
        updatedAt: session.updatedAt.toISOString(),
      },
      questions: sessionQuestions.map((sq) => ({
        id: sq.id,
        sessionId: sq.sessionId,
        order: sq.order,
        note: sq.note,
        questionRating: sq.questionRating,
        answer: sq.answer,
        isPresented: sq.isPresented,
        question: {
          id: sq.questionObj.id,
          tags: sq.questionObj.tags,
          questionType: sq.questionObj.questionType,
          question: sq.questionObj.question,
          expectedAnswer: sq.questionObj.expectedAnswer,
          difficulty: sq.questionObj.difficulty,
          hash: sq.questionObj.hash,
          createdAt: sq.questionObj.createdAt.toISOString(),
          updatedAt: sq.questionObj.updatedAt.toISOString(),
        },
        createdAt: sq.createdAt.toISOString(),
        updatedAt: sq.updatedAt.toISOString(),
      })),
    };

    return JSON.stringify(exportData, null, 2);
  }

  function generateMarkdownExport(
    candidate: Candidate,
    session: Session,
    sessionQuestions: SessionQuestion[]
  ): string {
    const lines: string[] = [];

    // Header with session/candidate info
    lines.push("# Interview Session Export");
    lines.push("");
    lines.push(`Candidate: ${candidate.displayName}`);
    lines.push(`Candidate ID: ${candidate.id}`);
    lines.push(`Session: ${session.name}`);
    lines.push(`Date: ${new Date(session.date).toLocaleDateString()}`);
    if (session.interviewers.length > 0) {
      lines.push(`Interviewers: ${session.interviewers.join(", ")}`);
    }
    lines.push(`Exported: ${new Date().toLocaleString()}`);
    lines.push("");
    lines.push("---");
    lines.push("");

    // Questions
    if (sessionQuestions.length === 0) {
      lines.push("*No questions in this session.*");
    } else {
      sessionQuestions.forEach((sq, index) => {
        const q = sq.questionObj;

        lines.push(`## Question ${index + 1}`);
        lines.push("");

        lines.push("### Question");
        lines.push("");
        lines.push(q.question);
        lines.push("");

        lines.push("### Expected Answer");
        lines.push("");
        lines.push(q.expectedAnswer || "*No expected answer provided.*");
        lines.push("");

        if (sq.answer) {
          lines.push("### Candidate's Answer");
          lines.push("");
          lines.push(sq.answer);
          lines.push("");
        }

        if (sq.note) {
          lines.push("### Interviewer's Notes");
          lines.push("");
          lines.push(sq.note);
          lines.push("");
        }

        // Metadata at the end
        lines.push(`Question ID: ${q.id}`);
        if (q.tags.length > 0) {
          lines.push(`Tags: ${q.tags.join(", ")}`);
        }
        if (q.difficulty && q.difficulty.length > 0) {
          lines.push(`Difficulty: [${q.difficulty.join(", ")}]`);
        }
        lines.push(`Type: ${q.questionType}`);
        lines.push(`Presented: ${sq.isPresented ? "Yes" : "No"}`);
        if (sq.questionRating && sq.questionRating > 0) {
          lines.push(`Answer Rating: ${sq.questionRating}`);
        }
        lines.push("");
        lines.push("---");
        lines.push("");
      });
    }

    return lines.join("\n");
  }

  function openImportModal() {
    importFile = null;
    importError = null;
    showImportModal = true;
  }

  function closeImportModal() {
    showImportModal = false;
    importFile = null;
    importError = null;
  }

  function handleFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      // Validate file type
      const validExtensions = [".json", ".md"];
      const fileExt = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
      if (!validExtensions.includes(fileExt)) {
        importError = "Please select a JSON or Markdown (.md) file";
        importFile = null;
        return;
      }
      importFile = file;
      importError = null;
    }
  }

  async function handleImport() {
    if (!importFile || !candidate) {
      return;
    }

    try {
      isImporting = true;
      importError = null;

      const fileContent = await importFile.text();
      const fileExt = importFile.name.substring(importFile.name.lastIndexOf(".")).toLowerCase();

      let importData: ImportSessionData;

      if (fileExt === ".json") {
        importData = await parseJsonImport(fileContent);
      } else if (fileExt === ".md") {
        importData = await parseMarkdownImport(fileContent);
      } else {
        throw new Error("Unsupported file format");
      }

      // Create session and questions
      await createSessionFromImport(importData);

      // Reload data and close modal
      await loadData();
      closeImportModal();
    } catch (err) {
      importError = err instanceof Error ? err.message : "Failed to import session";
      console.error("Import error:", err);
    } finally {
      isImporting = false;
    }
  }

  async function parseJsonImport(content: string): Promise<ImportSessionData> {
    try {
      const data = JSON.parse(content) as ImportSessionData;

      if (!data.session || !data.questions) {
        throw new Error("Invalid JSON format: missing session or questions");
      }

      return data;
    } catch (err) {
      throw new Error("Invalid JSON file format", { cause: err });
    }
  }

  async function parseMarkdownImport(content: string): Promise<ImportSessionData> {
    const lines = content.split("\n");
    const data: ImportSessionData = {
      session: {},
      questions: [],
    };

    // Parse header information
    for (let i = 0; i < Math.min(lines.length, 20); i++) {
      const line = lines[i].trim();

      if (line.startsWith("Session:")) {
        data.session.name = line.substring("Session:".length).trim();
      } else if (line.startsWith("Date:")) {
        const dateStr = line.substring("Date:".length).trim();
        data.session.date = parseImportDate(dateStr);
      } else if (line.startsWith("Interviewers:")) {
        const interviewersStr = line.substring("Interviewers:".length).trim();
        data.session.interviewers = interviewersStr.split(",").map((s) => s.trim());
      }
    }

    // Parse questions
    const questionRegex = /^## Question \d+$/;
    let currentQuestion: ImportQuestionData | null = null;
    let currentSection: string | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (questionRegex.test(line)) {
        // Save previous question if exists
        if (currentQuestion) {
          data.questions.push(currentQuestion);
        }
        // Start new question
        currentQuestion = {
          question: "",
          expectedAnswer: "",
          answer: "",
          note: "",
          tags: [],
          rating: [],
          questionType: "text",
          isPresented: false,
          questionRating: 0,
        };
        currentSection = null;
      } else if (line === "### Question") {
        currentSection = "question";
      } else if (line === "### Expected Answer") {
        currentSection = "expectedAnswer";
      } else if (line === "### Candidate's Answer") {
        currentSection = "answer";
      } else if (line === "### Interviewer's Notes") {
        currentSection = "note";
      } else if (line.startsWith("Question ID:")) {
        // Skip - we'll generate new IDs
      } else if (line.startsWith("Tags:")) {
        if (currentQuestion) {
          const tagsStr = line.substring("Tags:".length).trim();
          currentQuestion.tags = tagsStr
            .split(",")
            .map((s) => s.trim())
            .filter((s) => s.length > 0);
        }
      } else if (line.startsWith("Difficulty:")) {
        if (currentQuestion) {
          const difficultyMatch = line.match(/\[(.*?)\]/);
          if (difficultyMatch) {
            currentQuestion.rating = difficultyMatch[1]
              .split(",")
              .map((s) => parseInt(s.trim()))
              .filter((n) => !isNaN(n));
          }
        }
      } else if (line.startsWith("Type:")) {
        if (currentQuestion) {
          const type = line.substring("Type:".length).trim();
          currentQuestion.questionType = type;
        }
      } else if (line.startsWith("Presented:")) {
        if (currentQuestion) {
          const presented = line.substring("Presented:".length).trim().toLowerCase();
          currentQuestion.isPresented = presented === "yes";
        }
      } else if (line.startsWith("Answer Rating:")) {
        if (currentQuestion) {
          const rating = parseInt(line.substring("Answer Rating:".length).trim());
          if (!isNaN(rating)) {
            currentQuestion.questionRating = rating;
          }
        }
      } else if (line === "---" || line === "") {
        // Skip separators and empty lines
      } else if (currentSection && currentQuestion) {
        // Append content to current section
        if (currentSection === "question") {
          currentQuestion.question = currentQuestion.question
            ? (currentQuestion.question as string) + "\n" + line
            : line;
        } else if (currentSection === "expectedAnswer") {
          currentQuestion.expectedAnswer = currentQuestion.expectedAnswer
            ? currentQuestion.expectedAnswer + "\n" + line
            : line;
        } else if (currentSection === "answer") {
          currentQuestion.answer = currentQuestion.answer
            ? currentQuestion.answer + "\n" + line
            : line;
        } else if (currentSection === "note") {
          currentQuestion.note = currentQuestion.note ? currentQuestion.note + "\n" + line : line;
        }
      }
    }

    // Save last question
    if (currentQuestion) {
      data.questions.push(currentQuestion);
    }

    // Clean up question content (trim extra whitespace)
    data.questions.forEach((q: ImportQuestionData) => {
      if (typeof q.question === "string") q.question = q.question.trim();
      if (typeof q.expectedAnswer === "string") q.expectedAnswer = q.expectedAnswer.trim();
      if (typeof q.answer === "string") q.answer = q.answer.trim();
      if (typeof q.note === "string") q.note = q.note.trim();
    });

    return data;
  }

  function parseImportDate(dateStr: string): Date {
    // Try to parse various date formats
    // e.g., "9. 2. 2026" or "2026-02-09" or "02/09/2026"

    // Try ISO format first
    let date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date;
    }

    // Try European format (d. m. yyyy)
    const europeanMatch = dateStr.match(/(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/);
    if (europeanMatch) {
      const [, day, month, year] = europeanMatch;
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }

    // Default to today if parsing fails
    console.warn("Could not parse date:", dateStr);
    return new Date();
  }

  async function createSessionFromImport(importData: ImportSessionData) {
    if (!candidate) {
      throw new Error("No candidate selected");
    }

    const now = new Date();

    // Create or find questions in catalog
    for (let i = 0; i < importData.questions.length; i++) {
      const qData = importData.questions[i];

      // Extract question data (handle both JSON and parsed markdown formats)
      const nestedQ = typeof qData.question === "object" ? qData.question : null;
      const questionText =
        (typeof qData.question === "string" ? qData.question : nestedQ?.question) || "";
      const tags = qData.tags || nestedQ?.tags || [];
      const questionType = qData.questionType || nestedQ?.questionType || "text";
      const expectedAnswer = qData.expectedAnswer || nestedQ?.expectedAnswer || "";
      const rating = qData.rating || nestedQ?.rating || [];

      // Generate hash for duplicate detection
      const hash = generateQuestionHash(questionText, tags, questionType);

      // Check if question already exists by hash
      const existingQuestions = await questionDB.listByHash(hash);

      if (existingQuestions.length === 0) {
        // Create new question in catalog
        await questionDB.create({
          id: generateId(),
          tags: tags,
          questionType: questionType === "rating" ? QuestionType.Rating : QuestionType.Text,
          question: questionText,
          expectedAnswer: expectedAnswer,
          difficulty: rating,
          hash: hash,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    // Create new session
    const newSession: Session = {
      id: generateId(),
      candidateId: candidate.id,
      name: importData.session.name || "Imported Session",
      date: importData.session.date ? new Date(importData.session.date) : now,
      interviewers: importData.session.interviewers || [],
      notes: importData.session.notes || "Imported from external session",
      currentQuestionIndex: -1,
      sortOrder: sessions.length,
      createdAt: now,
      updatedAt: now,
    };
    await sessionDB.create(newSession);

    // Create session questions
    for (let i = 0; i < importData.questions.length; i++) {
      const qData = importData.questions[i];

      // Extract question data (same as above)
      const nestedQ2 = typeof qData.question === "object" ? qData.question : null;
      const questionText =
        (typeof qData.question === "string" ? qData.question : nestedQ2?.question) || "";
      const tags = qData.tags || nestedQ2?.tags || [];
      const questionType = qData.questionType || nestedQ2?.questionType || "text";

      // Get the question from catalog
      const hash = generateQuestionHash(questionText, tags, questionType);
      const existingQuestions = await questionDB.listByHash(hash);
      const questionObj = existingQuestions[0];

      const sessionQuestion: SessionQuestion = {
        id: generateId(),
        sessionId: newSession.id,
        questionObj: questionObj,
        order: i,
        note: qData.note || "",
        questionRating: qData.questionRating || 0,
        answer: qData.answer || "",
        isPresented: qData.isPresented || false,
        createdAt: now,
        updatedAt: now,
      };
      await sessionQuestionDB.create(sessionQuestion);
    }
  }
</script>

<div class="page candidate-detail">
  {#if loading}
    <Navigation />
    <p class="loading">Loading...</p>
  {:else if error}
    <Navigation />
    <p class="error">Error: {error}</p>
  {:else if candidate}
    <Navigation />
    <Breadcrumbs
      items={[
        { label: "Home", href: "/" },
        { label: "Candidates", href: "/candidates" },
        { label: candidate.displayName },
      ]}
    />

    <header>
      <div>
        {#if candidate.notes}
          <p class="notes">{candidate.notes}</p>
        {:else}
          <p class="notes">Candidate Details</p>
        {/if}
      </div>
      {#if sessions.length > 0}
        <div class="header-stats">
          <span class="stat-item">
            {aggregateStats.totalSessions} session{aggregateStats.totalSessions !== 1 ? "s" : ""}
          </span>
          <span class="stat-sep">·</span>
          <span class="stat-item">
            {aggregateStats.totalAnswered}/{aggregateStats.totalQuestions} answered
          </span>
          {#if aggregateStats.avgRating !== null}
            <span class="stat-sep">·</span>
            <span class="stat-item stat-rating">
              avg rating {aggregateStats.avgRating.toFixed(1)}/10
            </span>
          {/if}
        </div>
      {/if}
    </header>

    <section class="sessions">
      <div class="section-header">
        <h2>Interview Sessions ({sessions.length})</h2>
        <div class="header-buttons">
          <button onclick={openImportModal} class="secondary">📥 Import</button>
          <button onclick={openCreateSessionModal} class="primary">+ New Session</button>
        </div>
      </div>

      {#if sessions.length === 0}
        <div class="empty-state">
          <p>No sessions yet. Create the first interview session.</p>
          <button onclick={openCreateSessionModal} class="primary">+ New Session</button>
        </div>
      {:else}
        <div class="session-list">
          {#each sessions as session, i (session.id)}
            <div class="session-card-wrapper">
              <div class="session-card">
                <div class="session-card-main">
                  <h3>{session.name}</h3>
                  <p class="date">
                    {new Date(session.date).toLocaleDateString()}
                  </p>
                  {#if session.interviewers.length > 0}
                    <p class="interviewers">
                      Interviewers: {session.interviewers.join(", ")}
                    </p>
                  {/if}
                  {#if session.notes}
                    <p class="session-notes">{session.notes}</p>
                  {/if}
                </div>
                {#if sessionSummaries[session.id]}
                  {@const s = sessionSummaries[session.id]}
                  <div class="session-stats">
                    {#if s.total === 0}
                      <span class="s-stat s-empty">no questions</span>
                    {:else}
                      <div class="s-row">
                        <span class="s-label">Answered</span>
                        <span class="s-value">{s.answered}/{s.total}</span>
                      </div>
                      {#if s.ratedCount > 0}
                        <div class="s-row">
                          <span class="s-label">Avg rating</span>
                          <span class="s-value s-rating">{(s.ratingSum / s.ratedCount).toFixed(1)}/10</span>
                        </div>
                      {/if}
                    {/if}
                  </div>
                {/if}
              </div>
              <div class="card-actions">
                <button
                  onclick={() => moveSession(i, -1)}
                  class="action-btn move"
                  title="Move up"
                  disabled={i === 0}
                >
                  ↑
                </button>
                <button
                  onclick={() => moveSession(i, 1)}
                  class="action-btn move"
                  title="Move down"
                  disabled={i === sessions.length - 1}
                >
                  ↓
                </button>
                <button
                  onclick={(e) => confirmDeleteSession(session.id, e)}
                  class="action-btn delete-narrow"
                  title="Delete session"
                >
                  🗑️
                </button>
                <button
                  onclick={(e) => openEditSessionModal(session, e)}
                  class="action-btn edit"
                  title="Edit session"
                >
                  Edit
                </button>
                <button
                  onclick={(e) => openExportModal(session.id, e)}
                  class="action-btn export"
                  title="Export session"
                >
                  Export
                </button>
                <a href="/session/{session.id}" use:link class="action-btn start-interview">
                  Open Session →
                </a>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </section>
  {/if}
</div>

<!-- Session Modal -->
<SessionModal
  show={showSessionModal}
  onClose={closeSessionModal}
  title={editingSession ? "Edit Session" : "New Session"}
  size="medium"
>
  <form onsubmit={handleSessionSubmit} autocomplete="off" data-form-type="other">
    <div class="form-group">
      <label for="interviewSessionName">Session Name *</label>
      <input
        id="interviewSessionName"
        name="interview-session-name"
        type="text"
        bind:value={sessionFormData.name}
        required
        placeholder="e.g., Technical Round 1"
        autocomplete="off"
        data-lpignore="true"
        data-form-type="other"
      />
    </div>

    <div class="form-group">
      <label for="interviewSessionDate">Date *</label>
      <input
        id="interviewSessionDate"
        name="interview-session-date"
        type="date"
        bind:value={sessionFormData.date}
        required
        autocomplete="off"
        data-lpignore="true"
        data-form-type="other"
      />
    </div>

    <div class="form-group">
      <label for="sessionInterviewers">Interviewers</label>
      <input
        id="sessionInterviewers"
        name="session-interviewers"
        type="text"
        bind:value={sessionFormData.interviewers}
        placeholder="Enter names separated by commas"
        autocomplete="off"
        data-lpignore="true"
        data-form-type="other"
      />
      <small>Separate multiple names with commas (e.g., John Doe, Jane Smith)</small>
    </div>

    <div class="form-group">
      <label for="interviewSessionNotes">Session Notes</label>
      <textarea
        id="interviewSessionNotes"
        name="interview-session-notes"
        bind:value={sessionFormData.notes}
        placeholder="Add any notes about this session"
        rows="4"
        autocomplete="off"
        data-lpignore="true"
        data-form-type="other"
      ></textarea>
    </div>

    <div class="modal-actions">
      <button type="button" onclick={closeSessionModal} class="secondary" disabled={saving}>
        Cancel
      </button>
      <button type="submit" class="primary" disabled={saving}>
        {saving ? "Saving..." : editingSession ? "Update" : "Create"}
      </button>
    </div>
  </form>
</SessionModal>

<!-- Edit Candidate Modal -->
<SessionModal
  show={showEditCandidateModal}
  onClose={closeEditCandidateModal}
  title="Edit Candidate"
  size="medium"
>
  <form onsubmit={handleCandidateSubmit} autocomplete="off" data-form-type="other">
    <div class="form-group">
      <label for="candidateDisplayName">Display Name *</label>
      <input
        id="candidateDisplayName"
        name="candidate-display-name"
        type="text"
        bind:value={candidateFormData.displayName}
        required
        placeholder="Enter display name"
        autocomplete="off"
        data-lpignore="true"
        data-form-type="other"
      />
    </div>

    <div class="form-group">
      <label for="candidateNotes">Notes</label>
      <textarea
        id="candidateNotes"
        name="candidate-notes"
        bind:value={candidateFormData.notes}
        placeholder="Add any notes about the candidate"
        rows="4"
        autocomplete="off"
        data-lpignore="true"
        data-form-type="other"
      ></textarea>
    </div>

    <div class="modal-actions">
      <button type="button" onclick={closeEditCandidateModal} class="secondary" disabled={saving}>
        Cancel
      </button>
      <button type="submit" class="primary" disabled={saving}>
        {saving ? "Saving..." : "Update"}
      </button>
    </div>
  </form>
</SessionModal>

<!-- Delete Confirmation Modal -->
<SessionModal
  show={!!deleteConfirmSessionId}
  onClose={cancelDeleteSession}
  title="Delete Session?"
  size="small"
>
  <p class="confirm-text">
    Are you sure you want to delete this session? This action cannot be undone.
  </p>
  <div class="modal-actions">
    <button type="button" onclick={cancelDeleteSession} class="secondary">Cancel</button>
    <button
      type="button"
      onclick={() => deleteConfirmSessionId && handleDeleteSession(deleteConfirmSessionId)}
      class="danger"
    >
      Delete
    </button>
  </div>
</SessionModal>

<!-- Export Session Modal -->
<SessionModal show={showExportModal} onClose={closeExportModal} title="Export Session" size="large">
  <p class="modal-description">
    Choose the export format for this interview session. The export will include candidate
    information, session details, and all questions (answered and not answered).
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

<!-- Import Session Modal -->
<SessionModal
  show={showImportModal}
  onClose={closeImportModal}
  title="Import Session"
  size="medium"
>
  <p class="modal-description">
    Import a session from a colleague. You can import both JSON and Markdown (.md) formats. The
    questions will be added to your question catalog if they don't already exist.
  </p>

  {#if importError}
    <div class="import-error">
      {importError}
    </div>
  {/if}

  <div class="form-group">
    <input
      bind:this={importFileInput}
      type="file"
      accept=".json,.md"
      onchange={handleFileSelect}
      disabled={isImporting}
      style="display: none"
    />
    <button
      type="button"
      class="secondary"
      onclick={triggerImportFileSelect}
      disabled={isImporting}
    >
      📂 Choose File (.json or .md)
    </button>
    {#if importFile}
      <p class="file-selected">Selected: {importFile.name}</p>
    {/if}
  </div>

  <div class="import-info">
    <p><strong>What will be imported:</strong></p>
    <ul>
      <li>Session information (name, date, interviewers)</li>
      <li>All questions with their expected answers</li>
      <li>Candidate answers (if available)</li>
      <li>Interviewer notes (if available)</li>
    </ul>
  </div>

  <div class="modal-actions">
    <button type="button" onclick={closeImportModal} class="secondary" disabled={isImporting}>
      Cancel
    </button>
    <button
      type="button"
      onclick={handleImport}
      class="primary"
      disabled={isImporting || !importFile}
    >
      {isImporting ? "Importing..." : "Import"}
    </button>
  </div>
</SessionModal>

<style>

  .notes {
    color: #6c757d;
    margin: 0;
    font-size: 0.9rem;
  }

  .candidate-detail > :not(:global(.navigation-tabs)):not(:global(.breadcrumbs)):not(header) {
    padding: 1rem;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .section-header h2 {
    margin: 0;
  }

  .header-buttons {
    display: flex;
    gap: 0.5rem;
  }

  .session-list {
    display: grid;
    gap: 1rem;
  }

  .session-card-wrapper {
    position: relative;
  }

  /* Base session-card styles now in app.css */

  .date {
    color: #999;
    font-size: 0.9rem;
    margin: 0.25rem 0;
  }

  .interviewers {
    color: var(--color-text-secondary);
    font-size: 0.9rem;
    margin: 0.5rem 0;
  }

  .session-notes {
    color: var(--color-text-secondary);
    font-size: 0.9rem;
    margin-top: 0.5rem;
  }

  /* Base action-btn, card-actions, edit, delete styles now in app.css */

  .action-btn.move {
    flex: 0 0 2rem;
    background: var(--color-bg-subtle);
    color: var(--color-text-secondary);
    font-size: 1rem;
    padding: 0;
  }

  .action-btn.move:hover:not(:disabled) {
    background: #e0e0e0;
    color: var(--color-text);
    transform: translateY(-1px);
  }

  .action-btn.move:disabled {
    opacity: 0.3;
    cursor: default;
  }

  .action-btn.export {
    flex: 1;
    background: #e8f4f8;
    color: #0277bd;
    font-weight: 500;
  }

  .action-btn.export:hover {
    background: #b3e5fc;
    transform: translateY(-1px);
  }

  .action-btn.start-interview {
    flex: 2;
    background: var(--color-primary);
    color: white;
    font-weight: 600;
  }

  .action-btn.start-interview:hover {
    background: var(--color-primary-hover);
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0, 102, 204, 0.2);
  }

  .modal-description {
    color: var(--color-text-secondary);
    margin-bottom: 1.5rem;
    line-height: 1.5;
  }

  .export-format-options {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .format-option {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    padding: 1rem;
    border: 2px solid #e0e0e0;
    border-radius: 6px;
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
    width: 18px;
    height: 18px;
    flex-shrink: 0;
  }

  .format-option input[type="radio"]:checked ~ .format-content {
    color: var(--color-primary);
  }

  .format-option:has(input[type="radio"]:checked) {
    border-color: var(--color-primary);
    background: #e8f4f8;
  }

  .format-content {
    flex: 1;
  }

  .format-content strong {
    display: block;
    margin-bottom: 0.25rem;
    font-size: 1rem;
  }

  .format-content p {
    margin: 0;
    color: var(--color-text-secondary);
    font-size: 0.9rem;
    line-height: 1.4;
  }

  .import-error {
    background: #ffebee;
    color: #d32f2f;
    padding: 1rem;
    border-radius: 6px;
    margin-bottom: 1rem;
    font-size: 0.9rem;
  }

  .file-selected {
    color: var(--color-primary);
    font-size: 0.9rem;
    margin-top: 0.5rem;
    font-weight: 500;
  }

  .import-info {
    background: #f8f9fa;
    padding: 1rem;
    border-radius: 6px;
    margin-top: 1rem;
  }

  .import-info p {
    margin: 0 0 0.5rem 0;
    font-size: 0.9rem;
  }

  .import-info ul {
    margin: 0.5rem 0 0 0;
    padding-left: 1.5rem;
  }

  .import-info li {
    font-size: 0.9rem;
    color: var(--color-text-secondary);
    margin-bottom: 0.25rem;
  }

  /* Responsive Design */
  @media (max-width: 768px) {
    .candidate-detail > :not(:global(.navigation-tabs)):not(:global(.breadcrumbs)):not(header) {
      padding: 1.5rem;
    }
  }

  :global([data-theme="dark"]) .notes {
    color: var(--color-text-muted);
  }

  /* Session-card dark theme styles now in app.css */

  :global([data-theme="dark"]) .interviewers {
    color: var(--color-text-muted);
  }

  :global([data-theme="dark"]) .session-notes {
    color: var(--color-text-muted);
  }

  /* Action btn edit/delete dark theme now in app.css */

  :global([data-theme="dark"]) .action-btn.move {
    background: var(--color-bg-dark-2);
    color: var(--color-text-muted);
  }

  :global([data-theme="dark"]) .action-btn.move:hover:not(:disabled) {
    background: var(--color-bg-dark-3);
    color: #fff;
  }

  :global([data-theme="dark"]) .action-btn.export {
    background: #1a3a4a;
    color: #81d4fa;
  }

  :global([data-theme="dark"]) .action-btn.export:hover {
    background: #2a4a5a;
  }

  :global([data-theme="dark"]) .format-option {
    border-color: var(--color-border-dark);
    background: var(--color-bg-dark-2);
  }

  :global([data-theme="dark"]) .format-option:hover {
    border-color: var(--color-primary-dark);
    background: #333;
  }

  :global([data-theme="dark"]) .format-option:has(input[type="radio"]:checked) {
    border-color: var(--color-primary-dark);
    background: #1a3a4a;
  }

  :global([data-theme="dark"]) .format-content p,
  :global([data-theme="dark"]) .modal-description {
    color: var(--color-text-muted);
  }

  :global([data-theme="dark"]) .import-error {
    background: #4a1a1a;
    color: #ff8a80;
  }

  :global([data-theme="dark"]) .file-selected {
    color: var(--color-primary-dark);
  }

  :global([data-theme="dark"]) .import-info {
    background: var(--color-bg-dark-2);
    border: 1px solid #444;
  }

  :global([data-theme="dark"]) .import-info li {
    color: var(--color-text-muted);
  }

  /* Header stats */
  header {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
    padding: 0.5rem 1rem;
  }

  .header-stats {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.85rem;
    color: var(--color-text-secondary);
    background: var(--color-bg-subtle);
    border-radius: 6px;
    padding: 0.25rem 0.75rem;
  }

  .stat-sep {
    color: var(--color-text-muted);
  }

  .stat-rating {
    color: var(--color-primary);
    font-weight: 500;
  }

  /* Session card layout */
  .session-card {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
  }

  .session-card-main {
    flex: 1;
    min-width: 0;
  }

  /* Per-session stats panel */
  .session-stats {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    padding: 0.5rem 0.75rem;
    background: var(--color-bg-subtle);
    border-radius: 6px;
    border-left: 2px solid var(--color-border);
    font-size: 0.8rem;
    align-self: center;
    min-width: 7rem;
  }

  .s-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
  }

  .s-label {
    color: var(--color-text-muted);
  }

  .s-value {
    font-weight: 600;
    color: var(--color-text-secondary);
  }

  .s-rating {
    color: var(--color-primary);
  }

  .s-empty {
    color: var(--color-text-muted);
    font-style: italic;
  }

  :global([data-theme="dark"]) .header-stats {
    background: var(--color-bg-dark-2);
    color: var(--color-text-muted);
  }

  :global([data-theme="dark"]) .stat-rating {
    color: var(--color-primary-dark);
  }

  :global([data-theme="dark"]) .session-stats {
    background: var(--color-bg-dark-2);
    border-left-color: var(--color-border-dark);
  }

  :global([data-theme="dark"]) .s-rating {
    color: var(--color-primary-dark);
  }
</style>
