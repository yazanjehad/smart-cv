import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Query,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AnalysisResponseDto, AnalyzeRequestDto } from './dto/analysis.dto';
import { AnalysisService } from './analysis.service';

interface AnalysisUploads {
  cvFile?: Express.Multer.File[];
  jobFile?: Express.Multer.File[];
}

@ApiTags('analysis')
@Controller('v1/analysis')
export class AnalysisController {
  constructor(private readonly analysis: AnalysisService) {}

  @Post('evaluate')
  @ApiOperation({
    summary: 'End-to-end CV vs Job evaluation with tailored CV advice',
    description:
      'Uploads a CV PDF plus a job description (text or PDF), parses both with Gemini, ' +
      'scores the semantic match, generates tailored CV optimization advice, persists the ' +
      'result and deducts one credit from the session.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiHeader({
    name: 'x-session-id',
    required: false,
    description:
      'Guest/user session token (alternative to the sessionId field)',
  })
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
        sessionId: {
          type: 'string',
          description: 'Existing guest session id',
        },
        email: {
          type: 'string',
          description: 'Optional email to attach to the session',
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
    @Headers('x-session-id') headerSessionId?: string,
  ) {
    return this.analysis.evaluate({
      cvFile: files?.cvFile?.[0],
      jobFile: files?.jobFile?.[0],
      jobDescription: dto.jobDescription,
      sessionId: dto.sessionId ?? headerSessionId,
      email: dto.email,
    });
  }

  @Get('history')
  @ApiOperation({ summary: 'Unified analysis history for a session' })
  @ApiHeader({
    name: 'x-session-id',
    required: false,
    description:
      'Guest/user session token (alternative to the sessionId query)',
  })
  @ApiOkResponse({
    description:
      'Wrapped by the global i18n envelope -> { message, data, meta } where data is the latest 20 analysis entries of the session.',
  })
  history(
    @Query('sessionId') sessionId?: string,
    @Headers('x-session-id') headerSessionId?: string,
  ) {
    return this.analysis.history(sessionId ?? headerSessionId);
  }
}
