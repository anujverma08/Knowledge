// server/routes/index.js
import express from 'express';
import docsRouter from './docs.js';
import askRouter from './ask.js';
import adminRouter from './admin.js';
import { clerkAuthMiddleware } from '../middlewares/clerkAuth.js';
import { requireRole } from '../middleware/requireRole.js';
const router = express.Router();

// Mount child routers under root of /api (server will mount this router at /api)
router.use('', docsRouter); // maps /docs, /docs/:id
router.use('', askRouter);  // maps /ask
router.use('/admin', clerkAuthMiddleware, requireRole('admin'), adminRouter); // maps /admin
export default router;
