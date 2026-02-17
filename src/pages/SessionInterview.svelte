<script lang="ts">
  import {onDestroy, onMount} from "svelte";
  import candidateWindowSvg from "../assets/filipa-candidate-window.svg";
  import {candidateDB, generateId, questionDB, questionSetDB, sessionDB, sessionQuestionDB} from "../lib/db";
  import type {Candidate, FilipaUpdateMessage, Question, QuestionSet, Session, SessionQuestion} from "../lib/types";
  import SessionQuestionItem from "../lib/SessionQuestionItem.svelte";
  import QuestionBrowserModal from "../lib/QuestionBrowserModal.svelte";
  import Navigation from "../lib/Navigation.svelte";
  import Breadcrumbs from "../lib/Breadcrumbs.svelte";
  import SessionModal from "../lib/SessionModal.svelte";

  let {params = {sessionId: ""}}: { params: { sessionId: string } } = $props();

  let session: Session | null = $state(null);
  let candidate: Candidate | null = $state(null);
  let questions: SessionQuestion[] = $state([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  // Question catalog for adding
  let showQuestionBrowser = $state(false);
  let catalogQuestions: Question[] = $state([]);

  // Question set browser
  let showQuestionSetBrowser = $state(false);
  let availableQuestionSets: QuestionSet[] = $state([]);
  let questionSetBrowserLoading = $state(false);

  onMount(async () => {
    await loadSession();
    // Initialize BroadcastChannel for session updates
    if (session) {
      sessionChannel = new BroadcastChannel(`filipa-session-${session.id}`);
      // Listen for candidate window lifecycle events
      sessionChannel.onmessage = (event) => {
        if (event.data?.type === "candidate-window-opened") {
          candidateWindowOpen = true;
          startWindowCheck();
        } else if (event.data?.type === "candidate-window-closing") {
          candidateWindowOpen = false;
          stopWindowCheck();
        }
      };
    }
  });

  function startWindowCheck() {
    // Clear any existing interval
    stopWindowCheck();
    // Lightweight check every 2 seconds as fallback for cases where onDestroy doesn't fire
    windowCheckInterval = setInterval(() => {
      if (candidateWindow && candidateWindow.closed) {
        candidateWindowOpen = false;
        stopWindowCheck();
      }
    }, 5000);
  }

  function stopWindowCheck() {
    if (windowCheckInterval) {
      clearInterval(windowCheckInterval);
      windowCheckInterval = null;
    }
  }

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

  async function openCandidateView() {
    if (session) {
      // Reset active question so candidate sees the welcome page
      session.currentQuestionIndex = -1;
      session.updatedAt = new Date();
      const cleanSess = cleanSession(session);
      await sessionDB.update(cleanSess);
      session = session;

      // Broadcast reset to any already-open candidate window
      if (sessionChannel) {
        sessionChannel.postMessage({type: "filipa-question-update", sessionId: session.id});
      }
      if (candidateWindow && !candidateWindow.closed) {
        candidateWindow.postMessage({type: "filipa-question-update", sessionId: session.id}, "*");
      }

      const url = `${window.location.origin}${window.location.pathname}#/candidate-view/${session.id}`;
      candidateWindow = window.open(url, "candidate_view_" + session.id, "width=1280,height=1024");
    }
  }

  async function openQuestionBrowser() {
    await loadQuestionCatalog();
    showQuestionBrowser = true;
  }

  function closeQuestionBrowser() {
    showQuestionBrowser = false;
  }

  async function openQuestionSetBrowser() {
    try {
      questionSetBrowserLoading = true;
      showQuestionSetBrowser = true;
      const all = await questionSetDB.list();
      all.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      availableQuestionSets = all;
    } catch (err) {
      alert(
        "Failed to load question sets: " + (err instanceof Error ? err.message : "Unknown error")
      );
      showQuestionSetBrowser = false;
    } finally {
      questionSetBrowserLoading = false;
    }
  }

  function closeQuestionSetBrowser() {
    showQuestionSetBrowser = false;
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
      closeQuestionSetBrowser();
    } catch (err) {
      alert(
        "Failed to add question set: " + (err instanceof Error ? err.message : "Unknown error")
      );
    }
  }

  async function addQuestionToSession(question: Question) {
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
        createdAt: now,
        updatedAt: now
      };

      await sessionQuestionDB.create(newSessionQuestion);
      await loadSession();
    } catch (err) {
      alert("Failed to add question: " + (err instanceof Error ? err.message : "Unknown error"));
    }
  }

  async function removeQuestion(questionId: string) {
    if (!confirm("Remove this question from the session?")) return;

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
          session.updatedAt = new Date();
          const cleanSess = cleanSession(session);
          await sessionDB.update(cleanSess);
        }
      }

      await loadSession();
    } catch (err) {
      alert(
        "Failed to reorder questions: " + (err instanceof Error ? err.message : "Unknown error")
      );
    }
  }

  // Helper function to create a clean copy of SessionQuestion for IndexDB
  function cleanSessionQuestion(sq: SessionQuestion): SessionQuestion {
    return {
      id: sq.id,
      sessionId: sq.sessionId,
      questionObj: {
        id: sq.questionObj.id,
        hash: "",
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
      createdAt: new Date(s.createdAt),
      updatedAt: new Date(s.updatedAt)
    };
  }

  let candidateWindow: Window | null = null;
  let sessionChannel: BroadcastChannel | null = null;
  let candidateWindowOpen = $state(false);
  let windowCheckInterval: ReturnType<typeof setInterval> | null = null;
  let scrollToQuestionId = $state<string | null>(null);

  async function setActiveQuestion(index: number, shouldScroll = false) {
    if (!session) return;

    try {
      // Check if candidate window is open, if not open it
      if (!candidateWindow || candidateWindow.closed) {
        openCandidateView();
      }

      session.currentQuestionIndex = index;
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

      // Broadcast to BroadcastChannel (all tabs/windows)
      if (sessionChannel) {
        const message: FilipaUpdateMessage = {
          type: "filipa-question-update",
          sessionId: session.id,
          timestamp: Date.now()
        };
        sessionChannel.postMessage(message);
      }

      // Notify candidate window instantly via postMessage
      if (candidateWindow && !candidateWindow.closed) {
        candidateWindow.postMessage({type: "filipa-question-update", sessionId: session.id}, "*");
      }

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

  // Session notes modal
  let showNotesModal = $state(false);
  let sessionNotes = $state("");

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
      } catch (err) {
        console.error("Failed to save answer:", err);
      }
    }, 500) as unknown as number;
  }

  async function resetRecord(question: SessionQuestion) {
    if (!confirm("Reset this question's record? This will clear the answer, rating, and notes."))
      return;

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
    } catch (err) {
      alert("Failed to reset question: " + (err instanceof Error ? err.message : "Unknown error"));
    }
  }

  function goToPreviousQuestion() {
    if (!session || session.currentQuestionIndex === undefined || session.currentQuestionIndex <= 0)
      return;
    setActiveQuestion(session.currentQuestionIndex - 1, true);
  }

  function goToNextQuestion() {
    if (
      !session ||
      session.currentQuestionIndex === undefined ||
      session.currentQuestionIndex >= questions.length - 1
    )
      return;
    setActiveQuestion(session.currentQuestionIndex + 1, true);
  }

  function openNotesModal() {
    if (session) {
      sessionNotes = session.notes;
      showNotesModal = true;
    }
  }

  function closeNotesModal() {
    showNotesModal = false;
  }

  async function saveSessionNotes() {
    if (!session) return;

    try {
      session.notes = sessionNotes;
      session.updatedAt = new Date();
      const cleanSess = cleanSession(session);
      await sessionDB.update(cleanSess);
      session = session; // Trigger reactivity
      closeNotesModal();
    } catch (err) {
      alert(
        "Failed to save session notes: " + (err instanceof Error ? err.message : "Unknown error")
      );
    }
  }

  onDestroy(() => {
    if (sessionChannel) {
      sessionChannel.close();
    }
    stopWindowCheck();
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
          label: candidate ? `${candidate.firstName} ${candidate.lastName}` : "Candidate",
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
        <!-- make buttons full side bar width        -->
        <div style="display:flex;flex-direction:column;gap:0.5rem;">
          <button type="button" onclick={openCandidateView} class="primary">
            <img
              src={candidateWindowSvg}
              alt=""
              style="width:1.2em;height:1.2em;vertical-align:middle;margin-right:0.4em;"
            /> Show Welcome Page
          </button>
          <!-- keep horizontal space for showing window-status        -->
          <div class="window-status-container">
            {#if candidateWindowOpen}
              <span class="window-status open">● Candidate Window Open</span>
            {:else if candidateWindow}
              <span class="window-status closed">● Candidate Window Closed</span>
            {:else}
              <span class="window-status-placeholder"></span>
            {/if}
          </div>
          <button type="button" onclick={openNotesModal} class="secondary">📝 Session Notes</button>
          <button type="button" onclick={openQuestionSetBrowser} class="primary"
          >+ Add Question Set
          </button
          >
          <button type="button" onclick={openQuestionBrowser} class="primary"
          >+ Add Questions
          </button
          >

          {#if questions.length > 0}
            <div class="navigation-buttons">
              <button
                type="button"
                onclick={goToPreviousQuestion}
                class="nav-btn secondary"
                disabled={session?.currentQuestionIndex === undefined ||
                  session.currentQuestionIndex <= 0}
                title="Previous question"
              >
                ◀ Previous
              </button>
              <button
                type="button"
                onclick={goToNextQuestion}
                class="nav-btn secondary"
                disabled={session?.currentQuestionIndex === undefined ||
                  session.currentQuestionIndex >= questions.length - 1}
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
        </div>

        {#if questions.length === 0}
          <div class="empty-state">
            <h3>No questions yet</h3>
            <p>Add questions from the catalog to start preparing the interview.</p>
            <button type="button" onclick={openQuestionBrowser} class="primary"
            >+ Add Questions
            </button
            >
          </div>
        {:else}
          <div class="questions-list">
            {#each questions as question, index (question.id)}
              <SessionQuestionItem
                {question}
                {index}
                {session}
                totalQuestions={questions.length}
                {expandedQuestionId}
                {candidateWindowOpen}
                {scrollToQuestionId}
                onMoveUp={moveQuestionUp}
                onMoveDown={moveQuestionDown}
                onRemove={removeQuestion}
                onSetActive={setActiveQuestion}
                onToggleRecording={toggleRecordingForm}
                onSaveAnswer={saveAnswerData}
                onResetRecord={resetRecord}
              />
            {/each}
          </div>
        {/if}
      </main>
    </div>
  {/if}
</div>

<!-- Question Set Browser Modal -->
<SessionModal show={showQuestionSetBrowser} title="Add Question Set" size="large" onClose={closeQuestionSetBrowser}>
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
</SessionModal>

<!-- Question Browser Modal -->
{#if showQuestionBrowser}
  <QuestionBrowserModal
    questions={catalogQuestions}
    existingQuestionIds={questions.map((sq) => sq.questionObj.id)}
    onAdd={addQuestionToSession}
    onClose={closeQuestionBrowser}
  />
{/if}

<!-- Session Notes Modal -->
<SessionModal show={showNotesModal} title="Session Notes" onClose={closeNotesModal}>
  <div class="form-group">
    <textarea
      bind:value={sessionNotes}
      placeholder="Add notes about this interview session..."
      rows="12"
    ></textarea>
  </div>
  <div class="modal-actions">
    <button type="button" onclick={closeNotesModal} class="secondary">Cancel</button>
    <button type="button" onclick={saveSessionNotes} class="primary">Save Notes</button>
  </div>
</SessionModal>

<style>

  h1 {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  h1 .candidate-name {
    color: #0066cc;
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

  .window-status-container {
    min-height: 2.5rem;
    display: flex;
    align-items: center;
    width: 100%;
    flex-basis: 100%;
  }

  .window-status {
    font-size: 0.9rem;
    font-weight: 500;
    display: flex;
    align-items: center;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    white-space: nowrap;
    width: 100%;
  }

  .window-status.open {
    color: #2e7d32;
    background: #e8f5e9;
  }

  .window-status.closed {
    color: #d32f2f;
    background: #ffebee;
  }

  .window-status-placeholder {
    display: inline-block;
    height: 2.5rem;
    width: 1px;
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
    background: #f5f5f5;
    border-radius: 8px;
    flex: 1;
    min-width: 200px;
  }

  .sidebar button.primary {
    width: 100%;
    white-space: nowrap;
  }

  .stats h3 {
    margin: 0 0 0.5rem 0;
    font-size: 0.9rem;
    color: #666;
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
    color: #666;
    font-weight: 500;
  }

  .stat-value-inline {
    color: #0066cc;
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

  .empty-state h3 {
    margin: 0 0 1rem 0;
  }

  .questions-list {
    display: flex;
    flex-direction: column;
    gap: 0;
    align-items: stretch;
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
      position: static;
    }
  }

  :global([data-theme="dark"]) h1 .candidate-name {
    color: #4da3ff;
  }

  :global([data-theme="dark"]) h1 .separator {
    color: #666;
  }

  :global([data-theme="dark"]) .meta {
    color: #a0a0a0;
  }

  :global([data-theme="dark"]) .window-status.open {
    color: #a5d6a7;
    background: #1b5e20;
  }

  :global([data-theme="dark"]) .window-status.closed {
    color: #ef9a9a;
    background: #b71c1c;
  }

  :global([data-theme="dark"]) .stats {
    background: #2a2a2a;
  }

  :global([data-theme="dark"]) .stats h3 {
    color: #a0a0a0;
  }

  :global([data-theme="dark"]) .stat-label-inline {
    color: #a0a0a0;
  }

  :global([data-theme="dark"]) .stat-value-inline {
    color: #4da3ff;
  }

  :global([data-theme="dark"]) .stat-separator {
    color: #666;
  }

  button.secondary {
    padding: 0.75rem 1.5rem;
    background: #f5f5f5;
    color: #333;
    border: 1px solid #ddd;
    border-radius: 6px;
    cursor: pointer;
    font-size: 1rem;
    font-weight: 500;
    transition: all 0.2s;
  }

  button.secondary:hover {
    background: #e0e0e0;
  }

  .sidebar button.secondary {
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
</style>
