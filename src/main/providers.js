'use strict';

// Streaming chat completions against the user's own API keys.
// Anthropic and Google speak their own protocols; every other provider is an
// OpenAI-compatible preset (fixed base URL), and "compatible" lets the user
// point at any endpoint that speaks the same dialect (Ollama, LM Studio, …).
// Each stream() call yields text deltas via onDelta and resolves when done.

const OPENAI_COMPAT = {
  openai:     { name: 'OpenAI',     base: 'https://api.openai.com/v1' },
  mistral:    { name: 'Mistral',    base: 'https://api.mistral.ai/v1' },
  deepseek:   { name: 'DeepSeek',   base: 'https://api.deepseek.com/v1' },
  xai:        { name: 'xAI',        base: 'https://api.x.ai/v1' },
  groq:       { name: 'Groq',       base: 'https://api.groq.com/openai/v1' },
  openrouter: { name: 'OpenRouter', base: 'https://openrouter.ai/api/v1' },
  ollama:     { name: 'Ollama',     base: 'http://localhost:11434/v1', keyOptional: true }
};

function needsKey(provider) {
  if (provider === 'compatible') return false;
  return !(OPENAI_COMPAT[provider] || {}).keyOptional;
}

async function streamChat(cfg, messages, onDelta, signal) {
  const provider = cfg.provider;
  const key = (cfg.apiKeys || {})[provider] || '';
  if (!key && needsKey(provider)) {
    throw new Error('No API key set. Open Settings and add your API key.');
  }
  if (provider === 'anthropic') return anthropic(cfg, key, messages, onDelta, signal);
  if (provider === 'google') return google(cfg, key, messages, onDelta, signal);
  const preset = OPENAI_COMPAT[provider];
  if (preset) return openaiLike(cfg, key, preset.base, preset.name, messages, onDelta, signal);
  if (provider === 'compatible') {
    const base = (cfg.baseUrl || '').replace(/\/+$/, '');
    if (!base) throw new Error('Set a Base URL for the OpenAI-compatible provider in Settings.');
    return openaiLike(cfg, key, base, 'API', messages, onDelta, signal);
  }
  throw new Error(`Unknown provider: ${provider}`);
}

async function readSSE(res, onEvent) {
  const decoder = new TextDecoder();
  let buf = '';
  for await (const chunk of res.body) {
    buf += decoder.decode(chunk, { stream: true });
    let idx;
    while ((idx = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, idx).replace(/\r$/, '');
      buf = buf.slice(idx + 1);
      if (line.startsWith('data:')) {
        const data = line.slice(5).trim();
        if (data && data !== '[DONE]') {
          try { onEvent(JSON.parse(data)); } catch { /* ignore partial/keepalive */ }
        }
      }
    }
  }
}

async function httpError(res, providerName) {
  let detail = '';
  try {
    const body = await res.text();
    try {
      const j = JSON.parse(body);
      detail = j.error?.message || j.message || body.slice(0, 300);
    } catch { detail = body.slice(0, 300); }
  } catch { /* ignore */ }
  const hint = res.status === 401 || res.status === 403
    ? ' Check your API key in Settings.'
    : res.status === 404 ? ' Check the model name in Settings.' : '';
  return new Error(`${providerName} error ${res.status}: ${detail}${hint}`);
}

async function anthropic(cfg, key, messages, onDelta, signal) {
  const system = messages.find(m => m.role === 'system')?.content;
  const rest = messages.filter(m => m.role !== 'system');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    signal,
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: cfg.maxTokens || 1024,
      system,
      messages: rest,
      stream: true
    })
  });
  if (!res.ok) throw await httpError(res, 'Anthropic');
  await readSSE(res, ev => {
    if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') {
      onDelta(ev.delta.text);
    }
  });
}

async function openaiLike(cfg, key, base, providerName, messages, onDelta, signal) {
  const headers = { 'content-type': 'application/json' };
  if (key) headers.authorization = `Bearer ${key}`;
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    signal,
    headers,
    body: JSON.stringify({
      model: cfg.model,
      messages,
      max_tokens: cfg.maxTokens || 1024,
      stream: true
    })
  });
  if (!res.ok) throw await httpError(res, providerName);
  await readSSE(res, ev => {
    const delta = ev.choices?.[0]?.delta?.content;
    if (delta) onDelta(delta);
  });
}

async function google(cfg, key, messages, onDelta, signal) {
  const system = messages.find(m => m.role === 'system')?.content;
  const contents = messages
    .filter(m => m.role !== 'system')
    .map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
  // Key travels in a header, not the URL, so it never lands in request logs.
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.model)}:streamGenerateContent?alt=sse`;
  const res = await fetch(url, {
    method: 'POST',
    signal,
    headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      contents,
      systemInstruction: system ? { parts: [{ text: system }] } : undefined,
      generationConfig: { maxOutputTokens: cfg.maxTokens || 1024 }
    })
  });
  if (!res.ok) throw await httpError(res, 'Google');
  await readSSE(res, ev => {
    const t = ev.candidates?.[0]?.content?.parts?.map(p => p.text).join('');
    if (t) onDelta(t);
  });
}

module.exports = { streamChat, needsKey };
