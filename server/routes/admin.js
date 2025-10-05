// server/routes/admin.js
import express from 'express';
import Document from '../models/Document.js';
import DocumentChunk from '../models/DocumentChunk.js';
import IndexMeta from '../models/IndexMeta.js';
import { parseFileByExtension } from '../utils/documentProcessing.js';
import { getEmbedding } from '../utils/embedding.js';
import { adminOnly } from '../middlewares/adminOnly.js';

const adminRouter = express.Router();

// ✅ Apply authentication to all admin routes
adminRouter.use(adminOnly);

// GET /api/admin/stats
adminRouter.get('/stats', async (req, res) => {
  try {
    console.log('[admin] Stats requested by user:', req.user.id);
    
    const totalDocs = await Document.countDocuments();
    const totalChunks = await DocumentChunk.countDocuments();
    const indexedDocs = await Document.countDocuments({ status: 'indexed' });
    const pendingDocs = await Document.countDocuments({ status: 'pending' });
    const failedDocs = await Document.countDocuments({ status: 'failed' });
    const meta = await IndexMeta.findOne() || {};

    res.json({
      total_docs: totalDocs,
      indexed_docs: indexedDocs,
      pending_docs: pendingDocs,
      failed_docs: failedDocs,
      total_chunks: totalChunks,
      last_rebuild: meta.last_rebuild || null,
      last_error: meta.last_error || null,
    });
  } catch (err) {
    console.error('[admin] stats error', err);
    res.status(500).json({ error: 'internal_error', detail: err.message });
  }
});

// POST /api/admin/rebuild
adminRouter.post('/rebuild', async (req, res) => {
  try {
    console.log('[admin] Rebuild requested by user:', req.user.id);
    
    // Respond immediately
    res.json({ message: 'Index rebuild started in background' });

    // Run rebuild in background
    setImmediate(async () => {
      try {
        console.log('[admin] Starting index rebuild...');
        
        // Mark rebuild as started
        await IndexMeta.findOneAndUpdate({}, {
          last_rebuild: new Date(),
          rebuild_in_progress: true,
        }, { upsert: true });

        const allDocs = await Document.find({ status: 'indexed' }).lean();
        let totalChunks = 0;
        let errors = [];

        for (const doc of allDocs) {
          try {
            console.log('[admin] Rebuilding doc:', doc._id, doc.original_name);
            
            // Delete existing chunks for this document
            await DocumentChunk.deleteMany({ document_id: doc._id });

            // Re-fetch from cloud if needed, or use stored data
            // For now, we'll re-create embeddings from existing chunks
            const existingChunks = await DocumentChunk.find({ 
              document_id: doc._id 
            }).lean();

            if (existingChunks.length === 0) {
              console.warn('[admin] No chunks found for doc:', doc._id);
              continue;
            }

            // Re-generate embeddings
            for (const chunk of existingChunks) {
              try {
                const embedding = await getEmbedding(chunk.text);
                
                await DocumentChunk.updateOne(
                  { document_id: doc._id, page_number: chunk.page_number },
                  { 
                    text: chunk.text, 
                    embedding,
                    document_id: doc._id, 
                    page_number: chunk.page_number 
                  },
                  { upsert: true }
                );
                
                totalChunks++;
              } catch (embErr) {
                console.error('[admin] Embedding failed for doc', doc._id, 'page', chunk.page_number, embErr);
                errors.push(`Doc ${doc._id} page ${chunk.page_number}: ${embErr.message}`);
              }
            }
          } catch (docErr) {
            console.error('[admin] Failed to rebuild doc:', doc._id, docErr);
            errors.push(`Doc ${doc._id}: ${docErr.message}`);
          }
        }

        // Update meta with results
        await IndexMeta.findOneAndUpdate({}, {
          last_rebuild: new Date(),
          last_error: errors.length > 0 ? errors.join('; ') : null,
          total_docs: allDocs.length,
          total_chunks: totalChunks,
          rebuild_in_progress: false,
        }, { upsert: true });

        console.log('[admin] Index rebuild finished. Total chunks:', totalChunks, 'Errors:', errors.length);
      } catch (err) {
        console.error('[admin] Index rebuild failed', err);
        await IndexMeta.findOneAndUpdate({}, {
          last_error: err.message,
          last_rebuild: new Date(),
          rebuild_in_progress: false,
        }, { upsert: true });
      }
    });

  } catch (err) {
    console.error('[admin] Rebuild API error', err);
    res.status(500).json({ error: 'internal_error', detail: err.message });
  }
});

export default adminRouter;
