-- Inventory balance, reservations, and append-only stock movements for every client database.

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('active', 'released', 'committed', 'expired');

-- CreateEnum
CREATE TYPE "ReservationReferenceType" AS ENUM ('cart', 'order', 'manual');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('initial', 'adjustment', 'reservation', 'release', 'deduction', 'return');

-- CreateTable
CREATE TABLE "inventory_items" (
    "variant_id" UUID NOT NULL,
    "quantity_on_hand" INTEGER NOT NULL DEFAULT 0,
    "quantity_reserved" INTEGER NOT NULL DEFAULT 0,
    "low_stock_threshold" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("variant_id"),
    CONSTRAINT "inventory_items_quantity_on_hand_nonnegative" CHECK ("quantity_on_hand" >= 0),
    CONSTRAINT "inventory_items_quantity_reserved_nonnegative" CHECK ("quantity_reserved" >= 0),
    CONSTRAINT "inventory_items_reserved_not_greater_than_on_hand" CHECK ("quantity_reserved" <= "quantity_on_hand"),
    CONSTRAINT "inventory_items_low_stock_threshold_nonnegative" CHECK ("low_stock_threshold" >= 0)
);

-- CreateTable
CREATE TABLE "stock_reservations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "variant_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'active',
    "reference_type" "ReservationReferenceType",
    "reference_id" UUID,
    "expires_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_reservations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "stock_reservations_quantity_positive" CHECK ("quantity" > 0),
    CONSTRAINT "stock_reservations_reference_pair" CHECK (
        ("reference_type" IS NULL AND "reference_id" IS NULL) OR
        ("reference_type" IS NOT NULL AND "reference_id" IS NOT NULL)
    )
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "variant_id" UUID NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "on_hand_delta" INTEGER NOT NULL,
    "reserved_delta" INTEGER NOT NULL,
    "resulting_on_hand" INTEGER NOT NULL,
    "resulting_reserved" INTEGER NOT NULL,
    "reference_type" "ReservationReferenceType",
    "reference_id" UUID,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "stock_movements_delta_nonzero" CHECK ("on_hand_delta" <> 0 OR "reserved_delta" <> 0),
    CONSTRAINT "stock_movements_type_delta_signs" CHECK (
        ("type" = 'initial' AND "on_hand_delta" > 0 AND "reserved_delta" = 0) OR
        ("type" = 'adjustment' AND "on_hand_delta" <> 0 AND "reserved_delta" = 0) OR
        ("type" = 'reservation' AND "on_hand_delta" = 0 AND "reserved_delta" > 0) OR
        ("type" = 'release' AND "on_hand_delta" = 0 AND "reserved_delta" < 0) OR
        ("type" = 'deduction' AND "on_hand_delta" < 0 AND "reserved_delta" < 0 AND "on_hand_delta" = "reserved_delta") OR
        ("type" = 'return' AND "on_hand_delta" > 0 AND "reserved_delta" = 0)
    ),
    CONSTRAINT "stock_movements_resulting_on_hand_nonnegative" CHECK ("resulting_on_hand" >= 0),
    CONSTRAINT "stock_movements_resulting_reserved_nonnegative" CHECK ("resulting_reserved" >= 0),
    CONSTRAINT "stock_movements_resulting_reserved_not_greater_than_on_hand" CHECK ("resulting_reserved" <= "resulting_on_hand"),
    CONSTRAINT "stock_movements_reference_pair" CHECK (
        ("reference_type" IS NULL AND "reference_id" IS NULL) OR
        ("reference_type" IS NOT NULL AND "reference_id" IS NOT NULL)
    )
);

-- CreateIndex
CREATE INDEX "stock_reservations_variant_id_idx" ON "stock_reservations"("variant_id");

-- CreateIndex
CREATE INDEX "stock_reservations_status_expires_at_idx" ON "stock_reservations"("status", "expires_at");

-- CreateIndex
CREATE INDEX "stock_reservations_reference_type_reference_id_idx" ON "stock_reservations"("reference_type", "reference_id");

-- CreateIndex
CREATE INDEX "stock_movements_variant_id_created_at_idx" ON "stock_movements"("variant_id", "created_at");

-- CreateIndex
CREATE INDEX "stock_movements_reference_type_reference_id_idx" ON "stock_movements"("reference_type", "reference_id");

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "inventory_items"("variant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "inventory_items"("variant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Keep the movement ledger append-only. Corrections must be new compensating movements.
CREATE FUNCTION reject_stock_movement_mutation() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'stock movements are append-only' USING ERRCODE = '23001';
END;
$$;

-- CreateTrigger
CREATE TRIGGER stock_movements_append_only
BEFORE UPDATE OR DELETE ON "stock_movements"
FOR EACH ROW EXECUTE FUNCTION reject_stock_movement_mutation();
