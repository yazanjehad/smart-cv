import { Role } from '@prisma/client';
import { Request } from 'express';

/**
 * Shape of `req.user` produced by `JwtStrategy` and consumed by the
 * CV-matching pipeline (`AnalysisService`) and the RBAC layer.
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string | null;
  role: Role;
  credits: number;
  isActive: boolean;
}

/** Express request augmented with the JWT-authenticated user. */
export interface RequestWithUser extends Request {
  user: AuthenticatedUser;
}

/** JWT access-token payload (`sub` = User.id, per JWT RFC 7519). */
export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
}
