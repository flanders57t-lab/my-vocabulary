import { getAllWords, addWord, updateWord, deleteWord, clearWords, exportBackup, importBackup } from './db.js';
import { getWordData } from './dictionary.js';
import { speak } from './speech.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];
const state = { words: [], searchResult: null, abortController: null, installPrompt: null };

const els = {
  title: $('#page-title'), subtitle: $('#page-subtitle'), vocabView: $('#view-vocab'), addView: $('#view-add'),
  vocabList: $('#vocab-list'), emptyState: $('#empty-state'), wordCount: $('#word-count'), vocabSearch: $('#vocab-search'), sortSelect: $('#sort-select'),
  managePanel: $('#manage-panel'), settingsToggle: $('#settings-toggle'), backupBtn: $('#backup-btn'), restoreFile: $('#restore-file'), deleteAllBtn: $('#delete-all-btn'),
  searchForm: $('#search-form'), wordInput: $('#word-input'), searchBtn: $('#search-btn'), statusBox: $('#status-box'), resultSection: $('#result-section'),
  resultWord: $('#result-word'), resultIpa: $('#result-ipa'), ipaNote: $('#ipa-note'), meaningChoices: $('#meaning-choices'),
  editWord: $('#edit-word'), editIpa: $('#edit-ipa'), editPos: $('#edit-pos'), editEnMeaning: $('#edit-en-meaning'), editKoMeaning: $('#edit-ko-meaning'), editExample: $('#edit-example'), editTranslation: $('#edit-translation'),
  speakWordBtn: $('#speak-word-btn'), speakExampleBtn: $('#speak-example-btn'), saveWordBtn: $('#save-word-btn'),
  editDialog: $('#edit-dialog'), editForm: $('#edit-form'), dialogId: $('#dialog-id'), dialogWord: $('#dialog-word'), dialogIpa: $('#dialog-ipa'), dialogPos: $('#dialog-pos'), dialogEn: $('#dialog-en'), dialogKo: $('#dialog-ko'), dialogExample: $('#dialog-example'), dialogTranslation: $('#dialog-translation'), dialogSave: $('#dialog-save'),
  installBtn: $('#install-btn')
};

function esc(text='') {
  return String(text).replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
}

function showStatus(message, type='info') {
  els.statusBox.textContent = message;
  els.statusBox.className = `status ${type === 'info' ? '' : type}`.trim();
  els.statusBox.classList.remove('hidden');
}
function hideStatus() { els.statusBox.classList.add('hidden'); }

function switchView(view) {
  const vocab = view === 'vocab';
  els.vocabView.classList.toggle('active', vocab);
  els.addView.classList.toggle('active', !vocab);
  $$('.nav-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.view === view));
  els.title.textContent = vocab ? '내 단어장' : '새 단어';
  els.subtitle.textContent = vocab ? '저장된 단어를 확인하세요.' : '무료 사전에서 단어 정보를 찾아보세요.';
  if (!vocab) setTimeout(() => els.wordInput.focus(), 80);
}

async function refreshWords() {
  state.words = await getAllWords();
  els.wordCount.textContent = state.words.length;
  renderWords();
}

function sortedFilteredWords() {
  const q = els.vocabSearch.value.trim().toLowerCase();
  let list = state.words.filter(w => !q || String(w.word).toLowerCase().includes(q) || String(w.koreanMeaning || '').toLowerCase().includes(q));
  const sort = els.sortSelect.value;
  list.sort((a,b) => sort === 'alphabetical'
    ? String(a.word).localeCompare(String(b.word), 'en')
    : sort === 'oldest'
      ? new Date(a.createdAt) - new Date(b.createdAt)
      : new Date(b.createdAt) - new Date(a.createdAt));
  return list;
}

function renderWords() {
  const list = sortedFilteredWords();
  els.emptyState.classList.toggle('hidden', state.words.length !== 0);
  els.vocabList.innerHTML = '';
  if (!list.length && state.words.length) {
    els.vocabList.innerHTML = '<div class="empty-state"><p>검색 결과가 없습니다.</p></div>';
    return;
  }
  for (const w of list) {
    const card = document.createElement('article');
    card.className = 'vocab-card';
    card.dataset.id = w.id;
    card.innerHTML = `
      <div class="word-line"><h2 class="word-title">${esc(w.word)}</h2><button class="speak-btn" data-action="speak-word" aria-label="${esc(w.word)} 발음 듣기">🔊</button></div>
      <div class="ipa">${esc(w.ipa || '발음기호 정보 없음')}</div>
      ${w.partOfSpeech ? `<span class="pos-badge">${esc(w.partOfSpeech)}</span>` : ''}
      ${w.koreanMeaning ? `<p class="meaning"><strong>${esc(w.koreanMeaning)}</strong></p>` : '<p class="meaning muted">한국어 뜻 없음</p>'}
      ${w.englishMeaning ? `<p class="meaning english-meaning">${esc(w.englishMeaning)}</p>` : ''}
      <div class="card-actions">
        <button class="btn btn-secondary" data-action="toggle-example">예문 보기 ▼</button>
        <button class="btn btn-secondary" data-action="edit">수정</button>
        <button class="btn btn-danger" data-action="delete">삭제</button>
      </div>
      <div class="example-box hidden">
        <div class="word-line"><p><strong>${esc(w.example || '저장된 예문이 없습니다.')}</strong></p>${w.example ? '<button class="speak-btn" data-action="speak-example" aria-label="예문 발음 듣기">🔊</button>' : ''}</div>
        ${w.exampleTranslation ? `<p>${esc(w.exampleTranslation)}</p>` : '<p class="muted">예문 해석 없음</p>'}
      </div>`;
    els.vocabList.appendChild(card);
  }
}

function renderMeaningChoices(result) {
  els.meaningChoices.innerHTML = '';
  result.meanings.forEach((m, groupIndex) => {
    const group = document.createElement('div');
    group.className = 'pos-group';
    group.innerHTML = `<button type="button" data-pos-index="${groupIndex}">${esc(m.partOfSpeech || '품사 정보 없음')}</button><div class="definition-list"></div>`;
    const list = group.querySelector('.definition-list');
    m.definitions.forEach((d, defIndex) => {
      const label = document.createElement('label');
      label.className = 'definition-item';
      label.innerHTML = `<input type="checkbox" data-group="${groupIndex}" data-def="${defIndex}" /><span>${esc(d.definition)}${d.example ? `<div class="definition-example">예: ${esc(d.example)}</div>` : ''}</span>`;
      list.appendChild(label);
    });
    els.meaningChoices.appendChild(group);
  });
  const firstCheckbox = els.meaningChoices.querySelector('input[type="checkbox"]');
  if (firstCheckbox) { firstCheckbox.checked = true; syncSelectedMeanings(); }
}

function syncSelectedMeanings() {
  if (!state.searchResult) return;
  const checked = $$('#meaning-choices input[type="checkbox"]:checked');
  const selected = checked.map(input => {
    const g = Number(input.dataset.group), d = Number(input.dataset.def);
    return { pos: state.searchResult.meanings[g].partOfSpeech, ...state.searchResult.meanings[g].definitions[d] };
  });
  const positions = [...new Set(selected.map(s => s.pos).filter(Boolean))];
  els.editPos.value = positions.join(', ');
  els.editEnMeaning.value = selected.map(s => s.definition).join('\n');
  const example = selected.find(s => s.example)?.example || '';
  if (example && !els.editExample.value.trim()) els.editExample.value = example;
}

async function runSearch() {
  const word = els.wordInput.value.trim().toLowerCase();
  if (!word) { showStatus('검색할 영어 단어를 입력해 주세요.', 'error'); return; }
  if (!navigator.onLine) { showStatus('현재 인터넷에 연결되어 있지 않아 새 단어를 검색할 수 없습니다.', 'error'); return; }
  if (state.abortController) state.abortController.abort();
  state.abortController = new AbortController();
  hideStatus();
  els.resultSection.classList.add('hidden');
  els.searchBtn.disabled = true;
  els.searchBtn.textContent = '검색 중…';
  showStatus('단어 정보를 찾고 있습니다…');
  try {
    const result = await getWordData(word, { signal: state.abortController.signal });
    state.searchResult = result;
    els.resultWord.textContent = result.word;
    els.resultIpa.textContent = result.ipa ? `/${result.ipa}/` : '발음기호 정보 없음';
    els.ipaNote.textContent = result.ipaNote || '';
    els.editWord.value = result.word;
    els.editIpa.value = result.ipa || '';
    els.editPos.value = '';
    els.editEnMeaning.value = '';
    els.editKoMeaning.value = '';
    els.editExample.value = '';
    els.editTranslation.value = '';
    renderMeaningChoices(result);
    els.resultSection.classList.remove('hidden');
    showStatus('검색이 완료되었습니다. 품사와 뜻을 확인한 뒤 필요한 내용을 수정해 저장하세요.', 'success');
  } catch (err) {
    if (err.name !== 'AbortError') {
      showStatus(err.message.includes('Failed to fetch') ? '무료 사전 서비스에 연결하지 못했습니다. 네트워크 또는 브라우저의 외부 요청 제한(CORS)일 수 있습니다. 직접 입력 모드로 저장하려면 아래 버튼을 이용해 주세요.' : err.message, 'error');
      showManualEntry(word);
    }
  } finally {
    els.searchBtn.disabled = false;
    els.searchBtn.textContent = '검색';
  }
}

function showManualEntry(word) {
  state.searchResult = { word, ipa: '', ipaNote: '발음기호 정보 없음', meanings: [] };
  els.resultWord.textContent = word;
  els.resultIpa.textContent = '발음기호 정보 없음';
  els.ipaNote.textContent = '자동 검색 실패 — 직접 입력 가능';
  els.meaningChoices.innerHTML = '<p class="muted">자동 검색 결과가 없습니다. 아래 입력란에 직접 입력해 저장할 수 있습니다.</p>';
  els.editWord.value = word;
  els.editIpa.value = '';
  els.editPos.value = '';
  els.editEnMeaning.value = '';
  els.editKoMeaning.value = '';
  els.editExample.value = '';
  els.editTranslation.value = '';
  els.resultSection.classList.remove('hidden');
}

function currentEditData() {
  return {
    word: els.editWord.value.trim().toLowerCase(), ipa: els.editIpa.value.trim(), partOfSpeech: els.editPos.value.trim(),
    englishMeaning: els.editEnMeaning.value.trim(), koreanMeaning: els.editKoMeaning.value.trim(), example: els.editExample.value.trim(), exampleTranslation: els.editTranslation.value.trim()
  };
}

async function saveCurrentWord() {
  const data = currentEditData();
  if (!data.word) { showStatus('영어 단어는 비워 둘 수 없습니다.', 'error'); return; }
  const result = await addWord(data);
  if (result.duplicate) {
    const replace = confirm(`'${data.word}'는 이미 저장되어 있습니다. 기존 단어를 수정 화면에서 열까요?`);
    if (replace) { switchView('vocab'); openEditDialog(result.existing); }
    return;
  }
  showStatus(`'${data.word}'를 단어장에 저장했습니다.`, 'success');
  await refreshWords();
}

function openEditDialog(word) {
  els.dialogId.value = word.id;
  els.dialogWord.value = word.word || '';
  els.dialogIpa.value = word.ipa || '';
  els.dialogPos.value = word.partOfSpeech || '';
  els.dialogEn.value = word.englishMeaning || '';
  els.dialogKo.value = word.koreanMeaning || '';
  els.dialogExample.value = word.example || '';
  els.dialogTranslation.value = word.exampleTranslation || '';
  els.editDialog.showModal();
}

async function handleCardAction(e) {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const card = btn.closest('.vocab-card');
  const word = state.words.find(w => Number(w.id) === Number(card.dataset.id));
  if (!word) return;
  const action = btn.dataset.action;
  try {
    if (action === 'speak-word') speak(word.word);
    if (action === 'speak-example') speak(word.example);
    if (action === 'toggle-example') {
      const box = card.querySelector('.example-box');
      box.classList.toggle('hidden');
      btn.textContent = box.classList.contains('hidden') ? '예문 보기 ▼' : '예문 닫기 ▲';
    }
    if (action === 'edit') openEditDialog(word);
    if (action === 'delete') {
      if (confirm(`'${word.word}'를 삭제하시겠습니까?`)) { await deleteWord(word.id); await refreshWords(); }
    }
  } catch (err) { alert(err.message); }
}

async function saveDialogWord(e) {
  e.preventDefault();
  const original = state.words.find(w => Number(w.id) === Number(els.dialogId.value));
  if (!original) return;
  const updated = {
    ...original,
    word: els.dialogWord.value.trim(), ipa: els.dialogIpa.value.trim(), partOfSpeech: els.dialogPos.value.trim(),
    englishMeaning: els.dialogEn.value.trim(), koreanMeaning: els.dialogKo.value.trim(), example: els.dialogExample.value.trim(), exampleTranslation: els.dialogTranslation.value.trim()
  };
  if (!updated.word) { alert('영어 단어는 비워 둘 수 없습니다.'); return; }
  await updateWord(updated);
  els.editDialog.close();
  await refreshWords();
}

async function backupWords() {
  const payload = await exportBackup();
  const date = new Date().toISOString().slice(0,10);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `my-vocabulary-${date}.json`; document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

async function restoreWords(file) {
  try {
    const text = await file.text();
    const payload = JSON.parse(text);
    const result = await importBackup(payload);
    alert(`복원이 완료되었습니다.\n총 ${result.total}개 중 새 단어 ${result.added}개 추가\n중복 ${result.duplicates}개 유지`);
    await refreshWords();
  } catch (err) { alert(`복원 실패: ${err.message}`); }
}

function setupInstall() {
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault(); state.installPrompt = e; els.installBtn.classList.remove('hidden');
  });
  els.installBtn.addEventListener('click', async () => {
    if (!state.installPrompt) return;
    state.installPrompt.prompt();
    await state.installPrompt.userChoice;
    state.installPrompt = null; els.installBtn.classList.add('hidden');
  });
}

function setupEvents() {
  $$('.nav-btn').forEach(btn => btn.addEventListener('click', () => switchView(btn.dataset.view)));
  $('#empty-add-btn').addEventListener('click', () => switchView('add'));
  els.vocabSearch.addEventListener('input', renderWords);
  els.sortSelect.addEventListener('change', renderWords);
  els.settingsToggle.addEventListener('click', () => els.managePanel.classList.toggle('hidden'));
  els.vocabList.addEventListener('click', handleCardAction);
  els.searchForm.addEventListener('submit', e => { e.preventDefault(); runSearch(); });
  els.meaningChoices.addEventListener('change', syncSelectedMeanings);
  els.saveWordBtn.addEventListener('click', saveCurrentWord);
  els.speakWordBtn.addEventListener('click', () => { try { speak(els.editWord.value || els.resultWord.textContent); } catch(e) { showStatus(e.message, 'error'); } });
  els.speakExampleBtn.addEventListener('click', () => { try { speak(els.editExample.value); } catch(e) { showStatus(e.message, 'error'); } });
  els.editForm.addEventListener('submit', saveDialogWord);
  els.backupBtn.addEventListener('click', backupWords);
  els.restoreFile.addEventListener('change', e => { const f = e.target.files?.[0]; if (f) restoreWords(f); e.target.value = ''; });
  els.deleteAllBtn.addEventListener('click', async () => {
    if (!state.words.length) return alert('삭제할 단어가 없습니다.');
    if (!confirm('저장된 모든 단어를 삭제하시겠습니까? 삭제 후에는 백업 파일이 없으면 복구할 수 없습니다.')) return;
    if (!confirm('정말로 전체 단어를 삭제할까요?')) return;
    await clearWords(); await refreshWords();
  });
  window.addEventListener('online', () => showStatus('인터넷에 다시 연결되었습니다.', 'success'));
  window.addEventListener('offline', () => showStatus('현재 오프라인입니다. 저장된 단어장은 계속 사용할 수 있습니다.', 'error'));
}

async function init() {
  setupEvents(); setupInstall(); await refreshWords();
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js').catch(console.warn));
  }
}

init().catch(err => console.error(err));
