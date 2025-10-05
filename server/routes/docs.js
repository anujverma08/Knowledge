// server/routes/docs.js
import express from 'express';
import multer from 'multer';
import path from 'path';
import Document from '../models/Document.js';
import DocumentChunk from '../models/DocumentChunk.js';
import { parseFileByExtension } from '../utils/documentProcessing.js';
import { getEmbedding } from '../utils/embedding.js';

const router = express.Router();
const upload = multer({ dest: path.join(process.cwd(), 'uploads') });

// POST /api/docs (upload)
router.post('/docs', upload.single('file'), async (req, res) => {
  try {
    const ownerId = req.user?.id || 'test-user'; // temporary
    if (!req.file) return res.status(400).json({ error: 'FILE_REQUIRED' });

    const { originalname, filename, path: filePath } = req.file;
    const ext = path.extname(originalname).toLowerCase();

    const newDoc = new Document({
      file_name: filename,
      original_name: originalname,
      title: req.body.title || originalname,
      owner_id: ownerId,
      visibility: req.body.visibility === 'public' ? 'public' : 'private',
      status: 'pending',
      pages: 0,
    });
    await newDoc.save();

    // parse -> array of page/chunk text
    let pages;
    try {
      pages = await parseFileByExtension(ext, filePath);
      if (!Array.isArray(pages)) pages = [String(pages || '')];
    } catch (err) {
      console.error('[docs] parse error', err);
      return res.status(400).json({ error: 'EXT_NOT_SUPPORTED' });
    }

    newDoc.pages = pages.length;
    await newDoc.save();

    // sequentially create chunks (embedding optional)
    for (let i = 0; i < pages.length; i++) {
      const text = pages[i] || '';
      if (!text.trim()) continue;

      let embedding = [];
      try {
        const emb = await getEmbedding(text); // may throw if not configured
        if (Array.isArray(emb)) embedding = emb;
      } catch (err) {
        console.warn(`[docs] embedding failed for doc ${newDoc._id} page ${i + 1}:`, err?.message || err);
      }

      const chunk = new DocumentChunk({
        document_id: newDoc._id,
        page_number: i + 1,
        text,
        embedding,
      });
      await chunk.save();
    }

    newDoc.status = 'indexed';
    await newDoc.save();

    res.status(201).json({ message: 'uploaded', documentId: newDoc._id, pagesCount: pages.length });
  } catch (err) {
    console.error('[docs] unexpected', err);
    res.status(500).json({ error: 'UPLOAD_FAILED' });
  }
});

// GET /api/docs (list, with pagination)
router.get('/docs', async (req, res) => {
  try {
    const limit = Math.min(100, parseInt(req.query.limit) || 10);
    const offset = parseInt(req.query.offset) || 0;
    const ownerId = req.user?.id || null;

    const query = ownerId ? { $or: [{ visibility: 'public' }, { owner_id: ownerId }] } : { visibility: 'public' };
    const total = await Document.countDocuments(query);
    const items = await Document.find(query).sort({ createdAt: -1 }).skip(offset).limit(limit).lean().exec();

    res.json({ limit, offset, total, items });
  } catch (err) {
    console.error('[docs:list] error', err);
    res.status(500).json({ error: 'failed' });
  }
});

// GET /api/docs/:id
router.get('/docs/:id', async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id).lean().exec();
    if (!doc) return res.status(404).json({ error: 'not_found' });

    const ownerId = req.user?.id || null;
    if (doc.visibility !== 'public' && doc.owner_id !== ownerId) return res.status(403).json({ error: 'forbidden' });

    res.json(doc);
  } catch (err) {
    console.error('[docs:get] error', err);
    res.status(500).json({ error: 'failed' });
  }
});

export default router;
