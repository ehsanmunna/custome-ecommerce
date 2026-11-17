import { inject } from '@angular/core';
import type { CanActivateFn } from '@angular/router';
import { Router } from '@angular/router';
import { AuthService } from '../../auth/auth.service';

export const permissionGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isAuthenticated) {
    return router.createUrlTree(['/login'], {
      queryParams: { returnUrl: state.url },
    });
  }

  const permissions = route.data['permissions'];
  if (!isStringArray(permissions) || permissions.length === 0) {
    return true;
  }

  const mode: unknown = route.data['permissionMode'];
  const permitted =
    mode === 'any'
      ? auth.hasAnyPermission(permissions)
      : permissions.every((permission) => auth.hasPermission(permission));

  return permitted ? true : router.createUrlTree(['/forbidden']);
};

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}
