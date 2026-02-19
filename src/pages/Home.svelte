<script lang="ts">
  import {link} from "svelte-spa-router";
  import Navigation from "../lib/Navigation.svelte";
  import questionCatalogSvg from "../assets/filipa-question-catalog.svg";
  import interviewerWindowSvg from "../assets/filipa-interviewer-window.svg";
  import {userSettings} from "../lib/userSettings";
  import {importDatabase} from "../lib/db";

  let fadingOut = $state(false);
  let showCard = $derived($userSettings.showWelcomeCard);

  const handleDontShow = (e: Event) => {
    const checked = (e.target as HTMLInputElement).checked;
    if (checked) {
      fadingOut = true;
      setTimeout(() => userSettings.setShowWelcomeCard(false), 500);
    }
  };

  const handleLoadExample = async () => {
    await importDatabase(__INIT_DB__.indexedDB);
    const preservedKeys = ["theme", "candidate-theme"];
    preservedKeys.forEach((key) => {
      const val = __INIT_DB__.localStorage[key];
      if (val != null) {
        localStorage.setItem(key, val);
      }
    });
    userSettings.setShowWelcomeCard(false);
    location.reload();
  };
</script>

<div class="home-page">
  <Navigation/>
  {#if showCard}
    <div class="welcome-card" class:fading-out={fadingOut}>
      <div class="welcome-header">
        <strong>Welcome to Filipa</strong>
        <p>Filipa is an interview assessment tool for IT developer candidates. Follow these steps to run your first
          interview:</p>
      </div>
      <ol class="welcome-steps">
        <li>
          <span class="step-number">1</span>
          <span class="step-body">
            Add questions to the <a href="#/questions" use:link class="step-link">Question Catalog</a>
            — create questions with difficulty levels, tags, and types to build your interview pool.
          </span>
        </li>
        <li>
          <span class="step-number">2</span>
          <span class="step-body">
            Register a <a href="#/candidates" use:link class="step-link">Candidate</a>
            — enter the candidate's name and position they are applying for.
          </span>
        </li>
        <li>
          <span class="step-number">3</span>
          <span class="step-body">
            Open the candidate, create a <strong>Session</strong>, pick questions from the catalog, and start the interview.
          </span>
        </li>
      </ol>
      <p class="welcome-note">
        Already using Filipa on another computer? You can
        <a href="#/settings" use:link class="step-link">import a backup</a>
        from the Settings page.
      </p>
      <p class="welcome-note">
        Want to use Filipa offline? The easiest way is <strong>File → Save As</strong> (<code>Ctrl+S</code> / <code>Cmd+S</code>)
        to save this page to your drive and open it anytime without internet.
        You can also
        <a href="https://github.com/m0jimo/filipa/releases/download/latest/filipa.zip" target="_blank"
           rel="noopener noreferrer" class="step-link">download the latest build</a>
        as a zip.
      </p>
      <div class="welcome-footer">
        <label class="dont-show-label">
          <input type="checkbox" onchange={handleDontShow}/>
          Don't show this again
          <span class="reopen-hint">
            (You can show it again from
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" class="hint-icon">
              <path
                d="M12 15.5A3.5 3.5 0 0 1 8.5 12 3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5 3.5 3.5 0 0 1-3.5 3.5m7.43-2.92c.04-.34.07-.68.07-1.08s-.03-.74-.07-1.08l2.11-1.63c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.63c-.04.34-.07.69-.07 1.08s.03.74.07 1.08L2.46 13.07c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.58 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.57z"/>
            </svg>
            Settings)
          </span>
        </label>
        <div class="welcome-footer-buttons">
          <a href="#/help" use:link class="help-btn">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" class="help-btn-icon">
              <path
                d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"/>
            </svg>
            Help & Docs
          </a>
          <button class="primary load-example-btn" onclick={handleLoadExample}>
            Use example data →
          </button>
        </div>
      </div>
    </div>
  {/if}
  <div class="cards-container">
    <a href="#/questions" use:link class="card">
      <img src={questionCatalogSvg} alt="Questions Catalog" class="card-icon"/>
      <span class="card-label">Questions Catalog</span>
    </a>
    <a href="#/candidates" use:link class="card">
      <img src={interviewerWindowSvg} alt="Candidates" class="card-icon"/>
      <span class="card-label">Candidates</span>
    </a>
  </div>
</div>

<style>
  .home-page {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  .welcome-card {
    margin: 1.5rem 2rem 0;
    padding: 1.5rem 1.75rem;
    background: #f0f7ff;
    border: 1px solid #b3d4f5;
    border-radius: 10px;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    opacity: 1;
    transition: opacity 0.5s ease;
  }

  .welcome-card.fading-out {
    opacity: 0;
  }

  .welcome-header strong {
    display: block;
    font-size: 1.05rem;
    font-weight: 700;
    color: #1a1a1a;
    margin-bottom: 0.3rem;
  }

  .welcome-header p {
    font-size: 0.9rem;
    color: #444;
    margin: 0;
  }

  .welcome-steps {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  .welcome-steps li {
    display: flex;
    align-items: baseline;
    gap: 0.75rem;
    font-size: 0.9rem;
    color: #333;
  }

  .step-number {
    flex-shrink: 0;
    width: 1.4rem;
    height: 1.4rem;
    border-radius: 50%;
    background: var(--color-primary);
    color: #fff;
    font-size: 0.75rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .step-body {
    line-height: 1.5;
  }

  .step-link {
    color: var(--color-primary);
    font-weight: 600;
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .step-link:hover {
    color: var(--color-primary-hover);
  }

  .welcome-note {
    font-size: 0.875rem;
    color: #555;
    margin: 0;
  }

  .welcome-note code {
    font-family: monospace;
    background: #ddeeff;
    border-radius: 3px;
    padding: 0.1em 0.3em;
    font-size: 0.85em;
  }

  .welcome-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 1rem;
    padding-top: 0.5rem;
    border-top: 1px solid #c8dff5;
  }

  .dont-show-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: #555;
    cursor: pointer;
  }

  .dont-show-label input[type="checkbox"] {
    cursor: pointer;
  }

  .reopen-hint {
    display: inline-flex;
    align-items: center;
    gap: 0.2rem;
    font-size: 0.8rem;
    color: var(--color-text-muted);
    font-weight: 400;
  }

  .hint-icon {
    width: 0.85rem;
    height: 0.85rem;
    fill: currentColor;
    flex-shrink: 0;
  }

  .welcome-footer-buttons {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .help-btn {
    display: inline-flex;
    align-items: center;
    box-sizing: border-box;
    height: 2.25rem;
    padding: 0 1rem;
    border-radius: 6px;
    background: #e0e0e0;
    color: #444;
    font-size: 0.875rem;
    font-weight: 600;
    text-decoration: none;
    transition: background 0.2s;
    white-space: nowrap;
  }

  .help-btn:hover {
    background: #d0d0d0;
    color: #333;
  }

  .help-btn-icon {
    width: 1rem;
    height: 1rem;
    fill: currentColor;
    flex-shrink: 0;
    margin-right: 0.35rem;
  }

  .load-example-btn {
    white-space: nowrap;
    box-sizing: border-box !important;
    height: 2.25rem !important;
    padding: 0 1rem !important;
    font-size: 0.875rem !important;
    line-height: 1 !important;
  }

  .cards-container {
    display: flex;
    flex-direction: row;
    justify-content: center;
    align-items: flex-start;
    gap: 2rem;
    padding: 3rem 2rem;
  }

  .card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.25rem;
    padding: 2.5rem 3rem;
    border: 2px solid #e0e0e0;
    border-radius: 12px;
    text-decoration: none;
    color: inherit;
    background: white;
    transition: border-color 0.2s,
    box-shadow 0.2s,
    transform 0.15s;
    cursor: pointer;
    min-width: 200px;
  }

  .card:hover {
    border-color: var(--color-primary);
    box-shadow: 0 4px 16px rgba(0, 102, 204, 0.15);
    transform: translateY(-2px);
  }

  .card-icon {
    width: 6rem;
    height: 6rem;
    object-fit: contain;
  }

  .card-label {
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--color-text);
  }

  .card:hover .card-label {
    color: var(--color-primary);
  }

  @media (max-width: 600px) {
    .cards-container {
      flex-direction: column;
    }

    .card {
      width: 100%;
      max-width: 280px;
    }

    .welcome-card {
      margin: 1rem 1rem 0;
    }
  }

  :global([data-theme="dark"]) .welcome-card {
    background: #1a2535;
    border-color: #2d4a6e;
  }

  :global([data-theme="dark"]) .welcome-header strong {
    color: #e0e0e0;
  }

  :global([data-theme="dark"]) .welcome-header p {
    color: var(--color-text-muted);
  }

  :global([data-theme="dark"]) .welcome-steps li {
    color: #c8c8c8;
  }

  :global([data-theme="dark"]) .step-link {
    color: var(--color-primary-dark);
  }

  :global([data-theme="dark"]) .step-link:hover {
    color: #7ec8ff;
  }

  :global([data-theme="dark"]) .welcome-note {
    color: var(--color-text-muted);
  }

  :global([data-theme="dark"]) .welcome-note code {
    background: #1e3a55;
    color: #a8d4ff;
  }

  :global([data-theme="dark"]) .welcome-footer {
    border-top-color: #2d4a6e;
  }

  :global([data-theme="dark"]) .dont-show-label {
    color: var(--color-text-muted);
  }

  :global([data-theme="dark"]) .help-btn {
    background: #3a3a3a;
    color: #c8c8c8;
  }

  :global([data-theme="dark"]) .help-btn:hover {
    background: #4a4a4a;
    color: #e0e0e0;
  }

  :global([data-theme="dark"]) .card {
    background: var(--color-bg-dark);
    border-color: var(--color-text);
    color: #e0e0e0;
  }

  :global([data-theme="dark"]) .card:hover {
    border-color: var(--color-primary-dark);
    box-shadow: 0 4px 16px rgba(77, 163, 255, 0.15);
  }

  :global([data-theme="dark"]) .card-label {
    color: #e0e0e0;
  }

  :global([data-theme="dark"]) .card:hover .card-label {
    color: var(--color-primary-dark);
  }
</style>
