// server/routes/docs.js
import express from 'express';
import multer from 'multer';
import path from 'path';
import { v2 as cloudinary } from 'cloudinary';
import streamifier from 'streamifier';

import Document from '../models/Document.js';
import DocumentChunk from '../models/DocumentChunk.js';
import { parseFileByExtension } from '../utils/documentProcessing.js';
import { getEmbedding } from '../utils/embedding.js';

const router = express.Router();

// Configure Cloudinary from env
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Multer memory storage so file is available as buffer
const storage = multer.memoryStorage();
const upload = multer({ storage });

/**
 * uploadBufferToCloudinary
 * - buffer: Buffer
 * - filename: original filename (used for public_id suggestion)
 * - resource_type: 'auto' (supports pdf/raw/etc)
 * Returns the upload result object from Cloudinary
 */
function uploadBufferToCloudinary(buffer, filename, resource_type = 'auto') {
  return new Promise((resolve, reject) => {
    const ext = path.extname(filename) || '';
    // create a safe public_id (strip ext and whitespace)
    const baseName = path.basename(filename, ext).replace(/\s+/g, '_').slice(0, 120);

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type,
        folder: process.env.CLOUDINARY_FOLDER || 'documents',
        public_id: `${baseName}_${Date.now()}`,
        overwrite: false,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );

    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
}

/**
 * POST /api/docs
 * - multipart/form-data with field 'file'
 * - stores document record with cloud metadata
 */
router.post('/docs', upload.single('file'), async (req, res) => {
  try {
    const ownerId = req.user?.id || 'test-user'; // temporary
    if (!req.file) return res.status(400).json({ error: 'FILE_REQUIRED' });

    const { originalname, buffer, mimetype } = req.file;
    const ext = path.extname(originalname).toLowerCase();

    // 1) Upload to Cloudinary
    let cloudResult;
    try {
      // resource_type 'auto' lets Cloudinary detect raw/pdf etc.
      cloudResult = await uploadBufferToCloudinary(buffer, originalname, 'auto');
    } catch (err) {
      console.error('[docs] cloud upload failed', err);
      return res.status(500).json({ error: 'CLOUD_UPLOAD_FAILED', detail: err.message || String(err) });
    }

    // 2) Create document record with cloud metadata
    const newDoc = new Document({
      file_name: originalname, // keep original filename for readability
      original_name: originalname,
      title: req.body.title || originalname,
      owner_id: ownerId,
      visibility: req.body.visibility === 'public' ? 'public' : 'private',
      status: 'pending',
      pages: 0,
      cloud_url: cloudResult.secure_url || cloudResult.url || '',
      cloud_public_id: cloudResult.public_id || '',
      cloud_resource_type: cloudResult.resource_type || 'auto',
    });

    await newDoc.save();

    // 3) Parse file into pages/chunks
    // NOTE: parseFileByExtension should accept a Buffer. If it currently expects a file path,
    // either update it to accept buffers or download from cloudResult.secure_url temporarily.
    let pages;
    try {
      pages = await parseFileByExtension(ext, buffer); // prefer buffer-friendly implementation
      if (!Array.isArray(pages)) pages = [String(pages || '')];
    } catch (err) {
      console.error('[docs] parse error (buffer)', err);
      // As a fallback, try parsing from the Cloudinary URL if your parser supports URLs
      try {
        pages = await parseFileByExtension(ext, cloudResult.secure_url);
        if (!Array.isArray(pages)) pages = [String(pages || '')];
      } catch (err2) {
        console.error('[docs] parse fallback also failed', err2);
        // Cleanup: consider deleting the cloud asset if parse is critical (optional)
        return res.status(400).json({ error: 'EXT_NOT_SUPPORTED', detail: err2.message || String(err2) });
      }
    }

    newDoc.pages = pages.length;
    await newDoc.save();

    // 4) Create DocumentChunk entries — embedding optional (best to enqueue in prod)
    for (let i = 0; i < pages.length; i++) {
      const text = pages[i] || '';
      if (!text.trim()) continue;

      let embedding = [];
      try {
        const emb = await getEmbedding(text);
        if (Array.isArray(emb)) embedding = emb;
      } catch (err) {
        // Log embed failure but don't fail the upload
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

    // 5) Finalize doc status
    newDoc.status = 'indexed';
    await newDoc.save();

    res.status(201).json({
      message: 'uploaded',
      documentId: newDoc._id,
      pagesCount: pages.length,
      cloud_url: newDoc.cloud_url,
      cloud_public_id: newDoc.cloud_public_id,
    });
  } catch (err) {
    console.error('[docs] unexpected', err);
    res.status(500).json({ error: 'UPLOAD_FAILED', detail: err.message || String(err) });
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
