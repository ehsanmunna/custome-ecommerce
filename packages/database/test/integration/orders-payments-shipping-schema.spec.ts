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
const OTHER_PHONE = '+8801812345678';
const PASSWORD_HASH = '$argon2id$v=19$m=65536,t=3,p=4$0123456789abcdef';
let orderSequence = 0;
let couponSequence = 0;

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

interface CouponValues {
  code?: string;
  discountType?: string;
  discountValue?: number;
  minOrderPoisha?: number;
  startsAt?: Date;
  expiresAt?: Date;
  totalUsageLimit?: number | null;
  perCustomerLimit?: number | null;
  isActive?: boolean;
}

async function createCoupon(client: Client, values: CouponValues = {}): Promise<string> {
  couponSequence += 1;
  const result = await client.query<{ id: string }>(
    `INSERT INTO coupons
       (code, discount_type, discount_value, min_order_poisha, starts_at, expires_at,
        total_usage_limit, per_customer_limit, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
    [
      values.code ?? `SAVE${couponSequence}`,
      values.discountType ?? 'percentage',
      values.discountValue ?? 10,
      values.minOrderPoisha ?? 0,
      values.startsAt ?? new Date(Date.now() - 60 * 60_000),
      values.expiresAt ?? new Date(Date.now() + 24 * 60 * 60_000),
      values.totalUsageLimit ?? null,
      values.perCustomerLimit ?? null,
      values.isActive ?? true,
    ],
  );
  return result.rows[0]!.id;
}

interface OrderValues {
  orderNumber?: string;
  customerId?: string | null;
  cartId?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  recipientName?: string | null;
  recipientPhone?: string | null;
  addressLine1?: string | null;
  district?: string | null;
  division?: string | null;
  countryCode?: string;
  deliveryFeePoisha?: number;
  couponId?: string | null;
  status?: string;
  subtotalPoisha?: number;
  discountPoisha?: number;
  taxPoisha?: number;
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
  const tax = values.taxPoisha ?? 0;
  const deliveryFee = values.deliveryFeePoisha ?? 6000;
  const total = values.totalPoisha ?? subtotal - discount + deliveryFee;

  const result = await client.query<{ id: string }>(
    `INSERT INTO orders
       (order_number, customer_id, cart_id, contact_name, contact_phone, contact_email,
        delivery_recipient_name, delivery_recipient_phone, delivery_address_line1,
        delivery_district, delivery_division, delivery_country_code, shipping_zone_id,
        delivery_fee_poisha, coupon_id, status, subtotal_poisha, discount_poisha,
        tax_poisha, total_poisha)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
             $17, $18, $19, $20)
     RETURNING id`,
    [
      values.orderNumber ?? `ORD-${orderSequence}`,
      values.customerId ?? null,
      values.cartId ?? null,
      values.contactName === undefined ? 'Customer' : values.contactName,
      values.contactPhone === undefined ? VALID_PHONE : values.contactPhone,
      values.contactEmail ?? null,
      values.recipientName === undefined ? 'Recipient' : values.recipientName,
      values.recipientPhone === undefined ? VALID_PHONE : values.recipientPhone,
      values.addressLine1 === undefined ? 'House 1, Road 1' : values.addressLine1,
      values.district === undefined ? 'Dhaka' : values.district,
      values.division === undefined ? 'Dhaka' : values.division,
      values.countryCode ?? 'BD',
      shippingZoneId,
      deliveryFee,
      values.couponId ?? null,
      values.status ?? 'pending',
      subtotal,
      discount,
      tax,
      total,
    ],
  );
  return result.rows[0]!.id;
}

async function addOrderItem(
  client: Client,
  orderId: string,
  variantId: string,
  values: { quantity?: number; unitPricePoisha?: number; lineTotalPoisha?: number } = {},
): Promise<string> {
  const quantity = values.quantity ?? 1;
  const unitPrice = values.unitPricePoisha ?? 1000;
  const lineTotal = values.lineTotalPoisha ?? unitPrice * quantity;
  const result = await client.query<{ id: string }>(
    `INSERT INTO order_items
       (order_id, variant_id, product_name, variant_sku, attributes,
        unit_price_poisha, quantity, line_total_poisha)
     VALUES ($1, $2, 'Snapshot Product', 'SKU-SNAPSHOT', '{"color":"black"}'::jsonb,
             $3, $4, $5)
     RETURNING id`,
    [orderId, variantId, unitPrice, quantity, lineTotal],
  );
  return result.rows[0]!.id;
}

async function createAdmin(client: Client): Promise<string> {
  const role = await client.query<{ id: string }>(
    `INSERT INTO admin_roles ("key", name) VALUES ('owner', 'Owner') RETURNING id`,
  );
  const admin = await client.query<{ id: string }>(
    `INSERT INTO admin_users (role_id, email, password_hash, display_name)
     VALUES ($1, 'admin@example.com', $2, 'Admin User') RETURNING id`,
    [role.rows[0]!.id, PASSWORD_HASH],
  );
  return admin.rows[0]!.id;
}

async function createReturn(client: Client, orderId: string): Promise<string> {
  const result = await client.query<{ id: string }>(
    `INSERT INTO order_returns (order_id, reason) VALUES ($1, 'Damaged item') RETURNING id`,
    [orderId],
  );
  return result.rows[0]!.id;
}

async function addReturnItem(
  client: Client,
  returnId: string,
  orderItemId: string,
  quantity = 1,
  refundAmountPoisha = 1000,
): Promise<string> {
  const result = await client.query<{ id: string }>(
    `INSERT INTO order_return_items (return_id, order_item_id, quantity, refund_amount_poisha)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [returnId, orderItemId, quantity, refundAmountPoisha],
  );
  return result.rows[0]!.id;
}

interface PaymentValues {
  method?: string;
  status?: string;
  amountPoisha?: number;
  providerReference?: string | null;
  paidAt?: Date | null;
  refundedAt?: Date | null;
  cancelledAt?: Date | null;
}

async function createPayment(
  client: Client,
  orderId: string,
  values: PaymentValues = {},
): Promise<string> {
  const result = await client.query<{ id: string }>(
    `INSERT INTO payments
       (order_id, method, status, amount_poisha, provider_reference, paid_at, refunded_at,
        cancelled_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [
      orderId,
      values.method ?? 'cod',
      values.status ?? 'pending',
      values.amountPoisha ?? 5000,
      values.providerReference ?? null,
      values.paidAt ?? null,
      values.refundedAt ?? null,
      values.cancelledAt ?? null,
    ],
  );
  return result.rows[0]!.id;
}

interface ShipmentValues {
  courier?: string;
  status?: string;
  trackingNumber?: string | null;
  codAmountPoisha?: number;
  deliveredAt?: Date | null;
}

async function createShipment(
  client: Client,
  orderId: string,
  values: ShipmentValues = {},
): Promise<string> {
  const result = await client.query<{ id: string }>(
    `INSERT INTO shipments
       (order_id, courier, status, tracking_number, cod_amount_poisha, delivered_at)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [
      orderId,
      values.courier ?? 'steadfast',
      values.status ?? 'pending',
      values.trackingNumber ?? null,
      values.codAmountPoisha ?? 0,
      values.deliveredAt ?? null,
    ],
  );
  return result.rows[0]!.id;
}

describeDatabase('orders, payments, and shipping schema', () => {
  beforeEach(async () => {
    await resetDatabase();
    const result = runMigrateCommand();
    expect(result.status, result.stderr).toBe(0);
  });

  it('stores order numbers, contact details, snapshots, and default status', async () => {
    await asRuntime(async (client) => {
      const customerId = await createCustomer(client);
      const zoneId = await createZone(client);

      const registeredId = await createOrder(client, zoneId, {
        customerId,
        contactEmail: 'customer@example.com',
      });
      const guestId = await createOrder(client, zoneId, { contactPhone: OTHER_PHONE });

      const registered = await client.query<{
        customer_id: string;
        status: string;
        contact_email: string;
        delivery_country_code: string;
      }>(
        `SELECT customer_id, status, contact_email, delivery_country_code
         FROM orders WHERE id = $1`,
        [registeredId],
      );
      expect(registered.rows[0]).toMatchObject({
        customer_id: customerId,
        status: 'pending',
        contact_email: 'customer@example.com',
        delivery_country_code: 'BD',
      });

      const guest = await client.query<{ customer_id: string | null; contact_phone: string }>(
        'SELECT customer_id, contact_phone FROM orders WHERE id = $1',
        [guestId],
      );
      expect(guest.rows[0]).toMatchObject({ customer_id: null, contact_phone: OTHER_PHONE });

      await expect(
        createOrder(client, zoneId, { orderNumber: `ORD-${orderSequence}` }),
      ).rejects.toMatchObject({ code: '23505' });
    });
  });

  it('rejects missing or invalid contact and delivery details', async () => {
    await asRuntime(async (client) => {
      const zoneId = await createZone(client);

      await expect(createOrder(client, zoneId, { contactName: null })).rejects.toMatchObject({
        code: '23502',
      });
      await expect(createOrder(client, zoneId, { contactPhone: null })).rejects.toMatchObject({
        code: '23502',
      });
      await expect(
        createOrder(client, zoneId, { contactPhone: '01712345678' }),
      ).rejects.toMatchObject({ code: '23514' });
      await expect(
        createOrder(client, zoneId, { contactEmail: 'Customer@Example.com' }),
      ).rejects.toMatchObject({ code: '23514' });
      await expect(createOrder(client, zoneId, { recipientName: null })).rejects.toMatchObject({
        code: '23502',
      });
      await expect(createOrder(client, zoneId, { district: null })).rejects.toMatchObject({
        code: '23502',
      });
      await expect(
        createOrder(client, zoneId, { recipientPhone: '01712345678' }),
      ).rejects.toMatchObject({ code: '23514' });
      await expect(createOrder(client, zoneId, { countryCode: 'bd' })).rejects.toMatchObject({
        code: '23514',
      });
    });
  });

  it('defaults the delivery country and order status when omitted', async () => {
    await asRuntime(async (client) => {
      const zoneId = await createZone(client);
      const result = await client.query<{ status: string; delivery_country_code: string }>(
        `INSERT INTO orders
           (order_number, contact_name, contact_phone, delivery_recipient_name,
            delivery_recipient_phone, delivery_address_line1, delivery_district,
            delivery_division, shipping_zone_id, delivery_fee_poisha, subtotal_poisha,
            total_poisha)
         VALUES ('ORD-DEFAULTS', 'Customer', $1, 'Recipient', $1, 'House 1', 'Dhaka',
                 'Dhaka', $2, 0, 1000, 1000)
         RETURNING status, delivery_country_code`,
        [VALID_PHONE, zoneId],
      );
      expect(result.rows[0]).toMatchObject({
        status: 'pending',
        delivery_country_code: 'BD',
      });
    });
  });

  it('enforces order money arithmetic and tax-inclusive totals', async () => {
    await asRuntime(async (client) => {
      const zoneId = await createZone(client);
      const couponId = await createCoupon(client);

      const orderId = await createOrder(client, zoneId, {
        couponId,
        subtotalPoisha: 10000,
        discountPoisha: 1000,
        taxPoisha: 1000,
        deliveryFeePoisha: 600,
      });
      const order = await client.query<{
        total_poisha: number;
        tax_poisha: number;
      }>('SELECT total_poisha, tax_poisha FROM orders WHERE id = $1', [orderId]);
      expect(order.rows[0]).toMatchObject({ total_poisha: 9600, tax_poisha: 1000 });

      await expect(
        createOrder(client, zoneId, { subtotalPoisha: -1, totalPoisha: 0 }),
      ).rejects.toMatchObject({ code: '23514' });
      await expect(
        createOrder(client, zoneId, { deliveryFeePoisha: -1 }),
      ).rejects.toMatchObject({ code: '23514' });
      await expect(
        createOrder(client, zoneId, {
          couponId,
          subtotalPoisha: 1000,
          discountPoisha: 2000,
          totalPoisha: 0,
        }),
      ).rejects.toMatchObject({ code: '23514' });
      await expect(
        createOrder(client, zoneId, {
          subtotalPoisha: 1000,
          taxPoisha: 2000,
          totalPoisha: 1600,
        }),
      ).rejects.toMatchObject({ code: '23514' });
      await expect(
        createOrder(client, zoneId, {
          subtotalPoisha: 1000,
          discountPoisha: 100,
          totalPoisha: 900,
        }),
      ).rejects.toMatchObject({ code: '23514' });
    });
  });

  it('defaults supported statuses and rejects unsupported order statuses', async () => {
    await asRuntime(async (client) => {
      const zoneId = await createZone(client);
      const deliveredId = await createOrder(client, zoneId, { status: 'delivered' });
      const delivered = await client.query<{ status: string }>(
        'SELECT status FROM orders WHERE id = $1',
        [deliveredId],
      );
      expect(delivered.rows[0]?.status).toBe('delivered');

      await expect(createOrder(client, zoneId, { status: 'archived' })).rejects.toMatchObject({
        code: '22P02',
      });
    });
  });

  it('preserves orders and their snapshots when a customer is deleted', async () => {
    await asRuntime(async (client) => {
      const customerId = await createCustomer(client);
      const zoneId = await createZone(client);
      const orderId = await createOrder(client, zoneId, { customerId });

      await client.query('DELETE FROM customers WHERE id = $1', [customerId]);

      const order = await client.query<{
        customer_id: string | null;
        contact_name: string;
        delivery_district: string;
      }>('SELECT customer_id, contact_name, delivery_district FROM orders WHERE id = $1', [
        orderId,
      ]);
      expect(order.rows[0]).toMatchObject({
        customer_id: null,
        contact_name: 'Customer',
        delivery_district: 'Dhaka',
      });
    });
  });

  it('snapshots order items and protects catalog history', async () => {
    await asRuntime(async (client) => {
      const zoneId = await createZone(client);
      const orderId = await createOrder(client, zoneId);
      const variant = await createVariant(client, 'SKU-ORDER-ITEM', 2500);

      const itemId = await addOrderItem(client, orderId, variant.id, {
        quantity: 3,
        unitPricePoisha: 2500,
      });
      const item = await client.query<{
        product_name: string;
        variant_sku: string;
        attributes: Record<string, unknown>;
        unit_price_poisha: number;
        quantity: number;
        line_total_poisha: number;
      }>(
        `SELECT product_name, variant_sku, attributes, unit_price_poisha, quantity,
                line_total_poisha
         FROM order_items WHERE id = $1`,
        [itemId],
      );
      expect(item.rows[0]).toMatchObject({
        product_name: 'Snapshot Product',
        variant_sku: 'SKU-SNAPSHOT',
        unit_price_poisha: 2500,
        quantity: 3,
        line_total_poisha: 7500,
      });
      expect(item.rows[0]?.attributes).toEqual({ color: 'black' });

      await expect(
        addOrderItem(client, orderId, variant.id, { quantity: 0, lineTotalPoisha: 0 }),
      ).rejects.toMatchObject({ code: '23514' });
      await expect(
        addOrderItem(client, orderId, variant.id, { quantity: 2, lineTotalPoisha: 1 }),
      ).rejects.toMatchObject({ code: '23514' });
      await expect(addOrderItem(client, orderId, variant.id)).rejects.toMatchObject({
        code: '23505',
      });
      await expect(addOrderItem(client, orderId, MISSING_ID)).rejects.toMatchObject({
        code: '23503',
      });

      await expect(
        client.query('DELETE FROM product_variants WHERE id = $1', [variant.id]),
      ).rejects.toMatchObject({ code: '23503' });
      await expect(
        client.query('DELETE FROM products WHERE id = $1', [variant.productId]),
      ).rejects.toMatchObject({ code: '23503' });
    });
  });

  it('records order status history and rejects mutations', async () => {
    await asRuntime(async (client) => {
      const zoneId = await createZone(client);
      const orderId = await createOrder(client, zoneId);
      const adminId = await createAdmin(client);

      const initial = await client.query<{ id: string }>(
        `INSERT INTO order_status_history (order_id, from_status, to_status, note)
         VALUES ($1, NULL, 'pending', 'Order placed') RETURNING id`,
        [orderId],
      );
      await client.query(
        `INSERT INTO order_status_history
           (order_id, from_status, to_status, changed_by_admin_id, note)
         VALUES ($1, 'pending', 'confirmed', $2, 'Confirmed by staff')`,
        [orderId, adminId],
      );

      const history = await client.query<{
        from_status: string | null;
        to_status: string;
        changed_by_admin_id: string | null;
      }>(
        `SELECT from_status, to_status, changed_by_admin_id
         FROM order_status_history WHERE order_id = $1 ORDER BY from_status NULLS FIRST`,
        [orderId],
      );
      expect(history.rows).toHaveLength(2);
      expect(history.rows[0]).toMatchObject({ from_status: null, to_status: 'pending' });
      expect(history.rows[1]).toMatchObject({
        from_status: 'pending',
        to_status: 'confirmed',
        changed_by_admin_id: adminId,
      });

      await expect(
        client.query('UPDATE order_status_history SET note = $1 WHERE id = $2', [
          'changed',
          initial.rows[0]!.id,
        ]),
      ).rejects.toMatchObject({ code: '23001' });
      await expect(
        client.query('DELETE FROM order_status_history WHERE id = $1', [initial.rows[0]!.id]),
      ).rejects.toMatchObject({ code: '23001' });
    });
  });

  it('records returns with same-order, quantity, and deletion rules', async () => {
    await asRuntime(async (client) => {
      const zoneId = await createZone(client);
      const orderId = await createOrder(client, zoneId);
      const otherOrderId = await createOrder(client, zoneId, { orderNumber: 'ORD-OTHER' });
      const variant = await createVariant(client, 'SKU-RETURN-ONE');
      const otherVariant = await createVariant(client, 'SKU-RETURN-TWO');
      const orderItemId = await addOrderItem(client, orderId, variant.id, { quantity: 3 });
      const otherItemId = await addOrderItem(client, otherOrderId, otherVariant.id);

      const returnId = await createReturn(client, orderId);
      const stored = await client.query<{ status: string }>(
        'SELECT status FROM order_returns WHERE id = $1',
        [returnId],
      );
      expect(stored.rows[0]?.status).toBe('requested');

      await addReturnItem(client, returnId, orderItemId, 1, 1000);

      await expect(addReturnItem(client, returnId, otherItemId, 1, 1000)).rejects.toMatchObject({
        code: '23514',
      });
      await expect(addReturnItem(client, returnId, orderItemId, 1, 1000)).rejects.toMatchObject({
        code: '23505',
      });
      await expect(addReturnItem(client, returnId, orderItemId, 0, 1000)).rejects.toMatchObject({
        code: '23514',
      });
      await expect(
        addReturnItem(client, returnId, orderItemId, 1, -1),
      ).rejects.toMatchObject({ code: '23514' });

      const secondReturnId = await createReturn(client, orderId);
      await addReturnItem(client, secondReturnId, orderItemId, 2, 2000);
      const thirdReturnId = await createReturn(client, orderId);
      await expect(
        addReturnItem(client, thirdReturnId, orderItemId, 1, 1000),
      ).rejects.toMatchObject({ code: '23514' });

      await expect(client.query('DELETE FROM orders WHERE id = $1', [orderId])).rejects.toMatchObject(
        { code: '23503' },
      );

      await client.query('DELETE FROM order_returns WHERE id = $1', [returnId]);
      const remaining = await client.query<{ count: string }>(
        'SELECT count(*) FROM order_return_items WHERE return_id = $1',
        [returnId],
      );
      expect(remaining.rows[0]?.count).toBe('0');
    });
  });

  it('stores payment attempts with lifecycle timestamps and provider references', async () => {
    await asRuntime(async (client) => {
      const zoneId = await createZone(client);
      const orderId = await createOrder(client, zoneId);

      const cod = await client.query<{ id: string; status: string; method: string }>(
        `INSERT INTO payments (order_id, method, amount_poisha)
         VALUES ($1, 'cod', 5000) RETURNING id, status, method`,
        [orderId],
      );
      expect(cod.rows[0]).toMatchObject({ status: 'pending', method: 'cod' });

      await createPayment(client, orderId, {
        method: 'bkash',
        providerReference: 'BKASH-TX-1',
      });
      await createPayment(client, orderId, { method: 'shurjopay' });
      await createPayment(client, orderId, { method: 'bkash', providerReference: 'BKASH-TX-2' });

      await expect(
        createPayment(client, orderId, { method: 'pathao' }),
      ).rejects.toMatchObject({ code: '22P02' });
      await expect(
        createPayment(client, orderId, { status: 'processing' }),
      ).rejects.toMatchObject({ code: '22P02' });
      await expect(
        createPayment(client, orderId, { amountPoisha: 0 }),
      ).rejects.toMatchObject({ code: '23514' });
      await expect(
        createPayment(client, orderId, { amountPoisha: -1 }),
      ).rejects.toMatchObject({ code: '23514' });
      await expect(
        createPayment(client, orderId, { method: 'bkash', providerReference: 'BKASH-TX-1' }),
      ).rejects.toMatchObject({ code: '23505' });
      await expect(
        createPayment(client, MISSING_ID, { amountPoisha: 100 }),
      ).rejects.toMatchObject({ code: '23503' });

      await expect(
        createPayment(client, orderId, { status: 'paid' }),
      ).rejects.toMatchObject({ code: '23514' });
      await expect(
        createPayment(client, orderId, { status: 'refunded' }),
      ).rejects.toMatchObject({ code: '23514' });
      await expect(
        createPayment(client, orderId, { status: 'partially_refunded' }),
      ).rejects.toMatchObject({ code: '23514' });
      await expect(
        createPayment(client, orderId, { status: 'cancelled' }),
      ).rejects.toMatchObject({ code: '23514' });

      await createPayment(client, orderId, { status: 'paid', paidAt: new Date() });
      await createPayment(client, orderId, { status: 'refunded', refundedAt: new Date() });
      await createPayment(client, orderId, {
        status: 'partially_refunded',
        refundedAt: new Date(),
      });
      await createPayment(client, orderId, { status: 'cancelled', cancelledAt: new Date() });

      const attempts = await client.query<{ count: string }>(
        'SELECT count(*) FROM payments WHERE order_id = $1',
        [orderId],
      );
      expect(attempts.rows[0]?.count).toBe('8');
    });
  });

  it('keeps shipping zones unique and snapshots their fees on orders', async () => {
    await asRuntime(async (client) => {
      const zoneId = await createZone(client, 'dhaka', 6000);
      await expect(createZone(client, 'dhaka')).rejects.toMatchObject({ code: '23505' });
      await expect(createZone(client, 'negative', -1)).rejects.toMatchObject({ code: '23514' });

      await client.query(
        "INSERT INTO shipping_zone_districts (district, zone_id) VALUES ('Dhaka', $1)",
        [zoneId],
      );
      const otherZoneId = await createZone(client, 'outside');
      await expect(
        client.query(
          "INSERT INTO shipping_zone_districts (district, zone_id) VALUES ('Dhaka', $1)",
          [otherZoneId],
        ),
      ).rejects.toMatchObject({ code: '23505' });
      await expect(
        client.query(
          "INSERT INTO shipping_zone_districts (district, zone_id) VALUES ('Chattogram', $1)",
          [MISSING_ID],
        ),
      ).rejects.toMatchObject({ code: '23503' });

      const orderId = await createOrder(client, zoneId, { deliveryFeePoisha: 6000 });
      await client.query('UPDATE shipping_zones SET delivery_fee_poisha = 8000 WHERE id = $1', [
        zoneId,
      ]);
      const order = await client.query<{ delivery_fee_poisha: number }>(
        'SELECT delivery_fee_poisha FROM orders WHERE id = $1',
        [orderId],
      );
      expect(order.rows[0]?.delivery_fee_poisha).toBe(6000);

      await expect(
        client.query('DELETE FROM shipping_zones WHERE id = $1', [zoneId]),
      ).rejects.toMatchObject({ code: '23503' });

      await client.query(
        "INSERT INTO shipping_zone_districts (district, zone_id) VALUES ('Sylhet', $1)",
        [otherZoneId],
      );
      await client.query('DELETE FROM shipping_zones WHERE id = $1', [otherZoneId]);
      const mappings = await client.query<{ count: string }>(
        'SELECT count(*) FROM shipping_zone_districts WHERE zone_id = $1',
        [otherZoneId],
      );
      expect(mappings.rows[0]?.count).toBe('0');
    });
  });

  it('tracks shipments with courier status, tracking, and COD rules', async () => {
    await asRuntime(async (client) => {
      const zoneId = await createZone(client);
      const orderId = await createOrder(client, zoneId);

      const created = await client.query<{ status: string; courier: string }>(
        `INSERT INTO shipments (order_id) VALUES ($1) RETURNING status, courier`,
        [orderId],
      );
      expect(created.rows[0]).toMatchObject({ status: 'pending', courier: 'steadfast' });

      await createShipment(client, orderId, { trackingNumber: 'SF-TRACK-1' });
      await expect(
        createShipment(client, orderId, { trackingNumber: 'SF-TRACK-1' }),
      ).rejects.toMatchObject({ code: '23505' });
      await createShipment(client, orderId);
      await createShipment(client, orderId, { status: 'in_transit' });

      await expect(
        createShipment(client, orderId, { status: 'lost' }),
      ).rejects.toMatchObject({ code: '22P02' });
      await expect(
        createShipment(client, orderId, { courier: 'pathao' }),
      ).rejects.toMatchObject({ code: '22P02' });
      await expect(
        createShipment(client, orderId, { codAmountPoisha: -1 }),
      ).rejects.toMatchObject({ code: '23514' });
      await expect(
        createShipment(client, orderId, { status: 'delivered' }),
      ).rejects.toMatchObject({ code: '23514' });
      await createShipment(client, orderId, { status: 'delivered', deliveredAt: new Date() });

      const shipments = await client.query<{ count: string }>(
        'SELECT count(*) FROM shipments WHERE order_id = $1',
        [orderId],
      );
      expect(Number(shipments.rows[0]?.count)).toBeGreaterThan(1);

      await expect(client.query('DELETE FROM orders WHERE id = $1', [orderId])).rejects.toMatchObject(
        { code: '23503' },
      );
    });
  });

  it('validates coupon codes, values, validity windows, and limits', async () => {
    await asRuntime(async (client) => {
      await createCoupon(client, { code: 'SAVE10' });
      await expect(createCoupon(client, { code: 'SAVE10' })).rejects.toMatchObject({
        code: '23505',
      });
      await expect(createCoupon(client, { code: 'save20' })).rejects.toMatchObject({
        code: '23514',
      });
      await expect(createCoupon(client, { code: 'SAVE 20' })).rejects.toMatchObject({
        code: '23514',
      });
      await expect(createCoupon(client, { code: '' })).rejects.toMatchObject({ code: '23514' });

      await createCoupon(client, { code: 'ONE', discountValue: 1 });
      await createCoupon(client, { code: 'HUNDRED', discountValue: 100 });
      await expect(createCoupon(client, { code: 'ZERO', discountValue: 0 })).rejects.toMatchObject({
        code: '23514',
      });
      await expect(
        createCoupon(client, { code: 'OVER', discountValue: 101 }),
      ).rejects.toMatchObject({ code: '23514' });

      await createCoupon(client, { code: 'FIXED', discountType: 'fixed', discountValue: 500 });
      await expect(
        createCoupon(client, { code: 'FIXEDZERO', discountType: 'fixed', discountValue: 0 }),
      ).rejects.toMatchObject({ code: '23514' });
      await expect(
        createCoupon(client, { code: 'BOGUS', discountType: 'bogus' }),
      ).rejects.toMatchObject({ code: '22P02' });
      await expect(
        createCoupon(client, { code: 'NEGMIN', minOrderPoisha: -1 }),
      ).rejects.toMatchObject({ code: '23514' });

      const sameTime = new Date();
      await expect(
        createCoupon(client, { code: 'SAME', startsAt: sameTime, expiresAt: sameTime }),
      ).rejects.toMatchObject({ code: '23514' });
      await expect(
        createCoupon(client, {
          code: 'BACKWARD',
          startsAt: new Date(Date.now() + 60_000),
          expiresAt: new Date(Date.now() + 30_000),
        }),
      ).rejects.toMatchObject({ code: '23514' });

      await expect(
        createCoupon(client, { code: 'TOTALZERO', totalUsageLimit: 0 }),
      ).rejects.toMatchObject({ code: '23514' });
      await expect(
        createCoupon(client, { code: 'PERZERO', perCustomerLimit: 0 }),
      ).rejects.toMatchObject({ code: '23514' });
      await createCoupon(client, {
        code: 'LIMITED',
        totalUsageLimit: 10,
        perCustomerLimit: 1,
      });
    });
  });

  it('records one positive redemption per order and protects redeemed coupons', async () => {
    await asRuntime(async (client) => {
      const zoneId = await createZone(client);
      const couponId = await createCoupon(client, { code: 'REDEEM' });
      const customerId = await createCustomer(client);
      const orderId = await createOrder(client, zoneId, {
        customerId,
        couponId,
        subtotalPoisha: 10000,
        discountPoisha: 1000,
      });

      await client.query(
        `INSERT INTO coupon_redemptions (coupon_id, order_id, customer_id, discount_poisha)
         VALUES ($1, $2, $3, 1000)`,
        [couponId, orderId, customerId],
      );
      await expect(
        client.query(
          `INSERT INTO coupon_redemptions (coupon_id, order_id, customer_id, discount_poisha)
           VALUES ($1, $2, $3, 1000)`,
          [couponId, orderId, customerId],
        ),
      ).rejects.toMatchObject({ code: '23505' });
      await expect(
        client.query(
          `INSERT INTO coupon_redemptions (coupon_id, order_id, discount_poisha)
           VALUES ($1, $2, 0)`,
          [couponId, orderId],
        ),
      ).rejects.toMatchObject({ code: '23514' });

      const guestOrderId = await createOrder(client, zoneId, { orderNumber: 'ORD-GUEST' });
      await client.query(
        `INSERT INTO coupon_redemptions (coupon_id, order_id, discount_poisha)
         VALUES ($1, $2, 500)`,
        [couponId, guestOrderId],
      );
      const guest = await client.query<{ customer_id: string | null }>(
        'SELECT customer_id FROM coupon_redemptions WHERE order_id = $1',
        [guestOrderId],
      );
      expect(guest.rows[0]?.customer_id).toBeNull();

      await expect(
        client.query('DELETE FROM coupons WHERE id = $1', [couponId]),
      ).rejects.toMatchObject({ code: '23503' });
      await expect(client.query('DELETE FROM orders WHERE id = $1', [orderId])).rejects.toMatchObject(
        { code: '23503' },
      );
    });
  });
});
