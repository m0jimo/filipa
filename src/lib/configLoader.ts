/**
 * Configuration loader for import mappings
 */

export interface ImportConfig {
  theme: {
    primaryColor: string;
    secondaryColor: string;
    backgroundColor: string;
    textColor: string;
    darkMode: boolean;
  };
  defaultLanguage: string;
  defaultQuestionSets: string[];
  importMappings: {
    [key: string]: {
      name: string;
      format: string;
      description: string;
      detection?: {
        questionHeader: string;
        subsectionLevel: string;
      };
      structure: {
        [key: string]: string;
      };
    };
  };
}

let cachedConfig: ImportConfig | null = null;

/**
 * Load configuration from config.json
 */
export async function loadConfig(): Promise<ImportConfig> {
  if (cachedConfig) {
    return cachedConfig;
  }

  try {
    const response = await fetch("./config.json");
    if (!response.ok) {
      throw new Error(`Failed to load config: ${response.statusText}`);
    }
    cachedConfig = await response.json();
    return cachedConfig as ImportConfig;
  } catch (error) {
    console.error("Failed to load config.json, using defaults:", error);
    // Return default config if loading fails
    return getDefaultConfig();
  }
}

/**
 * Get default configuration
 */
function getDefaultConfig(): ImportConfig {
  return {
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
        description: "Simple, unified markdown format",
        structure: {
          questionHeader: "^##\\s+Question\\s+(\\d+)",
          questionText: "^###\\s+Question$",
          expectedAnswer: "^###\\s+Expected Answer$",
          candidateAnswer: "^###\\s+Candidate's Answer$",
          interviewerNotes: "^###\\s+Interviewer's Notes$",
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
        structure: {},
      },
    },
  };
}

/**
 * Get markdown format key (simplified - only one format now)
 */
export function getMarkdownFormatKey(): string {
  return "markdown";
}
