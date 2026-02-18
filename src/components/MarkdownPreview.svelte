<script lang="ts" context="module">
  import { Marked } from "marked";
  import { markedHighlight } from "marked-highlight";
  import hljs from "highlight.js/lib/core";
  import javascript from "highlight.js/lib/languages/javascript";
  import typescript from "highlight.js/lib/languages/typescript";
  import python from "highlight.js/lib/languages/python";
  import java from "highlight.js/lib/languages/java";
  import sql from "highlight.js/lib/languages/sql";
  import csharp from "highlight.js/lib/languages/csharp";
  import "highlight.js/styles/github.css";

  hljs.registerLanguage("javascript", javascript);
  hljs.registerLanguage("typescript", typescript);
  hljs.registerLanguage("python", python);
  hljs.registerLanguage("java", java);
  hljs.registerLanguage("sql", sql);
  hljs.registerLanguage("csharp", csharp);

  // Create and configure marked instance once at module level
  const markedInstance = new Marked(
    markedHighlight({
      langPrefix: "hljs language-",
      highlight(code, lang) {
        if (lang && hljs.getLanguage(lang)) {
          try {
            return hljs.highlight(code, { language: lang }).value;
          } catch (err: unknown) {
            console.error("Highlighting error:", err);
            return code;
          }
        }
        // Fallback to auto-detection
        try {
          return hljs.highlightAuto(code).value;
        } catch {
          return code;
        }
      },
    })
  );

  markedInstance.setOptions({
    breaks: false,
    gfm: true,
  });
</script>

<script lang="ts">
  interface Props {
    md: string;
  }

  const { md }: Props = $props();

  // Parse markdown to HTML
  const html = $derived(markedInstance.parse(md) as string);
</script>

<div class="markdown-preview">
  <!-- eslint-disable-next-line svelte/no-at-html-tags -- intentional: rendering sanitized markdown -->
  {@html html}
</div>

<style>
  .markdown-preview {
    line-height: 1.6;
    color: var(--color-text);
  }

  .markdown-preview :global(h1),
  .markdown-preview :global(h2),
  .markdown-preview :global(h3),
  .markdown-preview :global(h4),
  .markdown-preview :global(h5),
  .markdown-preview :global(h6) {
    margin-top: 1.5em;
    margin-bottom: 0.5em;
    font-weight: 600;
  }

  .markdown-preview :global(h1) {
    font-size: 2em;
    border-bottom: 1px solid #eee;
    padding-bottom: 0.3em;
  }

  .markdown-preview :global(h2) {
    font-size: 1.5em;
    border-bottom: 1px solid #eee;
    padding-bottom: 0.3em;
  }

  .markdown-preview :global(h3) {
    font-size: 1.25em;
  }

  .markdown-preview :global(p) {
    margin-top: 0;
    margin-bottom: 1em;
  }

  .markdown-preview :global(code) {
    background-color: #f6f8fa;
    padding: 0.2em 0.4em;
    border-radius: 3px;
    font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, "Courier New", monospace;
    font-size: 0.9em;
    color: #e01e5a;
  }

  .markdown-preview :global(pre) {
    background-color: #f6f8fa;
    padding: 1em;
    border-radius: 6px;
    overflow-x: auto;
    border: 1px solid #e1e4e8;
    line-height: 1.6;
    margin: 1em 0;
  }

  .markdown-preview :global(pre code) {
    background-color: transparent;
    padding: 0;
    color: inherit;
    font-size: 0.95em;
    display: block;
    white-space: pre;
    word-wrap: normal;
  }

  .markdown-preview :global(pre code.hljs) {
    padding: 0;
    background: transparent;
  }

  .markdown-preview :global(blockquote) {
    border-left: 4px solid var(--color-border);
    padding-left: 1em;
    margin-left: 0;
    color: var(--color-text-secondary);
  }

  .markdown-preview :global(ul),
  .markdown-preview :global(ol) {
    padding-left: 2em;
    margin-bottom: 1em;
  }

  .markdown-preview :global(li) {
    margin-bottom: 0.25em;
  }

  .markdown-preview :global(a) {
    color: #0366d6;
    text-decoration: none;
  }

  .markdown-preview :global(a:hover) {
    text-decoration: underline;
  }

  .markdown-preview :global(table) {
    border-collapse: collapse;
    width: 100%;
    margin-bottom: 1em;
  }

  .markdown-preview :global(th),
  .markdown-preview :global(td) {
    border: 1px solid var(--color-border);
    padding: 0.5em;
    text-align: left;
  }

  .markdown-preview :global(th) {
    background-color: #f6f8fa;
    font-weight: 600;
  }

  .markdown-preview :global(img) {
    max-width: 100%;
    height: auto;
  }

  .markdown-preview :global(hr) {
    border: none;
    border-top: 1px solid #eee;
    margin: 1.5em 0;
  }

  /* Dark theme support */
  :global([data-theme="dark"]) .markdown-preview {
    color: #e0e0e0;
  }

  :global([data-theme="dark"]) .markdown-preview :global(h1),
  :global([data-theme="dark"]) .markdown-preview :global(h2),
  :global([data-theme="dark"]) .markdown-preview :global(h3),
  :global([data-theme="dark"]) .markdown-preview :global(h4),
  :global([data-theme="dark"]) .markdown-preview :global(h5),
  :global([data-theme="dark"]) .markdown-preview :global(h6) {
    color: #ffffff;
    border-bottom-color: var(--color-border-dark);
  }

  :global([data-theme="dark"]) .markdown-preview :global(code) {
    background-color: #2d2d2d;
    color: #f97583;
  }

  :global([data-theme="dark"]) .markdown-preview :global(pre) {
    background-color: #1e1e1e;
    border-color: var(--color-border-dark);
  }

  :global([data-theme="dark"]) .markdown-preview :global(pre code) {
    color: #e0e0e0;
  }

  :global([data-theme="dark"]) .markdown-preview :global(blockquote) {
    border-left-color: #555;
    color: var(--color-text-muted);
  }

  :global([data-theme="dark"]) .markdown-preview :global(a) {
    color: #58a6ff;
  }

  :global([data-theme="dark"]) .markdown-preview :global(table) {
    border-color: var(--color-border-dark);
  }

  :global([data-theme="dark"]) .markdown-preview :global(th),
  :global([data-theme="dark"]) .markdown-preview :global(td) {
    border-color: var(--color-border-dark);
  }

  :global([data-theme="dark"]) .markdown-preview :global(th) {
    background-color: #2d2d2d;
  }

  :global([data-theme="dark"]) .markdown-preview :global(hr) {
    border-top-color: var(--color-border-dark);
  }
</style>
