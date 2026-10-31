import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { SEEDED_ADMIN_PERMISSION_KEYS } from 'database';

interface OpenApiOperation {
  'x-required-permission'?: string;
  parameters?: Array<{
    name?: string;
    in?: string;
    schema?: { minLength?: number };
  }>;
  responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>;
}

const document = parse(readFileSync(resolve(process.cwd(), 'openapi/openapi.yaml'), 'utf8')) as {
  paths: Record<string, Record<string, OpenApiOperation>>;
  components: {
    schemas: Record<string, { properties?: Record<string, unknown> }>;
  };
  'x-implemented-operations': string[];
};

describe('admin customer support contract', () => {
  it('seeds every permission declared by an admin contract operation', () => {
    const seededPermissions = new Set<string>(SEEDED_ADMIN_PERMISSION_KEYS);
    for (const [path, pathItem] of Object.entries(document.paths)) {
      if (!path.startsWith('/admin/')) {
        continue;
      }

      for (const [method, operation] of Object.entries(pathItem)) {
        if (!isHttpMethod(method) || !operation['x-required-permission']) {
          continue;
        }
        expect(seededPermissions.has(operation['x-required-permission'])).toBe(true);
      }
    }
  });

  it('defines store-scoped, read-only customer lookup operations', () => {
    expect(document.paths['/admin/customers']?.get['x-required-permission']).toBe('customers.read');
    expect(document.paths['/admin/customers/{customerId}']?.get['x-required-permission']).toBe(
      'customers.read',
    );
    expect(document.paths['/admin/customers'].get.parameters).toContainEqual(
      expect.objectContaining({
        name: 'q',
        in: 'query',
        schema: expect.objectContaining({ minLength: 2 }),
      }),
    );
    expect(Object.keys(document.paths['/admin/customers']).filter(isHttpMethod)).toEqual(['get']);
    expect(
      Object.keys(document.paths['/admin/customers/{customerId}']).filter(isHttpMethod),
    ).toEqual(['get']);
    expect(document['x-implemented-operations']).not.toContain('GET /admin/customers');
    expect(document['x-implemented-operations']).not.toContain('GET /admin/customers/{customerId}');
  });

  it('limits customer support schemas to customer data and excludes authentication secrets', () => {
    for (const schemaName of [
      'AdminCustomer',
      'AdminCustomerDetail',
      'AdminCustomerAddress',
      'AdminCustomerOrderSummary',
    ]) {
      const propertyNames = Object.keys(document.components.schemas[schemaName]?.properties ?? {});
      expect(propertyNames).not.toContain('passwordHash');
      expect(propertyNames).not.toContain('otp');
      expect(propertyNames).not.toContain('accessToken');
      expect(propertyNames).not.toContain('refreshToken');
    }

    expect(
      document.paths['/admin/customers'].get.responses?.['200']?.content?.['application/json']
        ?.schema?.$ref,
    ).toBe('#/components/schemas/AdminCustomerPage');
    expect(
      document.paths['/admin/customers/{customerId}'].get.responses?.['200']?.content?.[
        'application/json'
      ]?.schema?.$ref,
    ).toBe('#/components/schemas/AdminCustomerDetail');
  });
});

function isHttpMethod(value: string): boolean {
  return ['get', 'post', 'put', 'patch', 'delete'].includes(value);
}
