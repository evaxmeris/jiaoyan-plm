-- Phase 1: Extend TestEntrustment model
-- Adds fields to match Inspection model, creates relations with ProductDesign/Registration
-- Data migration: copies Inspection data → test_entrustments, updates efficacy_claims FK

-- Step 1: Add new columns to test_entrustments (schema changes handled by prisma db push)
-- This file documents the data migration portion only.

-- Step 2: Copy existing Inspection records into test_entrustments
-- Note: testItems was String (old) / Json? (new). Inspections.items is Jsonb.
-- We cast Inspection.type (InspectionType enum) to text since TestEntrustment.type is String?
INSERT INTO test_entrustments (
  id,
  registration_id,
  product_design_id,
  product_name,
  type,
  test_items,
  institution,
  report_no,
  report_url,
  sample_batch,
  apply_date,
  send_date,
  complete_date,
  report_date,
  result,
  status,
  cost,
  remark,
  created_at,
  updated_at,
  deleted_at,
  is_deleted
)
SELECT
  i.id,
  i.registration_id,
  i.product_design_id,
  pd.name AS product_name,  -- derive product_name from ProductDesign
  i.type::text,             -- cast enum to text
  i.items,                  -- Jsonb → Json?
  i.institution,
  i.report_no,
  i.report_url,
  i.sample_batch,
  i.apply_date,
  NULL::timestamp,          -- send_date not in Inspection; leave null
  i.complete_date,
  NULL::timestamp,          -- report_date not in Inspection; leave null
  i.result,
  i.status,
  i.cost,
  i.remark,
  i.created_at,
  i.updated_at,
  i.deleted_at,
  i.is_deleted
FROM inspections i
LEFT JOIN product_designs pd ON pd.id = i.product_design_id
WHERE NOT EXISTS (SELECT 1 FROM test_entrustments te WHERE te.id = i.id);

-- Step 3: Update efficacy_claims that referenced inspections to point to test_entrustments
UPDATE efficacy_claims ec
SET test_entrustment_id = ec.inspection_id,
    inspection_id = NULL
WHERE ec.inspection_id IS NOT NULL
  AND ec.test_entrustment_id IS NULL;

-- Note: After this migration is run once, the inspections table is kept for
-- backward compatibility. New code should use TestEntrustment model.
