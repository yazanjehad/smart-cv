import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role, SubscriptionPlan, SubscriptionStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class SubscriptionDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: SubscriptionPlan })
  plan: SubscriptionPlan;

  @ApiProperty({ enum: SubscriptionStatus })
  status: SubscriptionStatus;

  @ApiProperty({ description: 'Credits granted per billing cycle' })
  creditsPerCycle: number;

  @ApiProperty({ description: 'Credits consumed in the current cycle' })
  creditsUsed: number;

  @ApiProperty({ type: String, format: 'date-time' })
  currentPeriodStart: Date;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  currentPeriodEnd: Date | null;

  @ApiProperty()
  cancelAtPeriodEnd: boolean;
}

export class UserProfileDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'recruiter@company.com' })
  email: string;

  @ApiProperty({ required: false, nullable: true })
  fullName: string | null;

  @ApiProperty({ enum: Role })
  role: Role;

  @ApiProperty({ description: 'Remaining analysis credits' })
  credits: number;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  lastLoginAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ type: SubscriptionDto, nullable: true })
  subscription: SubscriptionDto | null;
}

/** SUPER_ADMIN: add credits to an account (also tracked as subscription usage). */
export class GrantCreditsDto {
  @ApiProperty({ minimum: 1, maximum: 1000, example: 25 })
  @Type(() => Number)
  @IsInt({ message: 'validation.number' })
  @Min(1, { message: 'validation.min' })
  @Max(1000, { message: 'validation.max' })
  credits: number;
}

/** SUPER_ADMIN: create/update the billing record of an account. */
export class UpdateSubscriptionDto {
  @ApiPropertyOptional({ enum: SubscriptionPlan })
  @IsOptional()
  @IsEnum(SubscriptionPlan, { message: 'validation.enum' })
  plan?: SubscriptionPlan;

  @ApiPropertyOptional({ enum: SubscriptionStatus })
  @IsOptional()
  @IsEnum(SubscriptionStatus, { message: 'validation.enum' })
  status?: SubscriptionStatus;

  @ApiPropertyOptional({ minimum: 0, example: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'validation.number' })
  @Min(0, { message: 'validation.min' })
  creditsPerCycle?: number;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @IsDateString({}, { message: 'validation.string' })
  currentPeriodEnd?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean({ message: 'validation.boolean' })
  cancelAtPeriodEnd?: boolean;

  @ApiPropertyOptional({ description: 'Reset the consumed-usage counter' })
  @IsOptional()
  @IsBoolean({ message: 'validation.boolean' })
  resetUsage?: boolean;

  @ApiPropertyOptional({
    description: 'Also top up the account balance by this many credits',
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'validation.number' })
  @Min(0, { message: 'validation.min' })
  grantCredits?: number;
}

export class UserQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'validation.number' })
  @Min(1, { message: 'validation.min' })
  page?: number = 1;

  @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'validation.number' })
  @Min(1, { message: 'validation.min' })
  @Max(100, { message: 'validation.max' })
  limit?: number = 10;

  @ApiPropertyOptional({ enum: Role })
  @IsOptional()
  @IsEnum(Role, { message: 'validation.enum' })
  role?: Role;

  @ApiPropertyOptional({
    description: 'Case-insensitive email/full-name search',
  })
  @IsOptional()
  @IsString({ message: 'validation.string' })
  search?: string;
}
