const DB_NAME = 'myVocabularyDB';
const DB_VERSION = 2;
const STORE_NAME = 'words';

function legacySense(record) {
  const pos = String(record.partOfSpeech || '').trim();
  const meaning = String(record.koreanMeaning || '').trim();
  const example = String(record.example || '').trim();
  const translation = String(record.exampleTranslation || '').trim();
  if (!pos && !meaning && !example && !translation) return [];
  return [{ partOfSpeech: pos, meaning, example, translation }];
}

export function normalizeWordRecord(record = {}) {
  const senses = Array.isArray(record.senses)
    ? record.senses.map(s => ({
        partOfSpeech: String(s?.partOfSpeech || '').trim(),
        meaning: String(s?.meaning ?? s?.koreanMeaning ?? '').trim(),
        example: String(s?.example || '').trim(),
        translation: String(s?.translation ?? s?.exampleTranslation ?? '').trim()
      }))
    : legacySense(record);

  // v1/v2의 단일 품사/IPA 필드는 새 구조에서 제거한다.
  const { ipa, partOfSpeech, englishMeaning, koreanMeaning, example, exampleTranslation, ...rest } = record;

  return {
    ...rest,
    word: String(record.word || '').trim().toLowerCase(),
    senses
  };
}

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      const transaction = request.transaction;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('word', 'word', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
        return;
      }

      // v2 → v3 화면 구조 마이그레이션:
      // 기존 단일 품사 데이터를 senses 배열 1개로 자동 변환한다.
      const store = transaction.objectStore(STORE_NAME);
      const cursorRequest = store.openCursor();
      cursorRequest.onsuccess = event => {
        const cursor = event.target.result;
        if (!cursor) return;
        const value = cursor.value;
        if (!Array.isArray(value.senses)) {
          const migrated = normalizeWordRecord(value);
          cursor.update(migrated);
        }
        cursor.continue();
      };
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
    req.onsuccess = () => {
      resolve((req.result || []).map(normalizeWordRecord));
      db.close();
    };
    req.onerror = () => { reject(req.error); db.close(); };
  });
}

export async function addWord(wordData) {
  const normalizedData = normalizeWordRecord(wordData);
  const normalized = normalizedData.word;
  const existing = (await getAllWords()).find(w => String(w.word).toLowerCase() === normalized);
  if (existing) return { duplicate: true, existing };

  const now = new Date().toISOString();
  const record = {
    ...normalizedData,
    word: normalized,
    createdAt: now,
    updatedAt: now
  };

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
  const normalized = normalizeWordRecord(record);
  const all = await getAllWords();
  const duplicate = all.find(w => w.id !== normalized.id && w.word === normalized.word);
  if (duplicate) throw new Error(`'${normalized.word}'는 이미 다른 단어로 저장되어 있습니다.`);

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const req = store.put({ ...normalized, updatedAt: new Date().toISOString() });
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
    version: 3,
    exportedAt: new Date().toISOString(),
    words
  };
}

function normalizeImportedItem(item) {
  const normalized = normalizeWordRecord(item);
  return {
    ...normalized,
    createdAt: item.createdAt || new Date().toISOString(),
    updatedAt: item.updatedAt || new Date().toISOString()
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
    const record = normalizeImportedItem(item);
    const word = record.word;
    if (!word || existingMap.has(word)) {
      duplicates += 1;
      continue;
    }

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
