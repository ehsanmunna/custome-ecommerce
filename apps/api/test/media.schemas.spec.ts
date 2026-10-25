import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import {
  mediaCompleteInputSchema,
  mediaPaginationQuerySchema,
  mediaUploadInputSchema,
  parseMediaInput,
} from '../src/media/media.schemas';

describe('media request validation', () => {
  it('applies pagination defaults, coercion, and the maximum page size', () => {
    expect(parseMediaInput(mediaPaginationQuerySchema, {})).toEqual({ page: 1, pageSize: 20 });
    expect(parseMediaInput(mediaPaginationQuerySchema, { page: '2', pageSize: '100' })).toEqual({
      page: 2,
      pageSize: 100,
    });
    expect(() => parseMediaInput(mediaPaginationQuerySchema, { pageSize: '101' })).toThrowError(
      BadRequestException,
    );
    expect(() => parseMediaInput(mediaPaginationQuerySchema, { page: '0' })).toThrowError(
      BadRequestException,
    );
  });

  it('trims upload fields, accepts localized alt text, and rejects unknown fields', () => {
    expect(
      parseMediaInput(mediaUploadInputSchema, {
        fileName: '  product.png  ',
        mimeType: ' image/png ',
        sizeBytes: 512,
        alt: { bn: '  ছবি  ', en: ' Image ' },
      }),
    ).toEqual({
      fileName: 'product.png',
      mimeType: 'image/png',
      sizeBytes: 512,
      alt: { bn: 'ছবি', en: 'Image' },
    });

    expect(() =>
      parseMediaInput(mediaUploadInputSchema, {
        fileName: 'product.png',
        mimeType: 'image/png',
        sizeBytes: 0,
      }),
    ).toThrowError(BadRequestException);
    expect(() =>
      parseMediaInput(mediaUploadInputSchema, {
        fileName: 'product.png',
        mimeType: 'image/png',
        sizeBytes: 10,
        alt: { fr: 'Image' },
      }),
    ).toThrowError(BadRequestException);
    expect(() =>
      parseMediaInput(mediaUploadInputSchema, {
        fileName: 'product.png',
        mimeType: 'image/png',
        sizeBytes: 10,
        unexpected: true,
      }),
    ).toThrowError(BadRequestException);
  });

  it('requires dimensions to be positive and supplied together', () => {
    expect(parseMediaInput(mediaCompleteInputSchema, {})).toEqual({});
    expect(parseMediaInput(mediaCompleteInputSchema, { width: 800, height: 600 })).toEqual({
      width: 800,
      height: 600,
    });

    expect(() => parseMediaInput(mediaCompleteInputSchema, { width: 800 })).toThrowError(
      BadRequestException,
    );
    expect(() => parseMediaInput(mediaCompleteInputSchema, { width: 0, height: 600 })).toThrowError(
      BadRequestException,
    );
    expect(() =>
      parseMediaInput(mediaCompleteInputSchema, { width: 800, height: 600, extra: 1 }),
    ).toThrowError(BadRequestException);
  });

  it('reports structured validation issues without leaking request values', () => {
    try {
      parseMediaInput(mediaCompleteInputSchema, { width: 1 });
    } catch (error) {
      const response = (error as BadRequestException).getResponse() as {
        message: string;
        errors: Array<{ path: string; message: string }>;
      };
      expect(response.message).toBe('Invalid media request');
      expect(response.errors[0]).toMatchObject({ path: 'width' });
      expect(JSON.stringify(response)).not.toContain('"1"');
    }
  });
});
