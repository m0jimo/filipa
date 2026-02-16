<script lang="ts">
  import { onMount } from "svelte";
  import Navigation from "../lib/Navigation.svelte";
  import Breadcrumbs from "../lib/Breadcrumbs.svelte";
  import MarkdownPreview from "../components/MarkdownPreview.svelte";

  let markdown = $state<string | null>(null);
  let loadError = $state(false);
  const isLocalFile = window.location.protocol === "file:";

  onMount(async () => {
    try {
      const response = await fetch("./help.md");
      if (!response.ok) throw new Error("Not found");
      markdown = await response.text();
    } catch {
      loadError = true;
    }
  });

  const loadFromFile = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    markdown = await file.text();
    loadError = false;
  };
</script>

<div class="page">
  <Navigation />
  <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Help" }]} />

  <div class="page-content">
    {#if loadError}
      <div class="fallback">
        <h2>Documentation could not be loaded</h2>
        {#if isLocalFile}
          <p>
            Filipa is running from a local file (<code>file://</code>), so the browser cannot load
            <code>help.md</code> automatically — it stays separate to keep <code>index.html</code>
            small. The file is located in the same folder as <code>index.html</code>.
          </p>
          <p>You have two options:</p>
          <ol>
            <li>
              <strong>Open <code>help.md</code> from your folder</strong> — use the button below to
              locate and load the file directly:
              <label class="file-btn">
                Open help.md
                <input type="file" accept=".md,text/markdown,text/plain" onchange={loadFromFile} />
              </label>
            </li>
            <li>
              <strong>Read it online</strong> —
              <a
                href="https://github.com/m0jimo/filipa/blob/main/public/help.md"
                target="_blank"
                rel="noopener noreferrer">github.com/m0jimo/filipa — help.md</a
              >
            </li>
          </ol>
        {:else}
          <p>
            The documentation file <code>help.md</code> could not be fetched. You can read it
            online:
            <a
              href="https://github.com/m0jimo/filipa/blob/main/public/help.md"
              target="_blank"
              rel="noopener noreferrer">github.com/m0jimo/filipa — help.md</a
            >
          </p>
        {/if}
      </div>
    {:else if markdown === null}
      <p class="loading">Loading documentation…</p>
    {:else}
      <MarkdownPreview md={markdown} />
    {/if}
  </div>
</div>

<style>
  .page {
    width: 100%;
  }

  .page-content {
    padding: 2rem;
    max-width: 860px;
    margin: 0 auto;
  }

  .loading {
    color: #888;
    font-style: italic;
  }

  .fallback {
    background: #fff8e1;
    border: 1px solid #ffe082;
    border-radius: 8px;
    padding: 1.5rem 2rem;
    color: #555;
    line-height: 1.7;
  }

  .fallback h2 {
    font-size: 1.1rem;
    font-weight: 600;
    color: #333;
    margin-bottom: 0.75rem;
  }

  .fallback p,
  .fallback ol {
    margin-bottom: 0.75rem;
  }

  .fallback ol {
    padding-left: 1.25rem;
  }

  .fallback li {
    margin-bottom: 0.5rem;
  }

  .fallback code {
    background: #f0e8c8;
    padding: 0.1em 0.35em;
    border-radius: 3px;
    font-size: 0.9em;
  }

  .fallback a {
    color: #0066cc;
    text-decoration: none;
  }

  .fallback a:hover {
    text-decoration: underline;
  }

  .file-btn {
    display: inline-block;
    margin-left: 0.5rem;
    padding: 0.3rem 0.85rem;
    background: #0066cc;
    color: #fff;
    border-radius: 6px;
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
  }

  .file-btn:hover {
    background: #0052a3;
  }

  .file-btn input {
    display: none;
  }

  :global([data-theme="dark"]) .fallback {
    background: #2a2200;
    border-color: #554400;
    color: #c0b060;
  }

  :global([data-theme="dark"]) .fallback h2 {
    color: #e8d080;
  }

  :global([data-theme="dark"]) .fallback code {
    background: #3a3000;
    color: #e8d080;
  }

  :global([data-theme="dark"]) .fallback a {
    color: #4da3ff;
  }

  :global([data-theme="dark"]) .loading {
    color: #777;
  }
</style>
