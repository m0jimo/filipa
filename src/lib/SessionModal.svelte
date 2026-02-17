<script lang="ts">
  import { onMount } from "svelte";

  let {
    show = false,
    onClose,
    title = "",
    size = "medium",
    children,
  }: {
    show: boolean;
    onClose: () => void;
    title?: string;
    size?: "small" | "medium" | "large";
    children?: import("svelte").Snippet;
  } = $props();

  let modalRef: HTMLDivElement | null = $state(null);

  // Close on Escape key
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Escape" && show) {
      onClose();
    }
  }

  // Focus trap - keep focus within modal when open
  onMount(() => {
    if (show && modalRef) {
      const focusableElements = modalRef.querySelectorAll(
        "button, [href], input, select, textarea, [tabindex]:not([tabindex=\"-1\"])"
      );
      const firstElement = focusableElements[0] as HTMLElement;
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

      // Focus first element when modal opens
      firstElement?.focus();

      // Trap focus within modal
      const handleTabKey = (e: KeyboardEvent) => {
        if (e.key !== "Tab") return;

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            lastElement?.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastElement) {
            firstElement?.focus();
            e.preventDefault();
          }
        }
      };

      document.addEventListener("keydown", handleTabKey);
      return () => document.removeEventListener("keydown", handleTabKey);
    }
  });

  // Handle overlay click
  function handleOverlayClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }

  // Handle overlay keyboard events (Enter or Space on overlay)
  function handleOverlayKeydown(event: KeyboardEvent) {
    if ((event.key === "Enter" || event.key === " ") && event.target === event.currentTarget) {
      event.preventDefault();
      onClose();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if show}
  <div
    class="modal-overlay"
    role="button"
    tabindex="0"
    aria-label="Close modal"
    onclick={handleOverlayClick}
    onkeydown={handleOverlayKeydown}
  >
    <div
      bind:this={modalRef}
      class="modal {size}"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? "modal-title" : undefined}
      tabindex="-1"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
    >
      {#if title}
        <div class="modal-header">
          <h2 id="modal-title">{title}</h2>
          <button type="button" class="close-btn" onclick={onClose} aria-label="Close modal">
            &times;
          </button>
        </div>
      {/if}

      <div class="modal-content">
        {@render children?.()}
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
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

  .modal {
    background: white;
    border-radius: 8px;
    max-width: 500px;
    width: 90%;
    max-height: 90vh;
    cursor: default;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    display: flex;
    flex-direction: column;
  }

  .modal.small {
    max-width: 400px;
  }

  .modal.medium {
    max-width: 500px;
  }

  .modal.large {
    max-width: 900px;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 2rem 2rem 0 2rem;
    margin-bottom: 1.5rem;
    flex-shrink: 0;
  }

  .modal-header h2 {
    margin: 0;
    font-size: 1.5rem;
    color: #1a1a1a;
  }

  .modal-content {
    overflow-y: auto;
    padding: 0 2rem 2rem 2rem;
    flex: 1;
    min-height: 0;
  }

  .modal-content :global(textarea) {
    width: 100%;
    box-sizing: border-box;
  }

  /* Pull modal-actions out of the scrollable padding so background covers full width */
  .modal :global(.modal-actions) {
    position: sticky;
    bottom: -2rem;
    background: white;
    padding: 1.5rem 2rem 2rem 2rem;
    border-top: 1px solid #eee;
    margin-top: 1.5rem;
    margin-left: -2rem;
    margin-right: -2rem;
    flex-shrink: 0;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 2rem;
    cursor: pointer;
    color: #999;
    padding: 0;
    width: 2rem;
    height: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.2s;
  }

  .close-btn:hover {
    color: #333;
  }

  .close-btn:focus-visible {
    outline: 2px solid #0066cc;
    outline-offset: 2px;
    border-radius: 4px;
  }

  /* Dark mode support */
  :global([data-theme="dark"]) .modal {
    background: #2a2a2a;
  }

  :global([data-theme="dark"]) .modal-header h2 {
    color: #ffffff;
  }

  :global([data-theme="dark"]) .close-btn:hover {
    color: #ffffff;
  }

  :global([data-theme="dark"]) .close-btn:focus-visible {
    outline-color: #4da3ff;
  }

  :global([data-theme="dark"]) .modal :global(.modal-actions) {
    background: #2a2a2a;
    border-top-color: #444;
  }
</style>
