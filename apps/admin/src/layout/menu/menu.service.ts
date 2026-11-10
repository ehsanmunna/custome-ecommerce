import { computed, inject, Injectable } from '@angular/core';
import { AuthService } from '../../auth/auth.service';
import { ADMIN_MENU, type AdminMenuItem } from './admin-menu.config';

@Injectable({ providedIn: 'root' })
export class MenuService {
  private readonly auth = inject(AuthService);

  readonly menu = computed(() => filterMenuByRole(ADMIN_MENU, this.auth.roleKey));
}

export function filterMenuByRole(
  entries: readonly AdminMenuItem[],
  roleKey: string | null,
): AdminMenuItem[] {
  if (!roleKey) return [];

  return entries.flatMap((entry) => {
    if (!entry.roles.includes(roleKey)) return [];

    const { children: childEntries, ...rest } = entry;
    const children = childEntries ? filterMenuByRole(childEntries, roleKey) : [];
    return [
      {
        ...rest,
        ...(children.length > 0 ? { children } : {}),
      },
    ];
  });
}
