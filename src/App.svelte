<script lang="ts">
  import { onMount } from "svelte";
  import Router from "svelte-spa-router";
  import Home from "./pages/Home.svelte";
  import CandidateList from "./pages/CandidateList.svelte";
  import CandidateDetail from "./pages/CandidateDetail.svelte";
  import SessionInterview from "./pages/SessionInterview.svelte";
  import CandidateView from "./pages/CandidateView.svelte";
  import QuestionCatalog from "./pages/QuestionCatalog.svelte";
  import About from "./pages/About.svelte";
  import Settings from "./pages/Settings.svelte";
  import QuestionSetDetail from "./pages/QuestionSetDetail.svelte";
  import QuestionSets from "./pages/QuestionSets.svelte";
  import Help from "./pages/Help.svelte";
  import { themeStore } from "./lib/themeStore";

  const routes = {
    "/": Home,
    "/candidates": CandidateList,
    "/questions": QuestionCatalog,
    "/candidate/:candidateId": CandidateDetail,
    "/session/:sessionId": SessionInterview,
    "/candidate-view/:sessionId": CandidateView,
    "/about": About,
    "/settings": Settings,
    "/question-sets": QuestionSets,
    "/question-sets/:setId": QuestionSetDetail,
    "/help": Help,
  };

  onMount(() => {
    themeStore.initialize();
  });
</script>

<main>
  <Router {routes} />
</main>

<style>
  main {
    width: 100%;
    min-height: 100vh;
    background-color: inherit;
    color: inherit;
  }
</style>
