import { mount } from "svelte";
import "./app.css";
import App from "./App.svelte";
import { resetDatabase } from "./lib/db";

// Expose database reset function for debugging
(window as unknown as { resetFilipaDB: () => Promise<void> }).resetFilipaDB = async () => {
  try {
    await resetDatabase();
    console.log("Database reset successful. Please reload the page.");
    window.location.reload();
  } catch (error) {
    console.error("Failed to reset database:", error);
  }
};

const app = mount(App, {
  target: document.getElementById("app")!,
});

export default app;
