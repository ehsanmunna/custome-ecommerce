-- Backfill the initial order history row before making it automatic for new orders.
INSERT INTO "order_status_history" ("order_id", "from_status", "to_status", "created_at")
SELECT orders."id", NULL, orders."status", orders."created_at"
FROM "orders" AS orders
WHERE NOT EXISTS (
    SELECT 1
    FROM "order_status_history" AS history
    WHERE history."order_id" = orders."id"
      AND history."from_status" IS NULL
);

CREATE UNIQUE INDEX "order_status_history_one_initial_per_order_key"
ON "order_status_history"("order_id")
WHERE "from_status" IS NULL;

CREATE FUNCTION create_initial_order_status_history() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO "order_status_history" ("order_id", "from_status", "to_status", "created_at")
    VALUES (NEW."id", NULL, NEW."status", NEW."created_at");
    RETURN NEW;
END;
$$;

CREATE TRIGGER orders_create_initial_status_history
AFTER INSERT ON "orders"
FOR EACH ROW EXECUTE FUNCTION create_initial_order_status_history();

CREATE OR REPLACE FUNCTION validate_order_return_item() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    return_order_id UUID;
    return_status "OrderReturnStatus";
    item_order_id UUID;
    ordered_quantity INTEGER;
    returned_quantity INTEGER;
BEGIN
    SELECT "order_id", "status"
    INTO return_order_id, return_status
    FROM "order_returns"
    WHERE "id" = NEW."return_id";

    SELECT "order_id", "quantity"
    INTO item_order_id, ordered_quantity
    FROM "order_items"
    WHERE "id" = NEW."order_item_id";

    IF return_order_id IS NULL OR item_order_id IS NULL THEN
        RETURN NEW;
    END IF;

    IF item_order_id <> return_order_id THEN
        RAISE EXCEPTION 'return item must belong to the same order as the return'
            USING ERRCODE = '23514';
    END IF;

    IF return_status IN ('rejected', 'cancelled') THEN
        RAISE EXCEPTION 'return items cannot be added to a rejected or cancelled return'
            USING ERRCODE = '23514';
    END IF;

    SELECT COALESCE(SUM(return_items."quantity"), 0)
    INTO returned_quantity
    FROM "order_return_items" AS return_items
    JOIN "order_returns" AS returns ON returns."id" = return_items."return_id"
    WHERE return_items."order_item_id" = NEW."order_item_id"
      AND return_items."id" <> NEW."id"
      AND returns."status" IN ('requested', 'approved', 'received', 'refunded');

    IF returned_quantity + NEW."quantity" > ordered_quantity THEN
        RAISE EXCEPTION 'returned quantity exceeds ordered quantity' USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$;

CREATE FUNCTION validate_order_return_status_change() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    return_item RECORD;
    ordered_quantity INTEGER;
    other_returned_quantity INTEGER;
BEGIN
    IF NEW."status" IN ('requested', 'approved', 'received', 'refunded')
       AND OLD."status" IN ('rejected', 'cancelled') THEN
        FOR return_item IN
            SELECT "order_item_id", SUM("quantity") AS "quantity"
            FROM "order_return_items"
            WHERE "return_id" = NEW."id"
            GROUP BY "order_item_id"
        LOOP
            SELECT "quantity"
            INTO ordered_quantity
            FROM "order_items"
            WHERE "id" = return_item."order_item_id";

            SELECT COALESCE(SUM(return_items."quantity"), 0)
            INTO other_returned_quantity
            FROM "order_return_items" AS return_items
            JOIN "order_returns" AS returns ON returns."id" = return_items."return_id"
            WHERE return_items."order_item_id" = return_item."order_item_id"
              AND returns."id" <> NEW."id"
              AND returns."status" IN ('requested', 'approved', 'received', 'refunded');

            IF other_returned_quantity + return_item."quantity" > ordered_quantity THEN
                RAISE EXCEPTION 'returned quantity exceeds ordered quantity'
                    USING ERRCODE = '23514';
            END IF;
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER order_returns_validate_status_change
BEFORE UPDATE OF "status" ON "order_returns"
FOR EACH ROW EXECUTE FUNCTION validate_order_return_status_change();
