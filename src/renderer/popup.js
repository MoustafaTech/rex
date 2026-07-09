'use strict';

const $ = (id) => document.getElementById(id);

const viewAsk = $('view-ask');
const viewSettings = $('view-settings');
const thread = $('thread');
const questionEl = $('question');

if (navigator.platform.toLowerCase().includes('mac')) document.body.classList.add('mac');

let selection = '';
let history = [];        // [{role, content}] excluding system
let streamingEl = null;
let streamingRaw = '';
let busy = false;

const MODEL_PLACEHOLDERS = {
  anthropic: 'claude-sonnet-5',
  openai: 'gpt-5.2',
  google: 'gemini-2.5-flash',
  compatible: 'llama3.3'
};

/* ---------- view switching ----------
   One entry point, sets both views every time, and never leaves the popup
   blank: if something throws, the ask view is restored and the error shown. */

function setView(name) {
  const showSettingsView = name === 'settings';
  viewAsk.hidden = showSettingsView;
  viewSettings.hidden = !showSettingsView;
  if (!showSettingsView) questionEl.focus();
}

async function openSettingsView() {
  try {
    const cfg = await window.rexplain.getConfig();
    $('cfg-provider').value = cfg.provider;
    $('cfg-key').value = (cfg.apiKeys || {})[cfg.provider] || '';
    $('cfg-model').value = cfg.model || '';
    $('cfg-baseurl').value = cfg.baseUrl || '';
    $('cfg-tapctrl').checked = !!cfg.trigger.tapCtrl;
    $('cfg-ctrlselect').checked = !!cfg.trigger.ctrlSelect;
    $('cfg-closeblur').checked = !!cfg.closeOnBlur;
    syncProviderFields();
    setView('settings');
  } catch (err) {
    setView('ask');
    addMsg('error', 'Could not open settings: ' + escapeHtml(String(err.message || err)));
  }
}

/* ---------- tiny safe markdown ---------- */

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function inlineMd(s) {
  return s
    .replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|\W)\*([^*\n]+)\*(?=\W|$)/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2">$1</a>');
}

function renderMarkdown(src) {
  const lines = src.split('\n');
  const out = [];
  let i = 0;
  let list = null; // 'ul' | 'ol'
  const closeList = () => { if (list) { out.push(`</${list}>`); list = null; } };

  while (i < lines.length) {
    const line = lines[i];

    const fence = line.match(/^```(\w*)/);
    if (fence) {
      closeList();
      const code = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) code.push(lines[i++]);
      i++; // closing fence
      out.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
      continue;
    }

    const esc = escapeHtml(line);

    const h = esc.match(/^(#{1,3})\s+(.*)/);
    if (h) { closeList(); out.push(`<h${h[1].length}>${inlineMd(h[2])}</h${h[1].length}>`); i++; continue; }

    const ul = esc.match(/^\s*[-*]\s+(.*)/);
    const ol = esc.match(/^\s*\d+[.)]\s+(.*)/);
    if (ul || ol) {
      const kind = ul ? 'ul' : 'ol';
      if (list !== kind) { closeList(); out.push(`<${kind}>`); list = kind; }
      out.push(`<li>${inlineMd((ul || ol)[1])}</li>`);
      i++; continue;
    }

    if (/^\s*&gt;\s?/.test(esc)) {
      closeList();
      out.push(`<blockquote>${inlineMd(esc.replace(/^\s*&gt;\s?/, ''))}</blockquote>`);
      i++; continue;
    }

    if (esc.trim() === '') { closeList(); i++; continue; }

    closeList();
    out.push(`<p>${inlineMd(esc)}</p>`);
    i++;
  }
  closeList();
  return out.join('');
}

/* ---------- ask flow ---------- */

function addMsg(cls, html) {
  const el = document.createElement('div');
  el.className = `msg ${cls}`;
  el.innerHTML = html;
  thread.appendChild(el);
  thread.scrollTop = thread.scrollHeight;
  return el;
}

function setBusy(v) {
  busy = v;
  $('btn-send').hidden = v;
  $('btn-stop').hidden = !v;
  $('ask-form').classList.toggle('busy', v);
  if (v) startRunner(); else stopRunner();
}

/* ---------- dino runner (plays while the answer generates) ---------- */

const DINO_FRAMES = (() => {
  const base = [
    '..............########',
    '.............##.######',
    '.............#########',
    '.............#########',
    '.............#####....',
    '.............########.',
    '.............#####....',
    '#............####.....',
    '#...........#####.....',
    '##.........######.....',
    '###.......##########..',
    '####.....###########..',
    '#####...##########....',
    '###################...',
    '.#################....',
    '..###############.....',
    '...#############......',
    '....###########.......',
    '.....####..####.......'
  ];
  const legsA = [
    '.....###....###.......',
    '.....##......##.......',
    '.....###.....###......'
  ];
  const legsB = [
    '.....###.....##.......',
    '.....####....##.......',
    '.............###......'
  ];
  return [base.concat(legsA), base.concat(legsB)];
})();

const CACTUS = [
  '...##...',
  '...##...',
  '#..##...',
  '#..##..#',
  '#..##..#',
  '#..##..#',
  '#####..#',
  '...##..#',
  '...#####',
  '...##...',
  '...##...',
  '...##...'
];

const runner = { raf: null, obstacles: [], frame: 0, t: 0, y: 0, vy: 0, nextSpawn: 0 };

function drawBitmap(ctx, bitmap, x, y, px, style) {
  ctx.fillStyle = style;
  for (let r = 0; r < bitmap.length; r++) {
    for (let c = 0; c < bitmap[r].length; c++) {
      if (bitmap[r][c] === '#') ctx.fillRect(x + c * px, y + r * px, px + 0.4, px + 0.4);
    }
  }
}

function startRunner() {
  const canvas = $('dino-strip');
  canvas.hidden = false;
  const dpr = window.devicePixelRatio || 1;
  const W = Math.max(160, canvas.clientWidth || (canvas.parentElement.clientWidth - 28) || 0);
  const H = 52;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const PX = 2;                       // pixel size
  const DINO_W = 22 * PX, DINO_H = 22 * PX;
  const CACT_H = CACTUS.length * PX, CACT_W = 8 * PX;
  const groundY = H - 6;
  const dinoX = 16;
  const speed = 2.4;

  Object.assign(runner, { obstacles: [], frame: 0, t: 0, y: 0, vy: 0, nextSpawn: 40 });

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) {
    ctx.clearRect(0, 0, W, H);
    drawBitmap(ctx, DINO_FRAMES[0], dinoX, groundY - DINO_H, PX, 'rgba(255,255,255,0.85)');
    return;
  }

  function drawFrame() {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    for (let gx = -(runner.t * speed % 12); gx < W; gx += 12) {
      ctx.fillRect(gx, groundY + 2, 6, 1);
    }
    runner.obstacles.forEach(o => {
      drawBitmap(ctx, CACTUS, o.x, groundY - CACT_H, PX, 'rgba(255,255,255,0.4)');
    });
    const grounded = runner.y === 0;
    const frame = grounded ? DINO_FRAMES[Math.floor(runner.t / 7) % 2] : DINO_FRAMES[0];
    drawBitmap(ctx, frame, dinoX, groundY - DINO_H + runner.y, PX, 'rgba(255,255,255,0.85)');
  }

  function tick() {
    runner.t++;

    // spawn cacti
    if (--runner.nextSpawn <= 0) {
      runner.obstacles.push({ x: W + 10 });
      runner.nextSpawn = 70 + Math.random() * 80;
    }
    runner.obstacles.forEach(o => { o.x -= speed; });
    runner.obstacles = runner.obstacles.filter(o => o.x > -CACT_W - 4);

    // jump when an obstacle approaches
    const grounded = runner.y === 0;
    const next = runner.obstacles.find(o => o.x + CACT_W > dinoX && o.x < dinoX + DINO_W + 34);
    if (grounded && next && next.x - (dinoX + DINO_W) < 30) {
      runner.vy = -6.4;
    }
    if (!grounded || runner.vy !== 0) {
      runner.y += runner.vy;
      runner.vy += 0.42;
      if (runner.y >= 0) { runner.y = 0; runner.vy = 0; }
    }

    drawFrame();
    runner.raf = requestAnimationFrame(tick);
  }
  cancelAnimationFrame(runner.raf);
  drawFrame(); // first frame immediately, before the loop starts
  runner.raf = requestAnimationFrame(tick);
}

function stopRunner() {
  cancelAnimationFrame(runner.raf);
  runner.raf = null;
  $('dino-strip').hidden = true;
}

function syncHasText() {
  $('ask-form').classList.toggle('has-text', questionEl.value.trim().length > 0);
}

function systemContext() {
  return `The user selected the following text on their screen:\n\n"""\n${selection}\n"""`;
}

async function ask(q) {
  if (busy || !q.trim()) return;
  addMsg('user', escapeHtml(q));
  history.push({ role: 'user', content: history.length === 0 ? `${systemContext()}\n\nQuestion: ${q}` : q });
  questionEl.value = '';
  syncHasText();
  setBusy(true);

  streamingRaw = '';
  streamingEl = addMsg('assistant streaming', '');
  window.rexplain.ask(history.map(m => ({ ...m })));
}

window.rexplain.onChunk((delta) => {
  if (!streamingEl) return;
  streamingRaw += delta;
  streamingEl.innerHTML = renderMarkdown(streamingRaw);
  thread.scrollTop = thread.scrollHeight;
});

window.rexplain.onDone(() => {
  if (streamingEl) {
    streamingEl.classList.remove('streaming');
    history.push({ role: 'assistant', content: streamingRaw });
  }
  streamingEl = null;
  setBusy(false);
  questionEl.focus();
});

window.rexplain.onError((msg) => {
  if (streamingEl) { streamingEl.remove(); streamingEl = null; }
  history.pop(); // drop the failed user turn so retry is clean
  addMsg('error', escapeHtml(msg));
  setBusy(false);
});

$('ask-form').addEventListener('submit', (e) => {
  e.preventDefault();
  ask(questionEl.value);
});

questionEl.addEventListener('input', syncHasText);

$('btn-stop').addEventListener('click', () => {
  window.rexplain.stop();
  if (streamingEl) {
    streamingEl.classList.remove('streaming');
    if (streamingRaw) history.push({ role: 'assistant', content: streamingRaw });
    else { streamingEl.remove(); history.pop(); }
  }
  streamingEl = null;
  setBusy(false);
});

/* ---------- session ---------- */

window.rexplain.onSession(async (payload) => {
  if (payload.type === 'settings') { openSettingsView(); return; }
  selection = payload.selection || '';
  history = [];
  thread.innerHTML = '';
  streamingEl = null;
  setBusy(false);
  setView('ask');

  try {
    const cfg = await window.rexplain.getConfig();
    const hasKey = cfg.provider === 'compatible' ? !!cfg.baseUrl : !!(cfg.apiKeys || {})[cfg.provider];
    if (!hasKey) {
      addMsg('hintline', 'Add your API key first — opening Settings.');
      openSettingsView();
    }
  } catch { /* stay on ask view */ }
});

/* ---------- settings ---------- */

function syncProviderFields() {
  const p = $('cfg-provider').value;
  $('field-baseurl').hidden = p !== 'compatible';
  $('cfg-model').placeholder = MODEL_PLACEHOLDERS[p] || '';
  $('key-hint').textContent = p === 'compatible'
    ? 'optional for local servers like Ollama'
    : 'stored only on this device';
}

$('cfg-provider').addEventListener('change', async () => {
  try {
    const cfg = await window.rexplain.getConfig();
    $('cfg-key').value = (cfg.apiKeys || {})[$('cfg-provider').value] || '';
  } catch { $('cfg-key').value = ''; }
  syncProviderFields();
});

$('btn-save').addEventListener('click', async () => {
  const provider = $('cfg-provider').value;
  try {
    await window.rexplain.setConfig({
      provider,
      model: $('cfg-model').value.trim() || MODEL_PLACEHOLDERS[provider],
      baseUrl: $('cfg-baseurl').value.trim(),
      apiKeys: { [provider]: $('cfg-key').value },
      trigger: {
        tapCtrl: $('cfg-tapctrl').checked,
        ctrlSelect: $('cfg-ctrlselect').checked,
        hotkey: 'CommandOrControl+Shift+Space'
      },
      closeOnBlur: $('cfg-closeblur').checked
    });
  } catch (err) {
    setView('ask');
    addMsg('error', 'Could not save settings: ' + escapeHtml(String(err.message || err)));
    return;
  }
  setView('ask');
});

$('btn-back').addEventListener('click', () => setView('ask'));
$('btn-settings').addEventListener('click', openSettingsView);
$('btn-close').addEventListener('click', () => window.rexplain.close());

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') window.rexplain.close();
});

// External links open in the browser, never inside the popup.
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="http"]');
  if (a) {
    e.preventDefault();
    window.rexplain.openExternal(a.href);
  }
});
