import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import {
  GrantCreditsDto,
  UpdateSubscriptionDto,
  UserProfileDto,
  UserQueryDto,
} from './dto/user.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('v1/users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @ApiOperation({
    summary: 'Current account profile with credits + subscription',
  })
  @ApiOkResponse({
    type: UserProfileDto,
    description: 'Wrapped by the global i18n envelope -> { message, data }',
  })
  async me(@CurrentUser('id') userId: string) {
    const user = await this.users.getProfile(userId);
    return {
      message: 'users.messages.profile',
      data: this.users.toProfile(user),
    };
  }

  @Get()
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({
    summary: 'List accounts and credit consumption (SUPER_ADMIN only)',
  })
  @ApiOkResponse({ description: 'Wrapped envelope -> { message, data, meta }' })
  list(@Query() query: UserQueryDto) {
    return this.users.listUsers(query);
  }

  @Patch(':id/credits')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({
    summary: "Top up an account's credit balance (SUPER_ADMIN only)",
  })
  async grantCredits(@Param('id') id: string, @Body() dto: GrantCreditsDto) {
    const user = await this.users.grantCredits(id, dto);
    return {
      message: 'users.messages.credits_granted',
      data: this.users.toProfile(user),
      args: { credits: dto.credits },
    };
  }

  @Patch(':id/subscription')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({
    summary: "Manage an account's subscription (SUPER_ADMIN only)",
  })
  async updateSubscription(
    @Param('id') id: string,
    @Body() dto: UpdateSubscriptionDto,
  ) {
    const user = await this.users.updateSubscription(id, dto);
    return {
      message: 'users.messages.subscription_updated',
      data: this.users.toProfile(user),
    };
  }
}
