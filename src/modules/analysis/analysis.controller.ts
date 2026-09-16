import {
  Body,
  Controller,
  Get,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { AnalysisResponseDto, AnalyzeRequestDto } from './dto/analysis.dto';
import { AnalysisService } from './analysis.service';

interface AnalysisUploads {
  cvFile?: Express.Multer.File[];
  jobFile?: Express.Multer.File[];
}

@ApiTags('analysis')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ description: 'Missing, invalid or expired JWT' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('v1/analysis')
export class AnalysisController {
  constructor(private readonly analysis: AnalysisService) {}

  @Post('evaluate')
  @Roles(Role.SUPER_ADMIN, Role.RECRUITER, Role.JOB_SEEKER)
  @ApiOperation({
    summary: 'End-to-end CV vs Job evaluation with tailored CV advice',
    description:
      'Uploads a CV PDF plus a job description (text or PDF), parses both with Gemini, ' +
      'scores the semantic match, generates tailored CV optimization advice, persists the ' +
      'result and atomically deducts one credit from the authenticated user. ' +
      'RECRUITER accounts run this per job/CV pair; JOB_SEEKER accounts evaluate their own CV.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        cvFile: {
          type: 'string',
          format: 'binary',
          description: 'Candidate CV (PDF, max 10MB)',
        },
        jobFile: {
          type: 'string',
          format: 'binary',
          description: 'Job description PDF (alternative to jobDescription)',
        },
        jobDescription: {
          type: 'string',
          description: 'Job description as raw text',
        },
      },
      required: ['cvFile'],
    },
  })
  @ApiOkResponse({
    type: AnalysisResponseDto,
    description:
      'Wrapped by the global i18n envelope -> { message, data } where data is the whole analysis result.',
  })
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'cvFile', maxCount: 1 },
      { name: 'jobFile', maxCount: 1 },
    ]),
  )
  evaluate(
    @UploadedFiles() files: AnalysisUploads,
    @Body() dto: AnalyzeRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.analysis.evaluate({
      user,
      cvFile: files?.cvFile?.[0],
      jobFile: files?.jobFile?.[0],
      jobDescription: dto.jobDescription,
    });
  }

  @Get('history')
  @Roles(Role.SUPER_ADMIN, Role.RECRUITER, Role.JOB_SEEKER)
  @ApiOperation({
    summary: 'Unified analysis history of the authenticated account',
  })
  @ApiOkResponse({
    description:
      'Wrapped by the global i18n envelope -> { message, data, meta } where data is the latest 20 analysis entries of the account.',
  })
  history(@CurrentUser() user: AuthenticatedUser) {
    return this.analysis.history(user);
  }
}
