/**
 * IndexDB service layer for Filipa application
 * Provides type-safe CRUD operations for all data stores
 */

import type {
  Candidate,
  Session,
  QuestionSet,
  Question,
  SessionQuestion,
  AppConfig,
} from "./types";

// ============================================================================
// Constants
// ============================================================================

const DB_NAME = "FilipaDB";
const DB_VERSION = 4;

// Object store names
export const STORES = {
  CANDIDATES: "candidates",
  SESSIONS: "sessions",
  QUESTION_SETS: "questionSets",
  QUESTIONS: "questions",
  SESSION_QUESTIONS: "sessionQuestions",
  CONFIG: "config",
} as const;

// ============================================================================
// Database Initialization
// ============================================================================

let dbInstance: IDBDatabase | null = null;

/**
 * Initialize the IndexDB database with all required object stores
 */
export async function initDB(): Promise<IDBDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error(`Failed to open database: ${request.error?.message}`));
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const oldVersion = (event as IDBVersionChangeEvent).oldVersion;

      // Create object stores if they don't exist
      if (!db.objectStoreNames.contains(STORES.CANDIDATES)) {
        const candidateStore = db.createObjectStore(STORES.CANDIDATES, { keyPath: "id" });
        candidateStore.createIndex("createdAt", "createdAt", { unique: false });
        candidateStore.createIndex("displayName", "displayName", { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.SESSIONS)) {
        const sessionStore = db.createObjectStore(STORES.SESSIONS, { keyPath: "id" });
        sessionStore.createIndex("candidateId", "candidateId", { unique: false });
        sessionStore.createIndex("date", "date", { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.QUESTION_SETS)) {
        const questionSetStore = db.createObjectStore(STORES.QUESTION_SETS, { keyPath: "id" });
        questionSetStore.createIndex("name", "name", { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.QUESTIONS)) {
        const questionStore = db.createObjectStore(STORES.QUESTIONS, { keyPath: "id" });
        questionStore.createIndex("tags", "tags", { unique: false, multiEntry: true });
        questionStore.createIndex("questionType", "questionType", { unique: false });
        questionStore.createIndex("hash", "hash", { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.SESSION_QUESTIONS)) {
        const sessionQuestionStore = db.createObjectStore(STORES.SESSION_QUESTIONS, {
          keyPath: "id",
        });
        sessionQuestionStore.createIndex("sessionId", "sessionId", { unique: false });
        sessionQuestionStore.createIndex("order", "order", { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.CONFIG)) {
        db.createObjectStore(STORES.CONFIG, { keyPath: "id" });
      }

      // Migration from version 1 to 2: Add hash index to questions store
      if (oldVersion < 2 && db.objectStoreNames.contains(STORES.QUESTIONS)) {
        const transaction = (event.target as IDBOpenDBRequest).transaction!;
        const questionStore = transaction.objectStore(STORES.QUESTIONS);

        // Check if the index already exists before creating it
        if (!questionStore.indexNames.contains("hash")) {
          questionStore.createIndex("hash", "hash", { unique: false });
        }
      }

      // Migration from version 2 to 3: Rename 'rating' to 'difficulty' in all questions
      if (oldVersion < 3 && db.objectStoreNames.contains(STORES.QUESTIONS)) {
        const transaction = (event.target as IDBOpenDBRequest).transaction!;
        const questionStore = transaction.objectStore(STORES.QUESTIONS);

        // Use cursor to iterate and update all questions
        const cursorRequest = questionStore.openCursor();
        cursorRequest.onsuccess = (e) => {
          const cursor = (e.target as IDBRequest).result;
          if (cursor) {
            const question = cursor.value;
            if (question.rating !== undefined) {
              question.difficulty = question.rating;
              delete question.rating;
              cursor.update(question);
            }
            cursor.continue();
          }
        };
      }
    };
  });
}

/**
 * Get the database instance (initializes if needed)
 */
async function getDB(): Promise<IDBDatabase> {
  if (!dbInstance) {
    await initDB();
    // Run migration check after initialization
    await ensureQuestionMigration();
  }
  return dbInstance!;
}

/**
 * Ensure all questions have difficulty field (migration safety check)
 */
async function ensureQuestionMigration(): Promise<void> {
  if (!dbInstance) return;

  try {
    const transaction = dbInstance.transaction(STORES.QUESTIONS, "readwrite");
    const store = transaction.objectStore(STORES.QUESTIONS);
    const getAllRequest = store.getAll();

    await new Promise<void>((resolve, reject) => {
      getAllRequest.onsuccess = async () => {
        const questions = getAllRequest.result;
        let needsUpdate = false;

        for (const question of questions) {
          if (question.rating !== undefined && question.difficulty === undefined) {
            question.difficulty = question.rating;
            delete question.rating;
            needsUpdate = true;
            await new Promise<void>((res, rej) => {
              const putRequest = store.put(question);
              putRequest.onsuccess = () => res();
              putRequest.onerror = () => rej(putRequest.error);
            });
          } else if (question.difficulty === undefined) {
            // If neither rating nor difficulty exists, set empty array
            question.difficulty = [];
            needsUpdate = true;
            await new Promise<void>((res, rej) => {
              const putRequest = store.put(question);
              putRequest.onsuccess = () => res();
              putRequest.onerror = () => rej(putRequest.error);
            });
          }
        }

        if (needsUpdate) {
          console.log("✅ Question migration completed");
        }
        resolve();
      };

      getAllRequest.onerror = () => reject(getAllRequest.error);
    });
  } catch (error) {
    console.error("Question migration error:", error);
    // Don't throw - allow app to continue
  }
}

// ============================================================================
// Generic CRUD Operations
// ============================================================================

/**
 * Create (add) a new record to a store
 */
async function create<T>(storeName: string, data: T): Promise<T> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    const request = store.add(data);

    request.onsuccess = () => resolve(data);
    request.onerror = () => reject(new Error(`Failed to create record: ${request.error?.message}`));
  });
}

/**
 * Read (get) a single record by ID
 */
async function read<T>(storeName: string, id: string): Promise<T | null> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readonly");
    const store = transaction.objectStore(storeName);
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(new Error(`Failed to read record: ${request.error?.message}`));
  });
}

/**
 * Update an existing record
 */
async function update<T>(storeName: string, data: T): Promise<T> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    const request = store.put(data);

    request.onsuccess = () => resolve(data);
    request.onerror = () => reject(new Error(`Failed to update record: ${request.error?.message}`));
  });
}

/**
 * Delete a record by ID
 */
async function remove(storeName: string, id: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error(`Failed to delete record: ${request.error?.message}`));
  });
}

/**
 * List all records in a store
 */
async function list<T>(storeName: string): Promise<T[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readonly");
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(new Error(`Failed to list records: ${request.error?.message}`));
  });
}

/**
 * Query records by index
 */
async function queryByIndex<T>(
  storeName: string,
  indexName: string,
  value: string | number | Date
): Promise<T[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readonly");
    const store = transaction.objectStore(storeName);
    const index = store.index(indexName);
    const request = index.getAll(value);

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () =>
      reject(new Error(`Failed to query by index: ${request.error?.message}`));
  });
}

/**
 * Clear all records from a store
 */
async function clear(storeName: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error(`Failed to clear store: ${request.error?.message}`));
  });
}

// ============================================================================
// Candidate Operations
// ============================================================================

const normalizeCandidate = (candidate: Candidate | null): Candidate | null => {
  if (!candidate) return null;
  if (candidate.displayName) return candidate;
  // Backfill displayName from legacy firstName/lastName fields
  const raw = candidate as unknown as Record<string, string>;
  const fallback = [raw["firstName"], raw["lastName"]].filter(Boolean).join(" ").trim();
  return { ...candidate, displayName: fallback || "Unknown" };
};

export const candidateDB = {
  create: (candidate: Candidate) => create<Candidate>(STORES.CANDIDATES, candidate),
  read: async (id: string) => normalizeCandidate(await read<Candidate>(STORES.CANDIDATES, id)),
  get: async (id: string) => normalizeCandidate(await read<Candidate>(STORES.CANDIDATES, id)),
  update: (candidate: Candidate) => update<Candidate>(STORES.CANDIDATES, candidate),
  delete: (id: string) => remove(STORES.CANDIDATES, id),
  list: async () => (await list<Candidate>(STORES.CANDIDATES)).map(c => normalizeCandidate(c)!),
  clear: () => clear(STORES.CANDIDATES),
};

// ============================================================================
// Session Operations
// ============================================================================

export const sessionDB = {
  create: (session: Session) => create<Session>(STORES.SESSIONS, session),
  read: (id: string) => read<Session>(STORES.SESSIONS, id),
  get: (id: string) => read<Session>(STORES.SESSIONS, id), // Alias for read
  update: (session: Session) => update<Session>(STORES.SESSIONS, session),
  delete: (id: string) => remove(STORES.SESSIONS, id),
  list: () => list<Session>(STORES.SESSIONS),
  listByCandidateId: (candidateId: string) =>
    queryByIndex<Session>(STORES.SESSIONS, "candidateId", candidateId),
  clear: () => clear(STORES.SESSIONS),
};

// ============================================================================
// Question Set Operations
// ============================================================================

export const questionSetDB = {
  create: (questionSet: QuestionSet) => create<QuestionSet>(STORES.QUESTION_SETS, questionSet),
  read: (id: string) => read<QuestionSet>(STORES.QUESTION_SETS, id),
  update: (questionSet: QuestionSet) => update<QuestionSet>(STORES.QUESTION_SETS, questionSet),
  delete: (id: string) => remove(STORES.QUESTION_SETS, id),
  list: () => list<QuestionSet>(STORES.QUESTION_SETS),
  clear: () => clear(STORES.QUESTION_SETS),
};

// ============================================================================
// Question Operations
// ============================================================================

export const questionDB = {
  create: (question: Question) => create<Question>(STORES.QUESTIONS, question),
  read: (id: string) => read<Question>(STORES.QUESTIONS, id),
  get: (id: string) => read<Question>(STORES.QUESTIONS, id), // Alias for read
  update: (question: Question) => update<Question>(STORES.QUESTIONS, question),
  delete: (id: string) => remove(STORES.QUESTIONS, id),
  list: () => list<Question>(STORES.QUESTIONS),
  listByTag: (tag: string) => queryByIndex<Question>(STORES.QUESTIONS, "tags", tag),
  listByType: (type: string) => queryByIndex<Question>(STORES.QUESTIONS, "questionType", type),
  listByHash: (hash: string) => queryByIndex<Question>(STORES.QUESTIONS, "hash", hash),
  clear: () => clear(STORES.QUESTIONS),
};

// ============================================================================
// Session Question Operations
// ============================================================================

export const sessionQuestionDB = {
  create: (sessionQuestion: SessionQuestion) =>
    create<SessionQuestion>(STORES.SESSION_QUESTIONS, sessionQuestion),
  read: (id: string) => read<SessionQuestion>(STORES.SESSION_QUESTIONS, id),
  update: (sessionQuestion: SessionQuestion) =>
    update<SessionQuestion>(STORES.SESSION_QUESTIONS, sessionQuestion),
  delete: (id: string) => remove(STORES.SESSION_QUESTIONS, id),
  list: () => list<SessionQuestion>(STORES.SESSION_QUESTIONS),
  listBySessionId: (sessionId: string) =>
    queryByIndex<SessionQuestion>(STORES.SESSION_QUESTIONS, "sessionId", sessionId),
  clear: () => clear(STORES.SESSION_QUESTIONS),
};

// ============================================================================
// Configuration Operations
// ============================================================================

const CONFIG_KEY = "app-config";

export const configDB = {
  read: async (): Promise<AppConfig | null> => {
    return read<AppConfig>(STORES.CONFIG, CONFIG_KEY);
  },
  save: async (config: AppConfig): Promise<AppConfig> => {
    return update<AppConfig>(STORES.CONFIG, { ...config, id: CONFIG_KEY } as AppConfig & {
      id: string;
    });
  },
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate a unique ID (simple GUID generator)
 */
export function generateId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Generate a hash from question content for duplicate detection
 */
export function generateQuestionHash(
  question: string,
  tags: string[],
  questionType: string
): string {
  // Normalize the content
  const normalizedQuestion = question.trim().toLowerCase();
  const normalizedTags = tags
    .map((t) => t.trim().toLowerCase())
    .sort()
    .join(",");
  const normalizedType = questionType.trim().toLowerCase();
  const content = `${normalizedQuestion}|${normalizedTags}|${normalizedType}`;

  // Simple hash function (DJB2)
  let hash = 5381;
  for (let i = 0; i < content.length; i++) {
    hash = (hash << 5) + hash + content.charCodeAt(i);
  }

  return hash.toString(36);
}

/**
 * Export entire database to JSON
 */
export async function exportDatabase(): Promise<Record<string, unknown[]>> {
  const db = await getDB();
  const storeNames = Array.from(db.objectStoreNames);
  const data: Record<string, unknown[]> = {};

  for (const storeName of storeNames) {
    data[storeName] = await list(storeName);
  }

  return data;
}

/**
 * Returns true when none of the main content stores contain any records.
 */
export async function isDatabaseEmpty(): Promise<boolean> {
  const db = await getDB();
  const contentStores = [STORES.CANDIDATES, STORES.QUESTIONS, STORES.QUESTION_SETS, STORES.SESSIONS];
  for (const storeName of contentStores) {
    const n = await new Promise<number>((resolve, reject) => {
      const tx = db.transaction(storeName, "readonly");
      const req = tx.objectStore(storeName).count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    if (n > 0) return false;
  }
  return true;
}

/**
 * Import data into database (merge mode)
 */
export async function importDatabase(data: Record<string, unknown[]>): Promise<void> {
  const db = await getDB();

  for (const [storeName, records] of Object.entries(data)) {
    if (!db.objectStoreNames.contains(storeName)) {
      console.warn(`Store "${storeName}" does not exist, skipping import`);
      continue;
    }

    const transaction = db.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);

    for (const record of records) {
      await new Promise<void>((resolve, reject) => {
        const request = store.put(record);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }
  }
}

/**
 * Clear entire database
 */
export async function clearDatabase(): Promise<void> {
  await candidateDB.clear();
  await sessionDB.clear();
  await questionSetDB.clear();
  await questionDB.clear();
  await sessionQuestionDB.clear();
}

/**
 * Delete and recreate the entire database (use when schema changes cause issues)
 */
export async function resetDatabase(): Promise<void> {
  // Close existing connection
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }

  // Delete the database
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);

    request.onsuccess = () => {
      console.log("Database deleted successfully");
      resolve();
    };

    request.onerror = () => {
      reject(new Error(`Failed to delete database: ${request.error?.message}`));
    };

    request.onblocked = () => {
      console.warn("Database deletion blocked - close all tabs using this app");
    };
  });
}
