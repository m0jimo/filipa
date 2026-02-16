<script lang="ts">
  import { link } from "svelte-spa-router";
  import Navigation from "../lib/Navigation.svelte";
  import questionCatalogSvg from "../assets/filipa-question-catalog.svg";
  import interviewerWindowSvg from "../assets/filipa-interviewer-window.svg";
</script>

<div class="home-page">
  <Navigation />
  <div class="cards-container">
    <a href="#/questions" use:link class="card">
      <img src={questionCatalogSvg} alt="Questions Catalog" class="card-icon" />
      <span class="card-label">Questions Catalog</span>
    </a>
    <a href="#/candidates" use:link class="card">
      <img src={interviewerWindowSvg} alt="Candidates" class="card-icon" />
      <span class="card-label">Candidates</span>
    </a>
  </div>
</div>

<style>
  .home-page {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  .cards-container {
    flex: 1;
    display: flex;
    flex-direction: row;
    justify-content: center;
    align-items: center;
    gap: 2rem;
    padding: 3rem 2rem;
  }

  .card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.25rem;
    padding: 2.5rem 3rem;
    border: 2px solid #e0e0e0;
    border-radius: 12px;
    text-decoration: none;
    color: inherit;
    background: white;
    transition:
      border-color 0.2s,
      box-shadow 0.2s,
      transform 0.15s;
    cursor: pointer;
    min-width: 200px;
  }

  .card:hover {
    border-color: #0066cc;
    box-shadow: 0 4px 16px rgba(0, 102, 204, 0.15);
    transform: translateY(-2px);
  }

  .card-icon {
    width: 6rem;
    height: 6rem;
    object-fit: contain;
  }

  .card-label {
    font-size: 1.1rem;
    font-weight: 600;
    color: #333;
  }

  .card:hover .card-label {
    color: #0066cc;
  }

  @media (max-width: 600px) {
    .cards-container {
      flex-direction: column;
    }

    .card {
      width: 100%;
      max-width: 280px;
    }
  }

  :global([data-theme="dark"]) .card {
    background: #1a1a1a;
    border-color: #333;
    color: #e0e0e0;
  }

  :global([data-theme="dark"]) .card:hover {
    border-color: #4da3ff;
    box-shadow: 0 4px 16px rgba(77, 163, 255, 0.15);
  }

  :global([data-theme="dark"]) .card-label {
    color: #e0e0e0;
  }

  :global([data-theme="dark"]) .card:hover .card-label {
    color: #4da3ff;
  }
</style>
