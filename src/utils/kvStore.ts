// Minimal IndexedDB key-value store (one object store, JSON-able values).
// Falls back to localStorage where IndexedDB is unavailable, e.g. some
// private-browsing modes.

const DB_NAME = "eclat";
const STORE = "kv";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

function request<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const req = run(db.transaction(STORE, mode).objectStore(STORE));
        req.onsuccess = () => resolve(req.result as T);
        req.onerror = () => reject(req.error);
      })
  );
}

export async function kvGet<T>(key: string): Promise<T | undefined> {
  try {
    return await request<T | undefined>("readonly", (s) => s.get(key));
  } catch {
    try {
      const raw = localStorage.getItem(`kv:${key}`);
      return raw ? (JSON.parse(raw) as T) : undefined;
    } catch {
      return undefined;
    }
  }
}

export async function kvSet<T>(key: string, value: T): Promise<void> {
  try {
    await request("readwrite", (s) => s.put(value, key));
  } catch {
    try {
      localStorage.setItem(`kv:${key}`, JSON.stringify(value));
    } catch {
      // storage unavailable — the queue still works in memory for this session
    }
  }
}
