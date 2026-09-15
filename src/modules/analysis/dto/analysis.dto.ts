import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { ParsedCvDto } from '../../parser/dto/parsed-cv.dto';

export class AnalyzeRequestDto {
  @ApiPropertyOptional({
    description:
      'Job description as raw text. Required when jobFile is not uploaded.',
  })
  @IsOptional()
  @IsString({ message: 'validation.string' })
  jobDescription?: string;

  @ApiPropertyOptional({
    description:
      'Existing guest session id. Omit to auto-create a new free-trial session.',
  })
  @IsOptional()
  @IsString({ message: 'validation.string' })
  sessionId?: string;

  @ApiPropertyOptional({
    description: 'Optional email to attach to the session.',
  })
  @IsOptional()
  @IsEmail({}, { message: 'validation.email' })
  email?: string;
}

export class ParsedJobDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString({ message: 'validation.string' })
  title?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString({ message: 'validation.string' })
  company?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString({ message: 'validation.string' })
  location?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString({ message: 'validation.string' })
  employmentType?: string;

  @ApiProperty({
    required: false,
    description: 'intern | junior | mid | senior | lead | principal',
  })
  @IsOptional()
  @IsString({ message: 'validation.string' })
  seniorityLevel?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber({}, { message: 'validation.number' })
  minYearsExperience?: number;

  @ApiProperty({ type: [String], default: [] })
  @IsArray({ message: 'validation.array' })
  @IsString({ each: true, message: 'validation.string' })
  requiredHardSkills: string[] = [];

  @ApiProperty({ type: [String], default: [] })
  @IsArray({ message: 'validation.array' })
  @IsString({ each: true, message: 'validation.string' })
  softSkills: string[] = [];

  @ApiProperty({ type: [String], default: [] })
  @IsArray({ message: 'validation.array' })
  @IsString({ each: true, message: 'validation.string' })
  domainKeywords: string[] = [];

  @ApiProperty({ type: [String], default: [] })
  @IsArray({ message: 'validation.array' })
  @IsString({ each: true, message: 'validation.string' })
  requirements: string[] = [];
}

export class TailoredBulletPointDto {
  @ApiProperty({
    required: false,
    description: 'The original CV bullet that was rewritten',
  })
  @IsOptional()
  @IsString({ message: 'validation.string' })
  original?: string;

  @ApiProperty({
    description: 'Action-oriented rewritten bullet tailored to the job',
  })
  @IsString({ message: 'validation.string' })
  tailored: string;

  @ApiProperty({ type: [String], default: [] })
  @IsArray({ message: 'validation.array' })
  @IsString({ each: true, message: 'validation.string' })
  targetKeywords: string[] = [];

  @ApiProperty({
    required: false,
    description: "Target CV section, e.g. 'experience' | 'summary'",
  })
  @IsOptional()
  @IsString({ message: 'validation.string' })
  section?: string;
}

export class TailoredAdviceDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString({ message: 'validation.string' })
  summary?: string;

  @ApiProperty({ type: [TailoredBulletPointDto], default: [] })
  @IsArray({ message: 'validation.array' })
  @ValidateNested({ each: true })
  @Type(() => TailoredBulletPointDto)
  rewrittenBulletPoints: TailoredBulletPointDto[] = [];

  @ApiProperty({ type: [String], default: [] })
  @IsArray({ message: 'validation.array' })
  @IsString({ each: true, message: 'validation.string' })
  skillsToAdd: string[] = [];

  @ApiProperty({ type: [String], default: [] })
  @IsArray({ message: 'validation.array' })
  @IsString({ each: true, message: 'validation.string' })
  keywordsToInclude: string[] = [];

  @ApiProperty({ type: [String], default: [] })
  @IsArray({ message: 'validation.array' })
  @IsString({ each: true, message: 'validation.string' })
  actionableSteps: string[] = [];
}

export class AnalysisResponseDto {
  @ApiProperty({ description: 'Analysis history id' })
  id: string;

  @ApiProperty({ description: 'Owner (user or guest session) id' })
  userId: string;

  @ApiProperty({ description: 'Parsed candidate id' })
  candidateId: string;

  @ApiProperty({ description: 'Job id' })
  jobId: string;

  @ApiProperty({ required: false, description: 'Parsed candidate full name' })
  candidateName?: string | null;

  @ApiProperty({ description: 'Parsed job title' })
  jobTitle: string;

  @ApiProperty({
    description: 'Semantic match score 0-100',
    minimum: 0,
    maximum: 100,
  })
  matchScore: number;

  @ApiProperty({
    enum: ['MATCHED', 'SHORTLISTED', 'REJECTED'],
    description: 'Status derived from deterministic score thresholds',
  })
  status: 'MATCHED' | 'SHORTLISTED' | 'REJECTED';

  @ApiProperty({ type: [String] })
  strengths: string[];

  @ApiProperty({ type: [String] })
  missingSkills: string[];

  @ApiProperty({ required: false })
  reasoning?: string | null;

  @ApiProperty({ type: TailoredAdviceDto, nullable: true })
  tailoredAdvice: TailoredAdviceDto | null;

  @ApiProperty({ type: ParsedCvDto })
  parsedCv: ParsedCvDto;

  @ApiProperty({ type: ParsedJobDto })
  parsedJob: ParsedJobDto;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;

  @ApiProperty({
    description: 'Session token to reuse for follow-up requests',
  })
  sessionToken: string;

  @ApiProperty({ description: 'Remaining credits after this evaluation' })
  creditsRemaining: number;
}
