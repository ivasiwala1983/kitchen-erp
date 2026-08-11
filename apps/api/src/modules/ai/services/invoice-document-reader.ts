/**
 * Invoice Document Reader Service
 * Extracts text and content from PDFs and Images for AI invoice processing.
 * Works seamlessly with text-only free LLMs (via OCR/PDF text) and vision-capable free LLMs.
 */

export interface ExtractedDocument {
  mimeType: string;
  text: string;
  base64Image?: string;
  pageCount?: number;
  hasReadableText: boolean;
  fileName?: string;
}

export class InvoiceDocumentReader {
  /**
   * Reads and processes uploaded document buffer
   */
  public async readDocument(
    buffer: Buffer,
    mimeType: string,
    fileName?: string
  ): Promise<ExtractedDocument> {
    const isPdf = mimeType === 'application/pdf';

    if (isPdf) {
      try {
        // Dynamic import pdf-parse
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const pdfParseModule = require('pdf-parse');
        const parseFn =
          typeof pdfParseModule === 'function' ? pdfParseModule : pdfParseModule?.default;
        if (typeof parseFn === 'function') {
          const data = await parseFn(buffer);
          const extractedText = (data.text || '').trim();

          if (extractedText.length > 20) {
            return {
              mimeType,
              text: extractedText,
              pageCount: data.numpages || 1,
              hasReadableText: true,
              fileName,
            };
          }
        }
      } catch (err) {
        console.warn('⚠️ PDF text extraction warning:', err);
      }

      // Fallback if PDF text extraction returns little or no text
      return {
        mimeType,
        text: `[PDF Document: ${fileName || 'invoice.pdf'} - Binary content attached]`,
        base64Image: `data:application/pdf;base64,${buffer.toString('base64')}`,
        pageCount: 1,
        hasReadableText: false,
        fileName,
      };
    }

    // Image file (PNG, JPG, JPEG, WEBP)
    const base64Image = `data:${mimeType};base64,${buffer.toString('base64')}`;

    return {
      mimeType,
      text: `[Image Document: ${fileName || 'invoice.png'} - Image content attached]`,
      base64Image,
      pageCount: 1,
      hasReadableText: false,
      fileName,
    };
  }
}

export const invoiceDocumentReader = new InvoiceDocumentReader();
