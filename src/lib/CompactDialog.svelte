<script lang="ts">
  let {
    show = false,
    onClose,
    title = "",
    children,
  }: {
    show: boolean;
    onClose: () => void;
    title?: string;
    children?: import("svelte").Snippet;
  } = $props();

  let dialogRef: HTMLDivElement | null = $state(null);

  $effect(() => {
    if (show && dialogRef) {
      const cancelBtn = dialogRef.querySelector<HTMLElement>("button.secondary");
      cancelBtn?.focus();
    }
  });

  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === "Escape" && show) {
      onClose();
    }
  };

  const handleOverlayClick = (event: MouseEvent) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };
</script>

<svelte:window onkeydown={handleKeydown} />

{#if show}
  <div class="dialog-overlay" role="presentation" onclick={handleOverlayClick}>
    <div bind:this={dialogRef} class="dialog" role="dialog" aria-modal="true" aria-labelledby={title ? "dialog-title" : undefined} onclick={(e) => e.stopPropagation()}>
      {#if title}
        <div class="dialog-header">
          <h2 id="dialog-title">{title}</h2>
          <button type="button" class="close-btn" onclick={onClose} aria-label="Close dialog">
            &times;
          </button>
        </div>
      {/if}

      <div class="dialog-content">
        {@render children?.()}
      </div>
    </div>
  </div>
{/if}

<style>
  .dialog-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    cursor: pointer;
  }

  .dialog {
    background: white;
    border-radius: 8px;
    width: min(480px, 92vw);
    max-height: 80vh;
    cursor: default;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .dialog-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.25rem 1.5rem 0 1.5rem;
    flex-shrink: 0;
  }

  .dialog-header h2 {
    margin: 0;
    font-size: 1.2rem;
    color: var(--color-bg-dark);
  }

  .dialog-content {
    overflow-y: auto;
    padding: 1.25rem 1.5rem 1.5rem 1.5rem;
    flex: 1;
    min-height: 0;
  }

  .dialog-content :global(.modal-actions) {
    display: flex;
    gap: 1rem;
    justify-content: flex-end;
    margin-top: 1.5rem;
    padding-top: 1rem;
    border-top: 1px solid #eee;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 1.75rem;
    cursor: pointer;
    color: #999;
    padding: 0;
    width: 2rem;
    height: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.2s;
    line-height: 1;
  }

  .close-btn:hover {
    color: var(--color-text);
  }

  .close-btn:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
    border-radius: 4px;
  }

  :global([data-theme="dark"]) .dialog {
    background: var(--color-bg-dark-2);
  }

  :global([data-theme="dark"]) .dialog-header h2 {
    color: #ffffff;
  }

  :global([data-theme="dark"]) .close-btn:hover {
    color: #ffffff;
  }

  :global([data-theme="dark"]) .close-btn:focus-visible {
    outline-color: var(--color-primary-dark);
  }

  :global([data-theme="dark"]) .dialog-content :global(.modal-actions) {
    border-top-color: var(--color-border-dark);
  }
</style>
