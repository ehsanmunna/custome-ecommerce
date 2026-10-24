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
const VALID_PHONE = '+8801712345678';
let orderSequence = 0;

async function asRuntime<T>(callback: (client: Client) => Promise<T>): Promise<T> {
  if (!runtimeUrl) {
    throw new Error('DATABASE_URL is required for database integration tests');
  }
  return withClient(runtimeUrl, callback);
}

async function createCustomer(client: Client, phone = VALID_PHONE): Promise<string> {
  const result = await client.query<{ id: string }>(
    'INSERT INTO customers (phone) VALUES ($1) RETURNING id',
    [phone],
  );
  return result.rows[0]!.id;
}

async function createVariant(
  client: Client,
  sku: string,
  pricePoisha = 1000,
): Promise<{ id: string; productId: string }> {
  const category = await client.query<{ id: string }>(
    'INSERT INTO categories DEFAULT VALUES RETURNING id',
  );
  const product = await client.query<{ id: string }>(
    'INSERT INTO products (category_id) VALUES ($1) RETURNING id',
    [category.rows[0]!.id],
  );
  const variant = await client.query<{ id: string }>(
    `INSERT INTO product_variants (product_id, sku, price_poisha)
     VALUES ($1, $2, $3) RETURNING id`,
    [product.rows[0]!.id, sku, pricePoisha],
  );
  return { id: variant.rows[0]!.id, productId: product.rows[0]!.id };
}

async function createCart(
  client: Client,
  customerId: string | null = null,
  status = 'active',
): Promise<string> {
  const result = await client.query<{ id: string }>(
    'INSERT INTO carts (customer_id, status) VALUES ($1, $2) RETURNING id',
    [customerId, status],
  );
  return result.rows[0]!.id;
}

async function addCartItem(
  client: Client,
  cartId: string,
  variantId: string,
  quantity = 1,
): Promise<string> {
  const result = await client.query<{ id: string }>(
    `INSERT INTO cart_items (cart_id, variant_id, quantity)
     VALUES ($1, $2, $3) RETURNING id`,
    [cartId, variantId, quantity],
  );
  return result.rows[0]!.id;
}

async function createZone(
  client: Client,
  code = 'dhaka',
  deliveryFeePoisha = 6000,
): Promise<string> {
  const result = await client.query<{ id: string }>(
    `INSERT INTO shipping_zones (code, name, delivery_fee_poisha)
     VALUES ($1, $2, $3) RETURNING id`,
    [code, `Zone ${code}`, deliveryFeePoisha],
  );
  return result.rows[0]!.id;
}

interface OrderValues {
  orderNumber?: string;
  customerId?: string | null;
  cartId?: string | null;
  subtotalPoisha?: number;
  discountPoisha?: number;
  deliveryFeePoisha?: number;
  totalPoisha?: number;
}

async function createOrder(
  client: Client,
  shippingZoneId: string,
  values: OrderValues = {},
): Promise<string> {
  orderSequence += 1;
  const subtotal = values.subtotalPoisha ?? 10000;
  const discount = values.discountPoisha ?? 0;
  const deliveryFee = values.deliveryFeePoisha ?? 6000;
  const total = values.totalPoisha ?? subtotal - discount + deliveryFee;

  const result = await client.query<{ id: string }>(
    `INSERT INTO orders
       (order_number, customer_id, cart_id, contact_name, contact_phone,
        delivery_recipient_name, delivery_recipient_phone, delivery_address_line1,
        delivery_district, delivery_division, shipping_zone_id, delivery_fee_poisha,
        subtotal_poisha, discount_poisha, total_poisha)
     VALUES ($1, $2, $3, 'Customer', $4, 'Recipient', $4, 'House 1, Road 1',
             'Dhaka', 'Dhaka', $5, $6, $7, $8, $9)
     RETURNING id`,
    [
      values.orderNumber ?? `ORD-CART-${orderSequence}`,
      values.customerId ?? null,
      values.cartId ?? null,
      VALID_PHONE,
      shippingZoneId,
      deliveryFee,
      subtotal,
      discount,
      total,
    ],
  );
  return result.rows[0]!.id;
}

async function addOrderItem(
  client: Client,
  orderId: string,
  variantId: string,
  quantity = 1,
  unitPricePoisha = 1000,
): Promise<string> {
  const result = await client.query<{ id: string }>(
    `INSERT INTO order_items
       (order_id, variant_id, product_name, variant_sku, attributes,
        unit_price_poisha, quantity, line_total_poisha)
     VALUES ($1, $2, 'Snapshot Product', 'SKU-SNAPSHOT', '{"color":"black"}'::jsonb,
             $3, $4, $5)
     RETURNING id`,
    [orderId, variantId, unitPricePoisha, quantity, unitPricePoisha * quantity],
  );
  return result.rows[0]!.id;
}

describeDatabase('cart and checkout schema', () => {
  beforeEach(async () => {
    await resetDatabase();
    const result = runMigrateCommand();
    expect(result.status, result.stderr).toBe(0);
  });

  it('stores guest and customer carts with supported statuses', async () => {
    await asRuntime(async (client) => {
      const customerId = await createCustomer(client);
      const guestCart = await client.query<{ id: string; status: string }>(
        'INSERT INTO carts DEFAULT VALUES RETURNING id, status',
      );
      const guestCartId = guestCart.rows[0]!.id;
      expect(guestCart.rows[0]?.status).toBe('active');
      const customerCartId = await createCart(client, customerId);

      const guest = await client.query<{ customer_id: string | null; status: string }>(
        'SELECT customer_id, status FROM carts WHERE id = $1',
        [guestCartId],
      );
      expect(guest.rows[0]).toMatchObject({ customer_id: null, status: 'active' });

      const registered = await client.query<{ customer_id: string; status: string }>(
        'SELECT customer_id, status FROM carts WHERE id = $1',
        [customerCartId],
      );
      expect(registered.rows[0]).toMatchObject({ customer_id: customerId, status: 'active' });

      await client.query("UPDATE carts SET status = 'converted' WHERE id = $1", [guestCartId]);
      const converted = await client.query<{ status: string }>(
        'SELECT status FROM carts WHERE id = $1',
        [guestCartId],
      );
      expect(converted.rows[0]?.status).toBe('converted');

      await client.query("UPDATE carts SET status = 'abandoned' WHERE id = $1", [customerCartId]);
      const abandoned = await client.query<{ status: string }>(
        'SELECT status FROM carts WHERE id = $1',
        [customerCartId],
      );
      expect(abandoned.rows[0]?.status).toBe('abandoned');

      await expect(createCart(client, MISSING_ID)).rejects.toMatchObject({ code: '23503' });
      await expect(createCart(client, null, 'expired')).rejects.toMatchObject({ code: '22P02' });
    });
  });

  it('deletes a customer cart when the customer is deleted', async () => {
    await asRuntime(async (client) => {
      const customerId = await createCustomer(client);
      await createCart(client, customerId);

      await client.query('DELETE FROM customers WHERE id = $1', [customerId]);

      const carts = await client.query<{ count: string }>('SELECT count(*) FROM carts');
      expect(carts.rows[0]?.count).toBe('0');
    });
  });

  it('stores one positive line per variant and cascades cart and variant changes', async () => {
    await asRuntime(async (client) => {
      const cartId = await createCart(client);
      const variant = await createVariant(client, 'SKU-CART-ONE');
      await addCartItem(client, cartId, variant.id, 3);

      const stored = await client.query<{ quantity: number }>(
        'SELECT quantity FROM cart_items WHERE cart_id = $1',
        [cartId],
      );
      expect(stored.rows[0]?.quantity).toBe(3);

      await expect(addCartItem(client, cartId, variant.id, 0)).rejects.toMatchObject({
        code: '23514',
      });
      await expect(addCartItem(client, cartId, variant.id, -1)).rejects.toMatchObject({
        code: '23514',
      });
      await expect(addCartItem(client, cartId, variant.id, 2)).rejects.toMatchObject({
        code: '23505',
      });
      await expect(addCartItem(client, cartId, MISSING_ID, 1)).rejects.toMatchObject({
        code: '23503',
      });

      const remaining = await client.query<{ count: string }>(
        'SELECT count(*) FROM cart_items WHERE cart_id = $1',
        [cartId],
      );
      expect(remaining.rows[0]?.count).toBe('1');

      await client.query('DELETE FROM carts WHERE id = $1', [cartId]);
      const afterCartDelete = await client.query<{ count: string }>(
        'SELECT count(*) FROM cart_items WHERE cart_id = $1',
        [cartId],
      );
      expect(afterCartDelete.rows[0]?.count).toBe('0');
    });

    await asRuntime(async (client) => {
      const cartId = await createCart(client);
      const variant = await createVariant(client, 'SKU-CART-TWO');
      await addCartItem(client, cartId, variant.id, 1);

      await client.query('DELETE FROM product_variants WHERE id = $1', [variant.id]);

      const lines = await client.query<{ count: string }>(
        'SELECT count(*) FROM cart_items WHERE cart_id = $1',
        [cartId],
      );
      const carts = await client.query<{ count: string }>('SELECT count(*) FROM carts');
      expect(lines.rows[0]?.count).toBe('0');
      expect(carts.rows[0]?.count).toBe('1');
    });
  });

  it('links a cart to one order and keeps snapshots after cart changes', async () => {
    await asRuntime(async (client) => {
      const customerId = await createCustomer(client);
      const variant = await createVariant(client, 'SKU-CART-ORDER', 125000);
      const cartId = await createCart(client, customerId);
      await addCartItem(client, cartId, variant.id, 2);
      const zoneId = await createZone(client);

      const orderId = await createOrder(client, zoneId, {
        customerId,
        cartId,
        subtotalPoisha: 250000,
        deliveryFeePoisha: 6000,
      });
      await client.query("UPDATE carts SET status = 'converted' WHERE id = $1", [cartId]);
      await addOrderItem(client, orderId, variant.id, 2, 125000);

      const linked = await client.query<{ cart_id: string; customer_id: string; status: string }>(
        `SELECT o.cart_id, o.customer_id, c.status
         FROM orders o JOIN carts c ON c.id = o.cart_id
         WHERE o.id = $1`,
        [orderId],
      );
      expect(linked.rows[0]).toMatchObject({
        cart_id: cartId,
        customer_id: customerId,
        status: 'converted',
      });

      await expect(
        createOrder(client, zoneId, { customerId, cartId, subtotalPoisha: 250000 }),
      ).rejects.toMatchObject({ code: '23505' });

      await client.query('UPDATE product_variants SET price_poisha = 999 WHERE id = $1', [
        variant.id,
      ]);
      await client.query('DELETE FROM carts WHERE id = $1', [cartId]);

      const order = await client.query<{
        cart_id: string | null;
        subtotal_poisha: number;
        total_poisha: number;
      }>('SELECT cart_id, subtotal_poisha, total_poisha FROM orders WHERE id = $1', [orderId]);
      expect(order.rows[0]).toMatchObject({
        cart_id: null,
        subtotal_poisha: 250000,
        total_poisha: 256000,
      });

      const item = await client.query<{
        product_name: string;
        unit_price_poisha: number;
        line_total_poisha: number;
      }>(
        'SELECT product_name, unit_price_poisha, line_total_poisha FROM order_items WHERE order_id = $1',
        [orderId],
      );
      expect(item.rows[0]).toMatchObject({
        product_name: 'Snapshot Product',
        unit_price_poisha: 125000,
        line_total_poisha: 250000,
      });
    });
  });

  it('keeps guest orders without a customer reference', async () => {
    await asRuntime(async (client) => {
      const variant = await createVariant(client, 'SKU-CART-GUEST');
      const cartId = await createCart(client);
      await addCartItem(client, cartId, variant.id, 1);
      const zoneId = await createZone(client);

      const orderId = await createOrder(client, zoneId, { cartId, subtotalPoisha: 1000 });
      const order = await client.query<{ customer_id: string | null; contact_phone: string }>(
        'SELECT customer_id, contact_phone FROM orders WHERE id = $1',
        [orderId],
      );
      expect(order.rows[0]).toMatchObject({ customer_id: null, contact_phone: VALID_PHONE });
    });
  });
});
