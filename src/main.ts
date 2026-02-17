import { mount } from "svelte";
import "./app.css";
import App from "./App.svelte";
import { initDB, resetDatabase } from "./lib/db";
import { loadConfig } from "./lib/config";

// Initialize database and configuration
async function init() {
  try {
    await initDB();
    await loadConfig();
    console.log("Filipa initialized successfully");
  } catch (error) {
    console.error("Failed to initialize Filipa:", error);
  }
}

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

init();

const app = mount(App, {
  target: document.getElementById("app")!,
});

export default app;
