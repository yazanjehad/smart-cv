import { Module } from '@nestjs/common';
import { AI_PROVIDER_TOKEN } from './interfaces/ai-provider.interface';
import { GeminiAiService } from './services/gemini-ai.service';

@Module({
  providers: [
    GeminiAiService,
    { provide: AI_PROVIDER_TOKEN, useExisting: GeminiAiService },
  ],
  exports: [AI_PROVIDER_TOKEN, GeminiAiService],
})
export class AiModule {}
