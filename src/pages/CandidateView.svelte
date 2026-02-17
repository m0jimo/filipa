<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { fly, fade } from "svelte/transition";
  import { sessionDB, sessionQuestionDB } from "../lib/db";
  import type { Session, SessionQuestion } from "../lib/types";
  import { candidateThemeStore } from "../lib/candidateThemeStore";
  import MarkdownPreview from "../components/MarkdownPreview.svelte";

  let { params = { sessionId: "" } }: { params: { sessionId: string } } = $props();

  let session: Session | null = $state(null);
  let questions: SessionQuestion[] = $state([]);
  let currentQuestion: SessionQuestion | null = $state(null);
  let fontSize = $state(26);
  let loading = $state(true);
  let error = $state<string | null>(null);

  async function refreshFromDB() {
    const sessionId = params.sessionId;
    const updatedSession = await sessionDB.read(sessionId);
    const updatedQuestions = await sessionQuestionDB.listBySessionId(sessionId);
    updatedQuestions.sort((a, b) => a.order - b.order);

    if (updatedQuestions.length !== questions.length) {
      questions = updatedQuestions;
    }

    if (updatedSession) {
      const indexChanged = updatedSession.currentQuestionIndex !== session?.currentQuestionIndex;
      const expectedQuestion =
        updatedSession.currentQuestionIndex >= 0 &&
        updatedSession.currentQuestionIndex < updatedQuestions.length
          ? updatedQuestions[updatedSession.currentQuestionIndex]
          : null;
      const questionOutOfSync = currentQuestion?.id !== expectedQuestion?.id;

      // Update if index changed OR if current question is out of sync with database
      if (indexChanged || questionOutOfSync) {
        session = updatedSession;
        currentQuestion = expectedQuestion;
      }
    }
  }

  let sessionChannel: BroadcastChannel | null = null;
  let messageHandler: ((event: MessageEvent) => void) | null = null;

  onMount(async () => {
    // Initialize candidate-specific theme
    candidateThemeStore.initialize();
    try {
      const sessionId = params.sessionId;
      session = await sessionDB.read(sessionId);

      if (!session) {
        error = "Session not found";
        loading = false;
        return;
      }

      questions = await sessionQuestionDB.listBySessionId(sessionId);
      questions.sort((a, b) => a.order - b.order);

      // Show active question immediately if one is already presented
      currentQuestion =
        session.currentQuestionIndex >= 0 && session.currentQuestionIndex < questions.length
          ? questions[session.currentQuestionIndex]
          : null;

      loading = false;

      // Set up BroadcastChannel for session-specific updates
      sessionChannel = new BroadcastChannel(`filipa-session-${sessionId}`);
      sessionChannel.onmessage = (event) => {
        if (event.data?.type === "filipa-question-update" && event.data?.sessionId === sessionId) {
          refreshFromDB();
        }
      };

      // Notify interviewer that candidate window is open
      sessionChannel.postMessage({
        type: "candidate-window-opened",
        sessionId: sessionId,
      });

      // Listen for postMessage from interviewer window (complementary mechanism)
      messageHandler = (event: MessageEvent) => {
        if (event.data?.type === "filipa-question-update" && event.data?.sessionId === sessionId) {
          refreshFromDB();
        }
      };
      window.addEventListener("message", messageHandler);
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to load session";
      loading = false;
    }
  });

  onDestroy(() => {
    if (messageHandler) {
      window.removeEventListener("message", messageHandler);
    }
    if (sessionChannel) {
      // Notify interviewer that candidate window is closing
      sessionChannel.postMessage({
        type: "candidate-window-closing",
        sessionId: params.sessionId,
      });
      sessionChannel.close();
    }
  });

  function increaseFontSize() {
    fontSize = Math.min(fontSize + 2, 36);
  }

  function decreaseFontSize() {
    fontSize = Math.max(fontSize - 2, 12);
  }
</script>

<div class="candidate-view">
  {#if loading}
    <div class="loading">
      <p>Loading interview session...</p>
    </div>
  {:else if error}
    <div class="error-state">
      <p class="error">{error}</p>
    </div>
  {:else if session}
    <header>
      <div class="session-info">
        <h1>Interview Session</h1>
        <p class="meta">
          {session.name} • {new Date(session.date).toLocaleDateString()}
        </p>
      </div>
      <div class="controls">
        <div class="font-controls">
          <button onclick={decreaseFontSize} aria-label="Decrease font size">A-</button>
          <span class="font-size-label">{fontSize}px</span>
          <button onclick={increaseFontSize} aria-label="Increase font size">A+</button>
        </div>
        <button
          class="theme-toggle-btn"
          onclick={() => candidateThemeStore.toggle()}
          title="Toggle theme"
        >
          {$candidateThemeStore === "light" ? "🌙" : "☀️"}
        </button>
      </div>
    </header>

    <main>
      <div class="content-container">
        {#if currentQuestion}
          {#key currentQuestion.id}
            <div
              class="question-display"
              style="font-size: {fontSize}px"
              in:fly={{ x: 1000, duration: 500, delay: 100 }}
              out:fly={{ x: -1000, duration: 500 }}
            >
              <div class="question-text">
                <MarkdownPreview md={currentQuestion.questionObj.question} />
              </div>
            </div>
          {/key}
        {:else}
          <div class="waiting-state" in:fade={{ duration: 300 }}>
            <div class="waiting-icon">👋</div>
            <h2 style="font-size: {fontSize}px">Welcome to Your Interview Session</h2>
            <p style="font-size: {fontSize * 0.7}px">
              The session is ready. Your interviewer will present questions here when they're ready
              to begin.
            </p>
            <p class="waiting-hint" style="font-size: {fontSize * 0.6}px">
              Please wait for the interviewer to start...
            </p>
          </div>
        {/if}
      </div>
    </main>

    <footer>
      <p class="session-id">Session ID: {session.id.substring(0, 8)}</p>
    </footer>
  {/if}
</div>

<style>
  .candidate-view {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background: #ffffff;
    padding-bottom: 60px; /* Space for fixed footer */
  }

  header {
    padding: 1.5rem 2rem;
    background: var(--color-bg-subtle);
    border-bottom: 2px solid #ddd;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .session-info h1 {
    margin: 0 0 0.25rem 0;
    font-size: 1.5rem;
    color: black;
  }

  .meta {
    margin: 0;
    color: var(--color-text-secondary);
    font-size: 0.9rem;
  }

  .controls {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .theme-toggle-btn {
    padding: 0.5rem 0.75rem;
    background: white;
    color: black;
    border: 2px solid #e0e0e0;
    border-radius: 8px;
    cursor: pointer;
    font-size: 1.25rem;
    transition: all 0.2s;
  }

  .theme-toggle-btn:hover {
    transform: scale(1.1);
    border-color: var(--color-primary);
  }

  .theme-toggle-btn:active {
    transform: scale(0.95);
  }

  .font-controls {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .font-controls button {
    padding: 0.5rem 1rem;
    background: var(--color-primary);
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 1rem;
    font-weight: bold;
  }

  .font-controls button:hover {
    background: var(--color-primary-hover);
  }

  .font-size-label {
    min-width: 50px;
    text-align: center;
    color: var(--color-text-secondary);
    font-size: 0.9rem;
  }

  main {
    flex: 1;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: 3rem 1rem;
    padding-top: 5rem;
    overflow-y: auto;
    position: relative;
  }

  .content-container {
    width: 100%;
    max-width: 1600px;
    min-height: 300px;
    display: flex;
    align-items: flex-start;
    justify-content: center;
  }

  .question-display {
    width: 100%;
    max-width: 1600px;
  }

  .question-text {
    line-height: 1.6;
    color: #1a1a1a;
    padding: 2rem;
    background: #fafafa;
    border-radius: 12px;
    border: 2px solid #e0e0e0;
  }

  .question-text :global(.markdown-preview) {
    color: inherit;
    font-size: inherit;
    line-height: inherit;
  }

  .question-text :global(.markdown-preview h1),
  .question-text :global(.markdown-preview h2),
  .question-text :global(.markdown-preview h3) {
    color: inherit;
    font-size: 1.2em;
    margin-top: 0.5em;
    margin-bottom: 0.5em;
  }

  .question-text :global(.markdown-preview p) {
    margin: 0.5em 0;
  }

  .question-text :global(.markdown-preview p:first-child) {
    margin-top: 0;
  }

  .question-text :global(.markdown-preview p:last-child) {
    margin-bottom: 0;
  }

  .loading,
  .error-state {
    text-align: center;
    padding: 3rem;
  }

  .waiting-state {
    max-width: 600px;
    text-align: center;
    padding: 3rem;
  }

  .waiting-icon {
    font-size: 4rem;
    margin-bottom: 1.5rem;
    animation: wave 2s ease-in-out infinite;
  }

  @keyframes wave {
    0%,
    100% {
      transform: rotate(0deg);
    }
    25% {
      transform: rotate(15deg);
    }
    75% {
      transform: rotate(-15deg);
    }
  }

  .waiting-state h2 {
    margin: 0 0 1rem 0;
    color: #1a1a1a;
    font-size: 1.75rem;
    font-weight: 600;
  }

  .waiting-state p {
    color: var(--color-text-secondary);
    font-size: 1.1rem;
    line-height: 1.6;
    margin: 0.5rem 0;
  }

  .waiting-hint {
    margin-top: 2rem !important;
    color: #999 !important;
    font-size: 1rem !important;
    font-style: italic;
  }

  .error {
    color: #d32f2f;
    background: #ffebee;
    padding: 1rem 2rem;
    border-radius: 4px;
    display: inline-block;
  }

  footer {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 1rem 2rem;
    background: var(--color-bg-subtle);
    border-top: 1px solid #ddd;
    display: flex;
    justify-content: space-between;
    align-items: center;
    z-index: 100;
  }

  footer p {
    margin: 0;
    color: var(--color-text-secondary);
    font-size: 0.85rem;
  }

  .session-id {
    font-family: monospace;
  }

  .progress {
    font-weight: bold;
  }

  :global([data-theme="dark"]) .candidate-view {
    background: var(--color-bg-dark);
  }

  :global([data-theme="dark"]) header {
    background: var(--color-bg-dark-2);
    border-bottom-color: var(--color-border-dark);
  }

  :global([data-theme="dark"]) .session-info h1 {
    color: #ffffff;
  }

  :global([data-theme="dark"]) .meta {
    color: var(--color-text-muted);
  }

  :global([data-theme="dark"]) .theme-toggle-btn {
    background: var(--color-bg-dark-2);
    color: white;
    border-color: var(--color-border-dark);
  }

  :global([data-theme="dark"]) .theme-toggle-btn:hover {
    border-color: var(--color-primary-dark);
  }

  :global([data-theme="dark"]) .font-size-label {
    color: var(--color-text-muted);
  }

  :global([data-theme="dark"]) .question-text {
    color: #ffffff;
    background: var(--color-bg-dark-2);
    border-color: var(--color-border-dark);
  }

  :global([data-theme="dark"]) .question-text :global(.markdown-preview) {
    color: #ffffff;
  }

  :global([data-theme="dark"]) .question-text :global(.markdown-preview h1),
  :global([data-theme="dark"]) .question-text :global(.markdown-preview h2),
  :global([data-theme="dark"]) .question-text :global(.markdown-preview h3) {
    color: #ffffff;
  }

  :global([data-theme="dark"]) .waiting-state h2 {
    color: #ffffff;
  }

  :global([data-theme="dark"]) .waiting-state p {
    color: var(--color-text-muted);
  }

  :global([data-theme="dark"]) .waiting-hint {
    color: var(--color-text-secondary) !important;
  }

  :global([data-theme="dark"]) footer {
    background: var(--color-bg-dark-2);
    border-top-color: var(--color-border-dark);
  }

  :global([data-theme="dark"]) footer p {
    color: var(--color-text-muted);
  }
</style>
