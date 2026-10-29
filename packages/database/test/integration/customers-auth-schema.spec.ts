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
const VALID_EMAIL = 'customer@example.com';
const OTHER_EMAIL = 'other@example.com';
const PASSWORD_HASH = '0123456789abcdef0123456789abcdef:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const OTP_HASH = '0123456789abcdef0123456789abcdef';

async function asRuntime<T>(callback: (client: Client) => Promise<T>): Promise<T> {
  if (!runtimeUrl) {
    throw new Error('DATABASE_URL is required for database integration tests');
  }
  return withClient(runtimeUrl, callback);
}

interface CustomerValues {
  phone?: string | null;
  email?: string | null;
  passwordHash?: string | null;
  status?: string;
}

async function insertCustomer(client: Client, values: CustomerValues = {}): Promise<string> {
  const result = await client.query<{ id: string }>(
    `INSERT INTO customers (phone, email, password_hash, status)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [
      values.phone ?? null,
      values.email ?? null,
      values.passwordHash ?? null,
      values.status ?? 'active',
    ],
  );
  return result.rows[0]!.id;
}

interface AddressValues {
  label?: string | null;
  recipientName?: string | null;
  recipientPhone?: string | null;
  addressLine1?: string | null;
  district?: string | null;
  division?: string | null;
  countryCode?: string;
  isDefaultShipping?: boolean;
  isDefaultBilling?: boolean;
}

async function insertAddress(
  client: Client,
  customerId: string,
  values: AddressValues = {},
): Promise<string> {
  const result = await client.query<{ id: string }>(
    `INSERT INTO customer_addresses
       (customer_id, label, recipient_name, recipient_phone, address_line1, district, division,
        country_code, is_default_shipping, is_default_billing)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
    [
      customerId,
      values.label ?? null,
      values.recipientName === undefined ? 'Recipient' : values.recipientName,
      values.recipientPhone === undefined ? VALID_PHONE : values.recipientPhone,
      values.addressLine1 === undefined ? 'House 1, Road 1' : values.addressLine1,
      values.district === undefined ? 'Dhaka' : values.district,
      values.division === undefined ? 'Dhaka' : values.division,
      values.countryCode ?? 'BD',
      values.isDefaultShipping ?? false,
      values.isDefaultBilling ?? false,
    ],
  );
  return result.rows[0]!.id;
}

interface OtpValues {
  channel?: string;
  purpose?: string;
  destination?: string;
  codeHash?: string;
  expiresAt?: Date;
  attempts?: number;
  maxAttempts?: number;
}

async function insertOtp(client: Client, values: OtpValues = {}): Promise<string> {
  const result = await client.query<{ id: string }>(
    `INSERT INTO otp_codes (channel, purpose, destination, code_hash, expires_at, attempts, max_attempts)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [
      values.channel ?? 'sms',
      values.purpose ?? 'customer_login',
      values.destination ?? VALID_PHONE,
      values.codeHash ?? OTP_HASH,
      values.expiresAt ?? new Date(Date.now() + 5 * 60_000),
      values.attempts ?? 0,
      values.maxAttempts ?? 5,
    ],
  );
  return result.rows[0]!.id;
}

interface RoleValues {
  key?: string;
  name?: string;
  scope?: string;
  isSystem?: boolean;
}

async function insertRole(client: Client, values: RoleValues = {}): Promise<string> {
  const result = await client.query<{ id: string }>(
    `INSERT INTO admin_roles ("key", name, scope, is_system)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [
      values.key ?? 'owner',
      values.name ?? 'Owner',
      values.scope ?? 'store',
      values.isSystem ?? false,
    ],
  );
  return result.rows[0]!.id;
}

async function insertPermission(
  client: Client,
  key = 'catalog_manage',
  groupKey = 'catalog',
): Promise<string> {
  const result = await client.query<{ id: string }>(
    `INSERT INTO admin_permissions ("key", group_key) VALUES ($1, $2) RETURNING id`,
    [key, groupKey],
  );
  return result.rows[0]!.id;
}

interface AdminValues {
  email?: string;
  passwordHash?: string;
  displayName?: string;
  status?: string;
}

async function insertAdmin(
  client: Client,
  roleId: string,
  values: AdminValues = {},
): Promise<string> {
  const result = await client.query<{ id: string }>(
    `INSERT INTO admin_users (role_id, email, password_hash, display_name, status)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [
      roleId,
      values.email ?? 'admin@example.com',
      values.passwordHash ?? PASSWORD_HASH,
      values.displayName ?? 'Admin User',
      values.status ?? 'active',
    ],
  );
  return result.rows[0]!.id;
}

describeDatabase('customers and admin auth schema', () => {
  beforeEach(async () => {
    await resetDatabase();
    const result = runMigrateCommand();
    expect(result.status, result.stderr).toBe(0);
  });

  it('stores phone, email, or both identities and rejects missing identities', async () => {
    await asRuntime(async (client) => {
      await insertCustomer(client, { phone: VALID_PHONE });
      await insertCustomer(client, { email: VALID_EMAIL });
      await insertCustomer(client, { phone: OTHER_PHONE, email: OTHER_EMAIL });

      const rows = await client.query<{ phone: string | null; email: string | null }>(
        'SELECT phone, email FROM customers ORDER BY created_at',
      );
      expect(rows.rows).toHaveLength(3);
      expect(rows.rows[0]).toMatchObject({ phone: VALID_PHONE, email: null });
      expect(rows.rows[1]).toMatchObject({ phone: null, email: VALID_EMAIL });
      expect(rows.rows[2]).toMatchObject({ phone: OTHER_PHONE, email: OTHER_EMAIL });

      await expect(insertCustomer(client)).rejects.toMatchObject({ code: '23514' });
    });
  });

  it('rejects invalid phone and email formats', async () => {
    await asRuntime(async (client) => {
      await expect(insertCustomer(client, { phone: '01712345678' })).rejects.toMatchObject({
        code: '23514',
      });
      await expect(insertCustomer(client, { phone: 'not-a-phone' })).rejects.toMatchObject({
        code: '23514',
      });
      await expect(
        insertCustomer(client, { email: 'Customer@Example.com' }),
      ).rejects.toMatchObject({ code: '23514' });
      await expect(insertCustomer(client, { email: 'not-an-email' })).rejects.toMatchObject({
        code: '23514',
      });
    });
  });

  it('rejects duplicate phone and email while allowing repeated nulls', async () => {
    await asRuntime(async (client) => {
      await insertCustomer(client, { phone: VALID_PHONE });
      await expect(
        insertCustomer(client, { phone: VALID_PHONE, email: OTHER_EMAIL }),
      ).rejects.toMatchObject({ code: '23505' });

      await insertCustomer(client, { email: VALID_EMAIL });
      await expect(
        insertCustomer(client, { phone: OTHER_PHONE, email: VALID_EMAIL }),
      ).rejects.toMatchObject({ code: '23505' });

      await insertCustomer(client, { phone: OTHER_PHONE });
      await insertCustomer(client, { email: OTHER_EMAIL });

      const count = await client.query<{ count: string }>('SELECT count(*) FROM customers');
      expect(count.rows[0]?.count).toBe('4');
    });
  });

  it('stores password hashes only for email accounts', async () => {
    await asRuntime(async (client) => {
      const customerId = await insertCustomer(client, {
        email: VALID_EMAIL,
        passwordHash: PASSWORD_HASH,
      });

      const stored = await client.query<{ password_hash: string | null }>(
        'SELECT password_hash FROM customers WHERE id = $1',
        [customerId],
      );
      expect(stored.rows[0]?.password_hash).toBe(PASSWORD_HASH);

      await expect(
        insertCustomer(client, { phone: VALID_PHONE, passwordHash: PASSWORD_HASH }),
      ).rejects.toMatchObject({ code: '23514' });
      await expect(
        insertCustomer(client, { email: OTHER_EMAIL, passwordHash: '' }),
      ).rejects.toMatchObject({ code: '23514' });
      await expect(
        insertCustomer(client, { email: OTHER_EMAIL, passwordHash: 'short' }),
      ).rejects.toMatchObject({ code: '23514' });

      await expect(insertCustomer(client, { phone: OTHER_PHONE })).resolves.toBeTruthy();
    });
  });

  it('defaults customers to active and stores blocked accounts', async () => {
    await asRuntime(async (client) => {
      const inserted = await client.query<{ status: string }>(
        'INSERT INTO customers (phone) VALUES ($1) RETURNING status',
        [VALID_PHONE],
      );
      expect(inserted.rows[0]?.status).toBe('active');

      const blockedId = await insertCustomer(client, {
        phone: OTHER_PHONE,
        status: 'blocked',
      });
      const blocked = await client.query<{ status: string }>(
        'SELECT status FROM customers WHERE id = $1',
        [blockedId],
      );
      expect(blocked.rows[0]?.status).toBe('blocked');

      await expect(
        insertCustomer(client, { email: VALID_EMAIL, status: 'pending' }),
      ).rejects.toMatchObject({ code: '22P02' });
    });
  });

  it('stores addresses with the required fields and defaults the country', async () => {
    await asRuntime(async (client) => {
      const customerId = await insertCustomer(client, { phone: VALID_PHONE });
      const addressId = await insertAddress(client, customerId);

      const stored = await client.query<{ customer_id: string; country_code: string }>(
        'SELECT customer_id, country_code FROM customer_addresses WHERE id = $1',
        [addressId],
      );
      expect(stored.rows[0]).toMatchObject({ customer_id: customerId, country_code: 'BD' });

      await expect(insertAddress(client, MISSING_ID)).rejects.toMatchObject({ code: '23503' });
      await expect(
        insertAddress(client, customerId, { recipientName: null }),
      ).rejects.toMatchObject({ code: '23502' });
      await expect(
        insertAddress(client, customerId, { addressLine1: '' }),
      ).rejects.toMatchObject({ code: '23514' });
      await expect(
        insertAddress(client, customerId, { recipientPhone: '01712345678' }),
      ).rejects.toMatchObject({ code: '23514' });
      await expect(
        insertAddress(client, customerId, { countryCode: 'bd' }),
      ).rejects.toMatchObject({ code: '23514' });
    });
  });

  it('cascades addresses when a customer is deleted', async () => {
    await asRuntime(async (client) => {
      const customerId = await insertCustomer(client, { phone: VALID_PHONE });
      await insertAddress(client, customerId);
      await insertAddress(client, customerId, { label: 'Office' });

      await client.query('DELETE FROM customers WHERE id = $1', [customerId]);

      const count = await client.query<{ count: string }>(
        'SELECT count(*) FROM customer_addresses WHERE customer_id = $1',
        [customerId],
      );
      expect(count.rows[0]?.count).toBe('0');
    });
  });

  it('enforces one default shipping and one default billing address per customer', async () => {
    await asRuntime(async (client) => {
      const firstCustomer = await insertCustomer(client, { phone: VALID_PHONE });
      await insertAddress(client, firstCustomer, { isDefaultShipping: true });
      await expect(
        insertAddress(client, firstCustomer, { isDefaultShipping: true }),
      ).rejects.toMatchObject({ code: '23505' });
      await insertAddress(client, firstCustomer, { isDefaultBilling: true });

      const bothCustomer = await insertCustomer(client, { phone: OTHER_PHONE });
      const bothId = await insertAddress(client, bothCustomer, {
        isDefaultShipping: true,
        isDefaultBilling: true,
      });
      const both = await client.query<{
        is_default_shipping: boolean;
        is_default_billing: boolean;
      }>(
        'SELECT is_default_shipping, is_default_billing FROM customer_addresses WHERE id = $1',
        [bothId],
      );
      expect(both.rows[0]).toMatchObject({
        is_default_shipping: true,
        is_default_billing: true,
      });

      const thirdCustomer = await insertCustomer(client, { email: VALID_EMAIL });
      await insertAddress(client, thirdCustomer, { isDefaultShipping: true });

      const shippingDefaults = await client.query<{ count: string }>(
        'SELECT count(*) FROM customer_addresses WHERE is_default_shipping',
      );
      expect(shippingDefaults.rows[0]?.count).toBe('3');

      const billingDefaults = await client.query<{ count: string }>(
        'SELECT count(*) FROM customer_addresses WHERE is_default_billing',
      );
      expect(billingDefaults.rows[0]?.count).toBe('2');
    });
  });

  it('stores hashed OTP records for matching channels and purposes', async () => {
    await asRuntime(async (client) => {
      const smsId = await insertOtp(client);
      const emailId = await insertOtp(client, {
        channel: 'email',
        purpose: 'email_verification',
        destination: VALID_EMAIL,
      });

      const stored = await client.query<{ code_hash: string }>(
        'SELECT code_hash FROM otp_codes WHERE id = ANY($1::uuid[]) ORDER BY created_at',
        [[smsId, emailId]],
      );
      expect(stored.rows).toHaveLength(2);
      expect(stored.rows.every((row) => row.code_hash === OTP_HASH)).toBe(true);
    });
  });

  it('rejects short OTP hashes and non-future expiries', async () => {
    await asRuntime(async (client) => {
      await expect(insertOtp(client, { codeHash: 'short' })).rejects.toMatchObject({
        code: '23514',
      });
      await expect(
        insertOtp(client, { expiresAt: new Date(Date.now() - 60_000) }),
      ).rejects.toMatchObject({ code: '23514' });
    });
  });

  it('requires OTP destinations and purposes to match the channel', async () => {
    await asRuntime(async (client) => {
      await expect(
        insertOtp(client, {
          channel: 'email',
          purpose: 'email_verification',
          destination: VALID_PHONE,
        }),
      ).rejects.toMatchObject({ code: '23514' });

      await expect(
        insertOtp(client, {
          channel: 'sms',
          purpose: 'customer_login',
          destination: VALID_EMAIL,
        }),
      ).rejects.toMatchObject({ code: '23514' });

      await expect(
        insertOtp(client, {
          channel: 'email',
          purpose: 'phone_verification',
          destination: VALID_EMAIL,
        }),
      ).rejects.toMatchObject({ code: '23514' });
    });
  });

  it('enforces OTP attempt bounds and terminal states', async () => {
    await asRuntime(async (client) => {
      await expect(insertOtp(client, { attempts: -1 })).rejects.toMatchObject({ code: '23514' });
      await expect(insertOtp(client, { maxAttempts: 0 })).rejects.toMatchObject({ code: '23514' });
      await expect(
        insertOtp(client, { attempts: 6, maxAttempts: 5 }),
      ).rejects.toMatchObject({ code: '23514' });

      await expect(
        client.query(
          `INSERT INTO otp_codes
             (channel, purpose, destination, code_hash, expires_at,
              consumed_at, invalidated_at, created_at)
           VALUES ('sms', 'customer_login', $1, $2, now() + interval '5 minutes',
                   now(), now(), now() - interval '1 hour')`,
          [VALID_PHONE, OTP_HASH],
        ),
      ).rejects.toMatchObject({ code: '23514' });
    });
  });

  it('retains OTP issuance history and records consumption or invalidation', async () => {
    await asRuntime(async (client) => {
      await insertOtp(client, { destination: OTHER_PHONE });
      await insertOtp(client, { destination: OTHER_PHONE });

      const history = await client.query<{ count: string }>(
        'SELECT count(*) FROM otp_codes WHERE destination = $1',
        [OTHER_PHONE],
      );
      expect(history.rows[0]?.count).toBe('2');

      const consumedId = await insertOtp(client);
      await client.query('UPDATE otp_codes SET consumed_at = now() WHERE id = $1', [consumedId]);
      const consumed = await client.query<{ consumed_at: Date | null }>(
        'SELECT consumed_at FROM otp_codes WHERE id = $1',
        [consumedId],
      );
      expect(consumed.rows[0]?.consumed_at).toBeInstanceOf(Date);

      const invalidatedId = await insertOtp(client);
      await client.query('UPDATE otp_codes SET invalidated_at = now() WHERE id = $1', [
        invalidatedId,
      ]);
      const invalidated = await client.query<{ invalidated_at: Date | null }>(
        'SELECT invalidated_at FROM otp_codes WHERE id = $1',
        [invalidatedId],
      );
      expect(invalidated.rows[0]?.invalidated_at).toBeInstanceOf(Date);
    });
  });

  it('stores admin users with unique emails and hashed passwords', async () => {
    await asRuntime(async (client) => {
      const roleId = await insertRole(client, { key: 'owner' });
      const adminId = await insertAdmin(client, roleId);

      const stored = await client.query<{ status: string; role_id: string }>(
        'SELECT status, role_id FROM admin_users WHERE id = $1',
        [adminId],
      );
      expect(stored.rows[0]).toMatchObject({ status: 'active', role_id: roleId });

      await expect(
        insertAdmin(client, roleId, { email: 'admin@example.com' }),
      ).rejects.toMatchObject({ code: '23505' });
      await expect(
        insertAdmin(client, roleId, { email: 'Admin@Example.com' }),
      ).rejects.toMatchObject({ code: '23514' });
      await expect(insertAdmin(client, roleId, { passwordHash: 'short' })).rejects.toMatchObject({
        code: '23514',
      });
      await expect(
        insertAdmin(client, roleId, { email: 'disabled@example.com', status: 'disabled' }),
      ).resolves.toBeTruthy();
      await expect(
        insertAdmin(client, roleId, { email: 'pending@example.com', status: 'pending' }),
      ).rejects.toMatchObject({ code: '22P02' });
    });
  });

  it('requires an admin role and prevents deleting a role in use', async () => {
    await asRuntime(async (client) => {
      const roleId = await insertRole(client, { key: 'manager' });
      await insertAdmin(client, roleId, { email: 'manager@example.com' });

      await expect(
        client.query(
          `INSERT INTO admin_users (role_id, email, password_hash, display_name)
           VALUES (NULL, 'none@example.com', $1, 'No Role')`,
          [PASSWORD_HASH],
        ),
      ).rejects.toMatchObject({ code: '23502' });

      await expect(
        client.query(
          `INSERT INTO admin_users (role_id, email, password_hash, display_name)
           VALUES ($1, 'unknown@example.com', $2, 'Unknown Role')`,
          [MISSING_ID, PASSWORD_HASH],
        ),
      ).rejects.toMatchObject({ code: '23503' });

      await expect(
        client.query('DELETE FROM admin_roles WHERE id = $1', [roleId]),
      ).rejects.toMatchObject({ code: '23503' });
    });
  });

  it('validates role keys, scopes, and system-role protection', async () => {
    await asRuntime(async (client) => {
      const storeRoleId = await insertRole(client, { key: 'owner', scope: 'store' });
      const platformRoleId = await insertRole(client, {
        key: 'super_admin',
        name: 'Super Admin',
        scope: 'platform',
        isSystem: true,
      });

      const roles = await client.query<{ key: string; scope: string; is_system: boolean }>(
        'SELECT "key", scope, is_system FROM admin_roles ORDER BY "key"',
      );
      expect(roles.rows).toEqual([
        { key: 'owner', scope: 'store', is_system: false },
        { key: 'super_admin', scope: 'platform', is_system: true },
      ]);

      await expect(insertRole(client, { key: 'owner' })).rejects.toMatchObject({ code: '23505' });
      await expect(insertRole(client, { key: 'Owner' })).rejects.toMatchObject({ code: '23514' });
      await expect(insertRole(client, { key: 'bad key' })).rejects.toMatchObject({
        code: '23514',
      });
      await expect(insertRole(client, { key: 'scoped', scope: 'global' })).rejects.toMatchObject({
        code: '22P02',
      });

      await expect(
        client.query('DELETE FROM admin_roles WHERE id = $1', [platformRoleId]),
      ).rejects.toMatchObject({ code: '23001' });
      await expect(
        client.query('DELETE FROM admin_roles WHERE id = $1', [storeRoleId]),
      ).resolves.toBeDefined();
    });
  });

  it('validates permission keys and role-permission grants', async () => {
    await asRuntime(async (client) => {
      const roleId = await insertRole(client, { key: 'staff' });
      const permissionId = await insertPermission(client, 'catalog_manage', 'catalog');

      await expect(
        insertPermission(client, 'catalog_manage', 'catalog'),
      ).rejects.toMatchObject({ code: '23505' });
      await expect(insertPermission(client, 'Catalog Manage', 'catalog')).rejects.toMatchObject({
        code: '23514',
      });
      await expect(insertPermission(client, 'orders_view', 'Orders')).rejects.toMatchObject({
        code: '23514',
      });

      await client.query(
        'INSERT INTO admin_role_permissions (role_id, permission_id) VALUES ($1, $2)',
        [roleId, permissionId],
      );
      await expect(
        client.query('INSERT INTO admin_role_permissions (role_id, permission_id) VALUES ($1, $2)', [
          roleId,
          permissionId,
        ]),
      ).rejects.toMatchObject({ code: '23505' });

      const roleWithoutPermissions = await insertRole(client, { key: 'support' });
      const grants = await client.query<{ count: string }>(
        'SELECT count(*) FROM admin_role_permissions WHERE role_id = $1',
        [roleWithoutPermissions],
      );
      expect(grants.rows[0]?.count).toBe('0');
    });
  });

  it('cascades grants on custom-role deletion and restricts granted permission deletion', async () => {
    await asRuntime(async (client) => {
      const roleId = await insertRole(client, { key: 'custom_role' });
      const grantedPermissionId = await insertPermission(client, 'orders_view', 'orders');
      const ungrantedPermissionId = await insertPermission(client, 'inventory_adjust', 'inventory');

      await client.query(
        'INSERT INTO admin_role_permissions (role_id, permission_id) VALUES ($1, $2)',
        [roleId, grantedPermissionId],
      );

      await expect(
        client.query('DELETE FROM admin_permissions WHERE id = $1', [grantedPermissionId]),
      ).rejects.toMatchObject({ code: '23503' });

      await client.query('DELETE FROM admin_roles WHERE id = $1', [roleId]);

      const grants = await client.query<{ count: string }>(
        'SELECT count(*) FROM admin_role_permissions WHERE role_id = $1',
        [roleId],
      );
      expect(grants.rows[0]?.count).toBe('0');

      await expect(
        client.query('DELETE FROM admin_permissions WHERE id = $1', [ungrantedPermissionId]),
      ).resolves.toBeDefined();
    });
  });

  it('derives admin permissions from the assigned role and identifies platform admins', async () => {
    await asRuntime(async (client) => {
      const roleId = await insertRole(client, { key: 'manager' });
      const permissionId = await insertPermission(client, 'orders_view', 'orders');
      await client.query(
        'INSERT INTO admin_role_permissions (role_id, permission_id) VALUES ($1, $2)',
        [roleId, permissionId],
      );
      const adminId = await insertAdmin(client, roleId, { email: 'manager@example.com' });

      const effective = await client.query<{ key: string }>(
        `SELECT p."key"
         FROM admin_users u
         JOIN admin_role_permissions rp ON rp.role_id = u.role_id
         JOIN admin_permissions p ON p.id = rp.permission_id
         WHERE u.id = $1`,
        [adminId],
      );
      expect(effective.rows.map((row) => row.key)).toEqual(['orders_view']);

      const platformRoleId = await insertRole(client, {
        key: 'super_admin',
        name: 'Super Admin',
        scope: 'platform',
      });
      const platformAdminId = await insertAdmin(client, platformRoleId, {
        email: 'platform@example.com',
      });
      const platform = await client.query<{ scope: string }>(
        `SELECT r.scope
         FROM admin_users u
         JOIN admin_roles r ON r.id = u.role_id
         WHERE u.id = $1`,
        [platformAdminId],
      );
      expect(platform.rows[0]?.scope).toBe('platform');
    });
  });
});
