// server/utils/documentProcessing.js
import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import * as pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

/**
 * Helper: normalize input to { ext, buffer }
 * - input can be:
 *   - local file path (string, exists on disk)
 *   - Buffer
 *   - remote URL (string starting with http/https)
 */
async function resolveInput(ext, input) {
  // If Buffer provided
  if (Buffer.isBuffer(input)) {
    return { ext, buffer: input };
  }

  // If string and looks like URL -> download
  if (typeof input === 'string' && /^https?:\/\//i.test(input)) {
    const res = await axios.get(input, { responseType: 'arraybuffer' });
    return { ext, buffer: Buffer.from(res.data) };
  }

  // If string and file path -> read file
  if (typeof input === 'string') {
    // If ext not provided, derive from path
    const resolvedPath = input;
    const buf = await fs.readFile(resolvedPath);
    return { ext: ext || path.extname(resolvedPath).toLowerCase(), buffer: buf };
  }

  throw new Error('Unsupported input type for parseFileByExtension');
}

/** Parse PDF buffer -> pages array */
export async function parsePDFBuffer(buffer) {
  const data = await pdfParse(buffer);
  // split on form feed or fallback to newline chunks
  const pages = data.text.split(/\f/).map(p => p.trim()).filter(Boolean);
  if (pages.length > 0) return pages;
  // fallback: split by paragraphs ~ every 1000-2000 chars
  const text = data.text || '';
  return chunkText(text, 2000);
}

/** Parse DOCX buffer -> pages array */
export async function parseDOCXBuffer(buffer) {
  // mammoth supports Buffer by passing { buffer }
  const result = await mammoth.extractRawText({ buffer });
  const pages = result.value.split(/\f/).map(p => p.trim()).filter(Boolean);
  if (pages.length > 0) return pages;
  return chunkText(result.value || '', 2000);
}

/** Parse TXT buffer -> pages array */
export async function parseTXTBuffer(buffer) {
  const content = buffer.toString('utf8');
  const pages = content.split(/\f/).map(p => p.trim()).filter(Boolean);
  if (pages.length > 0) return pages;
  return chunkText(content, 2000);
}

/** Helper to chunk long text into approximate page-sized pieces */
function chunkText(text, maxChars = 2000) {
  const chunks = [];
  let i = 0;
  while (i < text.length) {
    chunks.push(text.slice(i, i + maxChars).trim());
    i += maxChars;
  }
  return chunks.filter(Boolean);
}

/**
 * Main entrypoint.
 * parseFileByExtension(ext, input)
 * - ext: '.pdf' | '.docx' | '.txt' (case-insensitive)
 * - input: local path string | Buffer | remote URL string
 * Returns: Promise<string[]> pages
 */
export async function parseFileByExtension(ext, input) {
  if (!ext && typeof input === 'string' && !/^https?:\/\//i.test(input)) {
    ext = path.extname(input).toLowerCase();
  }
  ext = (ext || '').toLowerCase();

  const { buffer } = await resolveInput(ext, input);

  if (ext === '.pdf') {
    return parsePDFBuffer(buffer);
  } else if (ext === '.docx' || ext === '.doc') {
    return parseDOCXBuffer(buffer);
  } else if (ext === '.txt') {
    return parseTXTBuffer(buffer);
  } else {
    // Try to infer from buffer using pdf-parse as last resort
    // If unsure, attempt PDF parse then plaintext fallback
    try {
      return await parsePDFBuffer(buffer);
    } catch (err) {
      // fallback to txt
      return parseTXTBuffer(buffer);
    }
  }
}
