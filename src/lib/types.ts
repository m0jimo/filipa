/**
 * Core TypeScript types for Filipa interview assessment application
 */

// ============================================================================
// Enums
// ============================================================================

/**
 * Type of question that can be asked during interview
 */
export enum QuestionType {
  /** Rating question where candidate rates themselves 1-10 */
  Rating = "rating",
  /** Text-based question requiring verbal/written answer */
  Text = "text",
}

// ============================================================================
// Core Data Models
// ============================================================================

/**
 * Represents a candidate being interviewed
 */
export interface Candidate {
  /** Unique identifier (GUID) */
  id: string;
  /** Candidate's display name */
  displayName: string;
  /** General notes about the candidate */
  notes: string;
  /** Timestamp when candidate was created */
  createdAt: Date;
  /** Timestamp when candidate was last updated */
  updatedAt: Date;
}

/**
 * Represents an interview session (one round of interview for a candidate)
 */
export interface Session {
  /** Unique identifier (GUID) */
  id: string;
  /** Reference to the candidate */
  candidateId: string;
  /** List of interviewers conducting this session (names or IDs) */
  interviewers: string[];
  /** Name/title of the session (e.g., "Technical Round 1") */
  name: string;
  /** Date when the session is scheduled/conducted */
  date: Date;
  /** General notes about the session */
  notes: string;
  /** Index of currently active question during interview (for sync) */
  currentQuestionIndex: number;
  /** Timestamp when session was created */
  createdAt: Date;
  /** Timestamp when session was last updated */
  updatedAt: Date;
}

/**
 * Represents a set/group of related questions
 */
export interface QuestionSet {
  /** Unique identifier (GUID) */
  id: string;
  /** Name of the question set (e.g., "JavaScript Fundamentals") */
  name: string;
  /** Description/notes about this question set */
  notes: string;
  /** IDs of questions belonging to this set */
  questionIds: string[];
  /** Timestamp when question set was created */
  createdAt: Date;
  /** Timestamp when question set was last updated */
  updatedAt: Date;
}

/**
 * Represents a question in the question catalog
 */
export interface Question {
  /** Unique identifier (GUID) */
  id: string;
  /** Tags for categorization (e.g., ["frontend", "javascript", "typescript"]) */
  tags: string[];
  /** Type of question (rating or text) */
  questionType: QuestionType;
  /** The question text shown to candidate */
  question: string;
  /** Expected answer (visible only to interviewer) */
  expectedAnswer: string;
  /**
   * Difficulty levels this question applies to (e.g., [3, 4, 5, 6])
   * Used for questions where candidate rates themselves - this question
   * can be used for candidates who rate themselves at these levels
   */
  difficulty: number[];
  /** Content hash for duplicate detection */
  hash: string;
  /** Timestamp when question was created */
  createdAt: Date;
  /** Timestamp when question was last updated */
  updatedAt: Date;
}

/**
 * Represents a question instance used in a specific session with answers
 */
export interface SessionQuestion {
  /** Unique identifier (GUID) */
  id: string;
  /** Reference to the session this question belongs to */
  sessionId: string;
  /** The full question object from catalog */
  questionObj: Question;
  /** Order/position of this question in the session */
  order: number;
  /** Interviewer's notes taken during this question */
  note: string;
  /**
   * Rating given by interviewer (how well the question was answered)
   * This is different from the rating array in Question which is for categorization
   */
  questionRating: number;
  /** The actual answer given by candidate (recorded by interviewer) */
  answer: string;
  /** Whether this question has been presented to candidate */
  isPresented: boolean;
  /** Timestamp when question was added to session */
  createdAt: Date;
  /** Timestamp when question was last updated */
  updatedAt: Date;
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Theme configuration
 */
export interface ThemeConfig {
  /** Primary brand color */
  primaryColor: string;
  /** Secondary brand color */
  secondaryColor: string;
  /** Background color */
  backgroundColor: string;
  /** Text color */
  textColor: string;
  /** Dark mode enabled by default */
  darkMode: boolean;
}

/**
 * Import mapping configuration for parsing external files
 */
export interface ImportMapping {
  /** Display name for this import format */
  name?: string;
  /** File format (md, json, etc.) */
  format: "markdown" | "json";
  /** Description of this import format */
  description?: string;
  /** Structure/mapping rules for extracting data from file */
  structure?: {
    /** Regex for candidate information section */
    candidateSection?: string;
    /** Regex for session information section */
    sessionSection?: string;
    /** Regex for questions section */
    questionsSection?: string;
    /** Regex for question header/number */
    questionHeader?: string;
    /** Regex for question text */
    questionText?: string;
    /** Regex for expected answer */
    expectedAnswer?: string;
    /** Regex for candidate's answer */
    candidateAnswer?: string;
    /** Regex for interviewer's notes */
    interviewerNotes?: string;
    /** Regex for candidate name */
    candidateName?: string;
    /** Regex for candidate ID */
    candidateId?: string;
    /** Regex for session name */
    sessionName?: string;
    /** Regex for session date */
    sessionDate?: string;
    /** Regex for session interviewers */
    sessionInterviewers?: string;
    /** Regex for question ID */
    questionId?: string;
    /** Regex for tags */
    tags?: string;
    /** Regex for difficulty */
    difficulty?: string;
    /** Regex for question type */
    questionType?: string;
    /** Regex for presented status */
    presented?: string;
    /** Regex for answer rating */
    answerRating?: string;
  };
}

/**
 * Application configuration
 */
export interface AppConfig {
  /** Application theme settings */
  theme: ThemeConfig;
  /** Default language code (e.g., "en", "cs") */
  defaultLanguage: string;
  /** Paths or URLs to default question sets to load on startup */
  defaultQuestionSets: string[];
  /** Import/export mapping configurations */
  importMappings: {
    /** Mapping for markdown files */
    markdown: ImportMapping;
    /** Mapping for JSON files */
    json: ImportMapping;
  };
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Statistics for question usage
 */
export interface QuestionStats {
  /** Question ID */
  questionId: string;
  /** Number of times used in sessions */
  usageCount: number;
  /** Average rating received when used */
  averageRating: number;
}

/**
 * Session statistics
 */
export interface SessionStats {
  /** Total questions in session */
  totalQuestions: number;
  /** Questions that have been presented */
  presentedQuestions: number;
  /** Questions that have been answered */
  answeredQuestions: number;
  /** Average rating across answered questions */
  averageRating: number;
  /** Completion percentage (0-100) */
  completionPercentage: number;
}

/**
 * Export data structure for candidate folder
 */
export interface CandidateExport {
  /** Candidate information */
  candidate: Candidate;
  /** All sessions for this candidate */
  sessions: Session[];
  /** All session questions with answers */
  sessionQuestions: SessionQuestion[];
  /** Export timestamp */
  exportedAt: Date;
  /** Application version */
  version: string;
}

/**
 * Import result information
 */
export interface ImportResult {
  /** Whether import was successful */
  success: boolean;
  /** Number of items imported */
  itemsImported: number;
  /** Any errors encountered */
  errors: string[];
  /** Warnings (non-critical issues) */
  warnings: string[];
}

/**
 * Export data structure for question sets (with embedded questions)
 */
export interface QuestionSetExport {
  /** Export format version */
  version: string;
  /** ISO timestamp of export */
  exportedAt: string;
  /** Identifies this as a question set export */
  type: "questionSets";
  /** Exported question sets */
  questionSets: Array<{
    id: string;
    name: string;
    notes: string;
    questionIds: string[];
    createdAt: string;
    updatedAt: string;
  }>;
  /** All unique questions referenced by the exported sets */
  questions: Array<{
    id: string;
    question: string;
    expectedAnswer: string;
    tags: string[];
    questionType: string;
    difficulty: number[];
    hash: string;
    createdAt: string;
    updatedAt: string;
  }>;
}

/**
 * Message structure for cross-window/tab communication
 * Used by both postMessage and BroadcastChannel
 */
export interface FilipaUpdateMessage {
  /** Message type identifier */
  type: "filipa-question-update";
  /** Session ID this update relates to */
  sessionId: string;
  /** Optional timestamp when message was sent */
  timestamp?: number;
}
