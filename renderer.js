const MODEL = 'gemini-3.5-live-translate-preview';
const KEY_COOLDOWN_MS = 5 * 60 * 1000;
const OK_RUN_MS = 30 * 1000;

const I18N = {
  de: {
    app: 'Live Translate', subtitle: 'Echtzeit-Übersetzung mit Gemini',
    settings: 'Einstellungen', uiLang: 'App-Sprache', theme: 'Design',
    themeSystem: 'System', themeLight: 'Hell', themeDark: 'Dunkel', fontSize: 'Schriftgröße',
    apiKeys: 'Gemini API-Schlüssel (einer pro Zeile)',
    keyHint: 'Bei Limit oder Fehler wird automatisch der nächste Schlüssel verwendet.',
    target: 'Zielsprache',
    modeSystem: 'System-Audio (Videos, Apps)', modeMic: 'Mikrofon (Sprecher)',
    trVol: 'Lautstärke Übersetzung',
    start: 'Start', stop: 'Stopp', original: 'Original', translation: 'Übersetzung',
    ready: 'Bereit', connecting: 'Verbinde …', live: 'Übersetzung aktiv', stopped: 'Gestoppt',
    switching: 'Wechsle Schlüssel', allFailed: 'Alle Schlüssel fehlgeschlagen',
    needKey: 'Bitte mindestens einen API-Schlüssel eingeben', noAudio: 'Kein Audio erhalten', error: 'Fehler'
  },
  en: {
    app: 'Live Translate', subtitle: 'Real-time translation with Gemini',
    settings: 'Settings', uiLang: 'App language', theme: 'Theme',
    themeSystem: 'System', themeLight: 'Light', themeDark: 'Dark', fontSize: 'Font size',
    apiKeys: 'Gemini API keys (one per line)',
    keyHint: 'On a limit or error, the next key is used automatically.',
    target: 'Target language',
    modeSystem: 'System audio (videos, apps)', modeMic: 'Microphone (speaker)',
    trVol: 'Translation volume',
    start: 'Start', stop: 'Stop', original: 'Original', translation: 'Translation',
    ready: 'Ready', connecting: 'Connecting…', live: 'Translating', stopped: 'Stopped',
    switching: 'Switching key', allFailed: 'All keys failed',
    needKey: 'Please enter at least one API key', noAudio: 'No audio received', error: 'Error'
  },
  fa: {
    app: 'ترجمهٔ زنده', subtitle: 'ترجمهٔ همزمان با Gemini',
    settings: 'تنظیمات', uiLang: 'زبان برنامه', theme: 'پوسته',
    themeSystem: 'سیستم', themeLight: 'روشن', themeDark: 'تیره', fontSize: 'اندازهٔ فونت',
    apiKeys: 'کلیدهای API جمینای (هر کلید در یک خط)',
    keyHint: 'در صورت رسیدن به سقف یا بروز خطا، کلید بعدی خودکار استفاده می‌شود.',
    target: 'زبان مقصد',
    modeSystem: 'صدای سیستم (ویدیو و برنامه‌ها)', modeMic: 'میکروفون (گوینده)',
    trVol: 'بلندی صدای ترجمه',
    start: 'شروع', stop: 'توقف', original: 'متن اصلی', translation: 'ترجمه',
    ready: 'آماده', connecting: 'در حال اتصال…', live: 'ترجمه فعال است', stopped: 'متوقف شد',
    switching: 'تعویض کلید', allFailed: 'همهٔ کلیدها ناموفق بودند',
    needKey: 'حداقل یک کلید API وارد کن', noAudio: 'صدایی دریافت نشد', error: 'خطا'
  }
};

const $ = (id) => document.getElementById(id);
const defaults = { ui: 'de', theme: 'system', font: 16, keys: '', target: 'de', mode: 'system', gain: 100 };
const saved = JSON.parse(localStorage.getItem('lt') || '{}');
if (saved.key && !saved.keys) saved.keys = saved.key;
const st = Object.assign({}, defaults, saved);
const save = () => localStorage.setItem('lt', JSON.stringify(st));
const t = (k) => I18N[st.ui][k] || k;

let ws, inCtx, outCtx, stream, audioStream, node, trGain;
let nextTime = 0, ready = false, active = false;
let statusKey = 'ready', statusExtra = '';
let keys = [], keyIdx = 0, failedUntil = {}, connStart = 0, wasReady = false, reconnectTimer = null;

function setStatus(key, extra) {
  statusKey = key;
  statusExtra = extra || '';
  const el = $('status');
  el.textContent = t(key) + (statusExtra ? ' · ' + statusExtra : '');
  el.className = 'pill' + (key === 'live' ? ' live' : (key === 'error' || key === 'allFailed') ? ' err' : '');
}

function applyUi() {
  const r = document.documentElement;
  r.lang = st.ui;
  r.dir = st.ui === 'fa' ? 'rtl' : 'ltr';
  r.dataset.theme = st.theme;
  r.style.fontSize = st.font + 'px';
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  $('fontVal').textContent = st.font + 'px';
  $('gainVal').textContent = st.gain + '%';
  setStatus(statusKey, statusExtra);
}

function applyGain() { if (trGain) trGain.gain.value = st.gain / 100; }

function parseKeys() {
  return [...new Set($('keys').value.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean))];
}

function keyLabel() {
  return 'Key ' + (keyIdx + 1) + '/' + keys.length + ' …' + keys[keyIdx].slice(-4);
}

function init() {
  $('uiLang').value = st.ui;
  $('theme').value = st.theme;
  $('font').value = st.font;
  $('keys').value = st.keys;
  $('target').value = st.target;
  $('gain').value = st.gain;
  document.querySelector('input[name=mode][value=' + st.mode + ']').checked = true;
  applyUi();

  $('btnSettings').onclick = () => $('settings').classList.toggle('hidden');
  $('uiLang').onchange = (e) => { st.ui = e.target.value; save(); applyUi(); };
  $('theme').onchange = (e) => { st.theme = e.target.value; save(); applyUi(); };
  $('font').oninput = (e) => { st.font = +e.target.value; save(); applyUi(); };
  $('target').onchange = (e) => { st.target = e.target.value; save(); };
  $('gain').oninput = (e) => { st.gain = +e.target.value; save(); applyUi(); applyGain(); };
  $('keys').onchange = () => { st.keys = $('keys').value; save(); };
  $('toggleKey').onclick = () => $('keys').classList.toggle('masked');
  document.querySelectorAll('input[name=mode]').forEach((r) => {
    r.onchange = (e) => { st.mode = e.target.value; save(); };
  });
  $('btnStart').onclick = () => start().catch((e) => { setStatus('error', e.message); cleanup(); });
  $('btnStop').onclick = stop;
}

function b64(buf) {
  let s = '';
  const b = new Uint8Array(buf);
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
  return btoa(s);
}

function playPcm24k(base64) {
  if (!outCtx) return;
  const bin = atob(base64);
  const n = bin.length / 2;
  const buf = outCtx.createBuffer(1, n, 24000);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) {
    let v = bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8);
    if (v & 0x8000) v -= 0x10000;
    d[i] = v / 32768;
  }
  const src = outCtx.createBufferSource();
  src.buffer = buf;
  src.connect(trGain);
  nextTime = Math.max(nextTime, outCtx.currentTime + 0.05);
  src.start(nextTime);
  nextTime += buf.duration;
}

function append(el, text) { el.textContent += text; el.scrollTop = el.scrollHeight; }

function pickKey(from) {
  const now = Date.now();
  for (let i = 0; i < keys.length; i++) {
    const idx = (from + i) % keys.length;
    if ((failedUntil[keys[idx]] || 0) < now) return idx;
  }
  return -1;
}

function openSocket() {
  const key = keys[keyIdx];
  ready = false;
  wasReady = false;
  connStart = Date.now();
  nextTime = 0;
  setStatus('connecting', keyLabel());

  const sock = new WebSocket('wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=' + encodeURIComponent(key));
  ws = sock;

  sock.onopen = () => {
    sock.send(JSON.stringify({ setup: {
      model: 'models/' + MODEL,
      generationConfig: {
        responseModalities: ['AUDIO'],
        translationConfig: { targetLanguageCode: $('target').value, echoTargetLanguage: false }
      },
      inputAudioTranscription: {},
      outputAudioTranscription: {}
    } }));
  };

  sock.onmessage = async (ev) => {
    if (sock !== ws) return;
    const raw = typeof ev.data === 'string' ? ev.data : await ev.data.text();
    let m;
    try { m = JSON.parse(raw); } catch (e) { return; }
    if (m.setupComplete) { ready = true; wasReady = true; setStatus('live', keyLabel()); }
    const c = m.serverContent;
    if (c) {
      if (c.inputTranscription && c.inputTranscription.text) append($('inp'), c.inputTranscription.text);
      if (c.outputTranscription && c.outputTranscription.text) append($('out'), c.outputTranscription.text);
      for (const p of (c.modelTurn && c.modelTurn.parts) || []) {
        if (p.inlineData && p.inlineData.data) playPcm24k(p.inlineData.data);
      }
    }
  };

  sock.onerror = () => {};
  sock.onclose = (e) => {
    if (sock !== ws || !active) return;
    handleClose(e);
  };
}

function handleClose(e) {
  ready = false;
  const ranOk = wasReady && (Date.now() - connStart) > OK_RUN_MS;
  if (!ranOk) failedUntil[keys[keyIdx]] = Date.now() + (wasReady ? 15000 : KEY_COOLDOWN_MS);
  const next = pickKey(ranOk ? keyIdx : keyIdx + 1);
  if (next < 0) {
    setStatus('allFailed', e.code + ' ' + (e.reason || ''));
    cleanup(true);
    return;
  }
  keyIdx = next;
  setStatus('switching', keyLabel());
  clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(() => { if (active) openSocket(); }, 700);
}

async function start() {
  if (active) return;
  keys = parseKeys();
  if (!keys.length) return setStatus('needKey');
  st.keys = $('keys').value; save();
  keyIdx = 0;
  failedUntil = {};
  $('inp').textContent = '';
  $('out').textContent = '';
  active = true;
  $('btnStart').disabled = true;
  $('btnStop').disabled = false;
  setStatus('connecting');

  if (st.mode === 'system') {
    stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: { restrictOwnAudio: true } });
  } else {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true }
    });
  }
  stream.getVideoTracks().forEach((tr) => { tr.stop(); stream.removeTrack(tr); });
  if (!stream.getAudioTracks().length) { setStatus('noAudio'); return cleanup(true); }
  audioStream = new MediaStream(stream.getAudioTracks());

  outCtx = new AudioContext({ sampleRate: 24000 });
  trGain = outCtx.createGain();
  trGain.connect(outCtx.destination);
  applyGain();

  inCtx = new AudioContext({ sampleRate: 16000 });
  await inCtx.audioWorklet.addModule('pcm-worklet.js');
  node = new AudioWorkletNode(inCtx, 'pcm');
  inCtx.createMediaStreamSource(audioStream).connect(node);
  node.port.onmessage = (e) => {
    if (ready && ws && ws.readyState === 1) {
      ws.send(JSON.stringify({ realtimeInput: { audio: { data: b64(e.data), mimeType: 'audio/pcm;rate=16000' } } }));
    }
  };

  audioStream.getAudioTracks()[0].onended = stop;
  openSocket();
}

function cleanup(keepStatus) {
  active = false;
  ready = false;
  clearTimeout(reconnectTimer);
  if (ws) { ws.onclose = null; try { ws.close(); } catch (e) {} }
  if (stream) stream.getTracks().forEach((tr) => tr.stop());
  [inCtx, outCtx].forEach((c) => { try { c && c.close(); } catch (e) {} });
  ws = inCtx = outCtx = stream = audioStream = node = trGain = null;
  $('btnStart').disabled = false;
  $('btnStop').disabled = true;
}

function stop() {
  const was = active;
  cleanup();
  if (was) setStatus('stopped');
}

init();
