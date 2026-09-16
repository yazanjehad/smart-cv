import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AuthPayloadDto, LoginDto, RegisterDto } from './dto/auth.dto';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { UserProfileDto } from '../users/dto/user.dto';

@ApiTags('auth')
@Controller('v1/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @ApiOperation({
    summary: 'Create a RECRUITER / JOB_SEEKER account with free-trial credits',
  })
  @ApiOkResponse({
    type: AuthPayloadDto,
    description:
      'Wrapped by the global i18n envelope -> { message, data } where data holds the access token and profile.',
  })
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchange email + password for a JWT access token' })
  @ApiOkResponse({ type: AuthPayloadDto })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Get('me')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Profile of the JWT-authenticated account' })
  @ApiOkResponse({ type: UserProfileDto })
  me(@CurrentUser('id') userId: string) {
    return this.auth.profile(userId);
  }
}
