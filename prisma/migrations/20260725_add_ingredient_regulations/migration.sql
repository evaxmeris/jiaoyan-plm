-- CreateTable: ingredient_regulations
-- This table was created via direct SQL; this migration marks it for Prisma tracking

ALTER TABLE ingredient_regulations ALTER COLUMN name_cn SET NOT NULL;
ALTER TABLE ingredient_regulations ALTER COLUMN regulation_type SET NOT NULL;
ALTER TABLE ingredient_regulations ALTER COLUMN source_regulation SET NOT NULL DEFAULT '';
ALTER TABLE ingredient_regulations ALTER COLUMN updated_at SET DEFAULT now();
