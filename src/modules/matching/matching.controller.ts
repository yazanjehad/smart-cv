import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { MatchRequestDto } from './dto/match.dto';
import { MatchingService } from './matching.service';

@ApiTags('matching')
@ApiBearerAuth('access-token')
@Controller('matching')
export class MatchingController {
  constructor(private readonly service: MatchingService) {}

  @Post('evaluate')
  evaluate(@Body() dto: MatchRequestDto) {
    return this.service.match(dto);
  }

  @Get('jobs/:jobId/top')
  top(@Param('jobId') jobId: string, @Query('limit') limit = 10) {
    return this.service.topCandidates(jobId, Number(limit));
  }

  @Get('candidates/:candidateId')
  forCandidate(@Param('candidateId') candidateId: string) {
    return this.service.candidateMatches(candidateId);
  }
}
