import fs from 'fs/promises';
import path from 'path';
import * as pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

// Parse PDF into pages as array of texts
export async function parsePDF(filePath) {
  const dataBuffer = await fs.readFile(filePath);
  const data = await pdfParse(dataBuffer);
  // Example splitting by form feed which sometimes denotes page breaks
  const pages = data.text.split(/\f/);
  return pages;
}

// Parse DOCX into pages as array of texts
export async function parseDOCX(filePath) {
  const result = await mammoth.extractRawText({ path: filePath });
  const pages = result.value.split(/\f/); // or split by chunk size if no page breaks
  return pages;
}

// Parse TXT file
export async function parseTXT(filePath) {
  const content = await fs.readFile(filePath, 'utf8');
  const pages = content.split(/\f/);
  return pages;
}

// Automatically pick parser by extension
export async function parseFileByExtension(ext, filePath) {
  if (ext === '.pdf') return parsePDF(filePath);
  if (ext === '.docx') return parseDOCX(filePath);
  if (ext === '.txt') return parseTXT(filePath);
  throw new Error('Unsupported file extension');
}
