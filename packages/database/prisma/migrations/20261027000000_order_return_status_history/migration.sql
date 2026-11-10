CREATE TABLE "order_return_status_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "return_id" UUID NOT NULL,
    "from_status" "OrderReturnStatus",
    "to_status" "OrderReturnStatus" NOT NULL,
    "changed_by_admin_id" UUID,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_return_status_history_pkey" PRIMARY KEY ("id")
);

INSERT INTO "order_return_status_history" (
    "return_id",
    "from_status",
    "to_status",
    "created_at"
)
SELECT returns."id", NULL, returns."status", returns."created_at"
FROM "order_returns" AS returns;

CREATE UNIQUE INDEX "order_return_status_history_one_initial_per_return_key"
ON "order_return_status_history"("return_id")
WHERE "from_status" IS NULL;

CREATE INDEX "order_return_status_history_return_id_created_at_idx"
ON "order_return_status_history"("return_id", "created_at");

CREATE INDEX "order_return_status_history_changed_by_admin_id_idx"
ON "order_return_status_history"("changed_by_admin_id");

ALTER TABLE "order_return_status_history"
ADD CONSTRAINT "order_return_status_history_return_id_fkey"
FOREIGN KEY ("return_id") REFERENCES "order_returns"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "order_return_status_history"
ADD CONSTRAINT "order_return_status_history_changed_by_admin_id_fkey"
FOREIGN KEY ("changed_by_admin_id") REFERENCES "admin_users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE FUNCTION create_initial_order_return_status_history() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO "order_return_status_history" (
        "return_id",
        "from_status",
        "to_status",
        "created_at"
    )
    VALUES (NEW."id", NULL, NEW."status", NEW."created_at");
    RETURN NEW;
END;
$$;

CREATE TRIGGER order_returns_create_initial_status_history
AFTER INSERT ON "order_returns"
FOR EACH ROW EXECUTE FUNCTION create_initial_order_return_status_history();

CREATE FUNCTION reject_order_return_status_history_mutation() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'order return status history is append-only'
        USING ERRCODE = '23514';
END;
$$;

CREATE TRIGGER order_return_status_history_append_only
BEFORE UPDATE OR DELETE ON "order_return_status_history"
FOR EACH ROW EXECUTE FUNCTION reject_order_return_status_history_mutation();
