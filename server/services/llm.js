// server/services/llm.js
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

export async function getLLMAnswer(prompt) {
  if (!GEMINI_API_KEY) throw new Error('Missing GEMINI_API_KEY');

  try {
    const response = await axios.post(
      GEMINI_URL,
      {
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ],
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': GEMINI_API_KEY,
        },
      }
    );

    const text =
      response.data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No answer generated';
    const confidence =
      response.data?.candidates?.[0]?.safetyRatings?.[0]?.probability || null;

    return { text, confidence };
  } catch (err) {
    console.error('[LLM] error:', err.response?.data || err.message);
    throw new Error('Failed to generate LLM answer');
  }
}
