const DB_NAME = 'myVocabularyDB';
const DB_VERSION = 1;
const STORE_NAME = 'words';

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('word', 'word', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function tx(mode, callback) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    const result = callback(store);
    transaction.oncomplete = () => { db.close(); resolve(result?.result ?? result); };
    transaction.onerror = () => { db.close(); reject(transaction.error); };
  }));
}

export async function getAllWords() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const req = transaction.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => { resolve(req.result || []); db.close(); };
    req.onerror = () => { reject(req.error); db.close(); };
  });
}

export async function addWord(wordData) {
  const normalized = String(wordData.word || '').trim().toLowerCase();
  const existing = (await getAllWords()).find(w => String(w.word).toLowerCase() === normalized);
  if (existing) return { duplicate: true, existing };
  const now = new Date().toISOString();
  const record = { ...wordData, word: normalized, createdAt: now, updatedAt: now };
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const req = transaction.objectStore(STORE_NAME).add(record);
    req.onsuccess = () => resolve({ duplicate: false, id: req.result });
    req.onerror = () => reject(req.error);
    transaction.oncomplete = () => db.close();
  });
}

export async function updateWord(record) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const req = store.put({ ...record, word: String(record.word || '').trim().toLowerCase(), updatedAt: new Date().toISOString() });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    transaction.oncomplete = () => db.close();
  });
}

export async function deleteWord(id) {
  return tx('readwrite', store => store.delete(Number(id)));
}

export async function clearWords() {
  return tx('readwrite', store => store.clear());
}

export async function exportBackup() {
  const words = await getAllWords();
  return {
    app: 'my-vocabulary-pwa',
    version: 1,
    exportedAt: new Date().toISOString(),
    words
  };
}

export async function importBackup(payload) {
  if (!payload || payload.app !== 'my-vocabulary-pwa' || !Array.isArray(payload.words)) {
    throw new Error('이 앱에서 만든 올바른 백업 파일이 아닙니다.');
  }
  const current = await getAllWords();
  const existingMap = new Set(current.map(w => String(w.word || '').toLowerCase()));
  let added = 0;
  let duplicates = 0;
  for (const item of payload.words) {
    const word = String(item.word || '').trim().toLowerCase();
    if (!word || existingMap.has(word)) { duplicates += 1; continue; }
    const record = {
      word,
      ipa: String(item.ipa || ''),
      partOfSpeech: String(item.partOfSpeech || ''),
      englishMeaning: String(item.englishMeaning || ''),
      koreanMeaning: String(item.koreanMeaning || ''),
      example: String(item.example || ''),
      exampleTranslation: String(item.exampleTranslation || ''),
      createdAt: item.createdAt || new Date().toISOString(),
      updatedAt: item.updatedAt || new Date().toISOString()
    };
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const t = db.transaction(STORE_NAME, 'readwrite');
      const req = t.objectStore(STORE_NAME).add(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      t.oncomplete = () => db.close();
    });
    existingMap.add(word);
    added += 1;
  }
  return { total: payload.words.length, added, duplicates };
}
