<script lang="ts">
  import {onDestroy, onMount} from "svelte";
  import candidateWindowSvg from "../assets/filipa-candidate-window.svg";
  import {candidateDB, generateId, generateQuestionHash, questionDB, questionSetDB, sessionDB, sessionQuestionDB} from "../lib/db";
  import {getSharedCandidateWindow, setSharedCandidateWindow, setActiveQuestion as storeSetActiveQuestion, clearActiveQuestion} from "../lib/candidateWindowStore.svelte";
  import type {Candidate, Question, QuestionSet, Session, SessionQuestion} from "../lib/types";
  import {QuestionType} from "../lib/types";
  import MarkdownEditor from "../components/MarkdownEditor.svelte";
  import SessionQuestionItem from "../lib/SessionQuestionItem.svelte";
  import QuestionBrowserModal from "../lib/QuestionBrowserModal.svelte";
  import Navigation from "../lib/Navigation.svelte";
  import Breadcrumbs from "../lib/Breadcrumbs.svelte";
  import SessionModal from "../lib/SessionModal.svelte";
  import CompactDialog from "../lib/CompactDialog.svelte";
  import { backupNudge } from "../lib/backupNudge";
  import Tabs from "../components/Tabs.svelte";
  import PageActions from "../components/PageActions.svelte";

  let {params = {sessionId: ""}}: { params: { sessionId: string } } = $props();

  let session: Session | null = $state(null);
  let candidate: Candidate | null = $state(null);
  let questions: SessionQuestion[] = $state([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  // Combined add-questions modal
  let showAddQuestionsModal = $state(false);
  let addQuestionsTab = $state<"catalog" | "sets" | "new">("catalog");
  let catalogQuestions: Question[] = $state([]);
  let availableQuestionSets: QuestionSet[] = $state([]);
  let questionSetBrowserLoading = $state(false);

  // Ad-hoc question creation (inside the add-questions modal)
  let newQuestionFormData = $state({ question: "", expectedAnswer: "", tags: "", questionType: QuestionType.Text, difficulty: "1,2,3,4,5,6,7,8,9,10" });
  let savingNewQuestion = $state(false);

  // Edit question
  let showEditQuestionModal = $state(false);
  let editingSessionQuestion: SessionQuestion | null = $state(null);
  let editQuestionFormData = $state({ question: "", expectedAnswer: "", tags: "", questionType: QuestionType.Text, difficulty: "1,2,3,4,5,6,7,8,9,10" });
  let savingEditQuestion = $state(false);

  // Confirm dialogs
  let confirmRemoveQuestionId = $state<string | null>(null);
  let confirmResetQuestion = $state<SessionQuestion | null>(null);
  let confirmSaveToCatalogSQ = $state<SessionQuestion | null>(null);
  let confirmSaveToCatalogMode = $state<"add" | "update">("add");

  // Question list keyboard reorder selection
  let selectedQuestionIndex = $state<number | null>(null);
  let questionsListEl: HTMLDivElement | null = $state(null);
  let isReorderMode = $state(false);

  const handleQuestionsKeydown = async (e: KeyboardEvent) => {
    if (selectedQuestionIndex === null) return;

    const target = e.target as HTMLElement;
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT") return;

    if (isReorderMode && e.key === "ArrowUp") {
      e.preventDefault();
      if (selectedQuestionIndex > 0) {
        const next = selectedQuestionIndex - 1;
        await moveQuestionUp(selectedQuestionIndex);
        selectedQuestionIndex = next;
        questionsListEl?.focus();
      }
    } else if (isReorderMode && e.key === "ArrowDown") {
      e.preventDefault();
      if (selectedQuestionIndex < questions.length - 1) {
        const next = selectedQuestionIndex + 1;
        await moveQuestionDown(selectedQuestionIndex);
        selectedQuestionIndex = next;
        questionsListEl?.focus();
      }
    } else if (e.key === "Escape") {
      selectedQuestionIndex = null;
    }
  };

  // Catalog sync tracking: map of catalog question id → content fingerprint
  let catalogFingerprints = $state<Map<string, string>>(new Map());

  const questionFingerprint = (q: { question: string; expectedAnswer: string; tags: string[]; questionType: string; difficulty: number[] }) =>
    `${q.question}|${q.expectedAnswer}|${[...q.tags].sort().join(",")}|${q.questionType}|${[...q.difficulty].sort((a, b) => a - b).join(",")}`;

  const outOfSyncIds = $derived(
    new Set(
      questions
        .filter((sq) => !sq.isAdHoc && catalogFingerprints.has(sq.questionObj.id) && catalogFingerprints.get(sq.questionObj.id) !== questionFingerprint(sq.questionObj))
        .map((sq) => sq.questionObj.id)
    )
  );

  async function loadCatalogFingerprints() {
    const all = await questionDB.list();
    catalogFingerprints = new Map(all.map((q) => [q.id, questionFingerprint(q)]));
  }

  onMount(async () => {
    // Restore shared candidate window reference if still open from a previous visit.
    const shared = getSharedCandidateWindow();
    if (shared && !shared.closed) {
      candidateWindow = shared;
    }

    // Fixed global channel — same name regardless of session
    candidateChannel = new BroadcastChannel("filipa-candidate");

    const resendCurrentQuestion = () => {
      if (!session) return;
      const questionId = session.currentQuestionId ?? null;
      // localStorage is the primary reliable cross-window channel on Windows Chrome/Edge
      // (BroadcastChannel and postMessage are unreliable on file:// in Chromium)
      sendQuestionToCandidate(questionId);
    };

    const handleCandidateReady = (data: { type: string }) => {
      if (data?.type === "candidate-window-opened") {
        resendCurrentQuestion();
      }
    };

    // When the candidate window finishes loading it sends "candidate-window-opened".
    // Re-send the current question state so slow-loading windows don't miss the initial state.
    candidateChannel.onmessage = (event) => handleCandidateReady(event.data);

    // storage event: candidate window writes "filipa-candidate-ready" key to signal it loaded.
    // This is the most reliable cross-window signal on Windows Chrome/Edge with file:// protocol.
    const onStorageEvent = (event: StorageEvent) => {
      if (event.key === "filipa-candidate-ready") {
        resendCurrentQuestion();
      }
    };
    window.addEventListener("storage", onStorageEvent);

    // Fallback: catch opener postMessage from candidate window (Safari, etc.)
    const onWindowMessage = (event: MessageEvent) => {
      if (event.data?.type !== "candidate-window-opened" && event.data?.type !== "candidate-window-closing") return;
      handleCandidateReady(event.data);
    };
    window.addEventListener("message", onWindowMessage);
    candidateWindowMessageCleanup = () => {
      window.removeEventListener("storage", onStorageEvent);
      window.removeEventListener("message", onWindowMessage);
    };

    await loadSession();
    await loadCatalogFingerprints();
  });

  async function loadSession() {
    try {
      loading = true;
      const sessionId = params.sessionId;
      session = await sessionDB.read(sessionId);

      if (!session) {
        error = "Session not found";
        loading = false;
        return;
      }

      // Load candidate information
      candidate = await candidateDB.read(session.candidateId);

      questions = await sessionQuestionDB.listBySessionId(sessionId);
      questions.sort((a, b) => a.order - b.order);

      // Initialize session notes
      sessionNotes = session.notes;

      loading = false;
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to load session";
      loading = false;
    }
  }

  async function loadQuestionCatalog() {
    catalogQuestions = await questionDB.list();
  }

  async function loadQuestionSets() {
    try {
      questionSetBrowserLoading = true;
      const all = await questionSetDB.list();
      all.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      availableQuestionSets = all;
    } catch (err) {
      alert("Failed to load question sets: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      questionSetBrowserLoading = false;
    }
  }

  async function openAddQuestionsModal(tab: "catalog" | "sets" | "new" = "catalog") {
    addQuestionsTab = tab;
    if (tab === "new") {
      newQuestionFormData = { question: "", expectedAnswer: "", tags: "", questionType: QuestionType.Text, difficulty: "1,2,3,4,5,6,7,8,9,10" };
    }
    showAddQuestionsModal = true;
    await Promise.all([loadQuestionCatalog(), loadQuestionSets()]);
  }

  function closeAddQuestionsModal() {
    showAddQuestionsModal = false;
  }

  // Ensures the candidate window exists at the fixed candidate view URL.
  // Returns true if the window was already open, false if it was just opened.
  function ensureCandidateWindow(): boolean {
    // window.location.origin returns "null" on file:// protocol in all Chromium browsers.
    // Use href up to the hash instead so the URL works on both http and file://.
    const base = window.location.href.split("#")[0];
    const url = `${base}#/candidate-view`;
    const shared = getSharedCandidateWindow();
    if (shared && !shared.closed) {
      candidateWindow = shared;
      return true;
    }
    // No window open — open a new one with a fixed name
    // Must be synchronous (before any await) so browsers treat it as a user gesture
    candidateWindow = window.open(url, "filipa_candidate_view", "width=1280,height=1024");
    if (!candidateWindow) {
      // Fallback: plain new tab if popup was blocked (e.g. iPad Safari)
      candidateWindow = window.open(url, "_blank");
    }
    setSharedCandidateWindow(candidateWindow);
    return false;
  }

  async function openCandidateView() {
    if (!session) return;

    // Must open window synchronously before any await — Safari blocks window.open() after async gaps
    ensureCandidateWindow();

    // Save DB update so the candidate view reads the correct state on mount
    session.currentQuestionIndex = -1;
    session.currentQuestionId = null;
    session.updatedAt = new Date();
    const cleanSess = cleanSession(session);
    await sessionDB.update(cleanSess);
    session = session;

    // Clear active question globally — show welcome screen
    clearActiveQuestion();

    // Send null questionId to show the welcome screen via all channels
    sendQuestionToCandidate(null);
  }


  async function addQuestionSetToSession(questionSet: QuestionSet) {
    if (!session) return;

    try {
      const existingIds = new Set(questions.map((sq) => sq.questionObj.id));
      const toAdd: Question[] = [];

      for (const qId of questionSet.questionIds) {
        if (!existingIds.has(qId)) {
          const q = await questionDB.read(qId);
          if (q) toAdd.push(q);
        }
      }

      if (toAdd.length === 0) {
        alert("All questions from this set are already in the session.");
        return;
      }

      const now = new Date();
      let order = questions.length;

      for (const question of toAdd) {
        const cleanQuestion: Question = {
          id: question.id,
          hash: question.hash,
          tags: [...question.tags],
          questionType: question.questionType,
          question: question.question,
          expectedAnswer: question.expectedAnswer,
          difficulty: question.difficulty ? [...question.difficulty] : [],
          createdAt: new Date(question.createdAt),
          updatedAt: new Date(question.updatedAt)
        };

        const newSessionQuestion: SessionQuestion = {
          id: generateId(),
          sessionId: session.id,
          questionObj: cleanQuestion,
          order: order++,
          note: "",
          questionRating: 0,
          answer: "",
          isPresented: false,
          createdAt: now,
          updatedAt: now
        };

        await sessionQuestionDB.create(newSessionQuestion);
      }

      await loadSession();
      closeAddQuestionsModal();
      // Bulk add is always a significant change worth backing up
      if (toAdd.length >= 5) {
        backupNudge.markSignificantChange();
      }
    } catch (err) {
      alert(
        "Failed to add question set: " + (err instanceof Error ? err.message : "Unknown error")
      );
    }
  }

  async function addQuestionToSession(question: Question, isAdHoc = false) {
    if (!session) return;

    try {
      const now = new Date();
      // Create a clean copy of the question object to avoid cloning issues
      const cleanQuestion: Question = {
        id: question.id,
        hash: question.hash,
        tags: [...question.tags],
        questionType: question.questionType,
        question: question.question,
        expectedAnswer: question.expectedAnswer,
        difficulty: question.difficulty ? [...question.difficulty] : [],
        createdAt: new Date(question.createdAt),
        updatedAt: new Date(question.updatedAt)
      };

      const newSessionQuestion: SessionQuestion = {
        id: generateId(),
        sessionId: session.id,
        questionObj: cleanQuestion,
        order: questions.length,
        note: "",
        questionRating: 0,
        answer: "",
        isPresented: false,
        isAdHoc: isAdHoc || undefined,
        createdAt: now,
        updatedAt: now
      };

      await sessionQuestionDB.create(newSessionQuestion);
      await loadSession();
    } catch (err) {
      alert("Failed to add question: " + (err instanceof Error ? err.message : "Unknown error"));
    }
  }

  async function handleNewQuestionSubmit(event: Event) {
    event.preventDefault();
    if (!newQuestionFormData.question.trim()) { alert("Please enter a question"); return; }
    savingNewQuestion = true;
    try {
      const tagsList = newQuestionFormData.tags.split(",").map((t) => t.trim()).filter((t) => t.length > 0);
      const difficultyList = newQuestionFormData.difficulty.split(",").map((r) => parseInt(r.trim())).filter((r) => !isNaN(r) && r >= 1 && r <= 10);
      const now = new Date();
      const newQuestion: Question = {
        id: generateId(),
        question: newQuestionFormData.question.trim(),
        expectedAnswer: newQuestionFormData.expectedAnswer.trim(),
        tags: tagsList,
        questionType: newQuestionFormData.questionType,
        difficulty: difficultyList,
        hash: generateQuestionHash(newQuestionFormData.question.trim(), tagsList, newQuestionFormData.questionType),
        createdAt: now,
        updatedAt: now,
      };
      await addQuestionToSession(newQuestion, true);
      closeAddQuestionsModal();
    } finally {
      savingNewQuestion = false;
    }
  }

  function saveToCatalog(sq: SessionQuestion) {
    confirmSaveToCatalogSQ = sq;
    confirmSaveToCatalogMode = sq.isAdHoc ? "add" : "update";
  }

  async function confirmSaveToCatalogAction() {
    const sq = confirmSaveToCatalogSQ;
    confirmSaveToCatalogSQ = null;
    if (!sq) return;
    if (sq.isAdHoc) {
      try {
        await questionDB.create(cleanQuestionObj(sq.questionObj));
        const updated: SessionQuestion = { ...sq, isAdHoc: false, updatedAt: new Date() };
        await sessionQuestionDB.update(cleanSessionQuestion(updated));
        await Promise.all([loadSession(), loadCatalogFingerprints()]);
      } catch (err) {
        alert("Failed to save to catalog: " + (err instanceof Error ? err.message : "Unknown error"));
      }
    } else {
      try {
        const existing = await questionDB.read(sq.questionObj.id);
        if (existing) {
          await questionDB.update(cleanQuestionObj(sq.questionObj, { updatedAt: new Date() }));
        } else {
          await questionDB.create(cleanQuestionObj(sq.questionObj));
        }
        await loadCatalogFingerprints();
      } catch (err) {
        alert("Failed to update catalog: " + (err instanceof Error ? err.message : "Unknown error"));
      }
    }
  }

  function openEditQuestionModal(sq: SessionQuestion) {
    editingSessionQuestion = sq;
    editQuestionFormData = {
      question: sq.questionObj.question,
      expectedAnswer: sq.questionObj.expectedAnswer,
      tags: sq.questionObj.tags.join(", "),
      questionType: sq.questionObj.questionType,
      difficulty: sq.questionObj.difficulty ? sq.questionObj.difficulty.join(",") : "",
    };
    showEditQuestionModal = true;
  }

  function closeEditQuestionModal() {
    showEditQuestionModal = false;
    editingSessionQuestion = null;
  }

  async function handleEditQuestionSubmit(event: Event) {
    event.preventDefault();
    if (!editingSessionQuestion) return;
    if (!editQuestionFormData.question.trim()) { alert("Please enter a question"); return; }
    savingEditQuestion = true;
    try {
      const tagsList = editQuestionFormData.tags.split(",").map((t) => t.trim()).filter((t) => t.length > 0);
      const difficultyList = editQuestionFormData.difficulty.split(",").map((r) => parseInt(r.trim())).filter((r) => !isNaN(r) && r >= 1 && r <= 10);
      const updatedQuestion: Question = cleanQuestionObj(editingSessionQuestion.questionObj, {
        question: editQuestionFormData.question.trim(),
        expectedAnswer: editQuestionFormData.expectedAnswer.trim(),
        tags: tagsList,
        questionType: editQuestionFormData.questionType,
        difficulty: difficultyList,
        hash: generateQuestionHash(editQuestionFormData.question.trim(), tagsList, editQuestionFormData.questionType),
        updatedAt: new Date(),
      });
      const updatedSQ: SessionQuestion = { ...editingSessionQuestion, questionObj: updatedQuestion, updatedAt: new Date() };
      await sessionQuestionDB.update(cleanSessionQuestion(updatedSQ));

      await loadSession();
      await loadCatalogFingerprints();
      closeEditQuestionModal();
    } finally {
      savingEditQuestion = false;
    }
  }

  function removeQuestion(questionId: string) {
    confirmRemoveQuestionId = questionId;
  }

  async function confirmRemoveQuestionAction() {
    const questionId = confirmRemoveQuestionId;
    confirmRemoveQuestionId = null;
    if (!questionId) return;
    try {
      await sessionQuestionDB.delete(questionId);
      await loadSession();
      await reorderQuestions();
    } catch (err) {
      alert("Failed to remove question: " + (err instanceof Error ? err.message : "Unknown error"));
    }
  }

  async function moveQuestionUp(index: number) {
    if (index === 0 || !session) return;

    // Track the currently active question ID
    const activeQuestionId =
      session.currentQuestionIndex !== undefined && session.currentQuestionIndex >= 0
        ? questions[session.currentQuestionIndex]?.id
        : null;

    const temp = questions[index];
    questions[index] = questions[index - 1];
    questions[index - 1] = temp;

    await reorderQuestions(activeQuestionId);
  }

  async function moveQuestionDown(index: number) {
    if (index === questions.length - 1 || !session) return;

    // Track the currently active question ID
    const activeQuestionId =
      session.currentQuestionIndex !== undefined && session.currentQuestionIndex >= 0
        ? questions[session.currentQuestionIndex]?.id
        : null;

    const temp = questions[index];
    questions[index] = questions[index + 1];
    questions[index + 1] = temp;

    await reorderQuestions(activeQuestionId);
  }

  async function reorderQuestions(activeQuestionId: string | null = null) {
    if (!session) return;

    try {
      for (let i = 0; i < questions.length; i++) {
        questions[i].order = i;
        questions[i].updatedAt = new Date();
        // Create clean copy to avoid cloning issues
        const cleanQuestion = cleanSessionQuestion(questions[i]);
        await sessionQuestionDB.update(cleanQuestion);
      }

      // Update session's currentQuestionIndex to follow the moved question
      if (activeQuestionId) {
        const newIndex = questions.findIndex((q) => q.id === activeQuestionId);
        if (newIndex !== -1 && newIndex !== session.currentQuestionIndex) {
          session.currentQuestionIndex = newIndex;
          session.currentQuestionId = activeQuestionId;
          session.updatedAt = new Date();
          const cleanSess = cleanSession(session);
          await sessionDB.update(cleanSess);
        }
      }

      await loadSession();
      if (selectedQuestionIndex !== null) questionsListEl?.focus();
    } catch (err) {
      alert(
        "Failed to reorder questions: " + (err instanceof Error ? err.message : "Unknown error")
      );
    }
  }

  // Helper function to create a plain Question object safe for IndexedDB
  function cleanQuestionObj(q: Question, overrides: Partial<Question> = {}): Question {
    return {
      id: q.id,
      hash: q.hash ?? "",
      tags: [...q.tags],
      questionType: q.questionType,
      question: q.question,
      expectedAnswer: q.expectedAnswer,
      difficulty: q.difficulty ? [...q.difficulty] : [],
      createdAt: new Date(q.createdAt),
      updatedAt: new Date(q.updatedAt),
      ...overrides,
    };
  }

  // Helper function to create a clean copy of SessionQuestion for IndexDB
  function cleanSessionQuestion(sq: SessionQuestion): SessionQuestion {
    const cleaned: SessionQuestion = {
      id: sq.id,
      sessionId: sq.sessionId,
      questionObj: {
        id: sq.questionObj.id,
        hash: sq.questionObj.hash ?? "",
        tags: [...sq.questionObj.tags],
        questionType: sq.questionObj.questionType,
        question: sq.questionObj.question,
        expectedAnswer: sq.questionObj.expectedAnswer,
        difficulty: sq.questionObj.difficulty ? [...sq.questionObj.difficulty] : [],
        createdAt: new Date(sq.questionObj.createdAt),
        updatedAt: new Date(sq.questionObj.updatedAt)
      },
      order: sq.order,
      note: sq.note,
      questionRating: sq.questionRating,
      answer: sq.answer,
      isPresented: sq.isPresented,
      createdAt: new Date(sq.createdAt),
      updatedAt: new Date(sq.updatedAt)
    };
    if (sq.isAdHoc) cleaned.isAdHoc = true;
    return cleaned;
  }

  // Helper function to create a clean copy of Session for IndexDB
  function cleanSession(s: Session): Session {
    return {
      id: s.id,
      candidateId: s.candidateId,
      interviewers: [...s.interviewers],
      name: s.name,
      date: new Date(s.date),
      notes: s.notes,
      currentQuestionIndex: s.currentQuestionIndex,
      currentQuestionId: s.currentQuestionId ?? null,
      sortOrder: s.sortOrder ?? 0,
      createdAt: new Date(s.createdAt),
      updatedAt: new Date(s.updatedAt)
    };
  }

  let candidateWindow: Window | null = null;
  let candidateChannel: BroadcastChannel | null = null;
  let candidateWindowMessageCleanup: (() => void) | null = null;
  let scrollToQuestionId = $state<string | null>(null);

  // Send question update to candidate window via all available channels.
  // localStorage + storage event is the primary reliable channel on Windows Chrome/Edge
  // with file:// protocol where BroadcastChannel is scoped per-origin and postMessage
  // may fail when window.opener is null (Chromium security policy).
  function sendQuestionToCandidate(questionId: string | null) {
    // 1. localStorage — fires storage event cross-window, works on all browsers + file://
    // This is the only reliable channel on Chromium with file:// protocol.
    // window.postMessage() throws SecurityError when both windows have null origin (file://).
    try {
      localStorage.setItem("filipa-active-question", questionId ?? "");
    } catch {
      // Ignore (e.g. private browsing storage quota)
    }
    // 2. BroadcastChannel — same browser session, same origin (works on http/https, not file://)
    if (candidateChannel) {
      try {
        candidateChannel.postMessage({ type: "filipa-question-update", questionId });
      } catch {
        // Ignore — may fail on file:// in some browsers
      }
    }
    // NOTE: window.postMessage to candidateWindow is intentionally omitted.
    // On file:// protocol, Chromium blocks cross-window postMessage between null-origin frames
    // with a SecurityError even when using "*" as the target origin.
    // localStorage storage events are sufficient and reliable for this use case.
  }

  async function setActiveQuestion(index: number, shouldScroll = false) {
    if (!session) return;

    // Must open window synchronously before any await — Safari blocks window.open() after async gaps
    ensureCandidateWindow();

    try {
      // Save DB state so the candidate view reads the correct question on mount
      session.currentQuestionIndex = index;
      session.currentQuestionId = questions[index].id;
      session.updatedAt = new Date();
      const cleanSess = cleanSession(session);
      await sessionDB.update(cleanSess);

      // Mark question as presented
      if (!questions[index].isPresented) {
        questions[index].isPresented = true;
        questions[index].updatedAt = new Date();
        const cleanQuestion = cleanSessionQuestion(questions[index]);
        await sessionQuestionDB.update(cleanQuestion);
      }

      // Automatically expand Record Answer section for the active question
      expandedQuestionId = questions[index].id;

      // Trigger scroll if requested (from navigation buttons)
      if (shouldScroll) {
        scrollToQuestionId = questions[index].id;
      } else {
        scrollToQuestionId = null;
      }

      // Update global store so isActive reflects correctly across sessions
      storeSetActiveQuestion(session.id, questions[index].id);

      // Send question ID to candidate window via all channels
      sendQuestionToCandidate(questions[index].id);

      // Don't reload - just trigger reactivity by reassigning
      session = session;
      questions = questions;
    } catch (err) {
      alert(
        "Failed to set active question: " + (err instanceof Error ? err.message : "Unknown error")
      );
    }
  }

  // Answer recording
  let expandedQuestionId: string | null = $state(null);
  let saveTimeout: number | null = null;

  // Notes modal (combined session + candidate)
  let showNotesModal = $state(false);
  let sessionNotes = $state("");
  let candidateNotes = $state("");

  function toggleRecordingForm(questionId: string) {
    expandedQuestionId = expandedQuestionId === questionId ? null : questionId;
  }

  async function saveAnswerData(question: SessionQuestion) {
    // Clear existing timeout
    if (saveTimeout) clearTimeout(saveTimeout);

    // Debounce save by 500ms
    saveTimeout = setTimeout(async () => {
      try {
        question.updatedAt = new Date();
        const cleanQuestion = cleanSessionQuestion(question);
        await sessionQuestionDB.update(cleanQuestion);
        // Don't reload - the state is already updated via binding
        questions = questions;
        // Push live rating update to candidate window for active Rating questions
        if (question.questionObj.questionType === QuestionType.Rating && question.id === session?.currentQuestionId) {
          // Re-send active question signal to trigger re-fetch in candidate window.
          // Uses the already-proven filipa-active-question channel (reliable on file://).
          // Append timestamp so the value differs from the last write and the storage event fires.
          try { localStorage.setItem("filipa-active-question", `${question.id}:${Date.now()}`); } catch { /* ignore */ }
        }
        // Check if ≥80% of questions are answered — nudge backup if so
        if (questions.length > 0) {
          const answered = questions.filter((q) => q.answer.trim() !== "" || q.questionRating > 0).length;
          if (answered / questions.length >= 0.8) {
            backupNudge.markSignificantChange();
          }
        }
      } catch (err) {
        console.error("Failed to save answer:", err);
      }
    }, 500) as unknown as number;
  }

  function resetRecord(question: SessionQuestion) {
    confirmResetQuestion = question;
  }

  async function confirmResetRecordAction() {
    const question = confirmResetQuestion;
    confirmResetQuestion = null;
    if (!question) return;
    try {
      question.answer = "";
      question.questionRating = 0;
      question.note = "";
      question.isPresented = false;
      question.updatedAt = new Date();
      const cleanQuestion = cleanSessionQuestion(question);
      await sessionQuestionDB.update(cleanQuestion);
      // Don't reload - just trigger reactivity
      questions = questions;
      // Notify candidate window: hide rating for this question and re-fetch from DB
      try {
        localStorage.setItem("filipa-rating-visibility", JSON.stringify({ questionId: question.id, show: false }));
      } catch { /* ignore */ }
      sendQuestionToCandidate(`${question.id}:${Date.now()}`);
    } catch (err) {
      alert("Failed to reset question: " + (err instanceof Error ? err.message : "Unknown error"));
    }
  }

  let skippedQuestionIds = $state(new Set<string>());

  const toggleSkip = (questionId: string) => {
    const next = new Set(skippedQuestionIds);
    if (next.has(questionId)) {
      next.delete(questionId);
    } else {
      next.add(questionId);
    }
    skippedQuestionIds = next;
  };

  function goToPreviousQuestion() {
    if (!session || session.currentQuestionIndex === undefined) return;
    let idx = session.currentQuestionIndex - 1;
    while (idx >= 0 && skippedQuestionIds.has(questions[idx].id)) idx--;
    if (idx >= 0) setActiveQuestion(idx, true);
  }

  function goToNextQuestion() {
    if (!session || session.currentQuestionIndex === undefined) return;
    let idx = session.currentQuestionIndex + 1;
    while (idx < questions.length && skippedQuestionIds.has(questions[idx].id)) idx++;
    if (idx < questions.length) setActiveQuestion(idx, true);
  }

  function openNotesModal() {
    if (session) sessionNotes = session.notes;
    if (candidate) candidateNotes = candidate.notes;
    showNotesModal = true;
  }

  function closeNotesModal() {
    showNotesModal = false;
  }

  async function saveNotes() {
    try {
      if (session) {
        session.notes = sessionNotes;
        session.updatedAt = new Date();
        await sessionDB.update(cleanSession(session));
        session = session;
      }
      if (candidate) {
        candidate.notes = candidateNotes;
        candidate.updatedAt = new Date();
        await candidateDB.update({
          id: candidate.id,
          displayName: candidate.displayName,
          notes: candidate.notes,
          createdAt: new Date(candidate.createdAt),
          updatedAt: new Date(candidate.updatedAt)
        });
        candidate = candidate;
      }
      closeNotesModal();
    } catch (err) {
      alert("Failed to save notes: " + (err instanceof Error ? err.message : "Unknown error"));
    }
  }

  onDestroy(() => {
    if (candidateChannel) {
      candidateChannel.close();
    }
    candidateWindowMessageCleanup?.();
  });
</script>

<div class="page session-interview">
  {#if loading}
    <Navigation/>
    <p class="loading">Loading...</p>
  {:else if error}
    <Navigation/>
    <p class="error">Error: {error}</p>
  {:else if session}
    <Navigation/>
    <Breadcrumbs
      items={[
        { label: "Home", href: "/" },
        { label: "Candidates", href: "/candidates" },
        {
          label: candidate ? candidate.displayName : "Candidate",
          href: `/candidate/${session.candidateId}`,
        },
        { label: session.name },
      ]}
    />

    <header>
      <div>
        <p class="meta">
          {new Date(session.date).toLocaleDateString()}
          • Session ID: {session.id.substring(0, 8)}
          {#if session.interviewers.length > 0}
            • Interviewers: {session.interviewers.join(", ")}
          {/if}
        </p>
      </div>
    </header>

    <div class="content">
      <aside class="sidebar">
        <div class="stats">
          <h3>Progress</h3>
          <div class="stat-compact">
            <span class="stat-item-inline">
              <span class="stat-label-inline">Presented:</span>
              <span class="stat-value-inline"
              >{questions.filter((q) => q.isPresented).length}/{questions.length}</span
              >
            </span>
            <span class="stat-separator">•</span>
            <span class="stat-item-inline">
              <span class="stat-label-inline">Answered:</span>
              <span class="stat-value-inline"
              >{questions.filter((q) => q.answer).length}/{questions.length}</span
              >
            </span>
            <span class="stat-separator">•</span>
            <span class="stat-item-inline">
              <span class="stat-label-inline">Rated:</span>
              <span class="stat-value-inline"
              >{questions.filter((q) => q.questionRating > 0).length}
                /{questions.length}</span
              >
            </span>
          </div>
        </div>
        <div class="sidebar-actions">
          <div class="action-buttons">
            <button type="button" onclick={openCandidateView} class="primary"><img src={candidateWindowSvg} alt=""
                                                                                   style="width:1.2em;height:1.2em;vertical-align:middle;margin-right:0.4em;"/>
              Welcome Page
            </button>
            <button type="button" onclick={openNotesModal} class="secondary">📝 Notes</button>
            <button type="button" onclick={() => openAddQuestionsModal()} class="primary">+ Add Questions …</button>
          </div>

          {#if questions.length > 0}
            <div class="navigation-buttons">
              <button
                type="button"
                onclick={goToPreviousQuestion}
                class="nav-btn secondary"
                disabled={session?.currentQuestionIndex === undefined ||
                  questions.slice(0, session.currentQuestionIndex).every((q) => skippedQuestionIds.has(q.id))}
                title="Previous question"
              >
                ◀ Previous
              </button>
              <button
                type="button"
                onclick={goToNextQuestion}
                class="nav-btn secondary"
                disabled={session?.currentQuestionIndex === undefined ||
                  questions.slice(session.currentQuestionIndex + 1).every((q) => skippedQuestionIds.has(q.id))}
                title="Next question"
              >
                Next ▶
              </button>
            </div>
          {/if}
        </div>
      </aside>

      <main class="main-content">
        <div class="section-header">
          <h2>Questions ({questions.length})</h2>
          <PageActions
            {isReorderMode}
            onToggleReorder={() => (isReorderMode = !isReorderMode)}
          />
        </div>

        {#if questions.length === 0}
          <div class="empty-state">
            <h3>No questions yet</h3>
            <p>Add questions from the catalog to start preparing the interview.</p>
            <button type="button" onclick={() => openAddQuestionsModal()} class="primary">+ Add Questions …</button>
          </div>
        {:else}
          <!-- svelte-ignore a11y_no_noninteractive_tabindex a11y_no_noninteractive_element_interactions -->
          <div
            class="questions-list"
            class:reorder-mode={isReorderMode}
            tabindex="0"
            bind:this={questionsListEl}
            onkeydown={handleQuestionsKeydown}
            onblur={() => (selectedQuestionIndex = null)}
          >
            {#each questions as question, index (question.id)}
              <SessionQuestionItem
                {question}
                {index}
                {session}
                totalQuestions={questions.length}
                {expandedQuestionId}
                {scrollToQuestionId}
                onMoveUp={moveQuestionUp}
                onMoveDown={moveQuestionDown}
                onRemove={removeQuestion}
                onSetActive={setActiveQuestion}
                onToggleRecording={toggleRecordingForm}
                onSaveAnswer={saveAnswerData}
                onResetRecord={resetRecord}
                onSaveToCatalog={saveToCatalog}
                onEditQuestion={openEditQuestionModal}
                isOutOfSync={outOfSyncIds.has(question.questionObj.id)}
                isSkipped={skippedQuestionIds.has(question.id)}
                onToggleSkip={toggleSkip}
                isSelected={selectedQuestionIndex === index}
                onSelect={() => (selectedQuestionIndex = index)}
                onRatingVisibilityChange={(questionId, show) => {
                  // Store visibility state and re-trigger the proven active-question channel.
                  try {
                    localStorage.setItem("filipa-rating-visibility", JSON.stringify({ questionId, show }));
                    localStorage.setItem("filipa-active-question", `${questionId}:${Date.now()}`);
                  } catch { /* ignore */ }
                }}
              />
            {/each}
          </div>
        {/if}
      </main>
    </div>
  {/if}
</div>

<!-- Add Questions Modal (tabbed) -->
<SessionModal show={showAddQuestionsModal} title="Add Questions" size="large" onClose={closeAddQuestionsModal}>
  <Tabs
    tabs={[
      { id: "catalog", label: "From Catalog" },
      { id: "sets", label: "From Question Set" },
      { id: "new", label: "New Question" },
    ]}
    bind:activeTab={addQuestionsTab}
    onTabChange={(id) => {
      if (id === "new") {
        newQuestionFormData = { question: "", expectedAnswer: "", tags: "", questionType: QuestionType.Text, difficulty: "1,2,3,4,5,6,7,8,9,10" };
      }
    }}
  />

  {#if addQuestionsTab === "catalog"}
    <QuestionBrowserModal
      questions={catalogQuestions}
      existingQuestionIds={questions.map((sq) => sq.questionObj.id)}
      onAdd={addQuestionToSession}
      onClose={closeAddQuestionsModal}
    />
  {:else if addQuestionsTab === "sets"}
    {#if questionSetBrowserLoading}
      <p class="loading-text">Loading question sets...</p>
    {:else if availableQuestionSets.length === 0}
      <p class="empty-state">
        No question sets found. Create question sets in the Question Sets section.
      </p>
    {:else}
      <p class="helper-text">
        Select a question set to add its questions to the session. Duplicates will be skipped.
      </p>
      <div class="question-set-list">
        {#each availableQuestionSets as qs (qs.id)}
          <div class="question-set-item">
            <div class="question-set-info">
              <strong class="question-set-name">{qs.name}</strong>
              {#if qs.notes}
                <span class="question-set-notes">{qs.notes}</span>
              {/if}
              <span class="question-set-count"
              >{qs.questionIds.length} question{qs.questionIds.length !== 1 ? "s" : ""}</span
              >
            </div>
            <button type="button" class="primary" onclick={() => addQuestionSetToSession(qs)}>
              + Add to Session
            </button>
          </div>
        {/each}
      </div>
    {/if}
  {:else}
    <form onsubmit={handleNewQuestionSubmit} autocomplete="off" data-form-type="other">
      <div class="form-group">
        <MarkdownEditor
          bind:value={newQuestionFormData.question}
          id="newQuestionText"
          name="new-question-text-content"
          label="Question"
          required={true}
          placeholder="Enter the question text"
          rows={3}
        />
      </div>

      <div class="form-group">
        <MarkdownEditor
          bind:value={newQuestionFormData.expectedAnswer}
          id="newExpectedAnswer"
          name="new-question-expected-answer"
          label="Expected Answer"
          placeholder="Enter the expected answer (visible only to interviewer)"
          rows={5}
          helpText="This will be visible only to the interviewer during the interview"
        />
      </div>

      <div class="form-row">
        <div class="form-group">
          <label for="newQuestionType">Question Type <span class="required">*</span></label>
          <select
            id="newQuestionType"
            name="new-question-type"
            bind:value={newQuestionFormData.questionType}
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
          <label for="newQuestionTags">Tags</label>
          <input
            id="newQuestionTags"
            name="new-question-tags"
            type="text"
            bind:value={newQuestionFormData.tags}
            placeholder="javascript, react, frontend"
            autocomplete="off"
            data-lpignore="true"
            data-form-type="other"
          />
          <small>Separate tags with commas</small>
        </div>
      </div>

      <div class="form-group">
        <label for="newQuestionDifficulty">Difficulty</label>
        <input
          id="newQuestionDifficulty"
          name="new-question-difficulty-levels"
          type="text"
          bind:value={newQuestionFormData.difficulty}
          placeholder="1,2,3,4,5,6,7,8,9,10"
          autocomplete="off"
          data-lpignore="true"
          data-form-type="other"
        />
        <small>Comma-separated numbers (1-10) indicating which difficulty levels this question applies to</small>
      </div>

      <div class="modal-actions">
        <button type="button" onclick={closeAddQuestionsModal} class="secondary" disabled={savingNewQuestion}>Cancel</button>
        <button type="submit" class="primary" disabled={savingNewQuestion}>{savingNewQuestion ? "Adding..." : "Add to Session"}</button>
      </div>
    </form>
  {/if}
</SessionModal>

<!-- Edit Question Modal -->
<SessionModal show={showEditQuestionModal} title="Edit Question" size="large" onClose={closeEditQuestionModal}>
  <form onsubmit={handleEditQuestionSubmit} autocomplete="off" data-form-type="other">
    <div class="form-group">
      <MarkdownEditor
        bind:value={editQuestionFormData.question}
        id="editQuestionText"
        name="edit-question-text-content"
        label="Question"
        required={true}
        placeholder="Enter the question text"
        rows={3}
      />
    </div>

    <div class="form-group">
      <MarkdownEditor
        bind:value={editQuestionFormData.expectedAnswer}
        id="editExpectedAnswer"
        name="edit-question-expected-answer"
        label="Expected Answer"
        placeholder="Enter the expected answer (visible only to interviewer)"
        rows={5}
        helpText="This will be visible only to the interviewer during the interview"
      />
    </div>

    <div class="form-row">
      <div class="form-group">
        <label for="editQuestionType">Question Type <span class="required">*</span></label>
        <select
          id="editQuestionType"
          name="edit-question-type"
          bind:value={editQuestionFormData.questionType}
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
        <label for="editQuestionTags">Tags</label>
        <input
          id="editQuestionTags"
          name="edit-question-tags"
          type="text"
          bind:value={editQuestionFormData.tags}
          placeholder="javascript, react, frontend"
          autocomplete="off"
          data-lpignore="true"
          data-form-type="other"
        />
        <small>Separate tags with commas</small>
      </div>
    </div>

    <div class="form-group">
      <label for="editQuestionDifficulty">Difficulty</label>
      <input
        id="editQuestionDifficulty"
        name="edit-question-difficulty-levels"
        type="text"
        bind:value={editQuestionFormData.difficulty}
        placeholder="1,2,3,4,5,6,7,8,9,10"
        autocomplete="off"
        data-lpignore="true"
        data-form-type="other"
      />
      <small>Comma-separated numbers (1-10) indicating which difficulty levels this question applies to</small>
    </div>

    <div class="modal-actions">
      <button type="button" onclick={closeEditQuestionModal} class="secondary" disabled={savingEditQuestion}>Cancel</button>
      <button type="submit" class="primary" disabled={savingEditQuestion}>{savingEditQuestion ? "Saving..." : "Save Changes"}</button>
    </div>
  </form>
</SessionModal>

<!-- Notes Modal -->
<SessionModal show={showNotesModal} title="Notes" onClose={closeNotesModal} size="large">
  <div class="notes-modal-body">
    <div class="form-group form-group-grow">
      <label>Session Notes</label>
      <textarea bind:value={sessionNotes} placeholder="Add notes about this interview session..."></textarea>
    </div>
    <div class="form-group form-group-grow">
      <label>Candidate Notes</label>
      <textarea bind:value={candidateNotes} placeholder="Add notes about this candidate..."></textarea>
    </div>
    <div class="modal-actions">
      <button type="button" onclick={closeNotesModal} class="secondary">Cancel</button>
      <button type="button" onclick={saveNotes} class="primary">Save Notes</button>
    </div>
  </div>
</SessionModal>

<!-- Remove Question Confirmation -->
<CompactDialog
  show={!!confirmRemoveQuestionId}
  onClose={() => (confirmRemoveQuestionId = null)}
  title="Remove Question?"
>
  <p class="confirm-text">Remove this question from the session?</p>
  <div class="modal-actions">
    <button type="button" onclick={() => (confirmRemoveQuestionId = null)} class="secondary">Cancel</button>
    <button type="button" onclick={confirmRemoveQuestionAction} class="danger">Remove</button>
  </div>
</CompactDialog>

<!-- Reset Record Confirmation -->
<CompactDialog
  show={!!confirmResetQuestion}
  onClose={() => (confirmResetQuestion = null)}
  title="Reset Record?"
>
  <p class="confirm-text">This will clear the answer, rating, and notes for this question.</p>
  <div class="modal-actions">
    <button type="button" onclick={() => (confirmResetQuestion = null)} class="secondary">Cancel</button>
    <button type="button" onclick={confirmResetRecordAction} class="danger">Reset</button>
  </div>
</CompactDialog>

<!-- Save to Catalog Confirmation -->
<CompactDialog
  show={!!confirmSaveToCatalogSQ}
  onClose={() => (confirmSaveToCatalogSQ = null)}
  title={confirmSaveToCatalogMode === "add" ? "Add to Catalog?" : "Update Catalog?"}
>
  <p class="confirm-text">
    {#if confirmSaveToCatalogMode === "add"}
      Add this question to the Question Catalog?
    {:else}
      Update this question in the Question Catalog with the current version?
    {/if}
  </p>
  <div class="modal-actions">
    <button type="button" onclick={() => (confirmSaveToCatalogSQ = null)} class="secondary">Cancel</button>
    <button type="button" onclick={confirmSaveToCatalogAction} class="primary">
      {confirmSaveToCatalogMode === "add" ? "Add" : "Update"}
    </button>
  </div>
</CompactDialog>

<style>

  .notes-modal-body {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }

  h1 {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  h1 .candidate-name {
    color: var(--color-primary);
    font-weight: 600;
  }

  h1 .separator {
    color: #999;
    font-weight: 400;
  }

  .meta {
    color: #6c757d;
    margin: 0;
    font-size: 0.9rem;
  }

  .content {
    display: grid;
    grid-template-columns: 250px 1fr;
    gap: 2rem;
    padding: 2rem;
    align-items: start;
    min-height: calc(100vh - 12rem);
  }

  .sidebar {
    position: sticky;
    top: 6rem;
    align-self: start;
    display: flex;
    align-items: stretch;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .main-content {
    align-self: start;
  }

  .stats {
    padding: 1rem 1.5rem;
    background: var(--color-bg-subtle);
    border-radius: 8px;
    flex: 1;
    min-width: 200px;
  }

  .sidebar :not(.action-buttons) > button.primary {
    width: 100%;
    white-space: nowrap;
  }

  .stats h3 {
    margin: 0 0 0.5rem 0;
    font-size: 0.9rem;
    color: var(--color-text-secondary);
    font-weight: 600;
  }

  .stat-compact {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.5rem;
    font-size: 0.85rem;
  }

  .stat-item-inline {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
  }

  .stat-label-inline {
    color: var(--color-text-secondary);
    font-weight: 500;
  }

  .stat-value-inline {
    color: var(--color-primary);
    font-weight: 700;
  }

  .stat-separator {
    color: #999;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
  }

  .section-header h2 {
    margin: 0;
  }

  .empty-state {
    padding-top: 2rem;
  }

  .questions-list.reorder-mode {
    outline: 2px dashed var(--color-primary, #0066cc);
    border-radius: 6px;
  }

  .empty-state h3 {
    margin: 0 0 1rem 0;
  }

  .questions-list {
    display: flex;
    flex-direction: column;
    gap: 0;
    align-items: stretch;
  }

  .sidebar-actions {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .action-buttons {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  /* Responsive Design */
  @media (max-width: 968px) {
    .header-actions button.primary {
      width: 100%;
    }

    .content {
      grid-template-columns: 1fr;
      padding: 1.5rem;
    }

    .sidebar {
      position: sticky;
      top: 0;
      z-index: 10;
      flex-direction: column;
      background: var(--color-bg);
      padding: 0.5rem 0;
    }

    :global(.action-buttons) {
      flex-direction: row !important;
      flex-wrap: nowrap !important;
      overflow-x: auto;
    }

    :global(.action-buttons button.primary),
    :global(.action-buttons button.secondary) {
      flex: 0 0 auto !important;
      width: auto !important;
      min-width: 0 !important;
      padding: 0.5rem 0.75rem !important;
      font-size: 0.85rem !important;
      white-space: nowrap !important;
    }
  }

  :global([data-theme="dark"]) h1 .candidate-name {
    color: var(--color-primary-dark);
  }

  :global([data-theme="dark"]) h1 .separator {
    color: var(--color-text-secondary);
  }

  :global([data-theme="dark"]) .meta {
    color: var(--color-text-muted);
  }

:global([data-theme="dark"]) .stats {
    background: var(--color-bg-dark-2);
  }

  :global([data-theme="dark"]) .stats h3 {
    color: var(--color-text-muted);
  }

  :global([data-theme="dark"]) .stat-label-inline {
    color: var(--color-text-muted);
  }

  :global([data-theme="dark"]) .stat-value-inline {
    color: var(--color-primary-dark);
  }

  :global([data-theme="dark"]) .stat-separator {
    color: var(--color-text-secondary);
  }

  button.secondary {
    padding: 0.75rem 1.5rem;
    background: var(--color-bg-subtle);
    color: var(--color-text);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    cursor: pointer;
    font-size: 1rem;
    font-weight: 500;
    transition: all 0.2s;
  }

  button.secondary:hover {
    background: #e0e0e0;
  }

  .sidebar :not(.action-buttons) > button.secondary {
    width: 100%;
    white-space: nowrap;
  }

  .navigation-buttons {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
    width: 100%;
    margin-top: 0.5rem;
  }

  .nav-btn {
    flex: 1;
  }

  .nav-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  :global([data-theme="dark"]) button.secondary {
    background: #3a3a3a;
    color: #ffffff;
    border-color: #555;
  }

  :global([data-theme="dark"]) button.secondary:hover {
    background: #4a4a4a;
  }

  :global([data-theme="dark"]) .nav-btn:disabled {
    opacity: 0.4;
  }

  .helper-text {
    margin: 0 0 1rem;
    color: #6b7280;
    font-size: 0.9rem;
  }

  .question-set-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .question-set-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.75rem 1rem;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
  }

  .question-set-info {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    flex: 1;
    min-width: 0;
  }

  .question-set-name {
    font-size: 1rem;
  }

  .question-set-notes {
    font-size: 0.85rem;
    color: #6b7280;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .question-set-count {
    font-size: 0.8rem;
    color: #9ca3af;
  }

  :global([data-theme="dark"]) .question-set-item {
    border-color: #3a3a3a;
  }

  :global([data-theme="dark"]) .question-set-notes,
  :global([data-theme="dark"]) .helper-text {
    color: #9ca3af;
  }

  :global([data-theme="dark"]) .question-set-count {
    color: #6b7280;
  }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  .required {
    color: #d32f2f;
    margin-left: 0.25rem;
  }

</style>
