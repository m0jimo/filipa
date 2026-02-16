<script lang="ts">
  import { link } from "svelte-spa-router";
  import { themeStore } from "./themeStore";
  import filipaLogoSvg from "../assets/filipaLogo.svg";

  let {
    showAppName = true,
  }: {
    showAppName?: boolean;
  } = $props();
</script>

<nav class="navigation-tabs">
  {#if showAppName}
    <div class="app-name">
      <a href="/" use:link class="app-brand">
        <img src={filipaLogoSvg} alt="Filipa logo" class="app-logo" />
        <div class="app-brand-text">
          <span class="app-title">Filipa</span>
          <span class="app-subtitle">Interview Application</span>
        </div>
      </a>
    </div>
  {/if}
  <div class="spacer"></div>
  <button class="theme-toggle" onclick={() => themeStore.toggle()} title="Toggle theme">
    {$themeStore === "light" ? "🌙" : "☀️"}
  </button>
  <a
    href="https://github.com/m0jimo/filipa"
    target="_blank"
    rel="noopener noreferrer"
    class="github-link"
    title="View on GitHub"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      class="github-icon"
      aria-hidden="true"
    >
      <path
        d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"
      />
    </svg>
  </a>
  <a href="/help" use:link class="help-link" title="Help / Documentation">
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      class="help-icon"
      aria-hidden="true"
    >
      <path
        d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"
      />
    </svg>
  </a>
  <a href="/settings" use:link class="settings-link" title="Settings">
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      class="settings-icon"
      aria-hidden="true"
    >
      <path
        d="M12 15.5A3.5 3.5 0 0 1 8.5 12 3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5 3.5 3.5 0 0 1-3.5 3.5m7.43-2.92c.04-.34.07-.68.07-1.08s-.03-.74-.07-1.08l2.11-1.63c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.63c-.04.34-.07.69-.07 1.08s.03.74.07 1.08L2.46 13.07c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.58 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.57z"
      />
    </svg>
  </a>
</nav>

<style>
  .navigation-tabs {
    position: sticky;
    top: 0;
    z-index: 1000;
    display: flex;
    align-items: stretch;
    gap: 0;
    background: white;
    border-bottom: 2px solid #e0e0e0;
    padding: 0 2rem;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  }

  .app-name {
    display: flex;
    align-items: center;
    margin-right: 2rem;
    padding: 0.75rem 0;
  }

  .app-brand {
    display: flex;
    flex-direction: row;
    align-items: center;
    text-decoration: none;
    gap: 0.5rem;
    transition: opacity 0.2s;
  }

  .app-logo {
    width: 2rem;
    height: 2rem;
    flex-shrink: 0;
  }

  .app-brand-text {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .app-brand:hover {
    opacity: 0.8;
  }

  .app-title {
    font-size: 1.25rem;
    font-weight: 700;
    color: #0066cc;
    line-height: 1.2;
  }

  .app-subtitle {
    font-size: 0.75rem;
    font-weight: 500;
    color: #666;
    line-height: 1;
  }

  .spacer {
    flex: 1;
  }

  .theme-toggle {
    padding: 0.4rem;
    background: none;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 1.1rem;
    line-height: 1;
    transition: all 0.2s;
    margin: auto 0;
    margin-left: 0.25rem;
    color: #444;
  }

  .theme-toggle:hover {
    transform: scale(1.1);
    background: #f0f4ff;
    color: #0066cc;
  }

  .theme-toggle:active {
    transform: scale(0.95);
  }

  @media (max-width: 768px) {
    .navigation-tabs {
      padding: 0 1rem;
    }

    .app-name {
      margin-right: 1rem;
    }

    .app-title {
      font-size: 1.1rem;
    }

    .app-subtitle {
      font-size: 0.7rem;
    }

    .theme-toggle {
      padding: 0.4rem;
      font-size: 1.1rem;
      margin-left: 0.25rem;
    }
  }

  @media (max-width: 480px) {
    .app-name {
      margin-right: 0.75rem;
    }

    .app-title {
      font-size: 1rem;
    }

    .app-subtitle {
      font-size: 0.65rem;
    }

    .theme-toggle {
      padding: 0.4rem 0.5rem;
      font-size: 1rem;
      margin-left: 0.5rem;
    }
  }

  :global([data-theme="dark"]) .navigation-tabs {
    background: #1a1a1a;
    border-bottom-color: #333;
  }

  :global([data-theme="dark"]) .app-title {
    color: #4da3ff;
  }

  :global([data-theme="dark"]) .app-subtitle {
    color: #a0a0a0;
  }

  :global([data-theme="dark"]) .theme-toggle {
    background: none;
    color: #a0a0a0;
  }

  :global([data-theme="dark"]) .theme-toggle:hover {
    background: #1a2a3a;
    color: #4da3ff;
  }

  .github-link {
    display: flex;
    align-items: center;
    margin: auto 0;
    margin-left: 0.5rem;
    padding: 0.4rem;
    border-radius: 6px;
    color: #444;
    transition:
      color 0.2s,
      background 0.2s;
  }

  .github-link:hover {
    color: #0066cc;
    background: #f0f4ff;
  }

  .github-icon {
    width: 1.5rem;
    height: 1.5rem;
    fill: currentColor;
  }

  :global([data-theme="dark"]) .github-link {
    color: #a0a0a0;
  }

  :global([data-theme="dark"]) .github-link:hover {
    color: #4da3ff;
    background: #1a2a3a;
  }

  .settings-link {
    display: flex;
    align-items: center;
    margin: auto 0;
    margin-left: 0.5rem;
    padding: 0.4rem;
    border-radius: 6px;
    color: #444;
    transition:
      color 0.2s,
      background 0.2s;
    text-decoration: none;
  }

  .settings-link:hover {
    color: #0066cc;
    background: #f0f4ff;
  }

  .settings-icon {
    width: 1.5rem;
    height: 1.5rem;
    fill: currentColor;
  }

  :global([data-theme="dark"]) .settings-link {
    color: #a0a0a0;
  }

  :global([data-theme="dark"]) .settings-link:hover {
    color: #4da3ff;
    background: #1a2a3a;
  }

  .help-link {
    display: flex;
    align-items: center;
    margin: auto 0;
    margin-left: 0.5rem;
    padding: 0.4rem;
    border-radius: 6px;
    color: #444;
    transition:
      color 0.2s,
      background 0.2s;
    text-decoration: none;
  }

  .help-link:hover {
    color: #0066cc;
    background: #f0f4ff;
  }

  .help-icon {
    width: 1.5rem;
    height: 1.5rem;
    fill: currentColor;
  }

  :global([data-theme="dark"]) .help-link {
    color: #a0a0a0;
  }

  :global([data-theme="dark"]) .help-link:hover {
    color: #4da3ff;
    background: #1a2a3a;
  }
</style>
