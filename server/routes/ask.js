// server/routes/ask.js
import express from 'express';
import NodeCache from 'node-cache';
import Document from '../models/Document.js';
import DocumentChunk from '../models/DocumentChunk.js';
import { getEmbedding } from '../utils/embedding.js';
import { getLLMAnswer } from '../services/llm.js';

const router = express.Router();
const cache = new NodeCache({ stdTTL: 60 }); // cache for 60s

// vector helpers
function dot(a, b) { return a.reduce((sum, v, i) => sum + v * b[i], 0); }
function norm(a) { return Math.sqrt(a.reduce((sum, v) => sum + v*v, 0)) || 1e-12; }
function cosineSim(a,b){ return dot(a,b)/(norm(a)*norm(b)); }

// POST /api/ask
router.post('/ask', async (req, res) => {
  const start = Date.now();
  try {
    if (!req.body) return res.status(400).json({ error: 'missing body (enable express.json())' });

    const userId = req.user?.id || 'anon-test';
    const { query, k = 5 } = req.body;
    if (!query || typeof query !== 'string') return res.status(400).json({ error: 'query required' });

    // cache key
    const cacheKey = `ask:${userId}:${query.trim().toLowerCase()}:${k}`;
    const cached = cache.get(cacheKey);
    if (cached) return res.json({ cached: true, ...cached });

    // 1️⃣ Embed query
    let qEmbedding;
    try {
      qEmbedding = await getEmbedding(query);
      if (!Array.isArray(qEmbedding) || qEmbedding.length === 0) throw new Error('empty embedding');
    } catch (err) {
      console.error('[ask] embedding error', err);
      return res.status(502).json({ error: 'embedding_failed', detail: err?.message || String(err) });
    }

    // 2️⃣ Fetch candidate chunks
    const CANDIDATE_LIMIT = 2000;
    const candidates = await DocumentChunk.find({ embedding: { $exists: true, $ne: [] } })
      .limit(CANDIDATE_LIMIT).lean().exec();

    if (!candidates || candidates.length === 0) {
      const ans = { 
        query, 
        cached: false, 
        answers: [{ text: "I don't know. No evidence was found.", confidence: 0.0, sources: [] }],
        meta: { vector_results: 0, elapsed_ms: Date.now()-start } 
      };
      cache.set(cacheKey, ans);
      return res.json(ans);
    }

    // 3️⃣ Score chunks by cosine similarity
    const SIM_THRESHOLD = 0.4;
    let scored = [];
    for (const c of candidates) {
      try {
        const score = cosineSim(qEmbedding, c.embedding);
        if (score >= SIM_THRESHOLD) scored.push({ chunk: c, score });
      } catch (err) { /* skip */ }
    }

    scored.sort((a,b) => b.score - a.score);
    const top = scored.slice(0, Math.max(k, 20)).map(s => ({ ...s.chunk, score: s.score }));

    // 4️⃣ Verify docs/pages exist
    const docIds = [...new Set(top.map(t => String(t.document_id)))];
    const docs = await Document.find({ _id: { $in: docIds } }).lean().exec();
    const docMap = new Map(docs.map(d => [String(d._id), d]));

    const verified = top.filter(t => {
      const d = docMap.get(String(t.document_id));
      if (!d) return false;
      if (!d.pages) return true;
      return t.page_number <= d.pages;
    });

    if (verified.length === 0) {
      const ans = { 
        query, 
        cached: false, 
        answers: [{ text: "I don't know. No evidence was found.", confidence: 0.0, sources: [] }],
        meta: { vector_results: 0, elapsed_ms: Date.now()-start } 
      };
      cache.set(cacheKey, ans);
      return res.json(ans);
    }

    // 5️⃣ Prepare context for LLM (trim snippets)
    const contextChunks = verified.slice(0, k).map((c, i) => ({
      index: i+1,
      doc_id: String(c.document_id),
      page: c.page_number,
      score: c.score,
      snippet: c.text.length > 500 ? c.text.slice(0,500) + '…' : c.text
    }));

    // 6️⃣ Build strict RAG prompt
    const prompt = buildRAGPrompt(query, contextChunks);

    // 7️⃣ Call LLM
    let llmResp;
    try {
      llmResp = await getLLMAnswer(prompt); // { text, confidence? }
    } catch (err) {
      console.error('[ask] llm error', err);
      return res.status(502).json({ error: 'llm_failed', detail: err?.message || String(err) });
    }

    // 8️⃣ Construct final response
    const payload = {
      query,
      cached: false,
      answers: [{
        text: llmResp.text || '',
        confidence: llmResp.confidence ?? null,
        sources: contextChunks.map(c => ({
          doc_id: c.doc_id, page: c.page, snippet: c.snippet, score: c.score
        }))
      }],
      meta: { vector_results: verified.length, elapsed_ms: Date.now()-start }
    };

    cache.set(cacheKey, payload);
    return res.json(payload);

  } catch (err) {
    console.error('[ask] unexpected', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// strict RAG prompt
function buildRAGPrompt(query, contextChunks) {
  let p = `You are an assistant answering a user's question using ONLY the evidence provided.\n\nUser question:\n"""${query}"""\n\nEvidence:\n`;
  contextChunks.forEach(c => {
    p += `\n[${c.index}] (doc:${c.doc_id} page:${c.page} score:${c.score.toFixed(4)})\n${c.snippet}\n`;
  });
  p += `\nINSTRUCTIONS:\n`;
  p += `1) Use ONLY the evidence above.\n`;
  p += `2) For any claim include an inline citation like [1].\n`;
  p += `3) If you cannot answer, reply exactly: "I don't know".\n`;
  p += `4) Keep concise.\n\nAnswer:\n`;
  return p;
}

export default router;
    