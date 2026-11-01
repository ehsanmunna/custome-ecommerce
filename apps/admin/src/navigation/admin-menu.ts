import { Route, Routes } from '@angular/router';

export interface AdminMenuData {
  label: string;
  group?: string;
}

export interface AdminMenuEntry {
  label: string;
  path: string;
  group: string | null;
}

export interface AdminMenuSection {
  group: string | null;
  entries: AdminMenuEntry[];
}

function readMenuData(route: Route): AdminMenuData | undefined {
  const data = route.data as { menu?: AdminMenuData } | undefined;
  return data?.menu;
}

function joinPath(parentPath: string, path: string): string {
  const segments = [parentPath, path]
    .map((segment) => segment.replace(/^\/+|\/+$/g, ''))
    .filter((segment) => segment.length > 0);

  return `/${segments.join('/')}`;
}

function collectEntries(routes: Routes, parentPath: string, entries: AdminMenuEntry[]): void {
  for (const route of routes) {
    const fullPath = route.path ? joinPath(parentPath, route.path) : parentPath;
    const menu = readMenuData(route);

    if (menu) {
      entries.push({ label: menu.label, path: fullPath, group: menu.group ?? null });
    }

    if (route.children) {
      collectEntries(route.children, fullPath, entries);
    }
  }
}

export function buildAdminMenu(routes: Routes, parentPath = ''): AdminMenuSection[] {
  const entries: AdminMenuEntry[] = [];
  collectEntries(routes, parentPath, entries);

  const sections: AdminMenuSection[] = [];
  const ungrouped = entries.filter((entry) => entry.group === null);

  if (ungrouped.length > 0) {
    sections.push({ group: null, entries: ungrouped });
  }

  const groups = new Map<string, AdminMenuEntry[]>();
  for (const entry of entries) {
    if (entry.group === null) {
      continue;
    }

    const groupEntries = groups.get(entry.group);
    if (groupEntries) {
      groupEntries.push(entry);
    } else {
      groups.set(entry.group, [entry]);
    }
  }

  for (const [group, groupEntries] of groups) {
    sections.push({ group, entries: groupEntries });
  }

  return sections;
}
