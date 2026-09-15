import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { ParserModule } from '../parser/parser.module';
import { UsersModule } from '../users/users.module';
import { AnalysisController } from './analysis.controller';
import { AnalysisService } from './analysis.service';

@Module({
  imports: [AiModule, ParserModule, UsersModule],
  controllers: [AnalysisController],
  providers: [AnalysisService],
  exports: [AnalysisService],
})
export class AnalysisModule {}
