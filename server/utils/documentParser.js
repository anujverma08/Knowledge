// server/utils/documentParser.js
import fs from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import { getEmbedding } from '../gemini.js';
import DocumentChunk from '../models/DocumentChunk.js';

async function parseAndSaveChunks(doc, filePath) {
    try {
        const ext = path.extname(filePath).toLowerCase();
        let text = '';

        if (ext === '.pdf') {
            const dataBuffer = fs.readFileSync(filePath);
            const pdfData = await pdfParse(dataBuffer);
            text = pdfData.text;
        } else if (ext === '.docx') {
            const result = await mammoth.extractRawText({ path: filePath });
            text = result.value;
        } else if (ext === '.txt') {
            text = fs.readFileSync(filePath, 'utf-8');
        } else {
            console.warn('Unsupported file type for parsing:', ext);
        }

        const lines = text.split(/\n\s*\n/);
        const chunks = [];

        for (let idx = 0; idx < lines.length; idx++) {
            const line = lines[idx].trim();
            if (!line) continue;

            const embedding = await getEmbedding(line);

            chunks.push({
                document_id: doc._id,
                text: line,
                page: idx + 1,
                embedding,
            });
        }

        if (chunks.length > 0) {
            await DocumentChunk.insertMany(chunks);
        }

        doc.pages = chunks.length;
        doc.status = 'indexed';
        await doc.save();
    } catch (err) {
        console.error('Error parsing and saving chunks:', err);
    }
}

export { parseAndSaveChunks };
