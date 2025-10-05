// server/services/llm.js
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || null;
const GEMINI_ENDPOINT =
  process.env.GEMINI_ENDPOINT ||
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent';

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

function extractTextAndConfidence(respData) {
  if (!respData) return { text: null, confidence: null };

  const cand = respData?.candidates?.[0];
  if (cand) {
    const parts = cand?.content?.parts;
    if (Array.isArray(parts) && parts.length > 0) {
      const text = parts.map(p => p.text || '').join('').trim();
      if (text) {
        return { text, confidence: cand?.safetyRatings?.[0]?.probability ?? null };
      }
    }
  }

  return { text: null, confidence: null };
}

export async function getLLMAnswer(prompt) {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is required');
  }

  let attempt = 0;
  let lastErr = null;

  while (attempt < MAX_RETRIES) {
    attempt += 1;
    try {
      const payload = {
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ],
      };

      const url = GEMINI_API_KEY 
        ? `${GEMINI_ENDPOINT}?key=${GEMINI_API_KEY}`
        : GEMINI_ENDPOINT;

      const resp = await axios.post(url, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: TIMEOUT,
        validateStatus: () => true,
      });

      if (resp.status >= 400) {
        if (resp.status === 401 || resp.status === 403) {
          throw new Error(`Auth error ${resp.status}: Check your GEMINI_API_KEY`);
        }
        if (resp.status === 429 || resp.status === 503) {
          const err = new Error(`Rate limit or service unavailable: ${resp.status}`);
          err.retryable = true;
          throw err;
        }
        throw new Error(`LLM HTTP ${resp.status}: ${trim(resp.data)}`);
      }

      const { text, confidence } = extractTextAndConfidence(resp.data);

      if (text) {
        return { text, confidence };
      }

      lastErr = new Error(`No text in response: ${trim(resp.data, 800)}`);
      lastErr.retryable = true;
      throw lastErr;
    } catch (err) {
      lastErr = err;
      const status = err?.response?.status || null;
      const retryable =
        err?.retryable ||
        status === 429 ||
        status === 503 ||
        err.code === 'ECONNABORTED';

      if (!retryable || attempt >= MAX_RETRIES) {
        const detail = err?.response?.data ? trim(err.response.data) : err.message;
        console.error(`[LLM] Final error (attempt ${attempt}):`, detail);
        throw new Error(`LLM failed: ${detail}`);
      }

      const backoff = BACKOFF_BASE * Math.pow(2, attempt - 1);
      console.warn(`[LLM] Retry ${attempt}/${MAX_RETRIES} in ${backoff}ms:`, err.message);
      await wait(backoff);
    }
  }

  throw lastErr;
}
