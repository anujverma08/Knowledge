// server/routes/ask.js
import express from 'express';
import NodeCache from 'node-cache';
import Document from '../models/Document.js';
import DocumentChunk from '../models/DocumentChunk.js';
import { getEmbedding } from '../utils/embedding.js';
import { getLLMAnswer } from '../services/llm.js';
import { optionalAuth } from '../middlewares/clerkAuth.js';

const router = express.Router();
const cache = new NodeCache({ stdTTL: 60 }); // cache for 60s

// Vector helpers
function dot(a, b) { return a.reduce((sum, v, i) => sum + v * b[i], 0); }
function norm(a) { return Math.sqrt(a.reduce((sum, v) => sum + v*v, 0)) || 1e-12; }
function cosineSim(a,b){ return dot(a,b)/(norm(a)*norm(b)); }

// POST /api/ask
router.post('/ask', optionalAuth, async (req, res) => {
  const start = Date.now();
  try {
    if (!req.body) {
      return res.status(400).json({ error: 'missing body (enable express.json())' });
    }

    const userId = req.user?.id || 'anon';
    const { query, k = 5, docId } = req.body; // ✅ Extract docId from body
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'query required' });
    }

    // ✅ Fixed: Include docId in cache key
    const cacheKey = `ask:${userId}:${docId || 'all'}:${query.trim().toLowerCase()}:${k}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      console.log('[ask] Cache hit:', cacheKey);
      return res.json({ cached: true, ...cached });
    }

    console.log('[ask] Query:', query, 'DocId:', docId || 'all', 'User:', userId);

    // 1️⃣ Embed query
    let qEmbedding;
    try {
      qEmbedding = await getEmbedding(query);
      if (!Array.isArray(qEmbedding) || qEmbedding.length === 0) {
        throw new Error('empty embedding');
      }
    } catch (err) {
      console.error('[ask] embedding error', err);
      return res.status(502).json({ 
        error: 'embedding_failed', 
        detail: err?.message || String(err) 
      });
    }

    // 2️⃣ Build chunk query filter
    const chunkFilter = { 
      embedding: { $exists: true, $ne: [] } 
    };

    // ✅ Fixed: Filter by document if docId provided
    if (docId) {
      // Verify document exists and user has access
      try {
        const doc = await Document.findById(docId).lean().exec();
        if (!doc) {
          return res.status(404).json({ 
            error: 'document_not_found', 
            detail: 'The specified document does not exist' 
          });
        }

        // Check authorization
        if (doc.visibility !== 'public' && doc.owner_id !== userId) {
          return res.status(403).json({ 
            error: 'forbidden', 
            detail: 'You do not have access to this document' 
          });
        }

        // Add document filter
        chunkFilter.document_id = docId;
        console.log('[ask] Filtering by document:', docId);
      } catch (err) {
        console.error('[ask] Document verification error:', err);
        return res.status(400).json({ 
          error: 'invalid_document_id', 
          detail: 'Invalid document ID format' 
        });
      }
    } else {
      // ✅ When no docId, filter to public docs + user's private docs
      if (userId && userId !== 'anon') {
        const accessibleDocs = await Document.find({
          $or: [
            { visibility: 'public' },
            { owner_id: userId }
          ]
        }).select('_id').lean().exec();

        const docIds = accessibleDocs.map(d => d._id);
        chunkFilter.document_id = { $in: docIds };
        console.log('[ask] Filtering by accessible documents:', docIds.length);
      } else {
        // Anonymous users: only public docs
        const publicDocs = await Document.find({ 
          visibility: 'public' 
        }).select('_id').lean().exec();

        const docIds = publicDocs.map(d => d._id);
        chunkFilter.document_id = { $in: docIds };
        console.log('[ask] Filtering by public documents:', docIds.length);
      }
    }

    // 3️⃣ Fetch candidate chunks
    const CANDIDATE_LIMIT = 2000;
    const candidates = await DocumentChunk.find(chunkFilter)
      .limit(CANDIDATE_LIMIT)
      .lean()
      .exec();

    console.log('[ask] Found candidates:', candidates.length);

    if (!candidates || candidates.length === 0) {
      const ans = { 
        query, 
        docId: docId || null,
        cached: false, 
        answers: [{ 
          text: docId 
            ? "I don't have any content from this document to answer your question." 
            : "I don't know. No evidence was found in the knowledge base.", 
          confidence: 0.0, 
          sources: [] 
        }],
        meta: { 
          vector_results: 0, 
          document_filtered: Boolean(docId),
          elapsed_ms: Date.now()-start 
        } 
      };
      cache.set(cacheKey, ans);
      return res.json(ans);
    }

    // 4️⃣ Score chunks by cosine similarity
    const SIM_THRESHOLD = 0.35;
    let scored = [];
    for (const c of candidates) {
      try {
        const score = cosineSim(qEmbedding, c.embedding);
        if (score >= SIM_THRESHOLD) {
          scored.push({ chunk: c, score });
        }
      } catch (err) { 
        // Skip malformed embeddings
      }
    }

    scored.sort((a,b) => b.score - a.score);
    const top = scored.slice(0, Math.max(k, 20)).map(s => ({ 
      ...s.chunk, 
      score: s.score 
    }));

    console.log('[ask] Top matches:', top.length, 'Best score:', top[0]?.score || 0);

    // 5️⃣ Verify docs/pages exist
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
        docId: docId || null,
        cached: false, 
        answers: [{ 
          text: "I don't know. No relevant evidence was found.", 
          confidence: 0.0, 
          sources: [] 
        }],
        meta: { 
          vector_results: 0,
          document_filtered: Boolean(docId),
          elapsed_ms: Date.now()-start 
        } 
      };
      cache.set(cacheKey, ans);
      return res.json(ans);
    }

    // 6️⃣ Prepare context for LLM
    const contextChunks = verified.slice(0, k).map((c, i) => {
      const doc = docMap.get(String(c.document_id));
      return {
        index: i+1,
        doc_id: String(c.document_id),
        doc_title: doc?.title || doc?.original_name || 'Unknown',
        page: c.page_number,
        score: c.score,
        snippet: c.text.length > 600 ? c.text.slice(0,600) + '…' : c.text
      };
    });

    // 7️⃣ Build RAG prompt
    const prompt = buildRAGPrompt(query, contextChunks, docId ? 'single' : 'multi');

    // 8️⃣ Call LLM
    let llmResp;
    try {
      llmResp = await getLLMAnswer(prompt);
    } catch (err) {
      console.error('[ask] llm error', err);
      return res.status(502).json({ 
        error: 'llm_failed', 
        detail: err?.message || String(err) 
      });
    }

    // 9️⃣ Construct final response
    const payload = {
      query,
      docId: docId || null,
      cached: false,
      answers: [{
        text: llmResp.text || '',
        confidence: llmResp.confidence ?? null,
        sources: contextChunks.map(c => ({
          doc_id: c.doc_id,
          doc_title: c.doc_title,
          page: c.page,
          snippet: c.snippet,
          score: c.score
        }))
      }],
      meta: { 
        vector_results: verified.length,
        document_filtered: Boolean(docId),
        elapsed_ms: Date.now()-start 
      }
    };

    cache.set(cacheKey, payload);
    console.log('[ask] Response ready:', payload.answers[0].sources.length, 'sources');
    return res.json(payload);

  } catch (err) {
    console.error('[ask] unexpected', err);
    return res.status(500).json({ 
      error: 'internal_error',
      detail: err.message 
    });
  }
});

// Build RAG prompt
function buildRAGPrompt(query, contextChunks, mode = 'multi') {
  let p = `You are a helpful assistant answering questions using ONLY the provided evidence.\n\n`;
  p += `User question:\n"""${query}"""\n\n`;
  p += `Evidence from ${mode === 'single' ? 'the document' : 'knowledge base'}:\n`;
  
  contextChunks.forEach(c => {
    p += `\n[${c.index}] ${c.doc_title} (page ${c.page}, relevance: ${c.score.toFixed(3)})\n`;
    p += `${c.snippet}\n`;
  });
  
  p += `\nINSTRUCTIONS:\n`;
  p += `1) Answer using ONLY the evidence above. Do not use external knowledge.\n`;
  p += `2) Cite sources using inline citations like [1], [2], etc.\n`;
  p += `3) If the evidence doesn't contain the answer, say "I don't know based on the provided documents."\n`;
  p += `4) Be concise and specific.\n`;
  p += `5) If multiple documents are relevant, synthesize information from all of them.\n\n`;
  p += `Answer:\n`;
  
  return p;
}

export default router;
