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
const DB_VERSION = 6;

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

const BACKUP_DB_PREFIX = "FilipaDB_backup_v";

let dbInstance: IDBDatabase | null = null;

/**
 * Read the currently stored DB version without triggering an upgrade.
 * Returns 0 if the database does not exist yet.
 */
async function getStoredDBVersion(): Promise<number> {
  return new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME);
    request.onsuccess = () => {
      const version = request.result.version;
      request.result.close();
      resolve(version);
    };
    request.onupgradeneeded = (event) => {
      // Brand-new DB — version will be 1, close without doing anything
      (event.target as IDBOpenDBRequest).result.close();
      resolve(0);
    };
    request.onerror = () => resolve(0);
  });
}

/**
 * Create a snapshot copy of FilipaDB into FilipaDB_backup_v{version}.
 * Reads all stores from the source DB and writes them verbatim into the backup DB.
 */
export async function snapshotDB(fromVersion: number): Promise<void> {
  const backupName = `${BACKUP_DB_PREFIX}${fromVersion}`;

  // Read all data from the current live DB (open at stored version, no upgrade)
  const sourceData = await new Promise<Record<string, unknown[]>>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME);
    req.onsuccess = async () => {
      const db = req.result;
      try {
        const data = await exportFromDB(db);
        db.close();
        resolve(data);
      } catch (err) {
        db.close();
        reject(err);
      }
    };
    req.onerror = () => reject(req.error);
    req.onupgradeneeded = () => {
      // No data in a fresh DB — nothing to snapshot
      (req.result as IDBDatabase).close();
      resolve({});
    };
  });

  if (Object.keys(sourceData).length === 0) return;

  const storeNames = Object.keys(sourceData);

  // Open/create the backup DB
  await new Promise<void>((resolve, reject) => {
    const backupReq = indexedDB.open(backupName, 1);

    backupReq.onupgradeneeded = (event) => {
      const backupDB = (event.target as IDBOpenDBRequest).result;
      for (const storeName of storeNames) {
        if (!backupDB.objectStoreNames.contains(storeName)) {
          backupDB.createObjectStore(storeName, { keyPath: "id" });
        }
      }
    };

    backupReq.onsuccess = async () => {
      const backupDB = backupReq.result;
      try {
        for (const [storeName, records] of Object.entries(sourceData)) {
          if (!backupDB.objectStoreNames.contains(storeName) || records.length === 0) continue;
          const tx = backupDB.transaction(storeName, "readwrite");
          const store = tx.objectStore(storeName);
          for (const record of records) {
            await new Promise<void>((res, rej) => {
              const putReq = store.put(record);
              putReq.onsuccess = () => res();
              putReq.onerror = () => rej(putReq.error);
            });
          }
        }
        backupDB.close();
        resolve();
      } catch (err) {
        backupDB.close();
        reject(err);
      }
    };

    backupReq.onerror = () => reject(backupReq.error);
  });
}

/**
 * List all backup DB versions available in IndexedDB.
 * Returns version numbers sorted descending (newest first).
 */
export async function listBackupVersions(): Promise<number[]> {
  if (!("databases" in indexedDB)) return [];
  const databases = await indexedDB.databases();
  return databases
    .map((d) => d.name ?? "")
    .filter((name) => name.startsWith(BACKUP_DB_PREFIX))
    .map((name) => parseInt(name.slice(BACKUP_DB_PREFIX.length), 10))
    .filter((v) => !isNaN(v))
    .sort((a, b) => b - a);
}

/**
 * Export all data from a backup DB version as a .filipa-compatible object.
 */
export async function exportBackupVersion(version: number): Promise<Record<string, unknown[]>> {
  const backupName = `${BACKUP_DB_PREFIX}${version}`;
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(backupName);
    req.onsuccess = async () => {
      const db = req.result;
      try {
        const data = await exportFromDB(db);
        db.close();
        resolve(data);
      } catch (err) {
        db.close();
        reject(err);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * Delete a specific backup DB version.
 */
export async function deleteBackupVersion(version: number): Promise<void> {
  const backupName = `${BACKUP_DB_PREFIX}${version}`;
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(backupName);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Keep only the `maxToKeep` most recent backups and delete the rest.
 * Versions are sorted descending (newest first), so we delete from the tail.
 */
export async function pruneOldBackups(maxToKeep: number): Promise<void> {
  const versions = await listBackupVersions();
  const toDelete = versions.slice(maxToKeep);
  for (const version of toDelete) {
    try {
      await deleteBackupVersion(version);
    } catch (err) {
      console.warn(`Failed to delete backup v${version}:`, err);
    }
  }
}

/**
 * Initialize the IndexDB database with all required object stores
 */
export async function initDB(): Promise<IDBDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  // Check stored version before opening — if an upgrade is needed, snapshot first
  const storedVersion = await getStoredDBVersion();
  if (storedVersion > 0 && storedVersion < DB_VERSION) {
    try {
      await snapshotDB(storedVersion);
      // Prune old backups respecting the user's maxBackups preference
      const maxBackups = (() => {
        try {
          const raw = localStorage.getItem("userSettings");
          const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
          const v = parsed["maxBackups"];
          return typeof v === "number" && v >= 1 && v <= 4 ? v : 2;
        } catch {
          return 2;
        }
      })();
      await pruneOldBackups(maxBackups);
    } catch (err) {
      // Snapshot failure must not block the upgrade
      console.warn("Pre-upgrade snapshot failed:", err);
    }
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      const msg = request.error?.message ?? "";
      if (msg.includes("less than the existing version") || request.error?.name === "VersionError") {
        reject(new Error(`DB_VERSION_CONFLICT: ${msg}`));
      } else {
        reject(new Error(`Failed to open database: ${msg}`));
      }
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

      // Migration from version 5 to 6: Add currentQuestionId to sessions store
      if (oldVersion < 6 && db.objectStoreNames.contains(STORES.SESSIONS)) {
        const transaction = (event.target as IDBOpenDBRequest).transaction!;
        const sessionStore = transaction.objectStore(STORES.SESSIONS);
        // Backfill currentQuestionId: null for all existing sessions
        const cursorRequest6 = sessionStore.openCursor();
        cursorRequest6.onsuccess = (e) => {
          const cursor = (e.target as IDBRequest).result;
          if (cursor) {
            const session = cursor.value;
            if (session.currentQuestionId === undefined) {
              session.currentQuestionId = null;
              cursor.update(session);
            }
            cursor.continue();
          }
        };
      }

      // Migration from version 4 to 5: Add sortOrder index to sessions store
      if (oldVersion < 5 && db.objectStoreNames.contains(STORES.SESSIONS)) {
        const transaction = (event.target as IDBOpenDBRequest).transaction!;
        const sessionStore = transaction.objectStore(STORES.SESSIONS);
        if (!sessionStore.indexNames.contains("sortOrder")) {
          sessionStore.createIndex("sortOrder", "sortOrder", { unique: false });
        }
        // Backfill sortOrder for existing sessions using cursor
        const cursorRequest = sessionStore.openCursor();
        let order = 0;
        cursorRequest.onsuccess = (e) => {
          const cursor = (e.target as IDBRequest).result;
          if (cursor) {
            const session = cursor.value;
            if (session.sortOrder === undefined) {
              session.sortOrder = order++;
              cursor.update(session);
            }
            cursor.continue();
          }
        };
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
 * Open the database at its current stored version without triggering any upgrades.
 * Used for emergency data export when a version conflict is detected.
 */
export async function openDBAtStoredVersion(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    // Opening without a version argument opens at the current stored version
    const request = indexedDB.open(DB_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error(`Failed to open database for rescue: ${request.error?.message}`));
    // onupgradeneeded fires only for brand-new DBs — that's fine, resolve normally
    request.onupgradeneeded = () => {
      // Fresh DB, no data to rescue
    };
  });
}

/**
 * Export all data from an already-opened DB connection (used for rescue export).
 */
export async function exportFromDB(db: IDBDatabase): Promise<Record<string, unknown[]>> {
  const storeNames = Array.from(db.objectStoreNames);
  const data: Record<string, unknown[]> = {};

  for (const storeName of storeNames) {
    data[storeName] = await new Promise<unknown[]>((resolve, reject) => {
      const transaction = db.transaction(storeName, "readonly");
      const store = transaction.objectStore(storeName);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  return data;
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
  listByCandidateId: async (candidateId: string) => {
    const sessions = await queryByIndex<Session>(STORES.SESSIONS, "candidateId", candidateId);
    return sessions.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  },
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
 * Normalize a single imported record to match the current schema.
 * Applies all historical field migrations so old backups become valid on import.
 */
function normalizeImportedRecord(storeName: string, record: Record<string, unknown>): Record<string, unknown> {
  const r = { ...record };

  if (storeName === STORES.CANDIDATES) {
    // v0.3.x used firstName + lastName instead of displayName
    if (!r["displayName"]) {
      const first = (r["firstName"] as string | undefined) ?? "";
      const last = (r["lastName"] as string | undefined) ?? "";
      r["displayName"] = [first, last].filter(Boolean).join(" ").trim() || "Unknown";
    }
  }

  if (storeName === STORES.QUESTIONS) {
    // v1→v2: ensure hash exists
    if (!r["hash"]) {
      r["hash"] = "";
    }
    // v2→v3: rename rating → difficulty
    if (r["rating"] !== undefined && r["difficulty"] === undefined) {
      r["difficulty"] = r["rating"];
      delete r["rating"];
    }
    if (r["difficulty"] === undefined) {
      r["difficulty"] = [];
    }
  }

  if (storeName === STORES.SESSIONS) {
    // v4→v5: backfill sortOrder
    if (r["sortOrder"] === undefined) {
      r["sortOrder"] = 0;
    }
    // v5→v6: backfill currentQuestionId
    if (r["currentQuestionId"] === undefined) {
      r["currentQuestionId"] = null;
    }
  }

  if (storeName === STORES.SESSION_QUESTIONS) {
    // Normalize nested questionObj if present
    if (r["questionObj"] && typeof r["questionObj"] === "object") {
      r["questionObj"] = normalizeImportedRecord(STORES.QUESTIONS, r["questionObj"] as Record<string, unknown>);
    }
  }

  return r;
}

/**
 * Import data into database (merge mode).
 * Records are normalized to the current schema before insertion so old backups import cleanly.
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
      const normalized = normalizeImportedRecord(storeName, record as Record<string, unknown>);
      await new Promise<void>((resolve, reject) => {
        const request = store.put(normalized);
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
