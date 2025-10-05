// server/utils/documentProcessing.js
import { createRequire } from 'module';
import mammoth from 'mammoth';

// Create require for CommonJS modules (pdf-parse is CommonJS)
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

/**
 * Parse PDF buffer -> pages array
 */
async function parsePDFBuffer(buffer) {
  const data = await pdfParse(buffer);
  // Split on form feed or fallback to chunks
  const pages = data.text.split(/\f/).map(p => p.trim()).filter(Boolean);
  if (pages.length > 0) return pages;
  
  // Fallback: chunk by paragraphs
  const text = data.text || '';
  return chunkText(text, 2000);
}

/**
 * Parse DOCX buffer -> pages array
 */
async function parseDOCXBuffer(buffer) {
  const result = await mammoth.extractRawText({ buffer });
  const pages = result.value.split(/\f/).map(p => p.trim()).filter(Boolean);
  if (pages.length > 0) return pages;
  
  return chunkText(result.value || '', 2000);
}

/**
 * Parse TXT buffer -> pages array
 */
async function parseTXTBuffer(buffer) {
  const content = buffer.toString('utf8');
  const pages = content.split(/\f/).map(p => p.trim()).filter(Boolean);
  if (pages.length > 0) return pages;
  
  return chunkText(content, 2000);
}

/**
 * Helper to chunk long text into page-sized pieces
 */
function chunkText(text, maxChars = 2000) {
  const chunks = [];
  let i = 0;
  while (i < text.length) {
    const chunk = text.slice(i, i + maxChars).trim();
    if (chunk) chunks.push(chunk);
    i += maxChars;
  }
  return chunks;
}

/**
 * Main entrypoint - BUFFER ONLY
 * @param {string} ext - '.pdf' | '.docx' | '.txt'
 * @param {Buffer} buffer - file buffer
 * @returns {Promise<string[]>} pages
 */
export async function parseFileByExtension(ext, buffer) {
  if (!Buffer.isBuffer(buffer)) {
    throw new Error(`Expected Buffer, received ${typeof buffer}`);
  }
  
  ext = (ext || '').toLowerCase();

  switch (ext) {
    case '.pdf':
      return parsePDFBuffer(buffer);
    
    case '.docx':
      return parseDOCXBuffer(buffer);
    
    case '.txt':
      return parseTXTBuffer(buffer);
    
    default:
      throw new Error(
        `Unsupported file type: ${ext}. Supported formats: .pdf, .docx, .txt`
      );
  }
}
