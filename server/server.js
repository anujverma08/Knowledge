// server/server.js

import dotenv from 'dotenv';
dotenv.config(); // MUST run before any clerk import


import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';

import apiRouter from './routes/index.js';

import { clerkAuthMiddleware } from './middlewares/clerkAuth.js'; // Import middleware



const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Apply Clerk middleware globally to all /api routes or selectively
// Example: Protect all /api/docs routes
// app.use('/api/docs', clerkAuthMiddleware, apiRouter.docs);
// Or protect whole api namespace:
app.use('/api', clerkAuthMiddleware, apiRouter);

// app.use('/api', apiRouter);

// MongoDB connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/knowledge_scout';
mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
