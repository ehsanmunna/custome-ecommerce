import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SEEDED_ADMIN_PERMISSION_KEYS } from 'database';
import { ADMIN_PERMISSION_KEYS } from '../../admin/src/core/auth/admin-permissions';

const apiRoot = resolve(process.cwd());

const RESERVED_PERMISSION_KEYS = ['notifications.read', 'notifications.test'];

function readOpenApiPermissionKeys(): string[] {
  const document = readFileSync(join(apiRoot, 'openapi', 'openapi.yaml'), 'utf8');
  return [...document.matchAll(/^\s*x-required-permission:\s*([A-Za-z0-9_.-]+)\s*$/gm)].map(
    ([, key]) => key as string,
  );
}

function listTypeScriptFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return listTypeScriptFiles(path);
    return entry.name.endsWith('.ts') ? [path] : [];
  });
}

function readControllerPermissionKeys(): string[] {
  return listTypeScriptFiles(join(apiRoot, 'src')).flatMap((file) => {
    const source = readFileSync(file, 'utf8');
    return [...source.matchAll(/permission:\s*'([^']+)'/g)].map(([, key]) => key as string);
  });
}

const openApiPermissionKeys = readOpenApiPermissionKeys();
const controllerPermissionKeys = readControllerPermissionKeys();
const enforcedPermissionKeys = [...new Set([...controllerPermissionKeys, ...RESERVED_PERMISSION_KEYS])];
const seededPermissionKeys = [...SEEDED_ADMIN_PERMISSION_KEYS];

describe('admin permission catalog consistency', () => {
  it('collects declarations from every layer', () => {
    expect(openApiPermissionKeys.length).toBeGreaterThan(40);
    expect(controllerPermissionKeys.length).toBeGreaterThan(40);
    expect(seededPermissionKeys.length).toBeGreaterThan(40);
    expect(ADMIN_PERMISSION_KEYS.length).toBeGreaterThan(40);
  });

  it('declares no duplicates inside a layer', () => {
    expect(new Set(seededPermissionKeys).size).toBe(seededPermissionKeys.length);
    expect(new Set(ADMIN_PERMISSION_KEYS).size).toBe(ADMIN_PERMISSION_KEYS.length);
    expect(new Set(enforcedPermissionKeys).size).toBe(enforcedPermissionKeys.length);
  });

  it('keeps the OpenAPI contract aligned with enforced permissions', () => {
    expect([...new Set(openApiPermissionKeys)].sort()).toEqual([...enforcedPermissionKeys].sort());
  });

  it('seeds every enforced permission and no orphan key', () => {
    expect([...seededPermissionKeys].sort()).toEqual([...enforcedPermissionKeys].sort());
  });

  it('defines every seeded permission in the console catalog', () => {
    expect([...ADMIN_PERMISSION_KEYS].sort()).toEqual([...seededPermissionKeys].sort());
  });

  it('reserves notification administration keys until their operations ship', () => {
    expect(RESERVED_PERMISSION_KEYS).toEqual(['notifications.read', 'notifications.test']);
    for (const key of RESERVED_PERMISSION_KEYS) {
      expect(controllerPermissionKeys).not.toContain(key);
      expect(seededPermissionKeys).toContain(key);
      expect(ADMIN_PERMISSION_KEYS).toContain(key);
    }
  });
});
