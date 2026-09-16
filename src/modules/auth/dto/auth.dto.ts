import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { UserProfileDto } from '../../users/dto/user.dto';

/** Roles a visitor is allowed to self-assign (SUPER_ADMIN is seed-only). */
export const SELF_ASSIGNABLE_ROLES = [Role.RECRUITER, Role.JOB_SEEKER] as const;

export class RegisterDto {
  @ApiProperty({ example: 'recruiter@company.com' })
  @IsEmail({}, { message: 'validation.email' })
  email: string;

  @ApiProperty({ minLength: 8, example: 'SmartCv!2026' })
  @IsString({ message: 'validation.string' })
  @MinLength(8, { message: 'validation.min' })
  password: string;

  @ApiPropertyOptional({ example: 'Yazan Almasri' })
  @IsOptional()
  @IsString({ message: 'validation.string' })
  fullName?: string;

  @ApiPropertyOptional({
    enum: SELF_ASSIGNABLE_ROLES,
    default: Role.JOB_SEEKER,
    description:
      'RECRUITER or JOB_SEEKER (SUPER_ADMIN cannot be self-assigned)',
  })
  @IsOptional()
  @IsEnum(Role, { message: 'validation.enum' })
  @IsIn(SELF_ASSIGNABLE_ROLES, { message: 'validation.enum' })
  role?: Role;
}

export class LoginDto {
  @ApiProperty({ example: 'recruiter@company.com' })
  @IsEmail({}, { message: 'validation.email' })
  email: string;

  @ApiProperty({ example: 'SmartCv!2026' })
  @IsString({ message: 'validation.string' })
  password: string;
}

export class AuthPayloadDto {
  @ApiProperty({
    description: 'Signed JWT to send as `Authorization: Bearer <token>`',
  })
  accessToken: string;

  @ApiProperty({ example: 'Bearer' })
  tokenType: string;

  @ApiProperty({ description: 'Token lifetime, e.g. 1d', example: '1d' })
  expiresIn: string;

  @ApiProperty({ type: UserProfileDto })
  user: UserProfileDto;
}
