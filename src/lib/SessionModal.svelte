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
  let isDirty = $state(false);

  // Reset dirty state whenever modal opens/closes
  $effect(() => {
    if (show) {
      isDirty = false;
    }
  });

  // Track any input/change inside the modal content
  const markDirty = () => { isDirty = true; };

  // Close on Escape key — blocked when dirty
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Escape" && show && !isDirty) {
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

  // Handle overlay click — blocked when dirty
  function handleOverlayClick(event: MouseEvent) {
    if (event.target === event.currentTarget && !isDirty) {
      onClose();
    }
  }

</script>

<svelte:window onkeydown={handleKeydown} />

{#if show}
  <div
    class="modal-overlay"
    class:is-dirty={isDirty}
    role="presentation"
    onclick={handleOverlayClick}
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

      <div class="modal-content" oninput={markDirty} onchange={markDirty}>
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

  .modal-overlay.is-dirty {
    cursor: default;
  }

  .modal {
    background: white;
    border-radius: 8px;
    width: 90vw;
    height: 90vh;
    cursor: default;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    display: flex;
    flex-direction: column;
  }

  .modal.small {
    max-width: 400px;
    height: auto;
    max-height: 90vh;
  }

  .modal.medium {
    max-width: 600px;
    height: auto;
    max-height: 90vh;
  }

  .modal.large {
    max-width: 1200px;
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
    color: var(--color-bg-dark);
  }

  .modal-content {
    overflow-y: auto;
    padding: 0 2rem;
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .modal-content :global(textarea) {
    width: 100%;
    box-sizing: border-box;
  }

  .modal-content :global(form) {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }

  /* Pin modal-actions to the bottom of the scrollable content area */
  .modal :global(.modal-actions) {
    position: sticky;
    bottom: 0;
    background: white;
    padding: 1.5rem 2rem 2rem 2rem;
    border-top: 1px solid #eee;
    margin-top: auto;
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
    color: var(--color-text);
  }

  .close-btn:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
    border-radius: 4px;
  }

  /* Dark mode support */
  :global([data-theme="dark"]) .modal {
    background: var(--color-bg-dark-2);
  }

  :global([data-theme="dark"]) .modal-header h2 {
    color: #ffffff;
  }

  :global([data-theme="dark"]) .close-btn:hover {
    color: #ffffff;
  }

  :global([data-theme="dark"]) .close-btn:focus-visible {
    outline-color: var(--color-primary-dark);
  }

  :global([data-theme="dark"]) .modal :global(.modal-actions) {
    background: var(--color-bg-dark-2);
    border-top-color: var(--color-border-dark);
  }
</style>
