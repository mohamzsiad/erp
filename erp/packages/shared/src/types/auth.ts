import type { Module, Action, Resource } from '../constants/index.js';

export interface JwtPayload {
  userId: string;
  companyId: string;
  roleId: string;
  email: string;
  iat?: number;
  exp?: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse extends TokenPair {
  user: AuthUser;
  permissions: PermissionSet[];
}

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  companyId: string;
  roleId: string;
  roleName: string;
  locationId: string | null;
  enabledModules: Module[];
}

export interface PermissionSet {
  module: Module;
  resource: Resource;
  action: Action;
}

export interface RefreshRequest {
  refreshToken: string;
}
