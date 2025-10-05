import express from 'express';
import Document from '../models/Document.js';
import DocumentChunk from '../models/DocumentChunk.js';
import IndexMeta from '../models/IndexMeta.js';
import { parseFileByExtension } from '../utils/documentProcessing.js';
import { getEmbedding } from '../utils/embedding.js';

const adminRouter = express.Router();

// GET /api/index/stats
adminRouter.get('/index/stats', async (req, res) => {
  try {
    const totalDocs = await Document.countDocuments();
    const totalChunks = await DocumentChunk.countDocuments();
    const meta = await IndexMeta.findOne() || {};

    res.json({
      total_docs: totalDocs,
      total_chunks: totalChunks,
      last_rebuild: meta.last_rebuild || null,
      last_error: meta.last_error || null,
    });
  } catch (err) {
    console.error('[admin] stats error', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /api/index/rebuild
adminRouter.post('/ index/rebuild', async (req, res) => {
  try {
    // immediately respond so admin doesn't wait
    res.json({ message: 'Index rebuild started in background' });

    setImmediate(async () => {
      try {
        console.log('[admin] starting index rebuild...');
        const allDocs = await Document.find({}).lean();
        let totalChunks = 0;

        for (const doc of allDocs) {
          const pages = await parseFileByExtension(doc.original_name, `uploads/${doc.file_name}`);
          for (let i = 0; i < pages.length; i++) {
            const text = pages[i];
            const embedding = await getEmbedding(text).catch(err => {
              console.error('Embedding failed for doc', doc._id, 'page', i+1, err);
              return null;
            });
            if (!embedding) continue;

            await DocumentChunk.updateOne(
              { document_id: doc._id, page_number: i+1 },
              { text, embedding, document_id: doc._id, page_number: i+1 },
              { upsert: true }
            );
            totalChunks++;
          }
        }

        await IndexMeta.findOneAndUpdate({}, {
          last_rebuild: new Date(),
          last_error: null,
          total_docs: allDocs.length,
          total_chunks: totalChunks,
        }, { upsert: true });

        console.log('[admin] index rebuild finished successfully');
      } catch (err) {
        console.error('[admin] index rebuild failed', err);
        await IndexMeta.findOneAndUpdate({}, {
          last_error: err.message,
          last_rebuild: new Date(),
        }, { upsert: true });
      }
    });

  } catch (err) {
    console.error('[admin] rebuild API error', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

export default adminRouter;
