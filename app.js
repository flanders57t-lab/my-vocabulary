import {
  getAllWords,
  addWord,
  updateWord,
  deleteWord,
  clearWords,
  exportBackup,
  importBackup
} from './db.js';
import { speak } from './speech.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];
const state = { words: [], installPrompt: null };

const els = {
  title: $('#page-title'),
  subtitle: $('#page-subtitle'),
  vocabView: $('#view-vocab'),
  addView: $('#view-add'),
  vocabList: $('#vocab-list'),
  emptyState: $('#empty-state'),
  wordCount: $('#word-count'),
  vocabSearch: $('#vocab-search'),
  sortSelect: $('#sort-select'),
  managePanel: $('#manage-panel'),
  settingsToggle: $('#settings-toggle'),
  backupBtn: $('#backup-btn'),
  restoreFile: $('#restore-file'),
  deleteAllBtn: $('#delete-all-btn'),
  statusBox: $('#status-box'),
  editWord: $('#edit-word'),
  senseEditor: $('#sense-editor'),
  addSenseBtn: $('#add-sense-btn'),
  speakWordBtn: $('#speak-word-btn'),
  saveWordBtn: $('#save-word-btn'),
  clearEntryBtn: $('#clear-entry-btn'),
  editDialog: $('#edit-dialog'),
  editForm: $('#edit-form'),
  dialogId: $('#dialog-id'),
  dialogWord: $('#dialog-word'),
  dialogSenseEditor: $('#dialog-sense-editor'),
  dialogAddSenseBtn: $('#dialog-add-sense-btn'),
  dialogSpeakWordBtn: $('#dialog-speak-word-btn'),
  installBtn: $('#install-btn'),
  senseTemplate: $('#sense-template')
};

function esc(text = '') {
  return String(text).replace(/[&<>'"]/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[ch]));
}

function showStatus(message, type = 'info') {
  els.statusBox.textContent = message;
  els.statusBox.className = `status ${type === 'info' ? '' : type}`.trim();
  els.statusBox.classList.remove('hidden');
}

function hideStatus() {
  els.statusBox.classList.add('hidden');
}

function cleanSense(sense = {}) {
  return {
    partOfSpeech: String(sense.partOfSpeech || '').trim(),
    meaning: String(sense.meaning || '').trim(),
    example: String(sense.example || '').trim(),
    translation: String(sense.translation || '').trim()
  };
}

function hasSenseContent(sense) {
  return Object.values(cleanSense(sense)).some(Boolean);
}

function renumberSenseBlocks(container) {
  [...container.querySelectorAll('.sense-block')].forEach((block, index) => {
    const label = block.querySelector('.sense-number');
    if (label) label.textContent = `품사 ${index + 1}`;
    const removeBtn = block.querySelector('.remove-sense-btn');
    if (removeBtn) removeBtn.classList.toggle('hidden', container.querySelectorAll('.sense-block').length <= 1);
  });
}

function addSenseBlock(container, sense = {}, { focus = false } = {}) {
  const fragment = els.senseTemplate.content.cloneNode(true);
  const block = fragment.querySelector('.sense-block');
  const cleaned = cleanSense(sense);

  block.querySelector('.sense-pos').value = cleaned.partOfSpeech;
  block.querySelector('.sense-meaning').value = cleaned.meaning;
  block.querySelector('.sense-example').value = cleaned.example;
  block.querySelector('.sense-translation').value = cleaned.translation;

  block.querySelector('.remove-sense-btn').addEventListener('click', () => {
    block.remove();
    if (!container.querySelector('.sense-block')) addSenseBlock(container);
    renumberSenseBlocks(container);
  });

  block.querySelector('.sense-speak-example').addEventListener('click', () => {
    try {
      speak(block.querySelector('.sense-example').value);
    } catch (err) {
      alert(err.message);
    }
  });

  container.appendChild(fragment);
  renumberSenseBlocks(container);

  if (focus) setTimeout(() => block.querySelector('.sense-pos')?.focus(), 50);
}

function fillSenseEditor(container, senses = []) {
  container.innerHTML = '';
  const list = Array.isArray(senses) && senses.length ? senses : [{}];
  list.forEach(sense => addSenseBlock(container, sense));
  renumberSenseBlocks(container);
}

function readSensesFromEditor(container) {
  return [...container.querySelectorAll('.sense-block')]
    .map(block => cleanSense({
      partOfSpeech: block.querySelector('.sense-pos').value,
      meaning: block.querySelector('.sense-meaning').value,
      example: block.querySelector('.sense-example').value,
      translation: block.querySelector('.sense-translation').value
    }))
    .filter(hasSenseContent);
}

function clearEntryForm({ focus = true } = {}) {
  els.editWord.value = '';
  fillSenseEditor(els.senseEditor, [{}]);
  hideStatus();
  if (focus) setTimeout(() => els.editWord.focus(), 50);
}

function switchView(view) {
  const vocab = view === 'vocab';
  els.vocabView.classList.toggle('active', vocab);
  els.addView.classList.toggle('active', !vocab);
  $$('.nav-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.view === view));
  els.title.textContent = vocab ? '내 단어장' : '새 단어';
  els.subtitle.textContent = vocab
    ? '저장된 단어를 확인하세요.'
    : '한 단어에 여러 품사를 추가해 저장하세요.';
  if (!vocab) setTimeout(() => els.editWord.focus(), 80);
}

async function refreshWords() {
  state.words = await getAllWords();
  els.wordCount.textContent = state.words.length;
  renderWords();
}

function searchableText(word) {
  const senseText = (word.senses || [])
    .flatMap(s => [s.partOfSpeech, s.meaning, s.example, s.translation])
    .join(' ');
  return `${word.word || ''} ${senseText}`.toLowerCase();
}

function sortedFilteredWords() {
  const q = els.vocabSearch.value.trim().toLowerCase();
  let list = state.words.filter(w => !q || searchableText(w).includes(q));
  const sort = els.sortSelect.value;
  list.sort((a, b) => sort === 'alphabetical'
    ? String(a.word).localeCompare(String(b.word), 'en')
    : sort === 'oldest'
      ? new Date(a.createdAt) - new Date(b.createdAt)
      : new Date(b.createdAt) - new Date(a.createdAt));
  return list;
}

function renderSenseCard(sense, index) {
  const pos = sense.partOfSpeech || `품사 ${index + 1}`;
  const hasExample = Boolean(sense.example);
  return `
    <section class="saved-sense">
      <div class="saved-sense-head">
        <span class="pos-badge">${esc(pos)}</span>
      </div>
      ${sense.meaning
        ? `<p class="meaning"><strong>${esc(sense.meaning)}</strong></p>`
        : '<p class="meaning muted">뜻 없음</p>'}
      <div class="example-box compact-example ${hasExample || sense.translation ? '' : 'empty-example'}">
        <div class="word-line">
          <p><strong>${esc(sense.example || '저장된 예문이 없습니다.')}</strong></p>
          ${hasExample ? `<button class="speak-btn" data-action="speak-sense-example" data-sense-index="${index}" aria-label="예문 발음 듣기">🔊</button>` : ''}
        </div>
        ${sense.translation
          ? `<p>${esc(sense.translation)}</p>`
          : '<p class="muted">예문 해석 없음</p>'}
      </div>
    </section>`;
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
    const senses = Array.isArray(w.senses) ? w.senses : [];

    card.innerHTML = `
      <div class="word-line word-card-title-line">
        <h2 class="word-title">${esc(w.word)}</h2>
        <button class="speak-btn" data-action="speak-word" aria-label="${esc(w.word)} 발음 듣기">🔊</button>
      </div>
      <div class="saved-senses">
        ${senses.length
          ? senses.map((sense, index) => renderSenseCard(sense, index)).join('')
          : '<p class="muted">저장된 품사 정보가 없습니다.</p>'}
      </div>
      <div class="card-actions">
        <button class="btn btn-secondary" data-action="edit">수정</button>
        <button class="btn btn-danger" data-action="delete">삭제</button>
      </div>`;

    els.vocabList.appendChild(card);
  }
}

function currentEditData() {
  return {
    word: els.editWord.value.trim().toLowerCase(),
    senses: readSensesFromEditor(els.senseEditor)
  };
}

function validateWordData(data) {
  if (!data.word) return '영어 단어는 반드시 입력해 주세요.';
  if (!data.senses.length) return '최소 한 개의 품사 내용을 입력해 주세요.';
  return '';
}

async function saveCurrentWord() {
  const data = currentEditData();
  const error = validateWordData(data);
  if (error) {
    showStatus(error, 'error');
    if (!data.word) els.editWord.focus();
    return;
  }

  try {
    const result = await addWord(data);
    if (result.duplicate) {
      const replace = confirm(`'${data.word}'는 이미 저장되어 있습니다. 기존 단어를 수정 화면에서 열까요?`);
      if (replace) {
        switchView('vocab');
        openEditDialog(result.existing);
      }
      return;
    }

    await refreshWords();
    showStatus(`'${data.word}'를 단어장에 저장했습니다.`, 'success');
    setTimeout(() => {
      clearEntryForm({ focus: false });
      switchView('vocab');
    }, 350);
  } catch (err) {
    showStatus(`저장하지 못했습니다: ${err.message}`, 'error');
  }
}

function openEditDialog(word) {
  els.dialogId.value = word.id;
  els.dialogWord.value = word.word || '';
  fillSenseEditor(els.dialogSenseEditor, word.senses || []);
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
    if (action === 'speak-sense-example') {
      const index = Number(btn.dataset.senseIndex);
      speak(word.senses?.[index]?.example);
    }
    if (action === 'edit') openEditDialog(word);
    if (action === 'delete') {
      if (confirm(`'${word.word}'를 삭제하시겠습니까?`)) {
        await deleteWord(word.id);
        await refreshWords();
      }
    }
  } catch (err) {
    alert(err.message);
  }
}

async function saveDialogWord(e) {
  e.preventDefault();
  const original = state.words.find(w => Number(w.id) === Number(els.dialogId.value));
  if (!original) return;

  const updated = {
    ...original,
    word: els.dialogWord.value.trim().toLowerCase(),
    senses: readSensesFromEditor(els.dialogSenseEditor)
  };

  const error = validateWordData(updated);
  if (error) {
    alert(error);
    return;
  }

  try {
    await updateWord(updated);
    els.editDialog.close();
    await refreshWords();
  } catch (err) {
    alert(err.message);
  }
}

async function backupWords() {
  const payload = await exportBackup();
  const date = new Date().toISOString().slice(0, 10);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `my-vocabulary-${date}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function restoreWords(file) {
  try {
    const text = await file.text();
    const payload = JSON.parse(text);
    const result = await importBackup(payload);
    alert(`복원이 완료되었습니다.\n총 ${result.total}개 중 새 단어 ${result.added}개 추가\n중복 ${result.duplicates}개 유지`);
    await refreshWords();
  } catch (err) {
    alert(`복원 실패: ${err.message}`);
  }
}

function setupInstall() {
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    state.installPrompt = e;
    els.installBtn.classList.remove('hidden');
  });

  els.installBtn.addEventListener('click', async () => {
    if (!state.installPrompt) return;
    state.installPrompt.prompt();
    await state.installPrompt.userChoice;
    state.installPrompt = null;
    els.installBtn.classList.add('hidden');
  });
}

function setupEvents() {
  $$('.nav-btn').forEach(btn => btn.addEventListener('click', () => switchView(btn.dataset.view)));
  $('#empty-add-btn').addEventListener('click', () => switchView('add'));
  els.vocabSearch.addEventListener('input', renderWords);
  els.sortSelect.addEventListener('change', renderWords);
  els.settingsToggle.addEventListener('click', () => els.managePanel.classList.toggle('hidden'));
  els.vocabList.addEventListener('click', handleCardAction);

  els.addSenseBtn.addEventListener('click', () => addSenseBlock(els.senseEditor, {}, { focus: true }));
  els.dialogAddSenseBtn.addEventListener('click', e => {
    e.preventDefault();
    addSenseBlock(els.dialogSenseEditor, {}, { focus: true });
  });

  els.speakWordBtn.addEventListener('click', () => {
    try { speak(els.editWord.value); } catch (err) { alert(err.message); }
  });
  els.dialogSpeakWordBtn.addEventListener('click', e => {
    e.preventDefault();
    try { speak(els.dialogWord.value); } catch (err) { alert(err.message); }
  });

  els.saveWordBtn.addEventListener('click', saveCurrentWord);
  els.clearEntryBtn.addEventListener('click', () => {
    if (confirm('입력한 내용을 모두 지우시겠습니까?')) clearEntryForm();
  });

  els.editForm.addEventListener('submit', saveDialogWord);

  els.backupBtn.addEventListener('click', backupWords);
  els.restoreFile.addEventListener('change', async () => {
    const file = els.restoreFile.files?.[0];
    if (file) await restoreWords(file);
    els.restoreFile.value = '';
  });

  els.deleteAllBtn.addEventListener('click', async () => {
    if (!state.words.length) {
      alert('삭제할 단어가 없습니다.');
      return;
    }
    const first = confirm(`저장된 ${state.words.length}개 단어를 모두 삭제하시겠습니까?`);
    if (!first) return;
    const second = confirm('삭제하면 이 기기에서는 복구할 수 없습니다. 백업하지 않았다면 취소를 권장합니다. 정말 삭제할까요?');
    if (!second) return;
    await clearWords();
    await refreshWords();
  });
}

async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('./service-worker.js');
    } catch (err) {
      console.warn('Service Worker 등록 실패:', err);
    }
  }
}

async function init() {
  fillSenseEditor(els.senseEditor, [{}]);
  setupEvents();
  setupInstall();
  await refreshWords();
  await registerServiceWorker();
}

init().catch(err => {
  console.error(err);
  alert(`앱을 시작하지 못했습니다: ${err.message}`);
});
