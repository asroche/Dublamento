// Armazenamento local em IndexedDB (projetos, cenas próprias, takes, preferências)
const DB_NAME = 'dublamento';
const DB_VER = 1;
let dbp;

function open() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('projects')) db.createObjectStore('projects', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('scenes')) db.createObjectStore('scenes', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('blobs')) db.createObjectStore('blobs');
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

async function tx(store, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    let result;
    const r = fn(s);
    if (r && 'onsuccess' in r) r.onsuccess = () => (result = r.result);
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export const db = {
  get: (store, key) => tx(store, 'readonly', s => s.get(key)),
  put: (store, val, key) => tx(store, 'readwrite', s => (key === undefined ? s.put(val) : s.put(val, key))),
  del: (store, key) => tx(store, 'readwrite', s => s.delete(key)),
  all: (store) => tx(store, 'readonly', s => s.getAll()),
  clear: (store) => tx(store, 'readwrite', s => s.clear()),
};

export const kv = {
  async get(k, def) { try { const v = await db.get('kv', k); return v === undefined ? def : v; } catch { return def; } },
  set: (k, v) => db.put('kv', v, k),
};

export async function storageInfo() {
  if (navigator.storage?.estimate) {
    const e = await navigator.storage.estimate();
    return { used: e.usage || 0, quota: e.quota || 0 };
  }
  return null;
}

export async function requestPersist() {
  try { if (navigator.storage?.persist) await navigator.storage.persist(); } catch {}
}
