<script lang="ts">
  import MarkdownPreview from "./MarkdownPreview.svelte";

  let { md }: { md: string } = $props();

  let isExpanded = $state(false);
  let textRef: HTMLDivElement | null = $state(null);
  let isTruncated = $state(false);
  let collapsedHeight = $state("80px");

  const measureHeight = () => {
    if (!textRef) return;
    const markdownEl = textRef.querySelector(".markdown-preview");
    if (!markdownEl) return;

    textRef.style.maxHeight = "none";

    const children = Array.from(markdownEl.children) as HTMLElement[];
    const firstChild = children[0] ?? null;
    const firstChildHeight = firstChild ? firstChild.offsetHeight : 0;
    const fullScrollHeight = (markdownEl as HTMLElement).scrollHeight;
    const hasMoreChildren = children.length > 1;

    textRef.style.maxHeight = "";

    if (firstChildHeight > 0) collapsedHeight = `${firstChildHeight + 8}px`;
    const firstChildMargin = firstChild
      ? parseFloat(getComputedStyle(firstChild).marginBottom) +
        parseFloat(getComputedStyle(firstChild).marginTop)
      : 0;
    isTruncated = hasMoreChildren || fullScrollHeight > firstChildHeight + firstChildMargin + 2;
  };

  $effect(() => {
    if (textRef) {
      requestAnimationFrame(() => {
        if (!textRef) return;
        textRef
          .querySelectorAll("img")
          .forEach((img) => img.addEventListener("load", measureHeight, { once: true }));
        measureHeight();
      });
    }
  });
</script>

<div
  class="question-text"
  class:expanded={isExpanded}
  class:truncated={isTruncated}
  style:--collapsed-height={collapsedHeight}
  bind:this={textRef}
>
  <MarkdownPreview {md} />
</div>

{#if isTruncated}
  <button type="button" class="expand-btn" onclick={() => (isExpanded = !isExpanded)}>
    {isExpanded ? "▲ Show less" : "▼ See more"}
  </button>
{/if}

<style>
  .question-text {
    font-size: 0.9rem;
    max-height: var(--collapsed-height, 80px);
    overflow: hidden;
    position: relative;
    transition: max-height 0.3s ease;
  }

  .question-text.expanded {
    max-height: none;
  }

  .question-text.truncated::after {
    content: "";
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 12px;
    background: linear-gradient(
      to bottom,
      transparent,
      var(--question-text-fade-color, var(--color-bg))
    );
    pointer-events: none;
  }

  .question-text.truncated.expanded::after {
    display: none;
  }

  .question-text :global(.markdown-preview) {
    font-size: 0.9rem;
  }

  .question-text :global(.markdown-preview p) {
    margin-top: 0;
  }

  .question-text :global(.markdown-preview h1),
  .question-text :global(.markdown-preview h2),
  .question-text :global(.markdown-preview h3) {
    font-size: 1rem;
    margin-top: 0.5rem;
    margin-bottom: 0.25rem;
  }

  .expand-btn {
    width: 100%;
    margin-top: 0.25rem;
    padding: 0.25rem 0.5rem;
    background: var(--color-bg-subtle);
    border: 1px solid var(--color-border);
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.8rem;
    color: var(--color-primary);
    font-weight: 500;
    text-align: center;
    transition:
      background 0.15s,
      border-color 0.15s;
  }

  .expand-btn:hover {
    background: #e0e0e0;
    border-color: var(--color-primary);
  }

  :global([data-theme="dark"]) .expand-btn {
    background: #3a3a3a;
    border-color: #555;
  }

  :global([data-theme="dark"]) .expand-btn:hover {
    background: #4a4a4a;
    border-color: var(--color-primary);
  }
</style>
