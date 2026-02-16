/**
 * Configuration service for loading and managing application settings
 */

import type { AppConfig } from "./types";
import { configDB } from "./db";

/**
 * Default configuration used as fallback
 */
export const DEFAULT_CONFIG: AppConfig = {
  theme: {
    primaryColor: "#0066cc",
    secondaryColor: "#5c9fd6",
    backgroundColor: "#ffffff",
    textColor: "#333333",
    darkMode: false,
  },
  defaultLanguage: "en",
  defaultQuestionSets: [],
  importMappings: {
    markdown: {
      name: "Unified Markdown Format",
      format: "markdown",
      description: "Simple, unified markdown format for questions and sessions",
      structure: {
        candidateSection: "^##\\s+Candidate Information$",
        sessionSection: "^##\\s+Session Information$",
        questionsSection: "^##\\s+Questions$",
        questionHeader: "^##\\s+Question\\s+(\\d+)",
        questionText: "^###\\s+Question$",
        expectedAnswer: "^###\\s+Expected Answer$",
        candidateAnswer: "^###\\s+Candidate's Answer$",
        interviewerNotes: "^###\\s+Interviewer's Notes$",
        candidateName: "^Candidate:\\s*(.*)$",
        candidateId: "^Candidate ID:\\s*(.*)$",
        sessionName: "^Session:\\s*(.*)$",
        sessionDate: "^Date:\\s*(.*)$",
        sessionInterviewers: "^Interviewers:\\s*(.*)$",
        questionId: "^Question ID:\\s*(.*)$",
        tags: "^Tags:\\s*(.*)$",
        difficulty: "^Difficulty:\\s*\\[([^\\]]+)\\]",
        questionType: "^Type:\\s*(.*)$",
        presented: "^Presented:\\s*(.*)$",
        answerRating: "^Answer Rating:\\s*(\\d+)",
      },
    },
    json: {
      name: "JSON Format",
      format: "json",
      description: "Simple JSON export format",
    },
  },
};

let cachedConfig: AppConfig | null = null;

/**
 * Load configuration from various sources with fallback strategy:
 * 1. Try to load from IndexDB (user's saved config)
 * 2. Try to load from public/config.json
 * 3. Fall back to DEFAULT_CONFIG
 */
export async function loadConfig(): Promise<AppConfig> {
  // Return cached config if available
  if (cachedConfig) {
    return cachedConfig;
  }

  try {
    // Try to load from IndexDB first (user's saved config)
    const savedConfig = await configDB.read();
    if (savedConfig) {
      cachedConfig = savedConfig;
      return savedConfig;
    }
  } catch (error) {
    console.warn("Failed to load config from IndexDB:", error);
  }

  try {
    // Try to load from public/config.json
    const response = await fetch("./config.json");
    if (response.ok) {
      const config = await response.json();
      cachedConfig = config;

      // Save to IndexDB for future use
      await configDB.save(config);

      return config;
    }
  } catch (error) {
    console.warn("Failed to load config.json:", error);
  }

  // Fall back to default config
  cachedConfig = DEFAULT_CONFIG;

  // Save default config to IndexDB
  try {
    await configDB.save(DEFAULT_CONFIG);
  } catch (error) {
    console.warn("Failed to save default config to IndexDB:", error);
  }

  return DEFAULT_CONFIG;
}

/**
 * Save configuration to IndexDB and update cache
 */
export async function saveConfig(config: AppConfig): Promise<void> {
  try {
    await configDB.save(config);
    cachedConfig = config;
  } catch (error) {
    console.error("Failed to save config:", error);
    throw error;
  }
}

/**
 * Update specific configuration values (partial update)
 */
export async function updateConfig(updates: Partial<AppConfig>): Promise<AppConfig> {
  const currentConfig = await loadConfig();
  const newConfig = { ...currentConfig, ...updates };
  await saveConfig(newConfig);
  return newConfig;
}

/**
 * Reset configuration to defaults
 */
export async function resetConfig(): Promise<AppConfig> {
  await saveConfig(DEFAULT_CONFIG);
  return DEFAULT_CONFIG;
}

/**
 * Get current configuration (from cache or load)
 */
export async function getConfig(): Promise<AppConfig> {
  return loadConfig();
}

/**
 * Clear cached configuration (forces reload on next access)
 */
export function clearConfigCache(): void {
  cachedConfig = null;
}
