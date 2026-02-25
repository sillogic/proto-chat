import { Document } from 'langchain/document';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
// @ts-ignore
import * as _pdfjsWorker from 'pdfjs-dist/legacy/build/pdf.worker.mjs';
import type { TextContent } from 'pdfjs-dist/types/src/display/api';

// Polyfill DOMMatrix and Path2D for Node.js environment
// pdfjs-dist requires these browser APIs
if (typeof globalThis.DOMMatrix === 'undefined') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const canvas = require('@napi-rs/canvas');
    globalThis.DOMMatrix = canvas.DOMMatrix;
    globalThis.DOMPoint = canvas.DOMPoint;
    globalThis.DOMRect = canvas.DOMRect;
    globalThis.Path2D = canvas.Path2D;
  } catch (e) {
    console.warn('[PdfLoader] Warning: @napi-rs/canvas not available, PDF rendering may be limited');
  }
}

export const PdfLoader = async (fileBlob: Blob) => {
  console.log('[PdfLoader] Starting PDF loading, blob size:', fileBlob.size);

  try {
    // Convert Blob to ArrayBuffer
    const arrayBuffer = await fileBlob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // Load PDF using pdfjs-dist
    const loadingTask = getDocument({
      data: uint8Array,
      useSystemFonts: true,
    });

    const pdf: PDFDocumentProxy = await loadingTask.promise;
    console.log('[PdfLoader] PDF loaded, total pages:', pdf.numPages);

    const documents: Document[] = [];

    // Process each page
    for (let i = 1; i <= pdf.numPages; i += 1) {
      const page: PDFPageProxy = await pdf.getPage(i);

      // Debug: Check page info
      const viewport = page.getViewport({ scale: 1.0 });
      console.log(`[PdfLoader] Page ${i} viewport:`, viewport.width, 'x', viewport.height);

      const content: TextContent = await page.getTextContent();
      console.log(`[PdfLoader] Page ${i}: Got ${content.items.length} text items`);

      // Debug: Log content structure if available
      if (content.items.length > 0 && i === 1) {
        console.log(`[PdfLoader] Page 1 first item:`, JSON.stringify(content.items[0]).substring(0, 200));
      }

      // Extract text using the same logic as packages/file-loaders
      let lastY;
      const textItems = [];
      for (const item of content.items) {
        if ('str' in item) {
          if (lastY === item.transform[5] || !lastY) {
            textItems.push(item.str);
          } else {
            textItems.push(`\n${item.str}`);
          }
          lastY = item.transform[5];
        }
      }

      const pageText = textItems.join('');
      const cleanedPageContent = pageText.replaceAll('\0', '');

      console.log(`[PdfLoader] Page ${i}: Extracted ${cleanedPageContent.length} characters`);
      if (i === 1 && cleanedPageContent.length > 0) {
        console.log(`[PdfLoader] Page 1 preview: ${cleanedPageContent.substring(0, 100)}`);
      }

      // Create LangChain Document
      const doc = new Document({
        pageContent: cleanedPageContent,
        metadata: {
          source: 'blob',
          pdf: {
            pageNumber: i,
            totalPages: pdf.numPages,
          },
        },
      });

      documents.push(doc);

      // Clean up page resources
      page.cleanup();
    }

    // Clean up document resources
    await pdf.destroy();

    console.log('[PdfLoader] Converted to', documents.length, 'LangChain documents');

    if (documents.length > 0) {
      console.log('[PdfLoader] First page content preview:', documents[0].pageContent.substring(0, 200));
      console.log('[PdfLoader] First page content length:', documents[0].pageContent.length);
    } else {
      console.error('[PdfLoader] WARNING: No documents returned from PDF loader!');
    }

    return documents;
  } catch (error) {
    console.error('[PdfLoader] Error loading PDF:', error);
    throw error;
  }
};
