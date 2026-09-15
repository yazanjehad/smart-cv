import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { ParserController } from './parser.controller';
import { ParserService } from './parser.service';
import { PdfExtractorService } from './pdf-extractor.service';

@Module({
  imports: [AiModule],
  controllers: [ParserController],
  providers: [ParserService, PdfExtractorService],
  exports: [ParserService, PdfExtractorService],
})
export class ParserModule {}
