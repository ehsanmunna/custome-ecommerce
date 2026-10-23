import type { Client } from 'pg';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  hasDatabase,
  resetDatabase,
  runMigrateCommand,
  runtimeUrl,
  withClient,
} from '../helpers/database';

const describeDatabase = hasDatabase ? describe : describe.skip;

const MISSING_ID = '00000000-0000-0000-0000-000000000000';

async function asRuntime<T>(callback: (client: Client) => Promise<T>): Promise<T> {
  if (!runtimeUrl) {
    throw new Error('DATABASE_URL is required for database integration tests');
  }
  return withClient(runtimeUrl, callback);
}

async function createVariant(client: Client, sku: string): Promise<string> {
  const category = await client.query<{ id: string }>(
    'INSERT INTO categories DEFAULT VALUES RETURNING id',
  );
  const product = await client.query<{ id: string }>(
    'INSERT INTO products (category_id) VALUES ($1) RETURNING id',
    [category.rows[0]!.id],
  );
  const variant = await client.query<{ id: string }>(
    `INSERT INTO product_variants (product_id, sku, price_poisha)
     VALUES ($1, $2, 1000) RETURNING id`,
    [product.rows[0]!.id, sku],
  );
  return variant.rows[0]!.id;
}

async function createInventoryItem(
  client: Client,
  variantId: string,
  onHand = 0,
  reserved = 0,
  threshold = 0,
): Promise<void> {
  await client.query(
    `INSERT INTO inventory_items
       (variant_id, quantity_on_hand, quantity_reserved, low_stock_threshold)
     VALUES ($1, $2, $3, $4)`,
    [variantId, onHand, reserved, threshold],
  );
}

async function insertMovement(
  client: Client,
  variantId: string,
  values: {
    type: string;
    onHandDelta: number;
    reservedDelta: number;
    resultingOnHand: number;
    resultingReserved: number;
    referenceType?: string | null;
    referenceId?: string | null;
    note?: string | null;
  },
): Promise<string> {
  const result = await client.query<{ id: string }>(
    `INSERT INTO stock_movements
       (variant_id, type, on_hand_delta, reserved_delta,
        resulting_on_hand, resulting_reserved, reference_type, reference_id, note)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id`,
    [
      variantId,
      values.type,
      values.onHandDelta,
      values.reservedDelta,
      values.resultingOnHand,
      values.resultingReserved,
      values.referenceType ?? null,
      values.referenceId ?? null,
      values.note ?? null,
    ],
  );
  return result.rows[0]!.id;
}

describeDatabase('inventory schema', () => {
  beforeEach(async () => {
    await resetDatabase();
    const result = runMigrateCommand();
    expect(result.status, result.stderr).toBe(0);
  });

  it('requires an existing variant and allows one inventory item per variant', async () => {
    await asRuntime(async (client) => {
      const variantId = await createVariant(client, 'SKU-INV-ONE');

      await expect(createInventoryItem(client, MISSING_ID, 10)).rejects.toMatchObject({
        code: '23503',
      });

      await createInventoryItem(client, variantId, 10);

      const item = await client.query<{ quantity_on_hand: number }>(
        'SELECT quantity_on_hand FROM inventory_items WHERE variant_id = $1',
        [variantId],
      );
      expect(item.rows[0]?.quantity_on_hand).toBe(10);

      await expect(createInventoryItem(client, variantId, 5)).rejects.toMatchObject({
        code: '23505',
      });

      await expect(
        client.query('DELETE FROM product_variants WHERE id = $1', [variantId]),
      ).rejects.toMatchObject({ code: '23503' });
    });
  });

  it('enforces valid balances and derives availability and low stock', async () => {
    await asRuntime(async (client) => {
      const variantId = await createVariant(client, 'SKU-INV-BALANCE');

      await expect(createInventoryItem(client, variantId, -1)).rejects.toMatchObject({
        code: '23514',
      });
      await expect(createInventoryItem(client, variantId, 0, -1)).rejects.toMatchObject({
        code: '23514',
      });
      await expect(createInventoryItem(client, variantId, 2, 3)).rejects.toMatchObject({
        code: '23514',
      });
      await expect(createInventoryItem(client, variantId, 0, 0, -1)).rejects.toMatchObject({
        code: '23514',
      });

      await createInventoryItem(client, variantId, 10, 3, 7);

      const atThreshold = await client.query<{
        available: number;
        is_low: boolean;
        quantity_on_hand: number;
        quantity_reserved: number;
      }>(
        `SELECT quantity_on_hand - quantity_reserved AS available,
                (quantity_on_hand - quantity_reserved) <= low_stock_threshold AS is_low,
                quantity_on_hand, quantity_reserved
         FROM inventory_items WHERE variant_id = $1`,
        [variantId],
      );
      expect(atThreshold.rows[0]).toMatchObject({
        available: 7,
        is_low: true,
        quantity_on_hand: 10,
        quantity_reserved: 3,
      });

      await client.query(
        'UPDATE inventory_items SET low_stock_threshold = 6 WHERE variant_id = $1',
        [variantId],
      );

      const aboveThreshold = await client.query<{
        available: number;
        is_low: boolean;
        quantity_on_hand: number;
        quantity_reserved: number;
      }>(
        `SELECT quantity_on_hand - quantity_reserved AS available,
                (quantity_on_hand - quantity_reserved) <= low_stock_threshold AS is_low,
                quantity_on_hand, quantity_reserved
         FROM inventory_items WHERE variant_id = $1`,
        [variantId],
      );
      expect(aboveThreshold.rows[0]).toMatchObject({
        available: 7,
        is_low: false,
        quantity_on_hand: 10,
        quantity_reserved: 3,
      });
    });
  });

  it('validates reservation quantities, statuses, and references', async () => {
    await asRuntime(async (client) => {
      const variantId = await createVariant(client, 'SKU-INV-RESERVATION');
      await createInventoryItem(client, variantId, 5);

      await expect(
        client.query('INSERT INTO stock_reservations (variant_id, quantity) VALUES ($1, 0)', [
          variantId,
        ]),
      ).rejects.toMatchObject({ code: '23514' });

      await expect(
        client.query('INSERT INTO stock_reservations (variant_id, quantity) VALUES ($1, -1)', [
          variantId,
        ]),
      ).rejects.toMatchObject({ code: '23514' });

      await expect(
        client.query(
          "INSERT INTO stock_reservations (variant_id, quantity, status) VALUES ($1, 1, 'pending')",
          [variantId],
        ),
      ).rejects.toMatchObject({ code: '22P02' });

      const active = await client.query<{
        reference_type: string | null;
        reference_id: string | null;
        expires_at: Date | null;
      }>(
        `INSERT INTO stock_reservations
           (variant_id, quantity, status, reference_type, reference_id, expires_at)
         VALUES ($1, 2, 'active', 'order', $2, now() + interval '1 hour')
         RETURNING reference_type, reference_id, expires_at`,
        [variantId, MISSING_ID],
      );
      expect(active.rows[0]?.reference_type).toBe('order');
      expect(active.rows[0]?.reference_id).toBe(MISSING_ID);
      expect(active.rows[0]?.expires_at).toBeInstanceOf(Date);

      await client.query(
        "INSERT INTO stock_reservations (variant_id, quantity, status) VALUES ($1, 1, 'active')",
        [variantId],
      );

      await expect(
        client.query(
          "INSERT INTO stock_reservations (variant_id, quantity, reference_type) VALUES ($1, 1, 'cart')",
          [variantId],
        ),
      ).rejects.toMatchObject({ code: '23514' });

      await expect(
        client.query(
          `INSERT INTO stock_reservations (variant_id, quantity, reference_id)
           VALUES ($1, 1, $2)`,
          [variantId, MISSING_ID],
        ),
      ).rejects.toMatchObject({ code: '23514' });

      await expect(
        client.query(
          `INSERT INTO stock_reservations (variant_id, quantity, reference_type, reference_id)
           VALUES ($1, 1, 'manual', $2)`,
          [variantId, MISSING_ID],
        ),
      ).resolves.toBeDefined();

      await expect(
        client.query('INSERT INTO stock_reservations (variant_id, quantity) VALUES ($1, 1)', [
          MISSING_ID,
        ]),
      ).rejects.toMatchObject({ code: '23503' });

      const variantWithoutItem = await createVariant(client, 'SKU-INV-NO-ITEM');
      await expect(
        client.query('INSERT INTO stock_reservations (variant_id, quantity) VALUES ($1, 1)', [
          variantWithoutItem,
        ]),
      ).rejects.toMatchObject({ code: '23503' });
    });
  });

  it('enforces movement type semantics and resulting balances', async () => {
    await asRuntime(async (client) => {
      const variantId = await createVariant(client, 'SKU-INV-MOVEMENT');
      await createInventoryItem(client, variantId, 5);

      await expect(
        insertMovement(client, variantId, {
          type: 'initial',
          onHandDelta: 5,
          reservedDelta: 0,
          resultingOnHand: 10,
          resultingReserved: 0,
        }),
      ).resolves.toBeTruthy();

      await expect(
        insertMovement(client, variantId, {
          type: 'initial',
          onHandDelta: 0,
          reservedDelta: 0,
          resultingOnHand: 0,
          resultingReserved: 0,
        }),
      ).rejects.toMatchObject({ code: '23514' });

      await expect(
        insertMovement(client, variantId, {
          type: 'adjustment',
          onHandDelta: 0,
          reservedDelta: 0,
          resultingOnHand: 10,
          resultingReserved: 0,
        }),
      ).rejects.toMatchObject({ code: '23514' });

      await expect(
        insertMovement(client, variantId, {
          type: 'reservation',
          onHandDelta: 1,
          reservedDelta: 2,
          resultingOnHand: 11,
          resultingReserved: 2,
        }),
      ).rejects.toMatchObject({ code: '23514' });

      await expect(
        insertMovement(client, variantId, {
          type: 'release',
          onHandDelta: 0,
          reservedDelta: 2,
          resultingOnHand: 10,
          resultingReserved: 2,
        }),
      ).rejects.toMatchObject({ code: '23514' });

      await expect(
        insertMovement(client, variantId, {
          type: 'deduction',
          onHandDelta: -2,
          reservedDelta: -1,
          resultingOnHand: 8,
          resultingReserved: 1,
        }),
      ).rejects.toMatchObject({ code: '23514' });

      await expect(
        insertMovement(client, variantId, {
          type: 'return',
          onHandDelta: 1,
          reservedDelta: 1,
          resultingOnHand: 11,
          resultingReserved: 1,
        }),
      ).rejects.toMatchObject({ code: '23514' });

      await expect(
        insertMovement(client, variantId, {
          type: 'adjustment',
          onHandDelta: -1,
          reservedDelta: 0,
          resultingOnHand: -1,
          resultingReserved: 0,
        }),
      ).rejects.toMatchObject({ code: '23514' });

      await expect(
        insertMovement(client, variantId, {
          type: 'adjustment',
          onHandDelta: 1,
          reservedDelta: 0,
          resultingOnHand: 10,
          resultingReserved: -1,
        }),
      ).rejects.toMatchObject({ code: '23514' });

      await expect(
        insertMovement(client, variantId, {
          type: 'adjustment',
          onHandDelta: 1,
          reservedDelta: 0,
          resultingOnHand: 2,
          resultingReserved: 3,
        }),
      ).rejects.toMatchObject({ code: '23514' });

      await expect(
        insertMovement(client, variantId, {
          type: 'adjustment',
          onHandDelta: 1,
          reservedDelta: 0,
          resultingOnHand: 10,
          resultingReserved: 0,
          referenceType: 'cart',
        }),
      ).rejects.toMatchObject({ code: '23514' });

      const variantWithoutItem = await createVariant(client, 'SKU-INV-MOVEMENT-NO-ITEM');
      await expect(
        insertMovement(client, variantWithoutItem, {
          type: 'adjustment',
          onHandDelta: 1,
          reservedDelta: 0,
          resultingOnHand: 10,
          resultingReserved: 0,
        }),
      ).rejects.toMatchObject({ code: '23503' });

      await expect(
        insertMovement(client, MISSING_ID, {
          type: 'adjustment',
          onHandDelta: 1,
          reservedDelta: 0,
          resultingOnHand: 10,
          resultingReserved: 0,
        }),
      ).rejects.toMatchObject({ code: '23503' });

      await expect(
        insertMovement(client, variantId, {
          type: 'reservation',
          onHandDelta: 0,
          reservedDelta: 2,
          resultingOnHand: 10,
          resultingReserved: 2,
        }),
      ).resolves.toBeTruthy();

      await expect(
        insertMovement(client, variantId, {
          type: 'release',
          onHandDelta: 0,
          reservedDelta: -2,
          resultingOnHand: 10,
          resultingReserved: 0,
        }),
      ).resolves.toBeTruthy();

      await expect(
        insertMovement(client, variantId, {
          type: 'deduction',
          onHandDelta: -2,
          reservedDelta: -2,
          resultingOnHand: 8,
          resultingReserved: 0,
        }),
      ).resolves.toBeTruthy();

      const movements = await client.query<{ count: string }>(
        'SELECT count(*) FROM stock_movements WHERE variant_id = $1',
        [variantId],
      );
      expect(movements.rows[0]?.count).toBe('4');
    });
  });

  it('rejects updating or deleting an existing stock movement', async () => {
    await asRuntime(async (client) => {
      const variantId = await createVariant(client, 'SKU-INV-APPEND-ONLY');
      await createInventoryItem(client, variantId, 5);
      const movementId = await insertMovement(client, variantId, {
        type: 'initial',
        onHandDelta: 5,
        reservedDelta: 0,
        resultingOnHand: 5,
        resultingReserved: 0,
        note: 'opening',
      });

      await expect(
        client.query('UPDATE stock_movements SET note = $1 WHERE id = $2', ['changed', movementId]),
      ).rejects.toMatchObject({ code: '23001' });

      await expect(
        client.query('DELETE FROM stock_movements WHERE id = $1', [movementId]),
      ).rejects.toMatchObject({ code: '23001' });

      const movement = await client.query<{ note: string }>(
        'SELECT note FROM stock_movements WHERE id = $1',
        [movementId],
      );
      expect(movement.rows[0]?.note).toBe('opening');
    });
  });

  it('keeps inventory history when a variant or item is deleted', async () => {
    await asRuntime(async (client) => {
      const reservedVariant = await createVariant(client, 'SKU-INV-DELETE-RESERVATION');
      await createInventoryItem(client, reservedVariant, 5);
      await client.query(
        'INSERT INTO stock_reservations (variant_id, quantity) VALUES ($1, 2)',
        [reservedVariant],
      );

      await expect(
        client.query('DELETE FROM product_variants WHERE id = $1', [reservedVariant]),
      ).rejects.toMatchObject({ code: '23503' });
      await expect(
        client.query('DELETE FROM inventory_items WHERE variant_id = $1', [reservedVariant]),
      ).rejects.toMatchObject({ code: '23503' });

      const movementVariant = await createVariant(client, 'SKU-INV-DELETE-MOVEMENT');
      await createInventoryItem(client, movementVariant, 5);
      await insertMovement(client, movementVariant, {
        type: 'initial',
        onHandDelta: 5,
        reservedDelta: 0,
        resultingOnHand: 5,
        resultingReserved: 0,
      });

      await expect(
        client.query('DELETE FROM product_variants WHERE id = $1', [movementVariant]),
      ).rejects.toMatchObject({ code: '23503' });
      await expect(
        client.query('DELETE FROM inventory_items WHERE variant_id = $1', [movementVariant]),
      ).rejects.toMatchObject({ code: '23503' });
    });
  });
});
