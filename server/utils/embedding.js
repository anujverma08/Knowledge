// server/services/gemini.js
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const EMBEDDING_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent';

if (!GEMINI_API_KEY) {
  console.warn('⚠️ Warning: GEMINI_API_KEY not found in environment variables.');
}

const client = axios.create({
  baseURL: EMBEDDING_URL,
  headers: {
    'Content-Type': 'application/json',
    'x-goog-api-key': GEMINI_API_KEY, // correct header for Gemini public API
  },
  timeout: 60_000,
});

// Utility: delay helper
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Exponential backoff with jitter
function calcDelay(attempt, initial = 200, max = 5000) {
  const backoff = Math.min(max, initial * Math.pow(2, attempt - 1));
  const jitter = Math.random() * backoff * 0.5;
  return Math.floor(backoff + jitter);
}

/**
 * 🔹 getEmbedding(text)
 * Returns: float[] embedding for the given text.
 * Retries automatically on 503 / network errors.
 */
export async function getEmbedding(text, options = {}) {
  const {
    maxAttempts = 5,
    initialDelay = 300,
    maxDelay = 4000,
  } = options;

  if (!text || typeof text !== 'string') {
    throw new Error('Invalid text for embedding');
  }

  let attempt = 0;
  while (attempt < maxAttempts) {
    attempt++;
    try {
      const payload = {
        content: {
          parts: [{ text }],
        },
      };

      const response = await client.post('', payload);

      if (!response?.data?.embedding?.values) {
        throw new Error('Unexpected embedding response structure');
      }

      return response.data.embedding.values;

    } catch (err) {
      const status = err?.response?.status;
      const message = err?.response?.data?.error?.message || err.message;

      console.error(`[Gemini] Embedding attempt ${attempt}/${maxAttempts} failed:`, message);

      // Permanent error — stop retrying
      if (status && status >= 400 && status < 500 && status !== 429) {
        throw new Error(`Gemini API Error ${status}: ${message}`);
      }

      // Too many retries — give up
      if (attempt >= maxAttempts) {
        throw new Error(`Failed to fetch embedding after ${maxAttempts} attempts`);
      }

      // Wait before retrying
      const delay = calcDelay(attempt, initialDelay, maxDelay);
      console.log(`[Gemini] Retrying in ${delay}ms...`);
      await sleep(delay);
    }
  }

  throw new Error('Embedding failed after all retries.');
}

/**
 * 🔹 getBatchEmbeddings(texts[])
 * Optional helper for batching multiple texts in one go.
 */
export async function getBatchEmbeddings(texts) {
  if (!Array.isArray(texts) || texts.length === 0) {
    throw new Error('texts must be a non-empty array');
  }

  const results = [];
  for (const text of texts) {
    try {
      const emb = await getEmbedding(text);
      results.push(emb);
    } catch (err) {
      console.error('[Gemini] Skipping failed text embedding:', err.message);
      results.push([]);
    }
  }
  return results;
}
