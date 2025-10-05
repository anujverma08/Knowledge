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
import { requireAuth, optionalAuth } from '../middlewares/clerkAuth.js';

const router = express.Router();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Multer configuration
const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.txt'];
const ALLOWED_MIMETYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain'
];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return cb(new Error(`Invalid file type. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`));
    }
    
    if (!ALLOWED_MIMETYPES.includes(file.mimetype)) {
      return cb(new Error('Invalid file MIME type'));
    }
    
    cb(null, true);
  }
});

function uploadBufferToCloudinary(buffer, filename, resource_type = 'auto') {
  return new Promise((resolve, reject) => {
    const ext = path.extname(filename) || '';
    const baseName = path.basename(filename, ext).replace(/\s+/g, '_').slice(0, 120);

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type,
        folder: process.env.CLOUDINARY_FOLDER || 'documents',
        public_id: `${baseName}_${Date.now()}`,
        overwrite: false,
        flags: resource_type === 'raw' || ext === '.pdf' ? 'attachment' : undefined,
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
 * POST /api/docs - Upload (requires authentication)
 */
router.post('/docs', requireAuth, upload.single('file'), async (req, res) => {
  try {
    const ownerId = req.user.id;
    
    console.log('[docs] Upload request from user:', ownerId);
    
    if (!req.file) {
      return res.status(400).json({ error: 'FILE_REQUIRED' });
    }

    const { originalname, buffer } = req.file;
    const ext = path.extname(originalname).toLowerCase();

    console.log(`[docs] Processing: ${originalname} (${(buffer.length / 1024).toFixed(2)} KB)`);

    // Upload to Cloudinary
    let cloudResult;
    try {
      const resourceType = ext === '.pdf' ? 'raw' : 'auto';
      cloudResult = await uploadBufferToCloudinary(buffer, originalname, resourceType);
      console.log('[docs] Cloudinary upload successful:', cloudResult.public_id);
    } catch (err) {
      console.error('[docs] Cloudinary upload failed:', err);
      return res.status(500).json({ 
        error: 'CLOUD_UPLOAD_FAILED', 
        detail: err.message 
      });
    }

    // Create document record
    const newDoc = new Document({
      file_name: originalname,
      original_name: originalname,
      title: req.body.title || originalname,
      owner_id: ownerId,
      visibility: req.body.visibility === 'public' ? 'public' : 'private',
      status: 'pending',
      pages: 0,
      cloud_url: cloudResult.secure_url || cloudResult.url,
      cloud_public_id: cloudResult.public_id,
      cloud_resource_type: cloudResult.resource_type,
    });

    await newDoc.save();
    console.log('[docs] Document created:', newDoc._id);

    // Parse file
    let pages;
    try {
      pages = await parseFileByExtension(ext, buffer);
      if (!Array.isArray(pages)) {
        pages = [String(pages || '')];
      }
      console.log(`[docs] Parsed ${pages.length} chunks`);
    } catch (err) {
      console.error('[docs] Parse error:', err);
      newDoc.status = 'failed';
      await newDoc.save();
      return res.status(400).json({ 
        error: 'PARSE_FAILED', 
        detail: err.message 
      });
    }

    newDoc.pages = pages.length;
    await newDoc.save();

    // Create chunks
    const chunkPromises = pages.map(async (text, i) => {
      if (!text.trim()) return null;

      let embedding = [];
      try {
        const emb = await getEmbedding(text);
        if (Array.isArray(emb)) embedding = emb;
      } catch (err) {
        console.warn(`[docs] Embedding failed for page ${i + 1}:`, err?.message);
      }

      const chunk = new DocumentChunk({
        document_id: newDoc._id,
        page_number: i + 1,
        text,
        embedding,
      });

      return chunk.save();
    });

    await Promise.all(chunkPromises);

    // Finalize
    newDoc.status = 'indexed';
    await newDoc.save();

    res.status(201).json({
      message: 'uploaded',
      documentId: newDoc._id,
      pagesCount: pages.length,
      cloud_url: newDoc.cloud_url,
      cloud_public_id: newDoc.cloud_public_id,
      document: newDoc,
    });
  } catch (err) {
    console.error('[docs] Unexpected error:', err);
    res.status(500).json({ 
      error: 'UPLOAD_FAILED', 
      detail: err.message 
    });
  }
});

// Multer error handler
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ 
        error: 'FILE_TOO_LARGE', 
        detail: `Max file size is ${MAX_FILE_SIZE / (1024 * 1024)}MB` 
      });
    }
    return res.status(400).json({ error: err.message });
  }
  
  if (err) {
    return res.status(400).json({ error: err.message });
  }
  
  next();
});

/**
 * GET /api/docs - List documents (optional auth)
 */
router.get('/docs', optionalAuth, async (req, res) => {
  try {
    const limit = Math.min(100, parseInt(req.query.limit) || 10);
    const offset = parseInt(req.query.offset) || 0;
    
    const ownerId = req.user?.id || null;

    let query;
    if (ownerId) {
      query = { 
        $or: [
          { visibility: 'public' }, 
          { owner_id: ownerId }
        ] 
      };
      console.log('[docs:list] Authenticated user:', ownerId);
    } else {
      query = { visibility: 'public' };
      console.log('[docs:list] Unauthenticated request');
    }

    const total = await Document.countDocuments(query);
    const items = await Document.find(query)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .lean()
      .exec();

    console.log(`[docs:list] Returning ${items.length} documents (total: ${total})`);

    res.json({ 
      limit, 
      offset, 
      total,
      next_offset: offset + items.length < total ? offset + items.length : null,
      items 
    });
  } catch (err) {
    console.error('[docs:list] Error:', err);
    res.status(500).json({ error: 'LIST_FAILED', detail: err.message });
  }
});

/**
 * GET /api/docs/:id - Get single document (optional auth)
 */
router.get('/docs/:id', optionalAuth, async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id).lean().exec();
    if (!doc) {
      return res.status(404).json({ error: 'NOT_FOUND' });
    }

    const ownerId = req.user?.id || null;
    
    if (doc.visibility !== 'public' && doc.owner_id !== ownerId) {
      return res.status(403).json({ error: 'FORBIDDEN' });
    }

    res.json(doc);
  } catch (err) {
    console.error('[docs:get] Error:', err);
    res.status(500).json({ error: 'GET_FAILED', detail: err.message });
  }
});

export default router;
