import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, IsUUID } from 'class-validator';

export class MatchRequestDto {
  @ApiProperty({ description: 'Candidate id' })
  @IsUUID('4', { message: 'validation.uuid' })
  candidateId: string;

  @ApiProperty({ description: 'Job id' })
  @IsUUID('4', { message: 'validation.uuid' })
  jobId: string;
}

export class MatchResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  candidateId: string;

  @ApiProperty()
  jobId: string;

  @ApiProperty({ description: 'Match score 0-100' })
  score: number;

  @ApiProperty({
    enum: ['SHORTLISTED', 'MATCHED', 'REJECTED'],
    description: 'Evaluation status derived from score thresholds',
  })
  status: string;

  @ApiProperty({ type: [String] })
  strengths: string[];

  @ApiProperty({ type: [String] })
  missingSkills: string[];

  @ApiProperty({ required: false })
  reasoning?: string;
}
