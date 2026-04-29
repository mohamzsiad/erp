import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthUser, PermissionSet } from '@clouderp/shared';

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  permissions: PermissionSet[];
  isAuthenticated: boolean;

  setAuth: (user: AuthUser, accessToken: string, refreshToken: string, permissions: PermissionSet[]) => void;
  setAccessToken: (token: string) => void;
  clearAuth: () => void;
  hasPermission: (module: string, resource: string, action: string) => boolean;
  isModuleEnabled: (module: string) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      permissions: [],
      isAuthenticated: false,

      setAuth: (user, accessToken, refreshToken, permissions) =>
        set({ user, accessToken, refreshToken, permissions, isAuthenticated: true }),

      setAccessToken: (token) => set({ accessToken: token }),

      clearAuth: () =>
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          permissions: [],
          isAuthenticated: false,
        }),

      hasPermission: (module, resource, action) => {
        const { permissions } = get();
        return permissions.some(
          (p) =>
            p.module === module &&
            p.resource === resource &&
            p.action === action
        );
      },

      isModuleEnabled: (module) => {
        const { user } = get();
        if (!user) return false;
        return (user.enabledModules as string[]).includes(module);
      },
    }),
    {
      name: 'clouderp-auth',
      partialize: (state) => ({
        user: state.user,
        refreshToken: state.refreshToken,
        permissions: state.permissions,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
