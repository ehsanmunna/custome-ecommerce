import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import {
  findBreakingChanges,
  inspectControllerRoutes,
  validateContract,
} from './contract-check.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const contract = parse(
  readFileSync(path.join(root, 'apps', 'api', 'openapi', 'openapi.yaml'), 'utf8'),
);

test('v1 contract operations are complete and cover every implemented Nest route', () => {
  assert.deepEqual(validateContract(contract, inspectControllerRoutes()), []);
});

test('Nest route parameters are normalized to OpenAPI path parameters', () => {
  const routes = inspectControllerRoutes();

  assert(
    routes.some(({ method, route }) => method === 'get' && route === '/storefront/products/{slug}'),
  );
  assert(
    routes.some(
      ({ method, route }) => method === 'patch' && route === '/admin/variants/{variantId}',
    ),
  );
});

test('additive contract operations remain compatible', () => {
  const before = {
    paths: {
      '/items': {
        get: {
          'x-access': 'public',
          responses: { 200: { description: 'Items' } },
        },
      },
    },
  };
  const after = {
    paths: {
      '/items': {
        get: {
          'x-access': 'public',
          responses: { 200: { description: 'Items' } },
        },
      },
      '/new-items': {
        get: {
          'x-access': 'public',
          responses: { 200: { description: 'New items' } },
        },
      },
    },
  };

  assert.deepEqual(findBreakingChanges(before, after), []);
});

test('breaking paths, required request fields, and narrowed enums are reported', () => {
  const before = {
    paths: {
      '/items': {
        post: {
          'x-access': 'public',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['name'],
                  properties: {
                    name: { type: 'string' },
                    state: { type: 'string', enum: ['draft', 'active'] },
                  },
                },
              },
            },
          },
          responses: { 201: { description: 'Created' } },
        },
      },
      '/old-items': {
        get: { responses: { 200: { description: 'Old route' } } },
      },
    },
  };
  const after = {
    paths: {
      '/items': {
        post: {
          'x-access': 'public',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['name', 'state'],
                  properties: {
                    name: { type: 'string' },
                    state: { type: 'string', enum: ['draft'] },
                  },
                },
              },
            },
          },
          responses: { 201: { description: 'Created' } },
        },
      },
    },
  };

  const issues = findBreakingChanges(before, after);
  assert(issues.some((issue) => issue.includes('Removes path /old-items')));
  assert(issues.some((issue) => issue.includes('makes state newly required')));
  assert(issues.some((issue) => issue.includes('narrows an enum')));
});
