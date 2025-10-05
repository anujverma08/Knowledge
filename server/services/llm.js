// server/services/llm.js
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || null;
const GEMINI_ENDPOINT =
  process.env.GEMINI_ENDPOINT ||
  process.env.GENERATIVE_API_URL ||
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

const GEMINI_BEARER_TOKEN = process.env.GEMINI_BEARER_TOKEN || null;
const MAX_RETRIES = parseInt(process.env.LLM_MAX_RETRIES || '3', 10);
const TIMEOUT = parseInt(process.env.LLM_TIMEOUT_MS || '120000', 10);
const BACKOFF_BASE = 500;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function trim(v, n = 1200) {
  try {
    const s = typeof v === 'string' ? v : JSON.stringify(v);
    return s.length > n ? s.slice(0, n) + '…' : s;
  } catch {
    return String(v).slice(0, n);
  }
}

/** tolerant response parser */
function extractTextAndConfidence(respData) {
  if (!respData) return { text: null, confidence: null };

  // 1) Public Generative Language / Gemini shape
  const cand = respData?.candidates?.[0];
  if (cand) {
    // candidate.content may be { parts: [{text}] } or content array
    const part =
      cand?.content?.parts?.[0]?.text ||
      cand?.content?.[0]?.parts?.[0]?.text ||
      cand?.content?.[0]?.text ||
      cand?.content?.parts?.map((p) => p.text).join('') ||
      null;
    if (part) {
      const conf =
        cand?.safetyRatings?.[0]?.probability ?? cand?.score ?? null;
      return { text: String(part).trim(), confidence: conf ?? null };
    }
  }

  // 2) Vertex-style output
  const out0 = respData?.output?.[0];
  if (out0) {
    if (Array.isArray(out0.content)) {
      const collected = out0.content
        .map((c) => c?.text || (Array.isArray(c?.parts) ? c.parts.map((p) => p.text).join('') : ''))
        .filter(Boolean)
        .join('\n');
      if (collected) return { text: collected.trim(), confidence: null };
    }
  }

  // 3) Direct fields
  if (typeof respData?.output_text === 'string' && respData.output_text.trim()) {
    return { text: respData.output_text.trim(), confidence: null };
  }
  if (typeof respData?.text === 'string' && respData.text.trim()) {
    return { text: respData.text.trim(), confidence: null };
  }

  // 4) OpenAI-like
  if (Array.isArray(respData?.choices) && respData.choices.length > 0) {
    const c = respData.choices[0];
    const txt = c?.message?.content || c?.text || null;
    if (txt) return { text: String(txt).trim(), confidence: c?.score ?? null };
  }

  // nothing found
  return { text: null, confidence: null };
}

/** Main exported function */
export async function getLLMAnswer(prompt) {
  if (!GEMINI_API_KEY && !GEMINI_BEARER_TOKEN && !GEMINI_ENDPOINT) {
    throw new Error(
      'Missing LLM config: set GEMINI_API_KEY or GEMINI_BEARER_TOKEN or GEMINI_ENDPOINT'
    );
  }

  let attempt = 0;
  let lastErr = null;

  const headersBase = { 'Content-Type': 'application/json' };
  if (GEMINI_API_KEY) headersBase['x-goog-api-key'] = GEMINI_API_KEY;
  if (GEMINI_BEARER_TOKEN) headersBase['Authorization'] = `Bearer ${GEMINI_BEARER_TOKEN}`;

  while (attempt < MAX_RETRIES) {
    attempt += 1;
    try {
      // payload using the 'contents' / 'parts' shape you used (keeps backwards compat)
      const payload = {
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ],
      };

      const resp = await axios.post(GEMINI_ENDPOINT, payload, {
        headers: headersBase,
        timeout: TIMEOUT,
        validateStatus: (s) => true, // we'll handle statuses manually
      });

      // log trimmed response for debugging on non-2xx
      if (resp.status >= 400) {
        // auth issues should be surfaced immediately
        if (resp.status === 401 || resp.status === 403) {
          const sample = trim(resp.data);
          throw new Error(`Auth error ${resp.status}: ${sample}`);
        }
        if (resp.status === 429 || resp.status === 503) {
          const err = new Error(`Transient LLM status ${resp.status}`);
          err.retryable = true;
          throw err;
        }
        // 4xx other errors - surface with body
        const body = trim(resp.data);
        throw new Error(`LLM HTTP ${resp.status}: ${body}`);
      }

      // parse text out
      const { text, confidence } = extractTextAndConfidence(resp.data);

      if (text) {
        return { text, confidence };
      }

      // no text found — treat as transient/retryable depending on attempt
      lastErr = new Error(`LLM returned no text; sample: ${trim(resp.data, 800)}`);
      lastErr.retryable = true;
      throw lastErr;
    } catch (err) {
      lastErr = err;
      const status = err?.response?.status || null;
      const retryable =
        err?.retryable ||
        status === 429 ||
        status === 503 ||
        err.code === 'ECONNABORTED' ||
        err.code === 'ENOTFOUND';

      if (!retryable || attempt >= MAX_RETRIES) {
        // final failure — provide helpful diagnostic in message
        const detail = err?.response?.data ? trim(err.response.data, 2000) : err.message;
        console.error(`[LLM] final error (attempt ${attempt}):`, detail);
        throw new Error(`LLM failed: ${detail}`);
      }

      // retry with exponential backoff
      const backoff = BACKOFF_BASE * Math.pow(2, attempt - 1);
      console.warn(`[LLM] transient error (attempt ${attempt}), retrying in ${backoff}ms:`, err.message);
      await wait(backoff);
    }
  }

  throw new Error(`LLM failed after ${MAX_RETRIES} attempts: ${lastErr?.message || 'unknown'}`);
}
