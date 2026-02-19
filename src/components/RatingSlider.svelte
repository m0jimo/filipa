<script lang="ts">
  let {
    value = $bindable(0),
    onchange,
    label = "Rating",
  }: {
    value?: number;
    onchange?: (value: number) => void;
    label?: string;
  } = $props();

  const ratings = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  const getColor = (n: number): string => {
    if (n === 0) return "transparent";
    if (n <= 3) return "#e53935";
    if (n <= 6) return "#fb8c00";
    return "#43a047";
  };

  const select = (n: number) => {
    value = n;
    onchange?.(n);
  };

  const clear = () => {
    value = 0;
    onchange?.(0);
  };
</script>

<div class="rating-slider">
  <div class="rating-header">
    <span class="rating-label">{label}</span>
    {#if value > 0}
      <button type="button" class="clear-btn" onclick={clear} title="Clear rating">
        ✕
      </button>
    {/if}
  </div>

  <div class="rating-track">
    {#each ratings as n}
      {#if n > 0}
        <button
          type="button"
          class="rating-dot"
          class:selected={value === n}
          class:filled={value >= n && value > 0}
          style="--dot-color: {getColor(n)}"
          onclick={() => select(n)}
          title="{n}/10"
          aria-label="Rate {n} out of 10"
          aria-pressed={value === n}
        >
          <span class="dot-number">{n}</span>
        </button>
      {/if}
    {/each}
  </div>

  <div class="rating-labels">
    <span class="label-poor">Poor</span>
    <span class="label-medium">Medium</span>
    <span class="label-excellent">Excellent</span>
  </div>

  {#if value > 0}
    <div class="rating-value" style="color: {getColor(value)}">
      {value}/10
    </div>
  {/if}
</div>

<style>
  .rating-slider {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .rating-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .rating-label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-text-secondary);
  }

  .clear-btn {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--color-text-muted);
    font-size: 0.85rem;
    padding: 0.1rem 0.3rem;
    border-radius: 4px;
    line-height: 1;
    transition: color 0.15s, background 0.15s;
  }

  .clear-btn:hover {
    color: #d32f2f;
    background: #ffebee;
  }

  .rating-track {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.3rem 0;
  }

  .rating-dot {
    flex: 1;
    height: 28px;
    border: 2px solid var(--color-border);
    border-radius: 4px;
    background: var(--color-bg-subtle);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s;
    padding: 0;
    min-width: 0;
  }

  .rating-dot:hover {
    border-color: var(--dot-color);
    background: color-mix(in srgb, var(--dot-color) 15%, transparent);
    transform: scaleY(1.1);
  }

  .rating-dot.filled {
    background: color-mix(in srgb, var(--dot-color) 20%, transparent);
    border-color: var(--dot-color);
  }

  .rating-dot.selected {
    background: var(--dot-color);
    border-color: var(--dot-color);
    transform: scaleY(1.15);
    box-shadow: 0 2px 6px color-mix(in srgb, var(--dot-color) 50%, transparent);
  }

  .dot-number {
    font-size: 0.7rem;
    font-weight: 600;
    color: var(--color-text);
    line-height: 1;
  }

  .rating-dot.filled .dot-number,
  .rating-dot.selected .dot-number {
    color: color-mix(in srgb, var(--dot-color) 80%, #000);
  }

  .rating-dot.selected .dot-number {
    color: white;
  }

  .rating-labels {
    display: flex;
    justify-content: space-between;
    font-size: 0.7rem;
    color: var(--color-text-muted);
    padding: 0 0.1rem;
  }

  .label-poor { color: #e53935; }
  .label-medium { color: #fb8c00; }
  .label-excellent { color: #43a047; }

  .rating-value {
    font-size: 1rem;
    font-weight: 700;
    text-align: right;
    padding-right: 0.1rem;
  }

  /* Dark theme */
  :global([data-theme="dark"]) .rating-dot {
    background: var(--color-bg-dark-2);
    border-color: var(--color-border-dark);
  }

  :global([data-theme="dark"]) .rating-dot:hover {
    background: color-mix(in srgb, var(--dot-color) 25%, transparent);
  }

  :global([data-theme="dark"]) .rating-dot.filled {
    background: color-mix(in srgb, var(--dot-color) 30%, transparent);
    border-color: var(--dot-color);
  }

  :global([data-theme="dark"]) .dot-number {
    color: rgba(255, 255, 255, 0.87);
  }

  :global([data-theme="dark"]) .clear-btn:hover {
    background: rgba(211, 47, 47, 0.2);
  }
</style>
