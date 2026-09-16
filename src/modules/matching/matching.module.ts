import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { AuthModule } from '../auth/auth.module';
import { MatchingController } from './matching.controller';
import { MatchingService } from './matching.service';

@Module({
  imports: [AiModule, AuthModule],
  controllers: [MatchingController],
  providers: [MatchingService],
})
export class MatchingModule {}
