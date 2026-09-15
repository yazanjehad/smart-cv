import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class PdfExtractorService {
  private readonly logger = new Logger(PdfExtractorService.name);

  async extractText(buffer: Buffer): Promise<string> {
    try {
      // pdf-parse v2 exports PDFParse class; v1 exports a function.
      // Support both to stay version-agnostic.
      const mod: any = await import('pdf-parse');
      const Parser = mod.PDFParse ?? mod.default ?? mod;
      if (typeof Parser === 'function' && Parser.name === 'PDFParse') {
        const parser = new Parser({ data: buffer });
        const result = await parser.getText();
        return result?.text ?? '';
      }
      const result = await Parser(buffer);
      return result?.text ?? '';
    } catch (error) {
      this.logger.error(`PDF extraction failed: ${(error as Error).message}`);
      throw error;
    }
  }
}
