<script lang="ts">
  import { link } from "svelte-spa-router";
</script>

<div class="page">
  <h1>About Page</h1>
  <p>This is the about page with information about this application.</p>
  <nav>
    <a href="#/" use:link>Go to Home</a>
  </nav>
</div>

<style>
  .page {
    padding: 2rem;
  }

  h1 {
    color: #ff3e00;
    margin-bottom: 1rem;
  }

  p {
    font-size: 1.2rem;
    margin-bottom: 1.5rem;
  }

  nav a {
    display: inline-block;
    padding: 0.5rem 1rem;
    background: #ff3e00;
    color: white;
    text-decoration: none;
    border-radius: 4px;
    transition: background 0.3s;
  }

  nav a:hover {
    background: #d63200;
  }

  :global([data-theme="dark"]) p {
    color: #e0e0e0;
  }
</style>
