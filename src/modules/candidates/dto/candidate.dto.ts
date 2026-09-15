import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateCandidateDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString({ message: 'validation.string' })
  fullName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail({}, { message: 'validation.email' })
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString({ message: 'validation.string' })
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString({ message: 'validation.string' })
  location?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString({ message: 'validation.string' })
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString({ message: 'validation.string' })
  summary?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray({ message: 'validation.array' })
  @IsString({ each: true, message: 'validation.string' })
  skills?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray({ message: 'validation.array' })
  @IsString({ each: true, message: 'validation.string' })
  languages?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({}, { message: 'validation.number' })
  @Min(0, { message: 'validation.min' })
  yearsOfExp?: number;
}

export class UpdateCandidateDto extends PartialType(CreateCandidateDto) {}

export class CandidateQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString({ message: 'validation.string' })
  search?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsNumber({}, { message: 'validation.number' })
  page?: number = 1;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @IsNumber({}, { message: 'validation.number' })
  limit?: number = 10;
}
