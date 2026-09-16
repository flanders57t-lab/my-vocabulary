let voices = [];

function loadVoices() {
  if (!('speechSynthesis' in window)) return;
  voices = window.speechSynthesis.getVoices();
}

loadVoices();
if ('speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = loadVoices;
}

function chooseVoice() {
  if (!voices.length) loadVoices();
  return voices.find(v => /^en-US$/i.test(v.lang))
    || voices.find(v => /^en-US/i.test(v.lang))
    || voices.find(v => /^en/i.test(v.lang))
    || null;
}

export function canSpeak() {
  return 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
}

export function speak(text) {
  const clean = String(text || '').trim();
  if (!clean) throw new Error('읽을 영어 문장이 없습니다.');
  if (!canSpeak()) throw new Error('이 기기에서는 음성 읽기를 지원하지 않습니다.');
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(clean);
  const voice = chooseVoice();
  if (voice) utterance.voice = voice;
  utterance.lang = voice?.lang || 'en-US';
  utterance.rate = 0.9;
  utterance.pitch = 1;
  window.speechSynthesis.speak(utterance);
}
