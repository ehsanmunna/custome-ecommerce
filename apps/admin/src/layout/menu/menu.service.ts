import { computed, inject, Injectable } from '@angular/core';
import { AuthService } from '../../auth/auth.service';
import { type PermissionRequirement } from '../../core/auth/admin-permissions';
import { ADMIN_MENU, type AdminMenuItem } from './admin-menu.config';

@Injectable({ providedIn: 'root' })
export class MenuService {
  private readonly auth = inject(AuthService);

  readonly menu = computed(() => filterMenuByPermission(ADMIN_MENU, this.auth.permissionSet()));
}

export function filterMenuByPermission(
  entries: readonly AdminMenuItem[],
  granted: ReadonlySet<string>,
): AdminMenuItem[] {
  if (granted.size === 0) return [];

  return entries.flatMap((entry) => {
    if (!isPermitted(entry, granted)) return [];

    const { children: childEntries, ...rest } = entry;
    if (!childEntries || childEntries.length === 0) return [rest];

    const children = filterMenuByPermission(childEntries, granted);
    return [children.length > 0 ? { ...rest, children } : rest];
  });
}

function isPermitted(entry: PermissionRequirement, granted: ReadonlySet<string>): boolean {
  return entry.permissionMode === 'any'
    ? entry.permissions.some((permission) => granted.has(permission))
    : entry.permissions.every((permission) => granted.has(permission));
}
