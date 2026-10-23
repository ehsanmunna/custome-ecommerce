-- Customer identity, delivery addresses, OTP records, admin users, roles, and permissions.

-- CreateEnum
CREATE TYPE "CustomerStatus" AS ENUM ('active', 'blocked');

-- CreateEnum
CREATE TYPE "OtpChannel" AS ENUM ('sms', 'email');

-- CreateEnum
CREATE TYPE "OtpPurpose" AS ENUM ('customer_login', 'phone_verification', 'email_verification', 'password_reset');

-- CreateEnum
CREATE TYPE "AdminUserStatus" AS ENUM ('active', 'disabled');

-- CreateEnum
CREATE TYPE "AdminRoleScope" AS ENUM ('store', 'platform');

-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "phone" TEXT,
    "email" TEXT,
    "password_hash" TEXT,
    "first_name" TEXT,
    "last_name" TEXT,
    "status" "CustomerStatus" NOT NULL DEFAULT 'active',
    "email_verified_at" TIMESTAMPTZ(6),
    "phone_verified_at" TIMESTAMPTZ(6),
    "last_login_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "customers_identity_required" CHECK ("phone" IS NOT NULL OR "email" IS NOT NULL),
    CONSTRAINT "customers_phone_e164" CHECK ("phone" IS NULL OR "phone" ~ '^\+[1-9][0-9]{7,14}$'),
    CONSTRAINT "customers_email_lowercase" CHECK (
        "email" IS NULL OR ("email" = lower("email") AND position('@' in "email") > 1)
    ),
    CONSTRAINT "customers_password_requires_email" CHECK (
        "password_hash" IS NULL OR "email" IS NOT NULL
    ),
    CONSTRAINT "customers_password_hash_length" CHECK (
        "password_hash" IS NULL OR length("password_hash") >= 20
    )
);

-- CreateTable
CREATE TABLE "customer_addresses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "customer_id" UUID NOT NULL,
    "label" TEXT,
    "recipient_name" TEXT NOT NULL,
    "recipient_phone" TEXT NOT NULL,
    "address_line1" TEXT NOT NULL,
    "address_line2" TEXT,
    "area" TEXT,
    "district" TEXT NOT NULL,
    "division" TEXT NOT NULL,
    "postal_code" TEXT,
    "country_code" CHAR(2) NOT NULL DEFAULT 'BD',
    "is_default_shipping" BOOLEAN NOT NULL DEFAULT false,
    "is_default_billing" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_addresses_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "customer_addresses_recipient_phone_e164" CHECK (
        "recipient_phone" ~ '^\+[1-9][0-9]{7,14}$'
    ),
    CONSTRAINT "customer_addresses_country_code" CHECK (
        "country_code" = upper("country_code") AND length("country_code") = 2
    ),
    CONSTRAINT "customer_addresses_required_text" CHECK (
        btrim("recipient_name") <> '' AND
        btrim("address_line1") <> '' AND
        btrim("district") <> '' AND
        btrim("division") <> ''
    )
);

-- CreateTable
CREATE TABLE "otp_codes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "channel" "OtpChannel" NOT NULL,
    "purpose" "OtpPurpose" NOT NULL,
    "destination" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "consumed_at" TIMESTAMPTZ(6),
    "invalidated_at" TIMESTAMPTZ(6),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_codes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "otp_codes_code_hash_min_length" CHECK (length("code_hash") >= 16),
    CONSTRAINT "otp_codes_expiry_after_creation" CHECK ("expires_at" > "created_at"),
    CONSTRAINT "otp_codes_attempts_bounds" CHECK (
        "attempts" >= 0 AND "max_attempts" > 0 AND "attempts" <= "max_attempts"
    ),
    CONSTRAINT "otp_codes_terminal_state" CHECK (
        NOT ("consumed_at" IS NOT NULL AND "invalidated_at" IS NOT NULL)
    ),
    CONSTRAINT "otp_codes_consumed_after_creation" CHECK (
        "consumed_at" IS NULL OR "consumed_at" >= "created_at"
    ),
    CONSTRAINT "otp_codes_invalidated_after_creation" CHECK (
        "invalidated_at" IS NULL OR "invalidated_at" >= "created_at"
    ),
    CONSTRAINT "otp_codes_destination_matches_channel" CHECK (
        ("channel" = 'sms' AND "destination" ~ '^\+[1-9][0-9]{7,14}$') OR
        ("channel" = 'email' AND "destination" = lower("destination") AND position('@' in "destination") > 1)
    ),
    CONSTRAINT "otp_codes_purpose_matches_channel" CHECK (
        "purpose" = 'customer_login' OR
        ("purpose" = 'phone_verification' AND "channel" = 'sms') OR
        ("purpose" IN ('email_verification', 'password_reset') AND "channel" = 'email')
    )
);

-- CreateTable
CREATE TABLE "admin_roles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "scope" "AdminRoleScope" NOT NULL DEFAULT 'store',
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_roles_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "admin_roles_key_format" CHECK ("key" ~ '^[a-z][a-z0-9_]*$'),
    CONSTRAINT "admin_roles_name_nonempty" CHECK (btrim("name") <> '')
);

-- CreateTable
CREATE TABLE "admin_permissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" TEXT NOT NULL,
    "description" TEXT,
    "group_key" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_permissions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "admin_permissions_key_format" CHECK ("key" ~ '^[a-z][a-z0-9_]*$'),
    CONSTRAINT "admin_permissions_group_key_format" CHECK ("group_key" ~ '^[a-z][a-z0-9_]*$')
);

-- CreateTable
CREATE TABLE "admin_role_permissions" (
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,

    CONSTRAINT "admin_role_permissions_pkey" PRIMARY KEY ("role_id", "permission_id")
);

-- CreateTable
CREATE TABLE "admin_users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "role_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "status" "AdminUserStatus" NOT NULL DEFAULT 'active',
    "last_login_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "admin_users_email_lowercase" CHECK (
        "email" = lower("email") AND position('@' in "email") > 1
    ),
    CONSTRAINT "admin_users_password_hash_length" CHECK (length("password_hash") >= 20),
    CONSTRAINT "admin_users_display_name_nonempty" CHECK (btrim("display_name") <> '')
);

-- CreateIndex
CREATE UNIQUE INDEX "customers_phone_key" ON "customers"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "customers_email_key" ON "customers"("email");

-- CreateIndex
CREATE INDEX "customers_status_idx" ON "customers"("status");

-- CreateIndex
CREATE INDEX "customer_addresses_customer_id_idx" ON "customer_addresses"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "customer_addresses_one_default_shipping"
ON "customer_addresses"("customer_id") WHERE "is_default_shipping";

-- CreateIndex
CREATE UNIQUE INDEX "customer_addresses_one_default_billing"
ON "customer_addresses"("customer_id") WHERE "is_default_billing";

-- CreateIndex
CREATE INDEX "otp_codes_destination_purpose_created_at_idx"
ON "otp_codes"("destination", "purpose", "created_at");

-- CreateIndex
CREATE INDEX "otp_codes_expires_at_idx" ON "otp_codes"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "admin_roles_key_key" ON "admin_roles"("key");

-- CreateIndex
CREATE INDEX "admin_roles_scope_idx" ON "admin_roles"("scope");

-- CreateIndex
CREATE UNIQUE INDEX "admin_permissions_key_key" ON "admin_permissions"("key");

-- CreateIndex
CREATE INDEX "admin_role_permissions_permission_id_idx"
ON "admin_role_permissions"("permission_id");

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");

-- CreateIndex
CREATE INDEX "admin_users_role_id_idx" ON "admin_users"("role_id");

-- CreateIndex
CREATE INDEX "admin_users_status_idx" ON "admin_users"("status");

-- AddForeignKey
ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_customer_id_fkey"
FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_role_permissions" ADD CONSTRAINT "admin_role_permissions_role_id_fkey"
FOREIGN KEY ("role_id") REFERENCES "admin_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_role_permissions" ADD CONSTRAINT "admin_role_permissions_permission_id_fkey"
FOREIGN KEY ("permission_id") REFERENCES "admin_permissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_role_id_fkey"
FOREIGN KEY ("role_id") REFERENCES "admin_roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Keep seeded default roles from being deleted.
CREATE FUNCTION reject_system_role_delete() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF OLD."is_system" THEN
        RAISE EXCEPTION 'system roles cannot be deleted' USING ERRCODE = '23001';
    END IF;
    RETURN OLD;
END;
$$;

-- CreateTrigger
CREATE TRIGGER admin_roles_system_protected
BEFORE DELETE ON "admin_roles"
FOR EACH ROW EXECUTE FUNCTION reject_system_role_delete();
