<script lang="ts">
  import { link } from "svelte-spa-router";

  interface BreadcrumbItem {
    label: string;
    href?: string;
  }

  let { items }: { items: BreadcrumbItem[] } = $props();
</script>

<nav class="breadcrumbs" aria-label="Breadcrumb">
  <ol>
    {#each items as item, index (index)}
      <li>
        {#if item.href && index < items.length - 1}
          <a href={item.href} use:link>{item.label}</a>
        {:else}
          <span class="current">{item.label}</span>
        {/if}
        {#if index < items.length - 1}
          <span class="separator">›</span>
        {/if}
      </li>
    {/each}
  </ol>
</nav>

<style>
  .breadcrumbs {
    background: #f8f9fa;
    padding: 0.75rem 2rem;
    border-bottom: 1px solid #e0e0e0;
  }

  ol {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  li {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9rem;
  }

  a {
    color: var(--color-primary);
    text-decoration: none;
    transition: all 0.2s;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
  }

  a:hover {
    background: #e9ecef;
    text-decoration: underline;
  }

  .current {
    color: var(--color-text);
    font-weight: 500;
    padding: 0.25rem 0.5rem;
  }

  .separator {
    color: #999;
    font-size: 1.1rem;
    user-select: none;
  }

  @media (max-width: 768px) {
    .breadcrumbs {
      padding: 0.625rem 1.5rem;
    }

    li {
      font-size: 0.85rem;
    }
  }

  :global([data-theme="dark"]) .breadcrumbs {
    background: var(--color-bg-dark-2);
    border-bottom-color: var(--color-text);
  }

  :global([data-theme="dark"]) a {
    color: var(--color-primary-dark);
  }

  :global([data-theme="dark"]) a:hover {
    background: var(--color-bg-dark-3);
  }

  :global([data-theme="dark"]) .current {
    color: #ffffff;
  }

  :global([data-theme="dark"]) .separator {
    color: var(--color-text-secondary);
  }
</style>
