// server/routes/index.js
import express from 'express';
import docsRouter from './docs.js';
import askRouter from './ask.js';
import adminRouter from './admin.js';
const router = express.Router();

// Mount child routers under root of /api (server will mount this router at /api)
router.use('', docsRouter); // maps /docs, /docs/:id
router.use('', askRouter);  // maps /ask
router.use('/admin', adminRouter); // maps /admin
export default router;
