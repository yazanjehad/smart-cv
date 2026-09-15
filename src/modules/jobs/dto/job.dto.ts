import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateJobDto {
  @ApiPropertyOptional({ example: 'Senior Backend Engineer' })
  @IsString({ message: 'validation.required' })
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString({ message: 'validation.string' })
  company?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString({ message: 'validation.string' })
  location?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString({ message: 'validation.string' })
  employmentType?: string;

  @ApiPropertyOptional({ description: 'Full job description' })
  @IsString({ message: 'validation.required' })
  description: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray({ message: 'validation.array' })
  @IsString({ each: true, message: 'validation.string' })
  requirements?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray({ message: 'validation.array' })
  @IsString({ each: true, message: 'validation.string' })
  skills?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({}, { message: 'validation.number' })
  @Min(0, { message: 'validation.min' })
  minYearsExp?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean({ message: 'validation.boolean' })
  isActive?: boolean = true;
}

export class UpdateJobDto extends PartialType(CreateJobDto) {}
