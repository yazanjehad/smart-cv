import { Module } from '@nestjs/common';
import { GeminiAiService } from './services/gemini-ai.service';

@Module({
  providers: [GeminiAiService],
  exports: [GeminiAiService],
})
export class AiModule {}
