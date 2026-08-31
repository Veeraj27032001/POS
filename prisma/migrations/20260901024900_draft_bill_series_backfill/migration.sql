-- Backfill: every existing store + financial year combination needs a
-- NumberingSeries row for the two new temp series types, same as the ones
-- that already exist for cash_bill/credit_bill. New stores/financial years
-- get these automatically going forward via createDefaultNumberingSeries /
-- createNumberingSeriesForNewFinancialYear (lib/masters/copyNumberingSeries.ts).
INSERT INTO "numbering_series" (id, series_type, store_id, financial_year_id, prefix, current_number, is_active)
SELECT gen_random_uuid(), 'draft_cash_bill', s.id, fy.id, 'DRFTCB', 0, true
FROM "stores" s
CROSS JOIN "financial_years" fy
WHERE s.is_deleted = false AND fy.is_deleted = false
ON CONFLICT (series_type, store_id, financial_year_id) DO NOTHING;

INSERT INTO "numbering_series" (id, series_type, store_id, financial_year_id, prefix, current_number, is_active)
SELECT gen_random_uuid(), 'draft_credit_bill', s.id, fy.id, 'DRFTCR', 0, true
FROM "stores" s
CROSS JOIN "financial_years" fy
WHERE s.is_deleted = false AND fy.is_deleted = false
ON CONFLICT (series_type, store_id, financial_year_id) DO NOTHING;
