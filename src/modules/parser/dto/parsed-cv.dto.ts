import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsEmail,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ExperienceDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString({ message: 'validation.string' })
  jobTitle?: string;

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
  startDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString({ message: 'validation.string' })
  endDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString({ message: 'validation.string' })
  description?: string;
}

export class EducationDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString({ message: 'validation.string' })
  degree?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString({ message: 'validation.string' })
  institution?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString({ message: 'validation.string' })
  field?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString({ message: 'validation.string' })
  graduationYear?: string;
}

export class ParsedCvDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString({ message: 'validation.string' })
  fullName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEmail({}, { message: 'validation.email' })
  email?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString({ message: 'validation.string' })
  phone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString({ message: 'validation.string' })
  location?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString({ message: 'validation.string' })
  title?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString({ message: 'validation.string' })
  summary?: string;

  @ApiProperty({ type: [String], default: [] })
  @IsOptional()
  @IsArray({ message: 'validation.array' })
  @IsString({ each: true, message: 'validation.string' })
  skills: string[] = [];

  @ApiProperty({ type: [String], default: [] })
  @IsOptional()
  @IsArray({ message: 'validation.array' })
  @IsString({ each: true, message: 'validation.string' })
  languages: string[] = [];

  @ApiProperty({ type: [ExperienceDto], default: [] })
  @IsOptional()
  @IsArray({ message: 'validation.array' })
  @ValidateNested({ each: true })
  @Type(() => ExperienceDto)
  experience: ExperienceDto[] = [];

  @ApiProperty({ type: [EducationDto], default: [] })
  @IsOptional()
  @IsArray({ message: 'validation.array' })
  @ValidateNested({ each: true })
  @Type(() => EducationDto)
  education: EducationDto[] = [];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber({}, { message: 'validation.number' })
  yearsOfExperience?: number;
}
