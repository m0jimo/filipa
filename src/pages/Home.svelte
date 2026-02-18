<script lang="ts">
  import {link} from "svelte-spa-router";
  import Navigation from "../lib/Navigation.svelte";
  import questionCatalogSvg from "../assets/filipa-question-catalog.svg";
  import interviewerWindowSvg from "../assets/filipa-interviewer-window.svg";
  import {onMount} from "svelte";
  import {userSettings} from "../lib/userSettings";
  import {importDatabase, isDatabaseEmpty} from "../lib/db";

  let dbEmpty = $state(true);
  let fadingOut = $state(false);
  let showCard = $derived($userSettings.showWelcomeCard && dbEmpty);

  onMount(async () => {
    dbEmpty = await isDatabaseEmpty();
  });

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
        Want to use Filipa offline?
        <a href="https://github.com/m0jimo/filipa/releases/download/latest/filipa.zip" target="_blank" rel="noopener noreferrer" class="step-link">Download the latest build</a>
        — unzip and open <code>dist/index.html</code> directly in your browser, no server needed.
      </p>
      <div class="welcome-footer">
        <label class="dont-show-label">
          <input type="checkbox" onchange={handleDontShow}/>
          Don't show this again
        </label>
        <button class="primary load-example-btn" onclick={handleLoadExample}>
          Use example data →
        </button>
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

  .load-example-btn {
    white-space: nowrap;
  }

  .cards-container {
    flex: 1;
    display: flex;
    flex-direction: row;
    justify-content: center;
    align-items: center;
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
