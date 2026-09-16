const API_BASE = 'https://api.dictionaryapi.dev/api/v2/entries/en/';

function stripSlashes(text = '') {
  return String(text).trim().replace(/^\//, '').replace(/\/$/, '');
}

function pickPhonetic(entry) {
  const list = Array.isArray(entry.phonetics) ? entry.phonetics : [];
  const withText = list.filter(p => p && p.text);
  const explicitUS = withText.find(p => /(?:_us_|\/us\/|us[-_])/i.test(p.audio || ''));
  if (explicitUS) return { text: stripSlashes(explicitUS.text), note: '미국식 음원과 연결된 발음기호' };
  if (entry.phonetic) return { text: stripSlashes(entry.phonetic), note: '사전 제공 발음기호(지역 표기 없음)' };
  if (withText[0]) return { text: stripSlashes(withText[0].text), note: '사전 제공 발음기호(지역 표기 없음)' };
  return { text: '', note: '발음기호 정보 없음' };
}

function normalizeEntry(entry) {
  const meanings = (entry.meanings || []).map((m, meaningIndex) => ({
    id: `m-${meaningIndex}`,
    partOfSpeech: m.partOfSpeech || '',
    definitions: (m.definitions || []).map((d, definitionIndex) => ({
      id: `m-${meaningIndex}-d-${definitionIndex}`,
      definition: d.definition || '',
      example: d.example || '',
      synonyms: d.synonyms || [],
      antonyms: d.antonyms || []
    })).filter(d => d.definition)
  })).filter(m => m.definitions.length);

  const phonetic = pickPhonetic(entry);
  return {
    word: entry.word || '',
    ipa: phonetic.text,
    ipaNote: phonetic.note,
    meanings
  };
}

export async function getWordData(word, { signal } = {}) {
  const clean = String(word || '').trim().toLowerCase();
  if (!clean) throw new Error('검색할 단어를 입력해 주세요.');
  const response = await fetch(`${API_BASE}${encodeURIComponent(clean)}`, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
    signal
  });
  if (response.status === 404) throw new Error('단어 정보를 찾지 못했습니다. 철자를 확인해 주세요.');
  if (!response.ok) throw new Error(`사전 서버 오류(${response.status})가 발생했습니다.`);
  const data = await response.json();
  if (!Array.isArray(data) || !data.length) throw new Error('단어 정보를 찾지 못했습니다.');
  const normalized = normalizeEntry(data[0]);
  if (!normalized.meanings.length) throw new Error('뜻 정보를 찾지 못했습니다. 직접 입력해 저장할 수 있습니다.');
  return normalized;
}

export const DICTIONARY_INFO = {
  name: 'Free Dictionary API',
  homepage: 'https://dictionaryapi.dev/',
  endpoint: API_BASE,
  notes: 'API Key 없이 영어 뜻·품사·일부 예문·발음기호를 조회합니다. 한국어 뜻/해석은 자동 제공하지 않습니다.'
};
