import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import type { AuthenticatedUser } from '../interfaces/authenticated-user.interface';
import { RolesGuard } from './roles.guard';

const makeContext = (user?: Partial<AuthenticatedUser>): ExecutionContext =>
  ({
    getHandler: () => 'handler',
    getClass: () => 'controller',
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  }) as unknown as ExecutionContext;

const makeGuard = (requiredRoles?: Role[]) => {
  const getAllAndOverride = jest
    .fn<Role[] | undefined, [unknown, [unknown, unknown]]>()
    .mockReturnValue(requiredRoles);
  const reflector = {
    getAllAndOverride,
  } as unknown as Reflector;
  return { guard: new RolesGuard(reflector), reflector: getAllAndOverride };
};

describe('RolesGuard', () => {
  it('allows the request when the route declares no @Roles metadata', () => {
    const { guard } = makeGuard(undefined);

    expect(guard.canActivate(makeContext())).toBe(true);
  });

  it('reads the metadata from both the handler and the controller', () => {
    const { guard, reflector } = makeGuard([Role.RECRUITER]);
    const context = makeContext({ role: Role.RECRUITER });

    expect(guard.canActivate(context)).toBe(true);
    expect(reflector).toHaveBeenCalledWith(expect.anything(), [
      'handler',
      'controller',
    ]);
  });

  it.each([Role.SUPER_ADMIN, Role.RECRUITER])(
    'allows a %s account on an admin/recruiter route',
    (role) => {
      const { guard } = makeGuard([Role.SUPER_ADMIN, Role.RECRUITER]);

      expect(guard.canActivate(makeContext({ role }))).toBe(true);
    },
  );

  it('rejects a JOB_SEEKER on a recruiter-only route with 403', () => {
    const { guard } = makeGuard([Role.SUPER_ADMIN, Role.RECRUITER]);

    expect(() =>
      guard.canActivate(makeContext({ role: Role.JOB_SEEKER })),
    ).toThrow(ForbiddenException);
  });

  it('rejects an unauthenticated request (no req.user) with 403', () => {
    const { guard } = makeGuard([Role.SUPER_ADMIN]);

    expect(() => guard.canActivate(makeContext())).toThrow(ForbiddenException);
  });
});
