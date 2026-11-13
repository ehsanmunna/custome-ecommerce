import type { components } from 'api-sdk';

export type Role = components['schemas']['Role'];
export type RoleInput = components['schemas']['RoleInput'];
export type Permission = components['schemas']['Permission'];

export interface PageMetadata {
  page: number;
  pageSize: number;
  total: number;
  totalPages?: number;
}

/**
 * The generated OpenAPI page types place pagination at the top level, while the
 * running API nests it under `meta`. Accept both shapes so the list pages read
 * the same response safely.
 */
export interface PageResponse<T> {
  items: T[];
  total?: number;
  page?: number;
  pageSize?: number;
  meta?: PageMetadata;
}

export function pageItems<T>(response: PageResponse<T> | null | undefined): T[] {
  return response?.items ?? [];
}

export function pageTotal<T>(response: PageResponse<T> | null | undefined): number {
  if (!response) {
    return 0;
  }
  return response.meta?.total ?? response.total ?? response.items?.length ?? 0;
}

export function pagePageSize<T>(response: PageResponse<T> | null | undefined, fallback: number): number {
  return response?.meta?.pageSize ?? response?.pageSize ?? fallback;
}
