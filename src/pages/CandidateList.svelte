<script lang="ts">
  import { onMount } from "svelte";
  import { link } from "svelte-spa-router";
  import { candidateDB, sessionDB, sessionQuestionDB, questionDB, generateId } from "../lib/db";
  import type { Candidate, Session, SessionQuestion, Question } from "../lib/types";
  import { QuestionType } from "../lib/types";
  import { loadConfig, getMarkdownFormatKey } from "../lib/configLoader";
  import { parseMarkdownWithConfig, parseJsonWithConfig } from "../lib/importParser";
  import Navigation from "../lib/Navigation.svelte";
  import Breadcrumbs from "../lib/Breadcrumbs.svelte";
  import SessionModal from "../lib/SessionModal.svelte";
  import CompactDialog from "../lib/CompactDialog.svelte";

  interface ImportQuestionItem {
    question: {
      id: string;
      question: string;
      expectedAnswer?: string;
      tags?: string[];
      questionType?: string;
      difficulty?: number[];
      rating?: number[];
      hash?: string;
      createdAt?: string | Date;
    };
    answer?: string;
    note?: string;
    questionRating?: number;
    isPresented?: boolean;
    order?: number;
    tags?: string[];
    rating?: number[];
    [key: string]: unknown;
  }

  interface ImportData {
    candidate: {
      id: string;
      displayName: string;
      notes?: string;
      createdAt?: string | Date;
    };
    session: {
      id?: string;
      name: string;
      date: string | Date;
      interviewers?: string[];
      notes?: string;
    };
    questions: ImportQuestionItem[];
  }

  interface CandidateExportSessionEntry {
    session: {
      id: string;
      candidateId: string;
      name: string;
      date: string;
      interviewers: string[];
      notes: string;
      currentQuestionIndex: number;
      sortOrder: number;
      createdAt: string;
      updatedAt: string;
    };
    questions: ImportQuestionItem[];
  }

  interface CandidateImportData {
    version: "2.0.0";
    exportedAt: string;
    type: "candidate";
    candidate: {
      id: string;
      displayName: string;
      notes?: string;
      createdAt?: string;
      updatedAt?: string;
    };
    sessions: CandidateExportSessionEntry[];
  }

  interface CandidateStats {
    sessions: number;
    total: number;
    answered: number;
    ratedCount: number;
    ratingSum: number;
  }

  interface OverallStats {
    totalCandidates: number;
    totalSessions: number;
    totalQuestions: number;
    totalAnswered: number;
    ratedCount: number;
    ratingSum: number;
  }

  let candidates: Candidate[] = $state([]);
  let candidateStats: Record<string, CandidateStats> = $state({});
  let overallStats = $state<OverallStats | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);

  // Modal state
  let showModal = $state(false);
  let editingCandidate: Candidate | null = $state(null);
  let formData = $state({ displayName: "", notes: "" });
  let saving = $state(false);

  // Delete confirmation
  let deleteConfirmId: string | null = $state(null);

  // Import state
  let fileInput: HTMLInputElement;
  let importing = $state(false);

  // Candidate export/import state
  let exportingCandidateId: string | null = $state(null);
  let isExportingCandidate = $state(false);
  let showCandidateMergeModal = $state(false);
  let pendingCandidateImport: CandidateImportData | null = $state(null);
  let candidateMergeChoice: "merge" | "new" = $state("merge");

  // Conflict resolution state
  let showConflictModal = $state(false);
  let importConflicts = $state<{
    candidateExists: boolean;
    candidateName: string;
    questionsExist: Array<{ id: string; question: string }>;
    pendingImportData: ImportData;
  } | null>(null);
  let conflictResolution = $state<{
    candidateAction: "update" | "skip" | "create-new";
    questionAction: "skip" | "update" | "create-new" | "private";
  }>({
    candidateAction: "update",
    questionAction: "private",
  });

  onMount(async () => {
    await loadCandidates();
  });

  async function loadCandidates() {
    try {
      loading = true;
      candidates = await candidateDB.list();
      // Sort by creation date, newest first
      candidates.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      // Compute per-candidate and overall stats
      const allSessions = await sessionDB.list();
      const perCandidate: Record<string, CandidateStats> = {};
      let totalQuestions = 0;
      let totalAnswered = 0;
      let ratedCount = 0;
      let ratingSum = 0;

      // Initialize per-candidate stats
      for (const c of candidates) {
        perCandidate[c.id] = { sessions: 0, total: 0, answered: 0, ratedCount: 0, ratingSum: 0 };
      }

      await Promise.all(
        allSessions.map(async (session) => {
          const questions = await sessionQuestionDB.listBySessionId(session.id);
          const answered = questions.filter(
            (q) => (q.answer && q.answer.trim().length > 0) || q.questionRating > 0 || (q.note && q.note.trim().length > 0)
          ).length;
          const rated = questions.filter((q) => q.questionRating > 0);
          const sessionRatingSum = rated.reduce((sum, q) => sum + q.questionRating, 0);

          totalQuestions += questions.length;
          totalAnswered += answered;
          ratedCount += rated.length;
          ratingSum += sessionRatingSum;

          // Accumulate per-candidate
          const cs = perCandidate[session.candidateId];
          if (cs) {
            cs.sessions += 1;
            cs.total += questions.length;
            cs.answered += answered;
            cs.ratedCount += rated.length;
            cs.ratingSum += sessionRatingSum;
          }
        })
      );

      candidateStats = perCandidate;
      overallStats = {
        totalCandidates: candidates.length,
        totalSessions: allSessions.length,
        totalQuestions,
        totalAnswered,
        ratedCount,
        ratingSum,
      };

      loading = false;
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to load candidates";
      loading = false;
    }
  }

  function openCreateModal() {
    editingCandidate = null;
    formData = { displayName: "", notes: "" };
    showModal = true;
  }

  function openEditModal(candidate: Candidate, event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    editingCandidate = candidate;
    formData = {
      displayName: candidate.displayName,
      notes: candidate.notes,
    };
    showModal = true;
  }

  function closeModal() {
    showModal = false;
    editingCandidate = null;
    formData = { displayName: "", notes: "" };
  }

  async function handleSubmit(event: Event) {
    event.preventDefault();

    if (!formData.displayName.trim()) {
      alert("Please enter a display name");
      return;
    }

    try {
      saving = true;
      const now = new Date();

      if (editingCandidate) {
        // Update existing candidate
        const updated: Candidate = {
          ...editingCandidate,
          displayName: formData.displayName.trim(),
          notes: formData.notes.trim(),
          updatedAt: now,
        };
        await candidateDB.update(updated);
      } else {
        // Create new candidate
        const newCandidate: Candidate = {
          id: generateId(),
          displayName: formData.displayName.trim(),
          notes: formData.notes.trim(),
          createdAt: now,
          updatedAt: now,
        };
        await candidateDB.create(newCandidate);
      }

      await loadCandidates();
      closeModal();
    } catch (err) {
      alert("Failed to save candidate: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      saving = false;
    }
  }

  function confirmDelete(candidateId: string, event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    deleteConfirmId = candidateId;
  }

  async function handleDelete(candidateId: string) {
    try {
      await candidateDB.delete(candidateId);
      await loadCandidates();
      deleteConfirmId = null;
    } catch (err) {
      alert(
        "Failed to delete candidate: " + (err instanceof Error ? err.message : "Unknown error")
      );
    }
  }

  function cancelDelete() {
    deleteConfirmId = null;
  }

  function triggerImport() {
    fileInput.click();
  }

  async function handleFileImport(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    try {
      importing = true;
      const fileContent = await file.text();

      // Load configuration
      const config = await loadConfig();

      let importData: ImportData;

      if (file.name.endsWith(".json")) {
        const rawJson = JSON.parse(fileContent) as Record<string, unknown>;
        if (rawJson["version"] === "2.0.0" && rawJson["type"] === "candidate") {
          const data = parseCandidateJsonImport(rawJson);
          pendingCandidateImport = data;
          const allCandidates = await candidateDB.list();
          const nameMatch = allCandidates.find((c) => c.displayName === data.candidate.displayName);
          if (nameMatch) {
            candidateMergeChoice = "merge";
            showCandidateMergeModal = true;
            importing = false;
          } else {
            await importCandidateData(data, "new");
            fileInput.value = "";
            await loadCandidates();
            alert(`Imported: ${data.candidate.displayName}, ${data.sessions.length} session(s)`);
            pendingCandidateImport = null;
            importing = false;
          }
          return;
        }
        importData = parseJsonWithConfig(fileContent);
      } else if (file.name.endsWith(".md")) {
        // Use unified markdown format
        const formatKey = getMarkdownFormatKey();
        importData = parseMarkdownWithConfig(fileContent, formatKey, config);
      } else {
        throw new Error("Unsupported file format. Please use .json or .md files.");
      }

      // Check for conflicts before importing
      const conflicts = await detectConflicts(importData);

      // Always show modal to let user choose question handling
      // (even if no conflicts, user should decide: add to catalog or keep private)
      importConflicts = conflicts;
      showConflictModal = true;
      importing = false;
    } catch (err) {
      alert("Failed to import: " + (err instanceof Error ? err.message : "Unknown error"));
      importing = false;
    }
  }

  async function detectConflicts(data: ImportData) {
    const conflicts = {
      candidateExists: false,
      candidateName: data.candidate.displayName,
      questionsExist: [] as Array<{ id: string; question: string }>,
      pendingImportData: data,
    };

    // Check if candidate exists
    const existingCandidate = await candidateDB.get(data.candidate.id);
    if (existingCandidate) {
      conflicts.candidateExists = true;
    }

    // Check which questions already exist
    for (const questionData of data.questions) {
      const existingQuestion = await questionDB.get(questionData.question.id);
      if (existingQuestion) {
        conflicts.questionsExist.push({
          id: questionData.question.id,
          question: questionData.question.question,
        });
      }
    }

    return conflicts;
  }

  async function handleConflictResolution() {
    if (!importConflicts?.pendingImportData) return;

    try {
      importing = true;
      showConflictModal = false;

      const importedData = importConflicts.pendingImportData;
      await importSessionData(importedData, conflictResolution);

      // Reset file input
      if (fileInput) {
        fileInput.value = "";
      }

      // Reload candidates list and show success message
      await loadCandidates();

      const candidateName = importedData.candidate.displayName;
      const sessionName = importedData.session.name;
      alert(
        `Import successful!\n\nCandidate: ${candidateName}\nSession: ${sessionName}\nQuestions: ${importedData.questions.length}`
      );

      importConflicts = null;
    } catch (err) {
      alert("Failed to import: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      importing = false;
    }
  }

  function cancelConflictResolution() {
    showConflictModal = false;
    importConflicts = null;
    importing = false;
    if (fileInput) {
      fileInput.value = "";
    }
  }

  const toISOSafe = (value: unknown): string => {
    if (value instanceof Date) return value.toISOString();
    if (typeof value === "string") return value;
    return new Date().toISOString();
  };

  const generateCandidateJsonExport = (
    candidate: Candidate,
    sessionsWithQuestions: Array<{ session: Session; questions: SessionQuestion[] }>
  ): string => {
    const data = {
      version: "2.0.0",
      exportedAt: new Date().toISOString(),
      type: "candidate",
      candidate: {
        id: candidate.id,
        displayName: candidate.displayName,
        notes: candidate.notes,
        createdAt: toISOSafe(candidate.createdAt),
        updatedAt: toISOSafe(candidate.updatedAt),
      },
      sessions: sessionsWithQuestions.map(({ session, questions }) => ({
        session: {
          id: session.id,
          candidateId: session.candidateId,
          name: session.name,
          date: toISOSafe(session.date),
          interviewers: session.interviewers,
          notes: session.notes,
          currentQuestionIndex: session.currentQuestionIndex,
          sortOrder: session.sortOrder,
          createdAt: toISOSafe(session.createdAt),
          updatedAt: toISOSafe(session.updatedAt),
        },
        questions: questions.map((sq) => ({
          id: sq.id,
          sessionId: sq.sessionId,
          order: sq.order,
          note: sq.note,
          questionRating: sq.questionRating,
          answer: sq.answer,
          isPresented: sq.isPresented,
          question: {
            id: sq.questionObj.id,
            question: sq.questionObj.question,
            expectedAnswer: sq.questionObj.expectedAnswer,
            tags: sq.questionObj.tags,
            questionType: sq.questionObj.questionType,
            difficulty: sq.questionObj.difficulty,
            hash: sq.questionObj.hash,
            createdAt: toISOSafe(sq.questionObj.createdAt),
          },
          createdAt: toISOSafe(sq.createdAt),
          updatedAt: toISOSafe(sq.updatedAt),
        })),
      })),
    };
    return JSON.stringify(data, null, 2);
  };

  const handleExportCandidate = async (candidateId: string, event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    exportingCandidateId = candidateId;
    isExportingCandidate = true;
    try {
      const candidate = await candidateDB.get(candidateId);
      if (!candidate) throw new Error("Candidate not found");
      const sessions = await sessionDB.listByCandidateId(candidateId);
      const sessionsWithQuestions = await Promise.all(
        sessions.map(async (session) => {
          const questions = await sessionQuestionDB.listBySessionId(session.id);
          questions.sort((a, b) => a.order - b.order);
          return { session, questions };
        })
      );
      const content = generateCandidateJsonExport(candidate, sessionsWithQuestions);
      const date = new Date().toISOString().slice(0, 10);
      const safeName = candidate.displayName.replace(/[^a-z0-9]/gi, "-").toLowerCase();
      const filename = `candidate-${safeName}-${date}.json`;
      const blob = new Blob([content], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("Failed to export candidate: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      exportingCandidateId = null;
      isExportingCandidate = false;
    }
  };

  const parseCandidateJsonImport = (rawJson: Record<string, unknown>): CandidateImportData => {
    const now = new Date().toISOString();
    const rawCandidate = (rawJson["candidate"] as Record<string, unknown>) ?? {};
    const rawSessions = Array.isArray(rawJson["sessions"]) ? rawJson["sessions"] : [];

    return {
      version: "2.0.0",
      exportedAt: typeof rawJson["exportedAt"] === "string" ? rawJson["exportedAt"] : now,
      type: "candidate",
      candidate: {
        id: typeof rawCandidate["id"] === "string" ? rawCandidate["id"] : generateId(),
        displayName: typeof rawCandidate["displayName"] === "string" && rawCandidate["displayName"]
          ? rawCandidate["displayName"]
          : "Imported Candidate",
        notes: typeof rawCandidate["notes"] === "string" ? rawCandidate["notes"] : "",
        createdAt: typeof rawCandidate["createdAt"] === "string" ? rawCandidate["createdAt"] : now,
        updatedAt: typeof rawCandidate["updatedAt"] === "string" ? rawCandidate["updatedAt"] : now,
      },
      sessions: rawSessions.map((entry: unknown) => {
        const e = (entry as Record<string, unknown>) ?? {};
        const rawSession = (e["session"] as Record<string, unknown>) ?? {};
        const rawQuestions = Array.isArray(e["questions"]) ? e["questions"] : [];
        return {
          session: {
            id: typeof rawSession["id"] === "string" ? rawSession["id"] : generateId(),
            candidateId: typeof rawSession["candidateId"] === "string" ? rawSession["candidateId"] : "",
            name: typeof rawSession["name"] === "string" ? rawSession["name"] : "Imported Session",
            date: typeof rawSession["date"] === "string" ? rawSession["date"] : now,
            interviewers: Array.isArray(rawSession["interviewers"])
              ? rawSession["interviewers"].map((i: unknown) => String(i))
              : [],
            notes: typeof rawSession["notes"] === "string" ? rawSession["notes"] : "",
            currentQuestionIndex: typeof rawSession["currentQuestionIndex"] === "number"
              ? rawSession["currentQuestionIndex"]
              : -1,
            sortOrder: typeof rawSession["sortOrder"] === "number" ? rawSession["sortOrder"] : 0,
            createdAt: typeof rawSession["createdAt"] === "string" ? rawSession["createdAt"] : now,
            updatedAt: typeof rawSession["updatedAt"] === "string" ? rawSession["updatedAt"] : now,
          },
          questions: rawQuestions.map((q: unknown) => {
            const qe = (q as Record<string, unknown>) ?? {};
            const rawQ = (qe["question"] as Record<string, unknown>) ?? {};
            return {
              id: typeof qe["id"] === "string" ? qe["id"] : generateId(),
              sessionId: typeof qe["sessionId"] === "string" ? qe["sessionId"] : "",
              order: typeof qe["order"] === "number" ? qe["order"] : 0,
              note: typeof qe["note"] === "string" ? qe["note"] : "",
              questionRating: typeof qe["questionRating"] === "number" ? qe["questionRating"] : 0,
              answer: typeof qe["answer"] === "string" ? qe["answer"] : "",
              isPresented: typeof qe["isPresented"] === "boolean" ? qe["isPresented"] : false,
              createdAt: typeof qe["createdAt"] === "string" ? qe["createdAt"] : now,
              updatedAt: typeof qe["updatedAt"] === "string" ? qe["updatedAt"] : now,
              question: {
                id: typeof rawQ["id"] === "string" ? rawQ["id"] : generateId(),
                question: typeof rawQ["question"] === "string" ? rawQ["question"] : "",
                expectedAnswer: typeof rawQ["expectedAnswer"] === "string" ? rawQ["expectedAnswer"] : "",
                tags: Array.isArray(rawQ["tags"]) ? rawQ["tags"].map((t: unknown) => String(t)) : [],
                questionType: typeof rawQ["questionType"] === "string" ? rawQ["questionType"] : "text",
                difficulty: Array.isArray(rawQ["difficulty"])
                  ? rawQ["difficulty"].map((d: unknown) => Number(d))
                  : [],
                hash: typeof rawQ["hash"] === "string" ? rawQ["hash"] : "",
                createdAt: typeof rawQ["createdAt"] === "string" ? rawQ["createdAt"] : now,
              },
            } as ImportQuestionItem;
          }),
        };
      }),
    };
  };

  const importCandidateData = async (
    data: CandidateImportData,
    mode: "merge" | "new"
  ) => {
    const now = new Date();
    let targetCandidate: Candidate;

    if (mode === "merge") {
      const allCandidates = await candidateDB.list();
      const existing = allCandidates.find((c) => c.displayName === data.candidate.displayName);
      if (!existing) throw new Error("Candidate not found for merge");
      targetCandidate = existing;
    } else {
      const allCandidates = await candidateDB.list();
      const nameTaken = allCandidates.some((c) => c.displayName === data.candidate.displayName);
      const displayName = nameTaken
        ? `${data.candidate.displayName} (Imported)`
        : data.candidate.displayName;
      targetCandidate = {
        id: generateId(),
        displayName,
        notes: data.candidate.notes ?? "",
        createdAt: now,
        updatedAt: now,
      };
      await candidateDB.create(targetCandidate);
    }

    for (const entry of data.sessions) {
      const newSession: Session = {
        id: generateId(),
        candidateId: targetCandidate.id,
        name: entry.session.name + " (imported)",
        date: new Date(entry.session.date),
        interviewers: entry.session.interviewers.map((s) => String(s)),
        notes: entry.session.notes,
        currentQuestionIndex: entry.session.currentQuestionIndex,
        currentQuestionId: null,
        sortOrder: entry.session.sortOrder,
        createdAt: now,
        updatedAt: now,
      };
      await sessionDB.create(newSession);

      for (let i = 0; i < entry.questions.length; i++) {
        const qData = entry.questions[i];
        const question = createCleanQuestion(qData.question, generateId(), now);
        const sessionQuestion: SessionQuestion = {
          id: generateId(),
          sessionId: newSession.id,
          order: qData.order ?? i,
          note: qData.note || "",
          questionRating: qData.questionRating ?? 0,
          answer: qData.answer || "",
          isPresented: qData.isPresented ?? false,
          questionObj: question,
          createdAt: now,
          updatedAt: now,
        };
        await sessionQuestionDB.create(sessionQuestion);
      }
    }
  };

  const cancelCandidateMergeModal = () => {
    showCandidateMergeModal = false;
    pendingCandidateImport = null;
    candidateMergeChoice = "merge";
    importing = false;
    if (fileInput) fileInput.value = "";
  };

  const handleCandidateMergeResolution = async () => {
    if (!pendingCandidateImport) return;
    const data = structuredClone($state.snapshot(pendingCandidateImport));
    showCandidateMergeModal = false;
    importing = true;
    try {
      await importCandidateData(data, candidateMergeChoice);
      if (fileInput) fileInput.value = "";
      await loadCandidates();
      alert(`Imported: ${data.candidate.displayName}, ${data.sessions.length} session(s)`);
    } catch (err) {
      alert("Failed to import: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      pendingCandidateImport = null;
      candidateMergeChoice = "merge";
      importing = false;
    }
  };

  function createCleanQuestion(
    questionData: ImportQuestionItem["question"],
    id?: string,
    createdAt?: Date
  ): Question {
    console.log("🔍 createCleanQuestion - Input:", {
      questionData,
      id,
      createdAt,
      tagsIsArray: Array.isArray(questionData.tags),
      ratingIsArray: Array.isArray(questionData.rating),
    });

    // Create completely clean arrays and primitives to avoid cloning issues
    const cleanTags = Array.isArray(questionData.tags)
      ? questionData.tags.map((t: unknown) => String(t))
      : [];
    const cleanRating = Array.isArray(questionData.rating)
      ? questionData.rating.map((r: unknown) => Number(r))
      : [];

    console.log("🧹 Cleaned arrays:", { cleanTags, cleanRating });

    // Determine question type
    const typeValue = questionData.questionType || "text";
    const questionType: QuestionType =
      typeValue === "rating" ? QuestionType.Rating : QuestionType.Text;

    const result = {
      id: id || String(questionData.id),
      tags: cleanTags,
      questionType: questionType,
      question: String(questionData.question || ""),
      expectedAnswer: String(questionData.expectedAnswer || ""),
      difficulty: cleanRating,
      hash: String(questionData.hash || ""),
      createdAt: createdAt || new Date(questionData.createdAt || new Date()),
      updatedAt: new Date(),
    };

    console.log("✅ createCleanQuestion - Output:", result);
    return result;
  }

  async function importSessionData(
    data: ImportData,
    resolution: {
      candidateAction: "update" | "skip" | "create-new";
      questionAction: "skip" | "update" | "create-new" | "private";
    }
  ) {
    console.log("📥 Starting import with data:", {
      data,
      resolution,
      questionsCount: data.questions?.length,
    });

    // Validate data structure
    if (!data.candidate || !data.session || !data.questions) {
      throw new Error("Invalid import file format");
    }

    const now = new Date();
    console.log("⏰ Import timestamp:", now);

    // Handle candidate based on resolution strategy
    console.log("👤 Processing candidate...");
    let candidate: Candidate;
    const existingCandidate = await candidateDB.get(data.candidate.id);
    console.log("🔍 Existing candidate check:", existingCandidate ? "FOUND" : "NOT FOUND");

    if (existingCandidate) {
      if (resolution.candidateAction === "update") {
        console.log("🔄 Updating existing candidate");
        // Update existing candidate
        candidate = {
          ...existingCandidate,
          displayName: String(data.candidate.displayName),
          notes: String(data.candidate.notes || ""),
          updatedAt: now,
        };
        console.log("💾 About to update candidate:", candidate);
        await candidateDB.update(candidate);
        console.log("✅ Candidate updated");
      } else if (resolution.candidateAction === "create-new") {
        console.log("➕ Creating new candidate with new ID");
        // Create new candidate with different ID
        candidate = {
          id: generateId(),
          displayName: String(data.candidate.displayName),
          notes: String(data.candidate.notes || ""),
          createdAt: now,
          updatedAt: now,
        };
        console.log("💾 About to create new candidate:", candidate);
        await candidateDB.create(candidate);
        console.log("✅ New candidate created");
      } else {
        console.log("⏭️ Skipping - using existing candidate");
        // Skip - use existing candidate
        candidate = existingCandidate;
      }
    } else {
      console.log("➕ Candidate doesn't exist, creating new one");
      // Candidate doesn't exist, create new one
      candidate = {
        id: String(data.candidate.id),
        displayName: String(data.candidate.displayName),
        notes: String(data.candidate.notes || ""),
        createdAt: new Date(data.candidate.createdAt ?? now),
        updatedAt: now,
      };
      console.log("💾 About to create candidate:", candidate);
      await candidateDB.create(candidate);
      console.log("✅ Candidate created");
    }

    // Create new session
    console.log("📅 Creating session...");
    console.log("📊 Session data from import:", data.session);

    // Clean the interviewers array to ensure it's cloneable
    const cleanInterviewers = Array.isArray(data.session.interviewers)
      ? data.session.interviewers.map((interviewer: unknown) => String(interviewer))
      : [];

    console.log("🧹 Cleaned interviewers:", cleanInterviewers);

    const session: Session = {
      id: generateId(),
      candidateId: String(candidate.id),
      name: String(data.session.name) + " (imported)",
      date: new Date(data.session.date),
      interviewers: cleanInterviewers,
      notes: String(data.session.notes || ""),
      currentQuestionIndex: -1,
      currentQuestionId: null,
      sortOrder: 0,
      createdAt: now,
      updatedAt: now,
    };

    console.log("💾 About to create session:", session);
    console.log("🔎 Session structure check:", {
      id: typeof session.id,
      candidateId: typeof session.candidateId,
      name: typeof session.name,
      date: session.date instanceof Date,
      interviewers: Array.isArray(session.interviewers),
      interviewersContent: session.interviewers,
      notes: typeof session.notes,
      currentQuestionIndex: typeof session.currentQuestionIndex,
      createdAt: session.createdAt instanceof Date,
      updatedAt: session.updatedAt instanceof Date,
    });

    try {
      await sessionDB.create(session);
      console.log("✅ Session created successfully");
    } catch (err) {
      console.error("❌ Failed to create session:", err);
      console.error("Failed session object:", session);
      throw err;
    }

    // Import questions based on resolution strategy
    for (let i = 0; i < data.questions.length; i++) {
      const questionData = data.questions[i];
      console.log(`\n📝 Processing question ${i + 1}/${data.questions.length}:`, questionData);

      let question: Question;

      if (resolution.questionAction === "private") {
        console.log("🔒 Using PRIVATE mode for question");
        // Keep questions private to this candidate - don't add to catalog
        // Just create the question object for embedding in sessionQuestion
        question = createCleanQuestion(questionData.question, generateId(), now);
        // Do NOT add to questionDB catalog
      } else {
        // Handle other question actions (skip, update, create-new)
        const existingQuestion = await questionDB.get(questionData.question.id);

        if (existingQuestion) {
          if (resolution.questionAction === "update") {
            // Update existing question
            const updatedQuestion = createCleanQuestion(
              questionData.question,
              existingQuestion.id,
              existingQuestion.createdAt
            );
            question = updatedQuestion;
            await questionDB.update(question);
          } else if (resolution.questionAction === "create-new") {
            // Create new question with different ID
            question = createCleanQuestion(questionData.question, generateId(), now);
            await questionDB.create(question);
          } else {
            // Skip - use existing question
            question = existingQuestion;
          }
        } else {
          // Question doesn't exist, create it
          const createdAt = questionData.question.createdAt
            ? new Date(questionData.question.createdAt)
            : now;
          question = createCleanQuestion(
            questionData.question,
            questionData.question.id,
            createdAt
          );
          await questionDB.create(question);
        }
      }

      // Create session question (works for all strategies including "private")
      console.log("📋 Creating SessionQuestion with question:", question);

      const sessionQuestion: SessionQuestion = {
        id: generateId(),
        sessionId: session.id,
        order: questionData.order ?? i,
        note: questionData.note || "",
        questionRating: questionData.questionRating ?? 0,
        answer: questionData.answer || "",
        isPresented: false,
        questionObj: question,
        createdAt: now,
        updatedAt: now,
      };

      console.log("💾 About to store SessionQuestion:", sessionQuestion);
      console.log("🔎 SessionQuestion structure check:", {
        id: typeof sessionQuestion.id,
        sessionId: typeof sessionQuestion.sessionId,
        order: typeof sessionQuestion.order,
        note: typeof sessionQuestion.note,
        questionRating: sessionQuestion.questionRating,
        answer: typeof sessionQuestion.answer,
        isPresented: typeof sessionQuestion.isPresented,
        questionObj: sessionQuestion.questionObj,
        createdAt: sessionQuestion.createdAt instanceof Date,
        updatedAt: sessionQuestion.updatedAt instanceof Date,
      });

      try {
        await sessionQuestionDB.create(sessionQuestion);
        console.log("✅ Successfully stored SessionQuestion");
      } catch (err) {
        console.error("❌ Failed to store SessionQuestion:", err);
        console.error("Failed SessionQuestion object:", sessionQuestion);
        console.error("Failed Question object:", question);
        throw err;
      }
    }

    // Don't navigate - stay on candidates page
    console.log("✅ Import completed successfully");
  }
</script>

<div class="page candidate-list">
  <Navigation />
  <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Candidates" }]} />

  <header>
    <div></div>
    {#if overallStats && overallStats.totalSessions > 0}
      <p class="overall-stats">
        {overallStats.totalCandidates} candidate{overallStats.totalCandidates !== 1 ? "s" : ""}
        · {overallStats.totalSessions} session{overallStats.totalSessions !== 1 ? "s" : ""}
        · {overallStats.totalAnswered}/{overallStats.totalQuestions} answered
        {#if overallStats.ratedCount > 0}
          · avg rating {(overallStats.ratingSum / overallStats.ratedCount).toFixed(1)}/10
        {/if}
      </p>
    {/if}
  </header>

  {#if loading}
    <p class="loading">Loading candidates...</p>
  {:else if error}
    <p class="error">Error: {error}</p>
  {:else if candidates.length === 0}
    <div class="empty-state">
      <h2>No candidates yet</h2>
      <p>Create your first candidate or import an existing interview session.</p>
      <div class="empty-state-actions">
        <button onclick={triggerImport} class="secondary" disabled={importing}>
          {importing ? "Importing..." : "📥 Import from File"}
        </button>
        <button onclick={openCreateModal} class="primary">+ Add Candidate</button>
      </div>
    </div>
  {:else}
    <div class="candidates">
      <div class="section-header">
        <h2>Candidates ({candidates.length})</h2>
        <div class="header-buttons">
          <button onclick={triggerImport} class="secondary" disabled={importing}>
            {importing ? "Importing..." : "📥 Import"}
          </button>
          <button onclick={openCreateModal} class="primary">+ Add Candidate</button>
        </div>
      </div>
      <div class="candidate-grid">
        {#each candidates as candidate (candidate.id)}
          <div class="candidate-card-wrapper">
            <div class="candidate-card">
              <div class="candidate-card-main">
                <h3>{candidate.displayName}</h3>
                {#if candidate.notes}
                  <p class="notes">{candidate.notes}</p>
                {/if}
                <p class="date">
                  Added: {new Date(candidate.createdAt).toLocaleDateString()}
                </p>
              </div>
              {#if candidateStats[candidate.id]?.sessions > 0}
                {@const cs = candidateStats[candidate.id]}
                <div class="candidate-stats">
                  <div class="cs-row">
                    <span class="cs-label">Sessions</span>
                    <span class="cs-value">{cs.sessions}</span>
                  </div>
                  <div class="cs-row">
                    <span class="cs-label">Answered</span>
                    <span class="cs-value">{cs.answered}/{cs.total}</span>
                  </div>
                  {#if cs.ratedCount > 0}
                    <div class="cs-row">
                      <span class="cs-label">Avg rating</span>
                      <span class="cs-value cs-rating">{(cs.ratingSum / cs.ratedCount).toFixed(1)}/10</span>
                    </div>
                  {/if}
                </div>
              {/if}
            </div>
            <div class="card-actions">
              <button
                onclick={(e) => confirmDelete(candidate.id, e)}
                class="action-btn delete-narrow"
                title="Delete candidate"
              >
                🗑️
              </button>
              <button
                onclick={(e) => openEditModal(candidate, e)}
                class="action-btn edit"
                title="Edit candidate"
              >
                Edit
              </button>
              <button
                onclick={(e) => handleExportCandidate(candidate.id, e)}
                class="action-btn export-candidate"
                title="Export candidate with all sessions as JSON"
                disabled={isExportingCandidate && exportingCandidateId === candidate.id}
              >
                {isExportingCandidate && exportingCandidateId === candidate.id ? "..." : "Export"}
              </button>
              <a href="/candidate/{candidate.id}" use:link class="action-btn select-interview">
                Show Interviews →
              </a>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<!-- Hidden file input for import -->
<input
  bind:this={fileInput}
  type="file"
  accept=".json,.md"
  onchange={handleFileImport}
  style="display: none"
/>

<!-- Modal for Create/Edit -->
<SessionModal
  show={showModal}
  onClose={closeModal}
  title={editingCandidate ? "Edit Candidate" : "New Candidate"}
  size="large"
>
  <form onsubmit={handleSubmit} autocomplete="off" data-form-type="other">
    <div class="form-group">
      <label for="newCandidateDisplayName">Display Name *</label>
      <input
        id="newCandidateDisplayName"
        name="new-candidate-display-name"
        type="text"
        bind:value={formData.displayName}
        required
        placeholder="Enter display name"
        autocomplete="off"
        data-lpignore="true"
        data-form-type="other"
      />
    </div>

    <div class="form-group form-group-grow">
      <label for="newCandidateNotes">Notes</label>
      <textarea
        id="newCandidateNotes"
        name="new-candidate-notes"
        bind:value={formData.notes}
        placeholder="Add any notes about the candidate"
        autocomplete="off"
        data-lpignore="true"
        data-form-type="other"
      ></textarea>
    </div>

    <div class="modal-actions">
      <button type="button" onclick={closeModal} class="secondary" disabled={saving}>
        Cancel
      </button>
      <button type="submit" class="primary" disabled={saving}>
        {saving ? "Saving..." : editingCandidate ? "Update" : "Create"}
      </button>
    </div>
  </form>
</SessionModal>

<!-- Delete Confirmation Modal -->
<CompactDialog
  show={!!deleteConfirmId}
  onClose={cancelDelete}
  title="Delete Candidate?"
>
  <p class="confirm-text">
    Are you sure you want to delete this candidate? This action cannot be undone.
  </p>
  <div class="modal-actions">
    <button type="button" onclick={cancelDelete} class="secondary">Cancel</button>
    <button type="button" onclick={() => handleDelete(deleteConfirmId!)} class="danger"
      >Delete</button
    >
  </div>
</CompactDialog>

<!-- Conflict Resolution Modal -->
<SessionModal
  show={showConflictModal}
  onClose={cancelConflictResolution}
  title={importConflicts?.candidateExists || (importConflicts?.questionsExist.length ?? 0) > 0
    ? "Import Conflicts Detected"
    : "Import Options"}
  size="large"
>
  {#if importConflicts}
    <div class="conflict-content">
      {#if importConflicts.candidateExists || importConflicts.questionsExist.length > 0}
        <p class="conflict-intro">
          The import file contains data that already exists in your database. Please choose how to
          handle these conflicts:
        </p>
      {:else}
        <p class="conflict-intro">Please choose how to import the questions from this file:</p>
      {/if}

      {#if importConflicts.candidateExists}
        <div class="conflict-section">
          <h3>🔸 Candidate Conflict</h3>
          <p class="conflict-detail">
            Candidate <strong>{importConflicts.candidateName}</strong> already exists in the database.
          </p>
          <div class="radio-group">
            <label class="radio-option">
              <input
                type="radio"
                name="candidateAction"
                value="update"
                bind:group={conflictResolution.candidateAction}
              />
              <div class="radio-content">
                <strong>Update existing candidate</strong>
                <span>Replace candidate data with imported data</span>
              </div>
            </label>
            <label class="radio-option">
              <input
                type="radio"
                name="candidateAction"
                value="skip"
                bind:group={conflictResolution.candidateAction}
              />
              <div class="radio-content">
                <strong>Keep existing candidate</strong>
                <span>Use existing candidate, add session to them</span>
              </div>
            </label>
            <label class="radio-option">
              <input
                type="radio"
                name="candidateAction"
                value="create-new"
                bind:group={conflictResolution.candidateAction}
              />
              <div class="radio-content">
                <strong>Create new candidate (Recommended)</strong>
                <span>Create a duplicate candidate with new ID</span>
              </div>
            </label>
          </div>
        </div>
      {/if}

      {#if importConflicts.questionsExist.length > 0}
        <div class="conflict-section">
          <h3>🔸 Question Conflicts</h3>
          <p class="conflict-detail">
            <strong>{importConflicts.questionsExist.length}</strong> question{importConflicts
              .questionsExist.length > 1
              ? "s"
              : ""} already exist in the database:
          </p>
          <ul class="conflict-list">
            {#each importConflicts.questionsExist.slice(0, 5) as q (q.id)}
              <li>{q.question.substring(0, 80)}{q.question.length > 80 ? "..." : ""}</li>
            {/each}
            {#if importConflicts.questionsExist.length > 5}
              <li class="more-items">...and {importConflicts.questionsExist.length - 5} more</li>
            {/if}
          </ul>
          <div class="radio-group">
            <label class="radio-option">
              <input
                type="radio"
                name="questionAction"
                value="private"
                bind:group={conflictResolution.questionAction}
              />
              <div class="radio-content">
                <strong>Keep questions private to this candidate (Recommended)</strong>
                <span>Don't add to catalog - questions exist only for this session</span>
              </div>
            </label>
            <label class="radio-option">
              <input
                type="radio"
                name="questionAction"
                value="skip"
                bind:group={conflictResolution.questionAction}
              />
              <div class="radio-content">
                <strong>Use existing questions from catalog</strong>
                <span>Reuse questions from catalog, don't create duplicates</span>
              </div>
            </label>
            <label class="radio-option">
              <input
                type="radio"
                name="questionAction"
                value="update"
                bind:group={conflictResolution.questionAction}
              />
              <div class="radio-content">
                <strong>Update existing questions in catalog</strong>
                <span>Replace question data with imported data (affects all sessions)</span>
              </div>
            </label>
            <label class="radio-option">
              <input
                type="radio"
                name="questionAction"
                value="create-new"
                bind:group={conflictResolution.questionAction}
              />
              <div class="radio-content">
                <strong>Create duplicate questions in catalog</strong>
                <span>Create new questions with different IDs and add to catalog</span>
              </div>
            </label>
          </div>
        </div>
      {:else}
        <!-- No conflicts, but still show options for questions -->
        <div class="conflict-section">
          <h3>📋 Question Import Options</h3>
          <p class="conflict-detail">
            This import contains questions. How would you like to handle them?
          </p>
          <div class="radio-group">
            <label class="radio-option">
              <input
                type="radio"
                name="questionAction"
                value="private"
                bind:group={conflictResolution.questionAction}
              />
              <div class="radio-content">
                <strong>Keep questions private to this candidate (Recommended)</strong>
                <span>Don't add to catalog - questions exist only for this session</span>
              </div>
            </label>
            <label class="radio-option">
              <input
                type="radio"
                name="questionAction"
                value="create-new"
                bind:group={conflictResolution.questionAction}
              />
              <div class="radio-content">
                <strong>Add questions to catalog</strong>
                <span>Make questions reusable for other sessions</span>
              </div>
            </label>
          </div>
        </div>
      {/if}

      <div class="modal-actions">
        <button type="button" onclick={cancelConflictResolution} class="secondary">
          Cancel Import
        </button>
        <button type="button" onclick={handleConflictResolution} class="primary">
          Proceed with Import
        </button>
      </div>
    </div>
  {/if}
</SessionModal>

<!-- Candidate Merge Modal -->
<CompactDialog show={showCandidateMergeModal} onClose={cancelCandidateMergeModal} title="Candidate Already Exists">
  {#if pendingCandidateImport}
    <p class="conflict-detail">
      A candidate named <strong>{pendingCandidateImport.candidate.displayName}</strong> already exists.
    </p>
    <p style="font-size:0.85rem; color: var(--color-text-secondary); margin-bottom:0.5rem">
      {pendingCandidateImport.sessions.length} session(s) will be imported.
    </p>
    <div class="radio-group">
      <label class="radio-option">
        <input type="radio" name="candidateMerge" value="merge" bind:group={candidateMergeChoice} />
        <div class="radio-content">
          <strong>Merge into existing candidate</strong>
          <span>Sessions are added to the existing candidate</span>
        </div>
      </label>
      <label class="radio-option">
        <input type="radio" name="candidateMerge" value="new" bind:group={candidateMergeChoice} />
        <div class="radio-content">
          <strong>Import as new candidate</strong>
          <span>Creates "{pendingCandidateImport.candidate.displayName} (Imported)"</span>
        </div>
      </label>
    </div>
    <div class="modal-actions">
      <button type="button" onclick={cancelCandidateMergeModal} class="secondary">Cancel</button>
      <button type="button" onclick={handleCandidateMergeResolution} class="primary">Import</button>
    </div>
  {/if}
</CompactDialog>

<style>
  .candidate-list {
  }

  .candidate-list > header {
    min-height: calc(0.9rem * 1.5);
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
    padding: 0.5rem 1rem;
  }

  .overall-stats {
    font-size: 0.85rem;
    color: var(--color-text-secondary);
    background: var(--color-bg-subtle);
    border-radius: 6px;
    padding: 0.25rem 0.75rem;
    margin: 0;
  }

  :global([data-theme="dark"]) .overall-stats {
    background: var(--color-bg-dark-2);
    color: var(--color-text-muted);
  }

  .candidate-list > :not(:global(.navigation-tabs)):not(:global(.breadcrumbs)):not(header) {
    padding: 1rem;
  }

  .empty-state-actions {
    display: flex;
    gap: 1rem;
    justify-content: center;
    margin-top: 1.5rem;
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

  .candidate-grid {
    display: grid;
    gap: 1rem;
  }

  .candidate-card-wrapper {
    position: relative;
  }

  /* Candidate card layout */
  .candidate-card {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
  }

  .candidate-card-main {
    flex: 1;
    min-width: 0;
  }

  .candidate-stats {
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

  .cs-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
  }

  .cs-label {
    color: var(--color-text-muted);
  }

  .cs-value {
    font-weight: 600;
    color: var(--color-text-secondary);
  }

  .cs-rating {
    color: var(--color-primary);
  }

  :global([data-theme="dark"]) .candidate-stats {
    background: var(--color-bg-dark-2);
    border-left-color: var(--color-border-dark);
  }

  :global([data-theme="dark"]) .cs-rating {
    color: var(--color-primary-dark);
  }

  /* Component-specific card styling - base styles now in app.css */
  .notes {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  /* Base action-btn, card-actions, edit, delete styles now in app.css */

  .action-btn.export-candidate {
    flex: 1;
    background: #e8f4f8;
    color: #0277bd;
    font-weight: 500;
  }

  .action-btn.export-candidate:hover:not(:disabled) {
    background: #b3e5fc;
    transform: translateY(-1px);
  }

  .action-btn.export-candidate:disabled {
    opacity: 0.5;
    cursor: default;
  }

  :global([data-theme="dark"]) .action-btn.export-candidate {
    background: #1a3a4a;
    color: #81d4fa;
  }

  :global([data-theme="dark"]) .action-btn.export-candidate:hover:not(:disabled) {
    background: #2a4a5a;
  }

  /* Responsive Design */
  @media (max-width: 768px) {
    .candidate-list > header,
    .candidate-list > :not(:global(.navigation-tabs)):not(:global(.breadcrumbs)):not(header) {
      padding: 1.5rem;
    }
  }

  /* Action btn dark theme now in app.css */

  /* Conflict Resolution Modal */
  .conflict-content {
    max-height: 70vh;
    overflow-y: auto;
  }

  .conflict-intro {
    margin-bottom: 1.5rem;
    color: var(--color-text-secondary);
    line-height: 1.5;
  }

  .conflict-section {
    margin-bottom: 2rem;
    padding: 1rem;
    background: #f8f9fa;
    border-radius: 8px;
    border-left: 4px solid #ff9800;
  }

  .conflict-section h3 {
    margin: 0 0 0.5rem 0;
    color: var(--color-text);
    font-size: 1rem;
  }

  .conflict-detail {
    margin: 0.5rem 0 1rem 0;
    color: #555;
    font-size: 0.9rem;
  }

  .conflict-list {
    margin: 1rem 0;
    padding-left: 1.5rem;
    max-height: 150px;
    overflow-y: auto;
  }

  .conflict-list li {
    margin: 0.5rem 0;
    color: var(--color-text-secondary);
    font-size: 0.85rem;
  }

  .conflict-list li.more-items {
    color: #999;
    font-style: italic;
  }

  .radio-group {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-top: 1rem;
  }

  .radio-option {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.75rem;
    background: white;
    border: 2px solid #e0e0e0;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .radio-option:hover {
    border-color: var(--color-primary);
    background: #f0f7ff;
  }

  .radio-option:has(input:checked) {
    border-color: var(--color-primary);
    background: #e3f2fd;
  }

  .radio-option input[type="radio"] {
    margin-top: 0.25rem;
    cursor: pointer;
    flex-shrink: 0;
  }

  .radio-content {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .radio-content strong {
    color: var(--color-text);
    font-size: 0.9rem;
  }

  .radio-content span {
    color: var(--color-text-secondary);
    font-size: 0.8rem;
  }

  :global([data-theme="dark"]) .conflict-intro {
    color: var(--color-text-muted);
  }

  :global([data-theme="dark"]) .conflict-section {
    background: var(--color-bg-dark);
    border-left-color: #ff9800;
  }

  :global([data-theme="dark"]) .conflict-section h3 {
    color: #ffffff;
  }

  :global([data-theme="dark"]) .conflict-detail {
    color: #b0b0b0;
  }

  :global([data-theme="dark"]) .conflict-list li {
    color: var(--color-text-muted);
  }

  :global([data-theme="dark"]) .conflict-list li.more-items {
    color: #888;
  }

  :global([data-theme="dark"]) .radio-option {
    background: var(--color-bg-dark-2);
    border-color: var(--color-border-dark);
  }

  :global([data-theme="dark"]) .radio-option:hover {
    border-color: var(--color-primary);
    background: #1a3a5a;
  }

  :global([data-theme="dark"]) .radio-option:has(input:checked) {
    border-color: var(--color-primary);
    background: #1a3a5a;
  }

  :global([data-theme="dark"]) .radio-content strong {
    color: #ffffff;
  }

  :global([data-theme="dark"]) .radio-content span {
    color: var(--color-text-muted);
  }
</style>
