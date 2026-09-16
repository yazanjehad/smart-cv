import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

export const ROLES_KEY = 'rbac:roles';

/**
 * Restricts a route (or an entire controller) to the given roles.
 * Enforced by `RolesGuard`, e.g. `@Roles(Role.RECRUITER, Role.SUPER_ADMIN)`.
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
