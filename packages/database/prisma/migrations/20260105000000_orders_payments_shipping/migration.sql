-- Carts, orders, returns, payments, delivery zones, shipments, and coupons.

-- CreateEnum
CREATE TYPE "CartStatus" AS ENUM ('active', 'converted', 'abandoned');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned', 'partially_delivered');

-- CreateEnum
CREATE TYPE "OrderReturnStatus" AS ENUM ('requested', 'approved', 'rejected', 'received', 'refunded', 'cancelled');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('cod', 'bkash', 'shurjopay');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'authorized', 'paid', 'failed', 'cancelled', 'refunded', 'partially_refunded');

-- CreateEnum
CREATE TYPE "Courier" AS ENUM ('steadfast');

-- CreateEnum
CREATE TYPE "ShipmentStatus" AS ENUM ('pending', 'booked', 'picked_up', 'in_transit', 'delivered', 'returned', 'cancelled', 'failed');

-- CreateEnum
CREATE TYPE "CouponDiscountType" AS ENUM ('percentage', 'fixed');

-- CreateTable
CREATE TABLE "carts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "customer_id" UUID,
    "status" "CartStatus" NOT NULL DEFAULT 'active',
    "expires_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "carts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cart_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cart_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cart_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "cart_items_quantity_positive" CHECK ("quantity" > 0)
);

-- CreateTable
CREATE TABLE "shipping_zones" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "delivery_fee_poisha" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipping_zones_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "shipping_zones_code_format" CHECK ("code" ~ '^[a-z0-9][a-z0-9_-]*$'),
    CONSTRAINT "shipping_zones_name_nonempty" CHECK (btrim("name") <> ''),
    CONSTRAINT "shipping_zones_delivery_fee_nonnegative" CHECK ("delivery_fee_poisha" >= 0)
);

-- CreateTable
CREATE TABLE "shipping_zone_districts" (
    "district" TEXT NOT NULL,
    "zone_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipping_zone_districts_pkey" PRIMARY KEY ("district"),
    CONSTRAINT "shipping_zone_districts_district_nonempty" CHECK (btrim("district") <> '')
);

-- CreateTable
CREATE TABLE "coupons" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "discount_type" "CouponDiscountType" NOT NULL,
    "discount_value" INTEGER NOT NULL,
    "min_order_poisha" INTEGER NOT NULL DEFAULT 0,
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "total_usage_limit" INTEGER,
    "per_customer_limit" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "coupons_code_format" CHECK ("code" ~ '^[A-Z0-9][A-Z0-9_-]*$'),
    CONSTRAINT "coupons_discount_value" CHECK (
        ("discount_type" = 'percentage' AND "discount_value" BETWEEN 1 AND 100) OR
        ("discount_type" = 'fixed' AND "discount_value" > 0)
    ),
    CONSTRAINT "coupons_min_order_nonnegative" CHECK ("min_order_poisha" >= 0),
    CONSTRAINT "coupons_validity_window" CHECK ("starts_at" < "expires_at"),
    CONSTRAINT "coupons_total_usage_limit_positive" CHECK (
        "total_usage_limit" IS NULL OR "total_usage_limit" > 0
    ),
    CONSTRAINT "coupons_per_customer_limit_positive" CHECK (
        "per_customer_limit" IS NULL OR "per_customer_limit" > 0
    )
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_number" TEXT NOT NULL,
    "customer_id" UUID,
    "cart_id" UUID,
    "contact_name" TEXT NOT NULL,
    "contact_phone" TEXT NOT NULL,
    "contact_email" TEXT,
    "delivery_recipient_name" TEXT NOT NULL,
    "delivery_recipient_phone" TEXT NOT NULL,
    "delivery_address_line1" TEXT NOT NULL,
    "delivery_address_line2" TEXT,
    "delivery_area" TEXT,
    "delivery_district" TEXT NOT NULL,
    "delivery_division" TEXT NOT NULL,
    "delivery_postal_code" TEXT,
    "delivery_country_code" CHAR(2) NOT NULL DEFAULT 'BD',
    "shipping_zone_id" UUID NOT NULL,
    "delivery_fee_poisha" INTEGER NOT NULL,
    "coupon_id" UUID,
    "status" "OrderStatus" NOT NULL DEFAULT 'pending',
    "subtotal_poisha" INTEGER NOT NULL,
    "discount_poisha" INTEGER NOT NULL DEFAULT 0,
    "tax_poisha" INTEGER NOT NULL DEFAULT 0,
    "total_poisha" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "orders_order_number_nonempty" CHECK (btrim("order_number") <> ''),
    CONSTRAINT "orders_contact_name_nonempty" CHECK (btrim("contact_name") <> ''),
    CONSTRAINT "orders_contact_phone_e164" CHECK ("contact_phone" ~ '^\+[1-9][0-9]{7,14}$'),
    CONSTRAINT "orders_contact_email_lowercase" CHECK (
        "contact_email" IS NULL OR
        ("contact_email" = lower("contact_email") AND position('@' in "contact_email") > 1)
    ),
    CONSTRAINT "orders_required_delivery_text" CHECK (
        btrim("delivery_recipient_name") <> '' AND
        btrim("delivery_address_line1") <> '' AND
        btrim("delivery_district") <> '' AND
        btrim("delivery_division") <> ''
    ),
    CONSTRAINT "orders_delivery_recipient_phone_e164" CHECK (
        "delivery_recipient_phone" ~ '^\+[1-9][0-9]{7,14}$'
    ),
    CONSTRAINT "orders_delivery_country_code" CHECK (
        "delivery_country_code" = upper("delivery_country_code") AND
        length("delivery_country_code") = 2
    ),
    CONSTRAINT "orders_subtotal_nonnegative" CHECK ("subtotal_poisha" >= 0),
    CONSTRAINT "orders_discount_bounds" CHECK (
        "discount_poisha" >= 0 AND "discount_poisha" <= "subtotal_poisha"
    ),
    CONSTRAINT "orders_delivery_fee_nonnegative" CHECK ("delivery_fee_poisha" >= 0),
    CONSTRAINT "orders_tax_bounds" CHECK (
        "tax_poisha" >= 0 AND "tax_poisha" <= "subtotal_poisha"
    ),
    CONSTRAINT "orders_total_nonnegative" CHECK ("total_poisha" >= 0),
    CONSTRAINT "orders_total_arithmetic" CHECK (
        "total_poisha" = "subtotal_poisha" - "discount_poisha" + "delivery_fee_poisha"
    ),
    CONSTRAINT "orders_discount_requires_coupon" CHECK (
        "coupon_id" IS NOT NULL OR "discount_poisha" = 0
    )
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "product_name" TEXT NOT NULL,
    "variant_sku" TEXT NOT NULL,
    "attributes" JSONB NOT NULL DEFAULT '{}',
    "unit_price_poisha" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "line_total_poisha" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "order_items_product_name_nonempty" CHECK (btrim("product_name") <> ''),
    CONSTRAINT "order_items_variant_sku_nonempty" CHECK (btrim("variant_sku") <> ''),
    CONSTRAINT "order_items_unit_price_nonnegative" CHECK ("unit_price_poisha" >= 0),
    CONSTRAINT "order_items_quantity_positive" CHECK ("quantity" > 0),
    CONSTRAINT "order_items_line_total_nonnegative" CHECK ("line_total_poisha" >= 0),
    CONSTRAINT "order_items_line_total_arithmetic" CHECK (
        "line_total_poisha" = "unit_price_poisha" * "quantity"
    )
);

-- CreateTable
CREATE TABLE "order_status_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL,
    "from_status" "OrderStatus",
    "to_status" "OrderStatus" NOT NULL,
    "changed_by_admin_id" UUID,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_returns" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL,
    "status" "OrderReturnStatus" NOT NULL DEFAULT 'requested',
    "reason" TEXT NOT NULL,
    "refund_total_poisha" INTEGER NOT NULL DEFAULT 0,
    "approved_at" TIMESTAMPTZ(6),
    "received_at" TIMESTAMPTZ(6),
    "refunded_at" TIMESTAMPTZ(6),
    "cancelled_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_returns_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "order_returns_reason_nonempty" CHECK (btrim("reason") <> ''),
    CONSTRAINT "order_returns_refund_total_nonnegative" CHECK ("refund_total_poisha" >= 0),
    CONSTRAINT "order_returns_approved_timestamp" CHECK (
        "status" NOT IN ('approved', 'received', 'refunded') OR "approved_at" IS NOT NULL
    ),
    CONSTRAINT "order_returns_received_timestamp" CHECK (
        "status" NOT IN ('received', 'refunded') OR "received_at" IS NOT NULL
    ),
    CONSTRAINT "order_returns_refunded_timestamp" CHECK (
        "status" <> 'refunded' OR "refunded_at" IS NOT NULL
    ),
    CONSTRAINT "order_returns_cancelled_timestamp" CHECK (
        "status" <> 'cancelled' OR "cancelled_at" IS NOT NULL
    )
);

-- CreateTable
CREATE TABLE "order_return_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "return_id" UUID NOT NULL,
    "order_item_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "refund_amount_poisha" INTEGER NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_return_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "order_return_items_quantity_positive" CHECK ("quantity" > 0),
    CONSTRAINT "order_return_items_refund_amount_nonnegative" CHECK ("refund_amount_poisha" >= 0)
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'pending',
    "amount_poisha" INTEGER NOT NULL,
    "provider_reference" TEXT,
    "failure_reason" TEXT,
    "authorized_at" TIMESTAMPTZ(6),
    "paid_at" TIMESTAMPTZ(6),
    "failed_at" TIMESTAMPTZ(6),
    "cancelled_at" TIMESTAMPTZ(6),
    "refunded_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "payments_amount_positive" CHECK ("amount_poisha" > 0),
    CONSTRAINT "payments_provider_reference_nonempty" CHECK (
        "provider_reference" IS NULL OR btrim("provider_reference") <> ''
    ),
    CONSTRAINT "payments_paid_timestamp" CHECK ("status" <> 'paid' OR "paid_at" IS NOT NULL),
    CONSTRAINT "payments_refunded_timestamp" CHECK (
        "status" NOT IN ('refunded', 'partially_refunded') OR "refunded_at" IS NOT NULL
    ),
    CONSTRAINT "payments_cancelled_timestamp" CHECK (
        "status" <> 'cancelled' OR "cancelled_at" IS NOT NULL
    )
);

-- CreateTable
CREATE TABLE "shipments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL,
    "courier" "Courier" NOT NULL DEFAULT 'steadfast',
    "status" "ShipmentStatus" NOT NULL DEFAULT 'pending',
    "tracking_number" TEXT,
    "cod_amount_poisha" INTEGER NOT NULL DEFAULT 0,
    "booked_at" TIMESTAMPTZ(6),
    "picked_up_at" TIMESTAMPTZ(6),
    "delivered_at" TIMESTAMPTZ(6),
    "returned_at" TIMESTAMPTZ(6),
    "cancelled_at" TIMESTAMPTZ(6),
    "failed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "shipments_cod_amount_nonnegative" CHECK ("cod_amount_poisha" >= 0),
    CONSTRAINT "shipments_tracking_number_nonempty" CHECK (
        "tracking_number" IS NULL OR btrim("tracking_number") <> ''
    ),
    CONSTRAINT "shipments_delivered_timestamp" CHECK (
        "status" <> 'delivered' OR "delivered_at" IS NOT NULL
    )
);

-- CreateTable
CREATE TABLE "coupon_redemptions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "coupon_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "customer_id" UUID,
    "discount_poisha" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coupon_redemptions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "coupon_redemptions_discount_positive" CHECK ("discount_poisha" > 0)
);

-- CreateIndex
CREATE INDEX "carts_customer_id_idx" ON "carts"("customer_id");

-- CreateIndex
CREATE INDEX "carts_status_idx" ON "carts"("status");

-- CreateIndex
CREATE UNIQUE INDEX "cart_items_cart_id_variant_id_key" ON "cart_items"("cart_id", "variant_id");

-- CreateIndex
CREATE INDEX "cart_items_variant_id_idx" ON "cart_items"("variant_id");

-- CreateIndex
CREATE UNIQUE INDEX "shipping_zones_code_key" ON "shipping_zones"("code");

-- CreateIndex
CREATE INDEX "shipping_zones_is_active_idx" ON "shipping_zones"("is_active");

-- CreateIndex
CREATE INDEX "shipping_zone_districts_zone_id_idx" ON "shipping_zone_districts"("zone_id");

-- CreateIndex
CREATE UNIQUE INDEX "coupons_code_key" ON "coupons"("code");

-- CreateIndex
CREATE INDEX "coupons_is_active_idx" ON "coupons"("is_active");

-- CreateIndex
CREATE INDEX "coupons_starts_at_idx" ON "coupons"("starts_at");

-- CreateIndex
CREATE INDEX "coupons_expires_at_idx" ON "coupons"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "orders_order_number_key" ON "orders"("order_number");

-- CreateIndex
CREATE UNIQUE INDEX "orders_cart_id_key" ON "orders"("cart_id");

-- CreateIndex
CREATE INDEX "orders_customer_id_idx" ON "orders"("customer_id");

-- CreateIndex
CREATE INDEX "orders_shipping_zone_id_idx" ON "orders"("shipping_zone_id");

-- CreateIndex
CREATE INDEX "orders_coupon_id_idx" ON "orders"("coupon_id");

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "orders"("status");

-- CreateIndex
CREATE INDEX "orders_created_at_idx" ON "orders"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "order_items_order_id_variant_id_key" ON "order_items"("order_id", "variant_id");

-- CreateIndex
CREATE INDEX "order_items_variant_id_idx" ON "order_items"("variant_id");

-- CreateIndex
CREATE INDEX "order_status_history_order_id_created_at_idx" ON "order_status_history"("order_id", "created_at");

-- CreateIndex
CREATE INDEX "order_status_history_changed_by_admin_id_idx" ON "order_status_history"("changed_by_admin_id");

-- CreateIndex
CREATE INDEX "order_returns_order_id_idx" ON "order_returns"("order_id");

-- CreateIndex
CREATE INDEX "order_returns_status_idx" ON "order_returns"("status");

-- CreateIndex
CREATE UNIQUE INDEX "order_return_items_return_id_order_item_id_key" ON "order_return_items"("return_id", "order_item_id");

-- CreateIndex
CREATE INDEX "order_return_items_order_item_id_idx" ON "order_return_items"("order_item_id");

-- CreateIndex
CREATE INDEX "payments_order_id_idx" ON "payments"("order_id");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "payments"("status");

-- CreateIndex
CREATE UNIQUE INDEX "payments_method_provider_reference_key"
ON "payments"("method", "provider_reference") WHERE "provider_reference" IS NOT NULL;

-- CreateIndex
CREATE INDEX "shipments_order_id_idx" ON "shipments"("order_id");

-- CreateIndex
CREATE INDEX "shipments_status_idx" ON "shipments"("status");

-- CreateIndex
CREATE UNIQUE INDEX "shipments_tracking_number_key"
ON "shipments"("tracking_number") WHERE "tracking_number" IS NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "coupon_redemptions_order_id_key" ON "coupon_redemptions"("order_id");

-- CreateIndex
CREATE INDEX "coupon_redemptions_coupon_id_idx" ON "coupon_redemptions"("coupon_id");

-- CreateIndex
CREATE INDEX "coupon_redemptions_customer_id_idx" ON "coupon_redemptions"("customer_id");

-- AddForeignKey
ALTER TABLE "carts" ADD CONSTRAINT "carts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cart_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "carts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipping_zone_districts" ADD CONSTRAINT "shipping_zone_districts_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "shipping_zones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_cart_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "carts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_shipping_zone_id_fkey" FOREIGN KEY ("shipping_zone_id") REFERENCES "shipping_zones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_changed_by_admin_id_fkey" FOREIGN KEY ("changed_by_admin_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_returns" ADD CONSTRAINT "order_returns_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_return_items" ADD CONSTRAINT "order_return_items_return_id_fkey" FOREIGN KEY ("return_id") REFERENCES "order_returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_return_items" ADD CONSTRAINT "order_return_items_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Keep order status history append-only. Status changes must be new rows.
CREATE FUNCTION reject_order_status_history_mutation() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'order status history is append-only' USING ERRCODE = '23001';
END;
$$;

-- CreateTrigger
CREATE TRIGGER order_status_history_append_only
BEFORE UPDATE OR DELETE ON "order_status_history"
FOR EACH ROW EXECUTE FUNCTION reject_order_status_history_mutation();

-- Reject return items from another order and cumulative quantities above the ordered quantity.
CREATE FUNCTION validate_order_return_item() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    return_order_id UUID;
    item_order_id UUID;
    ordered_quantity INTEGER;
    returned_quantity INTEGER;
BEGIN
    SELECT "order_id" INTO return_order_id FROM "order_returns" WHERE "id" = NEW."return_id";
    SELECT "order_id", "quantity" INTO item_order_id, ordered_quantity
    FROM "order_items" WHERE "id" = NEW."order_item_id";

    IF return_order_id IS NULL OR item_order_id IS NULL THEN
        RETURN NEW;
    END IF;

    IF item_order_id <> return_order_id THEN
        RAISE EXCEPTION 'return item must belong to the same order as the return'
            USING ERRCODE = '23514';
    END IF;

    SELECT COALESCE(SUM("quantity"), 0) INTO returned_quantity
    FROM "order_return_items"
    WHERE "order_item_id" = NEW."order_item_id" AND "id" <> NEW."id";

    IF returned_quantity + NEW."quantity" > ordered_quantity THEN
        RAISE EXCEPTION 'returned quantity exceeds ordered quantity' USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$;

-- CreateTrigger
CREATE TRIGGER order_return_items_validate
BEFORE INSERT OR UPDATE ON "order_return_items"
FOR EACH ROW EXECUTE FUNCTION validate_order_return_item();
