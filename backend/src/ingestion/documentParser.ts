import fs from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { logger } from '../config/logger';

export interface ParsedDocument {
  content: string;
  metadata: {
    pageCount?: number;
    wordCount?: number;
    author?: string;
    createdDate?: Date;
    language?: string;
  };
}

export async function parseDocument(filePath: string, mimeType: string): Promise<ParsedDocument> {
  const buffer = fs.readFileSync(filePath);

  try {
    if (mimeType === 'application/pdf') {
      const data = await pdfParse(buffer);
      return {
        content: data.text,
        metadata: {
          pageCount: data.numpages,
          wordCount: data.text.split(/\s+/).length,
        },
      };
    }

    if (
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mimeType === 'application/msword'
    ) {
      const result = await mammoth.extractRawText({ buffer });
      return {
        content: result.value,
        metadata: { wordCount: result.value.split(/\s+/).length },
      };
    }

    if (
      mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      mimeType === 'application/vnd.ms-excel'
    ) {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const content = workbook.SheetNames.map((name) => {
        const sheet = workbook.Sheets[name];
        return `Sheet: ${name}\n${XLSX.utils.sheet_to_csv(sheet)}`;
      }).join('\n\n');
      return { content, metadata: {} };
    }

    if (mimeType === 'text/csv') {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const content = XLSX.utils.sheet_to_csv(sheet);
      return { content, metadata: {} };
    }

    if (mimeType === 'text/plain' || mimeType === 'message/rfc822') {
      const content = buffer.toString('utf-8');
      return { content, metadata: { wordCount: content.split(/\s+/).length } };
    }

    throw new Error(`Unsupported MIME type: ${mimeType}`);
  } catch (error) {
    logger.error(`Failed to parse document: ${filePath}`, error);
    throw error;
  }
}
