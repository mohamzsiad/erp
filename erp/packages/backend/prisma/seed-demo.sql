-- =============================================================================
-- CloudERP — Demo Data Seed (SQL)
-- Run via:  docker exec -i clouderp_postgres psql -U erpadmin -d clouderp < seed-demo.sql
-- =============================================================================
BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- Helper function: resolve company id
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_cid         TEXT;
  v_head_off    TEXT;
  v_engg_store  TEXT;
  v_main_wh_loc TEXT;
  v_engg_wh     TEXT;
  v_main_wh     TEXT;
  v_bin1        TEXT;
  v_bin2        TEXT;
  v_usd_cur     TEXT;
  v_cc1         TEXT;
  v_cc2         TEXT;
  v_proc_role   TEXT;
  v_inv_role    TEXT;
  v_admin_user  TEXT;
  v_gl_ap       TEXT;

  -- users
  v_proc_mgr  TEXT;
  v_inv_mgr   TEXT;

  -- uoms
  v_uom_nos   TEXT;
  v_uom_pcs   TEXT;
  v_uom_mtr   TEXT;
  v_uom_kg    TEXT;
  v_uom_ltr   TEXT;
  v_uom_box   TEXT;
  v_uom_set   TEXT;

  -- categories
  v_cat_eng    TEXT;
  v_cat_elec   TEXT;
  v_cat_chem   TEXT;
  v_cat_safe   TEXT;

  -- items
  v_i_vb96    TEXT;  -- SPR-VBELT0096
  v_i_vb21    TEXT;  -- SPR-VBELT0021
  v_i_vb92    TEXT;  -- SPR-VBELT0092
  v_i_vb93    TEXT;  -- SPR-VBELT0093
  v_i_br12    TEXT;  -- SPR-BEAR0012
  v_i_br34    TEXT;  -- SPR-BEAR0034
  v_i_sl05    TEXT;  -- SPR-SEAL0005
  v_i_pu01    TEXT;  -- SPR-PUMP0001
  v_i_ca10    TEXT;  -- ELE-CABLE0010
  v_i_ca20    TEXT;  -- ELE-CABLE0020
  v_i_la01    TEXT;  -- ELE-LAMP0001
  v_i_fu01    TEXT;  -- ELE-FUSE0001
  v_i_lu01    TEXT;  -- CHM-LUBE0001
  v_i_gr01    TEXT;  -- CHM-GRSE0001
  v_i_hl01    TEXT;  -- SFT-HLMT0001
  v_i_gl01    TEXT;  -- SFT-GLVE0001
  v_i_bt01    TEXT;  -- SFT-BOOT0001

  -- suppliers
  v_s_aero    TEXT;  -- MCLSA028
  v_s_btech   TEXT;  -- SUP-BTECH
  v_s_elec    TEXT;  -- SUP-ELECA
  v_s_chem    TEXT;  -- SUP-CHEMX
  v_s_safe    TEXT;  -- SUP-SAFEP
  v_s_genrl   TEXT;  -- SUP-GENRL

  -- mrls
  v_mrl_1 TEXT; v_mrl_2 TEXT; v_mrl_3 TEXT; v_mrl_4 TEXT;
  v_mrl_5 TEXT; v_mrl_6 TEXT; v_mrl_7 TEXT; v_mrl_8 TEXT;

  -- prls
  v_prl_1 TEXT; v_prl_2 TEXT; v_prl_3 TEXT; v_prl_4 TEXT;

  -- pos
  v_po_1 TEXT; v_po_2 TEXT; v_po_3 TEXT; v_po_4 TEXT;
  v_po_5 TEXT; v_po_6 TEXT; v_po_7 TEXT; v_po_8 TEXT;
  v_po_9 TEXT; v_po_10 TEXT; v_po_11 TEXT;

  -- po lines (needed for GRN links)
  v_pol_1_1 TEXT; v_pol_1_2 TEXT;
  v_pol_2_1 TEXT; v_pol_2_2 TEXT;
  v_pol_3_1 TEXT; v_pol_3_2 TEXT;
  v_pol_4_1 TEXT; v_pol_4_2 TEXT;
  v_pol_5_1 TEXT;
  v_pol_6_1 TEXT; v_pol_6_2 TEXT; v_pol_6_3 TEXT;
  v_pol_11_1 TEXT; v_pol_11_2 TEXT;

  v_pw_hash TEXT := '$2a$10$rK.LvFmn/WwJxNYDlJXs5e8cWVRZ1c3QX1PmHPPmZ.7pv/c2OdFLi'; -- Demo@123

BEGIN
  -- ── Resolve base entities ────────────────────────────────────────────────
  SELECT id INTO v_cid       FROM companies WHERE code = 'DEMO01' LIMIT 1;
  SELECT id INTO v_head_off  FROM locations WHERE company_id = v_cid AND code = 'HEAD_OFFICE' LIMIT 1;
  SELECT id INTO v_engg_store FROM locations WHERE company_id = v_cid AND code = 'ENGG_STORE' LIMIT 1;
  SELECT id INTO v_main_wh_loc FROM locations WHERE company_id = v_cid AND code = 'MAIN_WH' LIMIT 1;
  SELECT id INTO v_engg_wh   FROM warehouses WHERE company_id = v_cid AND code = 'ENGG_WH' LIMIT 1;
  SELECT id INTO v_main_wh   FROM warehouses WHERE company_id = v_cid AND code = 'MAIN_WH' LIMIT 1;
  SELECT id INTO v_bin1      FROM bins WHERE warehouse_id = v_engg_wh AND code = 'RACK-A1' LIMIT 1;
  SELECT id INTO v_bin2      FROM bins WHERE warehouse_id = v_main_wh AND code = 'BAY-01' LIMIT 1;
  SELECT id INTO v_usd_cur   FROM currencies WHERE company_id = v_cid AND code = 'USD' LIMIT 1;
  SELECT id INTO v_cc1       FROM cost_codes WHERE company_id = v_cid AND code = 'COSTCTRE1' LIMIT 1;
  SELECT id INTO v_cc2       FROM cost_codes WHERE company_id = v_cid AND code = 'COSTCTRE2' LIMIT 1;
  SELECT id INTO v_proc_role FROM roles WHERE company_id = v_cid AND name = 'PROCUREMENT_MANAGER' LIMIT 1;
  SELECT id INTO v_inv_role  FROM roles WHERE company_id = v_cid AND name = 'INVENTORY_MANAGER' LIMIT 1;
  SELECT id INTO v_admin_user FROM users WHERE company_id = v_cid AND email = 'admin@demo.com' LIMIT 1;
  SELECT id INTO v_gl_ap     FROM gl_accounts WHERE company_id = v_cid AND code = '2300' LIMIT 1;

  IF v_cid IS NULL THEN
    RAISE EXCEPTION 'Base seed not run — company DEMO01 not found. Run seed.ts first.';
  END IF;

  -- ── 1. Additional Users ──────────────────────────────────────────────────
  -- password hash for "Demo@123" (bcrypt cost 10)
  INSERT INTO users (id, company_id, email, password_hash, first_name, last_name, role_id, location_id, is_active, created_at, updated_at)
  VALUES (gen_random_uuid()::text, v_cid, 'proc.mgr@demo.com', v_pw_hash, 'Ahmed', 'Al-Rashidi', v_proc_role, v_head_off, true, now(), now())
  ON CONFLICT (company_id, email) DO NOTHING;

  INSERT INTO users (id, company_id, email, password_hash, first_name, last_name, role_id, location_id, is_active, created_at, updated_at)
  VALUES (gen_random_uuid()::text, v_cid, 'inv.mgr@demo.com', v_pw_hash, 'Sara', 'Al-Balushi', v_inv_role, v_engg_store, true, now(), now())
  ON CONFLICT (company_id, email) DO NOTHING;

  SELECT id INTO v_proc_mgr FROM users WHERE company_id = v_cid AND email = 'proc.mgr@demo.com';
  SELECT id INTO v_inv_mgr  FROM users WHERE company_id = v_cid AND email = 'inv.mgr@demo.com';

  RAISE NOTICE '✓ Users created';

  -- ── 2. UOMs ──────────────────────────────────────────────────────────────
  INSERT INTO uoms (id, company_id, code, name, symbol) VALUES
    (gen_random_uuid()::text, v_cid, 'NOS', 'Numbers',   'NOS'),
    (gen_random_uuid()::text, v_cid, 'PCS', 'Pieces',    'PCS'),
    (gen_random_uuid()::text, v_cid, 'MTR', 'Metres',    'M'),
    (gen_random_uuid()::text, v_cid, 'KG',  'Kilograms', 'KG'),
    (gen_random_uuid()::text, v_cid, 'LTR', 'Litres',    'L'),
    (gen_random_uuid()::text, v_cid, 'BOX', 'Box',       'BOX'),
    (gen_random_uuid()::text, v_cid, 'SET', 'Set',       'SET')
  ON CONFLICT (company_id, code) DO NOTHING;

  SELECT id INTO v_uom_nos FROM uoms WHERE company_id = v_cid AND code = 'NOS';
  SELECT id INTO v_uom_pcs FROM uoms WHERE company_id = v_cid AND code = 'PCS';
  SELECT id INTO v_uom_mtr FROM uoms WHERE company_id = v_cid AND code = 'MTR';
  SELECT id INTO v_uom_kg  FROM uoms WHERE company_id = v_cid AND code = 'KG';
  SELECT id INTO v_uom_ltr FROM uoms WHERE company_id = v_cid AND code = 'LTR';

  RAISE NOTICE '✓ UOMs ready';

  -- ── 3. Item Categories ───────────────────────────────────────────────────
  INSERT INTO item_categories (id, company_id, code, name) VALUES
    (gen_random_uuid()::text, v_cid, 'ENG',  'Engineering Spares'),
    (gen_random_uuid()::text, v_cid, 'ELEC', 'Electrical & Instrumentation'),
    (gen_random_uuid()::text, v_cid, 'CHEM', 'Chemicals & Lubricants'),
    (gen_random_uuid()::text, v_cid, 'SAFE', 'Safety & PPE')
  ON CONFLICT (company_id, code) DO NOTHING;

  SELECT id INTO v_cat_eng  FROM item_categories WHERE company_id = v_cid AND code = 'ENG';
  SELECT id INTO v_cat_elec FROM item_categories WHERE company_id = v_cid AND code = 'ELEC';
  SELECT id INTO v_cat_chem FROM item_categories WHERE company_id = v_cid AND code = 'CHEM';
  SELECT id INTO v_cat_safe FROM item_categories WHERE company_id = v_cid AND code = 'SAFE';

  -- ── 4. Items ──────────────────────────────────────────────────────────────
  INSERT INTO items (id, company_id, code, description, category_id, uom_id, grade1_options, grade2_options,
                     standard_cost, reorder_level, reorder_qty, status, created_at, updated_at) VALUES
    (gen_random_uuid()::text, v_cid,'SPR-VBELT0096','SPA 1150 V BELT',            v_cat_eng, v_uom_nos,'["NA"]','["NA"]', 1.729, 5, 20,'ACTIVE',now(),now()),
    (gen_random_uuid()::text, v_cid,'SPR-VBELT0021','SPA 1180 V BELT',            v_cat_eng, v_uom_pcs,'["NA"]','["NA"]', 1.955, 5, 20,'ACTIVE',now(),now()),
    (gen_random_uuid()::text, v_cid,'SPR-VBELT0092','SPA 2732 V BELT',            v_cat_eng, v_uom_nos,'["NA"]','["NA"]', 5.930, 5, 20,'ACTIVE',now(),now()),
    (gen_random_uuid()::text, v_cid,'SPR-VBELT0093','SPA 2282 V BELT',            v_cat_eng, v_uom_nos,'["NA"]','["NA"]', 4.300, 5, 20,'ACTIVE',now(),now()),
    (gen_random_uuid()::text, v_cid,'SPR-BEAR0012', '6205-2RS Deep Groove Bearing',v_cat_eng, v_uom_nos,'["NA"]','["NA"]', 8.50,  5, 20,'ACTIVE',now(),now()),
    (gen_random_uuid()::text, v_cid,'SPR-BEAR0034', '6306-Z Ball Bearing',         v_cat_eng, v_uom_nos,'["NA"]','["NA"]',12.75,  5, 20,'ACTIVE',now(),now()),
    (gen_random_uuid()::text, v_cid,'SPR-SEAL0005', 'Oil Seal 40x62x8 NBR',        v_cat_eng, v_uom_pcs,'["NA"]','["NA"]', 3.20,  5, 20,'ACTIVE',now(),now()),
    (gen_random_uuid()::text, v_cid,'SPR-PUMP0001', 'Centrifugal Pump 2in SS316',  v_cat_eng, v_uom_nos,'["NA"]','["NA"]',1250.0, 1,  2,'ACTIVE',now(),now()),
    (gen_random_uuid()::text, v_cid,'ELE-CABLE0010','2.5mm Cu XLPE Cable per m',   v_cat_elec,v_uom_mtr,'["NA"]','["NA"]', 2.85, 50,200,'ACTIVE',now(),now()),
    (gen_random_uuid()::text, v_cid,'ELE-CABLE0020','4mm Cu XLPE Cable per m',     v_cat_elec,v_uom_mtr,'["NA"]','["NA"]', 4.10, 50,200,'ACTIVE',now(),now()),
    (gen_random_uuid()::text, v_cid,'ELE-LAMP0001', 'LED Flood Light 100W IP65',   v_cat_elec,v_uom_nos,'["NA"]','["NA"]',85.00,  2, 10,'ACTIVE',now(),now()),
    (gen_random_uuid()::text, v_cid,'ELE-FUSE0001', '63A HRC Fuse Link',           v_cat_elec,v_uom_pcs,'["NA"]','["NA"]', 4.50, 10, 24,'ACTIVE',now(),now()),
    (gen_random_uuid()::text, v_cid,'CHM-LUBE0001', 'Shell Tellus S2 M 46 20L',   v_cat_chem,v_uom_ltr,'["NA"]','["NA"]',38.00, 20,100,'ACTIVE',now(),now()),
    (gen_random_uuid()::text, v_cid,'CHM-GRSE0001', 'Molykote BR2 Plus Grease 1KG',v_cat_chem,v_uom_kg, '["NA"]','["NA"]',22.50, 10, 50,'ACTIVE',now(),now()),
    (gen_random_uuid()::text, v_cid,'SFT-HLMT0001', 'Safety Helmet Type II Yellow',v_cat_safe,v_uom_nos,'["NA"]','["NA"]',15.00, 10, 50,'ACTIVE',now(),now()),
    (gen_random_uuid()::text, v_cid,'SFT-GLVE0001', 'Cut Resistant Gloves Lv5',   v_cat_safe,v_uom_pcs,'["NA"]','["NA"]', 7.50, 20,100,'ACTIVE',now(),now()),
    (gen_random_uuid()::text, v_cid,'SFT-BOOT0001', 'Safety Boot S3 Steel Toe',   v_cat_safe,v_uom_pcs,'["NA"]','["NA"]',55.00,  5, 30,'ACTIVE',now(),now())
  ON CONFLICT (company_id, code) DO NOTHING;

  SELECT id INTO v_i_vb96 FROM items WHERE company_id = v_cid AND code = 'SPR-VBELT0096';
  SELECT id INTO v_i_vb21 FROM items WHERE company_id = v_cid AND code = 'SPR-VBELT0021';
  SELECT id INTO v_i_vb92 FROM items WHERE company_id = v_cid AND code = 'SPR-VBELT0092';
  SELECT id INTO v_i_vb93 FROM items WHERE company_id = v_cid AND code = 'SPR-VBELT0093';
  SELECT id INTO v_i_br12 FROM items WHERE company_id = v_cid AND code = 'SPR-BEAR0012';
  SELECT id INTO v_i_br34 FROM items WHERE company_id = v_cid AND code = 'SPR-BEAR0034';
  SELECT id INTO v_i_sl05 FROM items WHERE company_id = v_cid AND code = 'SPR-SEAL0005';
  SELECT id INTO v_i_pu01 FROM items WHERE company_id = v_cid AND code = 'SPR-PUMP0001';
  SELECT id INTO v_i_ca10 FROM items WHERE company_id = v_cid AND code = 'ELE-CABLE0010';
  SELECT id INTO v_i_ca20 FROM items WHERE company_id = v_cid AND code = 'ELE-CABLE0020';
  SELECT id INTO v_i_la01 FROM items WHERE company_id = v_cid AND code = 'ELE-LAMP0001';
  SELECT id INTO v_i_fu01 FROM items WHERE company_id = v_cid AND code = 'ELE-FUSE0001';
  SELECT id INTO v_i_lu01 FROM items WHERE company_id = v_cid AND code = 'CHM-LUBE0001';
  SELECT id INTO v_i_gr01 FROM items WHERE company_id = v_cid AND code = 'CHM-GRSE0001';
  SELECT id INTO v_i_hl01 FROM items WHERE company_id = v_cid AND code = 'SFT-HLMT0001';
  SELECT id INTO v_i_gl01 FROM items WHERE company_id = v_cid AND code = 'SFT-GLVE0001';
  SELECT id INTO v_i_bt01 FROM items WHERE company_id = v_cid AND code = 'SFT-BOOT0001';

  RAISE NOTICE '✓ 17 items created';

  -- ── 5. Suppliers ──────────────────────────────────────────────────────────
  INSERT INTO suppliers (id, company_id, code, name, short_name, control_account_id,
                         credit_days, credit_amount, shipment_mode, is_active, is_parent_supplier,
                         is_tds_applicable, is_tds_party, created_at, updated_at)
  VALUES
    (gen_random_uuid()::text, v_cid,'MCLSA028', 'Aerotrans Global Forwarding LLC', 'Aerotrans Global',    v_gl_ap,30,50000,'NA',true,true,false,false,now(),now()),
    (gen_random_uuid()::text, v_cid,'SUP-BTECH','Bearing Technology Solutions LLC','Bearing Tech',         v_gl_ap,45,50000,'LAND',true,true,false,false,now(),now()),
    (gen_random_uuid()::text, v_cid,'SUP-ELECA','Al-Mansoori Electrical Supplies', 'Al-Mansoori Elec',    v_gl_ap,30,50000,'LAND',true,true,false,false,now(),now()),
    (gen_random_uuid()::text, v_cid,'SUP-CHEMX','Gulf Chemical & Industrial Oils', 'Gulf Chemicals',      v_gl_ap,60,50000,'LAND',true,true,false,false,now(),now()),
    (gen_random_uuid()::text, v_cid,'SUP-SAFEP','ProSafe Arabia FZE',              'ProSafe Arabia',      v_gl_ap,30,50000,'AIR', true,true,false,false,now(),now()),
    (gen_random_uuid()::text, v_cid,'SUP-GENRL','National General Trading Co.',    'Natl General Trading',v_gl_ap,45,50000,'LAND',true,true,false,false,now(),now())
  ON CONFLICT (company_id, code) DO NOTHING;

  SELECT id INTO v_s_aero  FROM suppliers WHERE company_id = v_cid AND code = 'MCLSA028';
  SELECT id INTO v_s_btech FROM suppliers WHERE company_id = v_cid AND code = 'SUP-BTECH';
  SELECT id INTO v_s_elec  FROM suppliers WHERE company_id = v_cid AND code = 'SUP-ELECA';
  SELECT id INTO v_s_chem  FROM suppliers WHERE company_id = v_cid AND code = 'SUP-CHEMX';
  SELECT id INTO v_s_safe  FROM suppliers WHERE company_id = v_cid AND code = 'SUP-SAFEP';
  SELECT id INTO v_s_genrl FROM suppliers WHERE company_id = v_cid AND code = 'SUP-GENRL';

  RAISE NOTICE '✓ 6 suppliers created';

  -- ── 6. Material Requisitions ──────────────────────────────────────────────
  -- MRL-2025-001  CONVERTED  Oct-2025
  INSERT INTO material_requisitions (id,company_id,doc_no,doc_date,location_id,charge_code_id,delivery_date,
    status,created_by_id,approved_by_id,approved_at,created_at,updated_at)
  SELECT gen_random_uuid()::text,v_cid,'MRL-2025-001','2025-10-05',v_engg_store,v_cc1,'2025-10-25',
    'CONVERTED',v_proc_mgr,v_admin_user,'2025-10-05',now(),now()
  WHERE NOT EXISTS (SELECT 1 FROM material_requisitions WHERE company_id=v_cid AND doc_no='MRL-2025-001');
  SELECT id INTO v_mrl_1 FROM material_requisitions WHERE company_id=v_cid AND doc_no='MRL-2025-001';

  INSERT INTO mrl_lines (id,mrl_id,item_id,uom_id,requested_qty,approved_qty,approx_price,line_no,free_stock)
  SELECT gen_random_uuid()::text,v_mrl_1,v_i_vb96,v_uom_nos,20,20,1.73,1,0
  WHERE NOT EXISTS (SELECT 1 FROM mrl_lines WHERE mrl_id=v_mrl_1 AND line_no=1);
  INSERT INTO mrl_lines (id,mrl_id,item_id,uom_id,requested_qty,approved_qty,approx_price,line_no,free_stock)
  SELECT gen_random_uuid()::text,v_mrl_1,v_i_vb92,v_uom_nos,10,10,5.93,2,0
  WHERE NOT EXISTS (SELECT 1 FROM mrl_lines WHERE mrl_id=v_mrl_1 AND line_no=2);

  -- MRL-2025-002  CONVERTED  Nov-2025
  INSERT INTO material_requisitions (id,company_id,doc_no,doc_date,location_id,charge_code_id,delivery_date,
    status,created_by_id,approved_by_id,approved_at,created_at,updated_at)
  SELECT gen_random_uuid()::text,v_cid,'MRL-2025-002','2025-11-12',v_engg_store,v_cc1,'2025-12-05',
    'CONVERTED',v_proc_mgr,v_admin_user,'2025-11-12',now(),now()
  WHERE NOT EXISTS (SELECT 1 FROM material_requisitions WHERE company_id=v_cid AND doc_no='MRL-2025-002');
  SELECT id INTO v_mrl_2 FROM material_requisitions WHERE company_id=v_cid AND doc_no='MRL-2025-002';
  INSERT INTO mrl_lines (id,mrl_id,item_id,uom_id,requested_qty,approved_qty,approx_price,line_no,free_stock)
  SELECT gen_random_uuid()::text,v_mrl_2,v_i_br12,v_uom_nos,8,8,8.50,1,0
  WHERE NOT EXISTS (SELECT 1 FROM mrl_lines WHERE mrl_id=v_mrl_2 AND line_no=1);
  INSERT INTO mrl_lines (id,mrl_id,item_id,uom_id,requested_qty,approved_qty,approx_price,line_no,free_stock)
  SELECT gen_random_uuid()::text,v_mrl_2,v_i_sl05,v_uom_pcs,15,15,3.20,2,0
  WHERE NOT EXISTS (SELECT 1 FROM mrl_lines WHERE mrl_id=v_mrl_2 AND line_no=2);

  -- MRL-2025-003  APPROVED  Dec-2025
  INSERT INTO material_requisitions (id,company_id,doc_no,doc_date,location_id,charge_code_id,delivery_date,
    status,created_by_id,approved_by_id,approved_at,created_at,updated_at)
  SELECT gen_random_uuid()::text,v_cid,'MRL-2025-003','2025-12-03',v_engg_store,v_cc1,'2025-12-30',
    'APPROVED',v_proc_mgr,v_admin_user,'2025-12-03',now(),now()
  WHERE NOT EXISTS (SELECT 1 FROM material_requisitions WHERE company_id=v_cid AND doc_no='MRL-2025-003');
  SELECT id INTO v_mrl_3 FROM material_requisitions WHERE company_id=v_cid AND doc_no='MRL-2025-003';
  INSERT INTO mrl_lines (id,mrl_id,item_id,uom_id,requested_qty,approved_qty,approx_price,line_no,free_stock)
  SELECT gen_random_uuid()::text,v_mrl_3,v_i_ca10,v_uom_mtr,500,500,2.85,1,0
  WHERE NOT EXISTS (SELECT 1 FROM mrl_lines WHERE mrl_id=v_mrl_3 AND line_no=1);
  INSERT INTO mrl_lines (id,mrl_id,item_id,uom_id,requested_qty,approved_qty,approx_price,line_no,free_stock)
  SELECT gen_random_uuid()::text,v_mrl_3,v_i_fu01,v_uom_pcs,24,24,4.50,2,0
  WHERE NOT EXISTS (SELECT 1 FROM mrl_lines WHERE mrl_id=v_mrl_3 AND line_no=2);

  -- MRL-2026-001  SUBMITTED  Jan-2026
  INSERT INTO material_requisitions (id,company_id,doc_no,doc_date,location_id,charge_code_id,delivery_date,
    status,created_by_id,created_at,updated_at)
  SELECT gen_random_uuid()::text,v_cid,'MRL-2026-001','2026-01-07',v_main_wh_loc,v_cc2,'2026-01-28',
    'SUBMITTED',v_proc_mgr,now(),now()
  WHERE NOT EXISTS (SELECT 1 FROM material_requisitions WHERE company_id=v_cid AND doc_no='MRL-2026-001');
  SELECT id INTO v_mrl_4 FROM material_requisitions WHERE company_id=v_cid AND doc_no='MRL-2026-001';
  INSERT INTO mrl_lines (id,mrl_id,item_id,uom_id,requested_qty,approved_qty,approx_price,line_no,free_stock)
  SELECT gen_random_uuid()::text,v_mrl_4,v_i_lu01,v_uom_ltr,200,0,38.00,1,0
  WHERE NOT EXISTS (SELECT 1 FROM mrl_lines WHERE mrl_id=v_mrl_4 AND line_no=1);
  INSERT INTO mrl_lines (id,mrl_id,item_id,uom_id,requested_qty,approved_qty,approx_price,line_no,free_stock)
  SELECT gen_random_uuid()::text,v_mrl_4,v_i_gr01,v_uom_kg,50,0,22.50,2,0
  WHERE NOT EXISTS (SELECT 1 FROM mrl_lines WHERE mrl_id=v_mrl_4 AND line_no=2);

  -- MRL-2026-002  CONVERTED  Feb-2026
  INSERT INTO material_requisitions (id,company_id,doc_no,doc_date,location_id,charge_code_id,delivery_date,
    status,created_by_id,approved_by_id,approved_at,created_at,updated_at)
  SELECT gen_random_uuid()::text,v_cid,'MRL-2026-002','2026-02-10',v_engg_store,v_cc1,'2026-03-05',
    'CONVERTED',v_proc_mgr,v_admin_user,'2026-02-10',now(),now()
  WHERE NOT EXISTS (SELECT 1 FROM material_requisitions WHERE company_id=v_cid AND doc_no='MRL-2026-002');
  SELECT id INTO v_mrl_5 FROM material_requisitions WHERE company_id=v_cid AND doc_no='MRL-2026-002';
  INSERT INTO mrl_lines (id,mrl_id,item_id,uom_id,requested_qty,approved_qty,approx_price,line_no,free_stock)
  SELECT gen_random_uuid()::text,v_mrl_5,v_i_hl01,v_uom_nos,50,50,15.00,1,0
  WHERE NOT EXISTS (SELECT 1 FROM mrl_lines WHERE mrl_id=v_mrl_5 AND line_no=1);
  INSERT INTO mrl_lines (id,mrl_id,item_id,uom_id,requested_qty,approved_qty,approx_price,line_no,free_stock)
  SELECT gen_random_uuid()::text,v_mrl_5,v_i_gl01,v_uom_pcs,100,100,7.50,2,0
  WHERE NOT EXISTS (SELECT 1 FROM mrl_lines WHERE mrl_id=v_mrl_5 AND line_no=2);
  INSERT INTO mrl_lines (id,mrl_id,item_id,uom_id,requested_qty,approved_qty,approx_price,line_no,free_stock)
  SELECT gen_random_uuid()::text,v_mrl_5,v_i_bt01,v_uom_pcs,30,30,55.00,3,0
  WHERE NOT EXISTS (SELECT 1 FROM mrl_lines WHERE mrl_id=v_mrl_5 AND line_no=3);

  -- MRL-2026-003  APPROVED  Mar-2026
  INSERT INTO material_requisitions (id,company_id,doc_no,doc_date,location_id,charge_code_id,delivery_date,
    status,created_by_id,approved_by_id,approved_at,created_at,updated_at)
  SELECT gen_random_uuid()::text,v_cid,'MRL-2026-003','2026-03-15',v_main_wh_loc,v_cc2,'2026-04-10',
    'APPROVED',v_proc_mgr,v_admin_user,'2026-03-15',now(),now()
  WHERE NOT EXISTS (SELECT 1 FROM material_requisitions WHERE company_id=v_cid AND doc_no='MRL-2026-003');
  SELECT id INTO v_mrl_6 FROM material_requisitions WHERE company_id=v_cid AND doc_no='MRL-2026-003';
  INSERT INTO mrl_lines (id,mrl_id,item_id,uom_id,requested_qty,approved_qty,approx_price,line_no,free_stock)
  SELECT gen_random_uuid()::text,v_mrl_6,v_i_pu01,v_uom_nos,2,2,1250.00,1,0
  WHERE NOT EXISTS (SELECT 1 FROM mrl_lines WHERE mrl_id=v_mrl_6 AND line_no=1);

  -- MRL-2026-004  DRAFT  Mar-2026
  INSERT INTO material_requisitions (id,company_id,doc_no,doc_date,location_id,charge_code_id,delivery_date,
    status,created_by_id,created_at,updated_at)
  SELECT gen_random_uuid()::text,v_cid,'MRL-2026-004','2026-03-28',v_engg_store,v_cc1,'2026-04-20',
    'DRAFT',v_proc_mgr,now(),now()
  WHERE NOT EXISTS (SELECT 1 FROM material_requisitions WHERE company_id=v_cid AND doc_no='MRL-2026-004');
  SELECT id INTO v_mrl_7 FROM material_requisitions WHERE company_id=v_cid AND doc_no='MRL-2026-004';
  INSERT INTO mrl_lines (id,mrl_id,item_id,uom_id,requested_qty,approved_qty,approx_price,line_no,free_stock)
  SELECT gen_random_uuid()::text,v_mrl_7,v_i_br34,v_uom_nos,6,0,12.75,1,0
  WHERE NOT EXISTS (SELECT 1 FROM mrl_lines WHERE mrl_id=v_mrl_7 AND line_no=1);
  INSERT INTO mrl_lines (id,mrl_id,item_id,uom_id,requested_qty,approved_qty,approx_price,line_no,free_stock)
  SELECT gen_random_uuid()::text,v_mrl_7,v_i_sl05,v_uom_pcs,20,0,3.20,2,0
  WHERE NOT EXISTS (SELECT 1 FROM mrl_lines WHERE mrl_id=v_mrl_7 AND line_no=2);

  -- MRL-2026-005  SUBMITTED  Apr-2026 (recent/overdue)
  INSERT INTO material_requisitions (id,company_id,doc_no,doc_date,location_id,charge_code_id,delivery_date,
    status,created_by_id,created_at,updated_at)
  SELECT gen_random_uuid()::text,v_cid,'MRL-2026-005','2026-04-01',v_engg_store,v_cc1,'2026-04-22',
    'SUBMITTED',v_proc_mgr,now(),now()
  WHERE NOT EXISTS (SELECT 1 FROM material_requisitions WHERE company_id=v_cid AND doc_no='MRL-2026-005');
  SELECT id INTO v_mrl_8 FROM material_requisitions WHERE company_id=v_cid AND doc_no='MRL-2026-005';
  INSERT INTO mrl_lines (id,mrl_id,item_id,uom_id,requested_qty,approved_qty,approx_price,line_no,free_stock)
  SELECT gen_random_uuid()::text,v_mrl_8,v_i_la01,v_uom_nos,12,0,85.00,1,0
  WHERE NOT EXISTS (SELECT 1 FROM mrl_lines WHERE mrl_id=v_mrl_8 AND line_no=1);
  INSERT INTO mrl_lines (id,mrl_id,item_id,uom_id,requested_qty,approved_qty,approx_price,line_no,free_stock)
  SELECT gen_random_uuid()::text,v_mrl_8,v_i_ca20,v_uom_mtr,300,0,4.10,2,0
  WHERE NOT EXISTS (SELECT 1 FROM mrl_lines WHERE mrl_id=v_mrl_8 AND line_no=2);

  RAISE NOTICE '✓ 8 MRLs created';

  -- ── 7. Purchase Requisitions ──────────────────────────────────────────────
  -- PRL-2025-001  PO_CREATED
  SELECT id INTO v_mrl_1 FROM material_requisitions WHERE company_id=v_cid AND doc_no='MRL-2025-001';
  INSERT INTO purchase_requisitions (id,company_id,doc_no,doc_date,location_id,charge_code_id,delivery_date,
    status,mrl_id,created_by_id,created_at,updated_at)
  SELECT gen_random_uuid()::text,v_cid,'PRL-2025-001','2025-10-06',v_engg_store,v_cc1,'2025-10-25',
    'PO_CREATED',v_mrl_1,v_proc_mgr,now(),now()
  WHERE NOT EXISTS (SELECT 1 FROM purchase_requisitions WHERE company_id=v_cid AND doc_no='PRL-2025-001');
  SELECT id INTO v_prl_1 FROM purchase_requisitions WHERE company_id=v_cid AND doc_no='PRL-2025-001';
  INSERT INTO prl_lines (id,prl_id,item_id,uom_id,requested_qty,approved_qty,approx_price,charge_code_id,line_no,free_stock)
  SELECT gen_random_uuid()::text,v_prl_1,v_i_vb96,v_uom_nos,20,20,1.73,v_cc1,1,0
  WHERE NOT EXISTS (SELECT 1 FROM prl_lines WHERE prl_id=v_prl_1 AND line_no=1);
  INSERT INTO prl_lines (id,prl_id,item_id,uom_id,requested_qty,approved_qty,approx_price,charge_code_id,line_no,free_stock)
  SELECT gen_random_uuid()::text,v_prl_1,v_i_vb92,v_uom_nos,10,10,5.93,v_cc1,2,0
  WHERE NOT EXISTS (SELECT 1 FROM prl_lines WHERE prl_id=v_prl_1 AND line_no=2);

  -- PRL-2025-002  PO_CREATED
  SELECT id INTO v_mrl_2 FROM material_requisitions WHERE company_id=v_cid AND doc_no='MRL-2025-002';
  INSERT INTO purchase_requisitions (id,company_id,doc_no,doc_date,location_id,charge_code_id,delivery_date,
    status,mrl_id,created_by_id,created_at,updated_at)
  SELECT gen_random_uuid()::text,v_cid,'PRL-2025-002','2025-11-13',v_engg_store,v_cc1,'2025-12-05',
    'PO_CREATED',v_mrl_2,v_proc_mgr,now(),now()
  WHERE NOT EXISTS (SELECT 1 FROM purchase_requisitions WHERE company_id=v_cid AND doc_no='PRL-2025-002');
  SELECT id INTO v_prl_2 FROM purchase_requisitions WHERE company_id=v_cid AND doc_no='PRL-2025-002';
  INSERT INTO prl_lines (id,prl_id,item_id,uom_id,requested_qty,approved_qty,approx_price,charge_code_id,line_no,free_stock)
  SELECT gen_random_uuid()::text,v_prl_2,v_i_br12,v_uom_nos,8,8,8.50,v_cc1,1,0
  WHERE NOT EXISTS (SELECT 1 FROM prl_lines WHERE prl_id=v_prl_2 AND line_no=1);
  INSERT INTO prl_lines (id,prl_id,item_id,uom_id,requested_qty,approved_qty,approx_price,charge_code_id,line_no,free_stock)
  SELECT gen_random_uuid()::text,v_prl_2,v_i_sl05,v_uom_pcs,15,15,3.20,v_cc1,2,0
  WHERE NOT EXISTS (SELECT 1 FROM prl_lines WHERE prl_id=v_prl_2 AND line_no=2);

  -- PRL-2026-001  PO_CREATED
  SELECT id INTO v_mrl_5 FROM material_requisitions WHERE company_id=v_cid AND doc_no='MRL-2026-002';
  INSERT INTO purchase_requisitions (id,company_id,doc_no,doc_date,location_id,charge_code_id,delivery_date,
    status,mrl_id,created_by_id,created_at,updated_at)
  SELECT gen_random_uuid()::text,v_cid,'PRL-2026-001','2026-02-11',v_engg_store,v_cc1,'2026-03-05',
    'PO_CREATED',v_mrl_5,v_proc_mgr,now(),now()
  WHERE NOT EXISTS (SELECT 1 FROM purchase_requisitions WHERE company_id=v_cid AND doc_no='PRL-2026-001');
  SELECT id INTO v_prl_3 FROM purchase_requisitions WHERE company_id=v_cid AND doc_no='PRL-2026-001';
  INSERT INTO prl_lines (id,prl_id,item_id,uom_id,requested_qty,approved_qty,approx_price,charge_code_id,line_no,free_stock)
  SELECT gen_random_uuid()::text,v_prl_3,v_i_hl01,v_uom_nos,50,50,15.00,v_cc1,1,0
  WHERE NOT EXISTS (SELECT 1 FROM prl_lines WHERE prl_id=v_prl_3 AND line_no=1);
  INSERT INTO prl_lines (id,prl_id,item_id,uom_id,requested_qty,approved_qty,approx_price,charge_code_id,line_no,free_stock)
  SELECT gen_random_uuid()::text,v_prl_3,v_i_gl01,v_uom_pcs,100,100,7.50,v_cc1,2,0
  WHERE NOT EXISTS (SELECT 1 FROM prl_lines WHERE prl_id=v_prl_3 AND line_no=2);
  INSERT INTO prl_lines (id,prl_id,item_id,uom_id,requested_qty,approved_qty,approx_price,charge_code_id,line_no,free_stock)
  SELECT gen_random_uuid()::text,v_prl_3,v_i_bt01,v_uom_pcs,30,30,55.00,v_cc1,3,0
  WHERE NOT EXISTS (SELECT 1 FROM prl_lines WHERE prl_id=v_prl_3 AND line_no=3);

  -- PRL-2026-002  APPROVED (waiting for PO)
  SELECT id INTO v_mrl_6 FROM material_requisitions WHERE company_id=v_cid AND doc_no='MRL-2026-003';
  INSERT INTO purchase_requisitions (id,company_id,doc_no,doc_date,location_id,charge_code_id,delivery_date,
    status,mrl_id,created_by_id,created_at,updated_at)
  SELECT gen_random_uuid()::text,v_cid,'PRL-2026-002','2026-03-16',v_main_wh_loc,v_cc2,'2026-04-10',
    'APPROVED',v_mrl_6,v_proc_mgr,now(),now()
  WHERE NOT EXISTS (SELECT 1 FROM purchase_requisitions WHERE company_id=v_cid AND doc_no='PRL-2026-002');
  SELECT id INTO v_prl_4 FROM purchase_requisitions WHERE company_id=v_cid AND doc_no='PRL-2026-002';
  INSERT INTO prl_lines (id,prl_id,item_id,uom_id,requested_qty,approved_qty,approx_price,charge_code_id,line_no,free_stock)
  SELECT gen_random_uuid()::text,v_prl_4,v_i_pu01,v_uom_nos,2,2,1250.00,v_cc2,1,0
  WHERE NOT EXISTS (SELECT 1 FROM prl_lines WHERE prl_id=v_prl_4 AND line_no=1);

  RAISE NOTICE '✓ 4 PRLs created';

  -- ── 8. Purchase Orders ────────────────────────────────────────────────────
  -- PO-2025-001  RECEIVED  Aerotrans  Oct-2025 (planned 20d, actual receipt 15d = -5 variance)
  INSERT INTO purchase_orders (id,company_id,doc_no,doc_date,supplier_id,currency_id,exchange_rate,
    payment_terms,delivery_date,ship_to_location_id,status,created_by_id,approved_by_id,total_amount,created_at,updated_at)
  SELECT gen_random_uuid()::text,v_cid,'PO-2025-001','2025-10-07',v_s_aero,v_usd_cur,1,
    'NET 30','2025-10-27',v_engg_store,'RECEIVED',v_proc_mgr,v_admin_user, 20*1.73+10*5.93, now(),now()
  WHERE NOT EXISTS (SELECT 1 FROM purchase_orders WHERE company_id=v_cid AND doc_no='PO-2025-001');
  SELECT id INTO v_po_1 FROM purchase_orders WHERE company_id=v_cid AND doc_no='PO-2025-001';
  INSERT INTO po_lines (id,po_id,item_id,uom_id,ordered_qty,received_qty,invoiced_qty,unit_price,discount_pct,tax_pct,net_amount,charge_code_id,line_no)
  SELECT gen_random_uuid()::text,v_po_1,v_i_vb96,v_uom_nos,20,20,0, 1.73,0,5, 20*1.73,v_cc1,1
  WHERE NOT EXISTS (SELECT 1 FROM po_lines WHERE po_id=v_po_1 AND line_no=1);
  SELECT id INTO v_pol_1_1 FROM po_lines WHERE po_id=v_po_1 AND line_no=1;
  INSERT INTO po_lines (id,po_id,item_id,uom_id,ordered_qty,received_qty,invoiced_qty,unit_price,discount_pct,tax_pct,net_amount,charge_code_id,line_no)
  SELECT gen_random_uuid()::text,v_po_1,v_i_vb92,v_uom_nos,10,10,0, 5.93,0,5, 10*5.93,v_cc1,2
  WHERE NOT EXISTS (SELECT 1 FROM po_lines WHERE po_id=v_po_1 AND line_no=2);
  SELECT id INTO v_pol_1_2 FROM po_lines WHERE po_id=v_po_1 AND line_no=2;

  -- PO-2025-002  RECEIVED  BearingTech  Nov-2025 (on time, variance 0)
  INSERT INTO purchase_orders (id,company_id,doc_no,doc_date,supplier_id,currency_id,exchange_rate,
    payment_terms,delivery_date,ship_to_location_id,status,created_by_id,approved_by_id,total_amount,created_at,updated_at)
  SELECT gen_random_uuid()::text,v_cid,'PO-2025-002','2025-11-14',v_s_btech,v_usd_cur,1,
    'NET 45','2025-12-06',v_engg_store,'RECEIVED',v_proc_mgr,v_admin_user, 8*8.20+15*3.10, now(),now()
  WHERE NOT EXISTS (SELECT 1 FROM purchase_orders WHERE company_id=v_cid AND doc_no='PO-2025-002');
  SELECT id INTO v_po_2 FROM purchase_orders WHERE company_id=v_cid AND doc_no='PO-2025-002';
  INSERT INTO po_lines (id,po_id,item_id,uom_id,ordered_qty,received_qty,invoiced_qty,unit_price,discount_pct,tax_pct,net_amount,charge_code_id,line_no)
  SELECT gen_random_uuid()::text,v_po_2,v_i_br12,v_uom_nos,8,8,0, 8.20,0,5, 8*8.20,v_cc1,1
  WHERE NOT EXISTS (SELECT 1 FROM po_lines WHERE po_id=v_po_2 AND line_no=1);
  SELECT id INTO v_pol_2_1 FROM po_lines WHERE po_id=v_po_2 AND line_no=1;
  INSERT INTO po_lines (id,po_id,item_id,uom_id,ordered_qty,received_qty,invoiced_qty,unit_price,discount_pct,tax_pct,net_amount,charge_code_id,line_no)
  SELECT gen_random_uuid()::text,v_po_2,v_i_sl05,v_uom_pcs,15,15,0, 3.10,0,5, 15*3.10,v_cc1,2
  WHERE NOT EXISTS (SELECT 1 FROM po_lines WHERE po_id=v_po_2 AND line_no=2);
  SELECT id INTO v_pol_2_2 FROM po_lines WHERE po_id=v_po_2 AND line_no=2;

  -- PO-2025-003  RECEIVED  Al-Mansoori Elec  Nov-2025 (late: +7 days variance)
  INSERT INTO purchase_orders (id,company_id,doc_no,doc_date,supplier_id,currency_id,exchange_rate,
    payment_terms,delivery_date,ship_to_location_id,status,created_by_id,approved_by_id,total_amount,created_at,updated_at)
  SELECT gen_random_uuid()::text,v_cid,'PO-2025-003','2025-11-20',v_s_elec,v_usd_cur,1,
    'NET 30','2025-12-04',v_main_wh_loc,'RECEIVED',v_proc_mgr,v_admin_user, 500*2.80+24*4.40, now(),now()
  WHERE NOT EXISTS (SELECT 1 FROM purchase_orders WHERE company_id=v_cid AND doc_no='PO-2025-003');
  SELECT id INTO v_po_3 FROM purchase_orders WHERE company_id=v_cid AND doc_no='PO-2025-003';
  INSERT INTO po_lines (id,po_id,item_id,uom_id,ordered_qty,received_qty,invoiced_qty,unit_price,discount_pct,tax_pct,net_amount,charge_code_id,line_no)
  SELECT gen_random_uuid()::text,v_po_3,v_i_ca10,v_uom_mtr,500,500,0, 2.80,0,5, 500*2.80,v_cc1,1
  WHERE NOT EXISTS (SELECT 1 FROM po_lines WHERE po_id=v_po_3 AND line_no=1);
  SELECT id INTO v_pol_3_1 FROM po_lines WHERE po_id=v_po_3 AND line_no=1;
  INSERT INTO po_lines (id,po_id,item_id,uom_id,ordered_qty,received_qty,invoiced_qty,unit_price,discount_pct,tax_pct,net_amount,charge_code_id,line_no)
  SELECT gen_random_uuid()::text,v_po_3,v_i_fu01,v_uom_pcs,24,24,0, 4.40,0,5, 24*4.40,v_cc1,2
  WHERE NOT EXISTS (SELECT 1 FROM po_lines WHERE po_id=v_po_3 AND line_no=2);
  SELECT id INTO v_pol_3_2 FROM po_lines WHERE po_id=v_po_3 AND line_no=2;

  -- PO-2025-004  PARTIAL  Gulf Chemicals  Dec-2025
  INSERT INTO purchase_orders (id,company_id,doc_no,doc_date,supplier_id,currency_id,exchange_rate,
    payment_terms,delivery_date,ship_to_location_id,status,created_by_id,approved_by_id,total_amount,created_at,updated_at)
  SELECT gen_random_uuid()::text,v_cid,'PO-2025-004','2025-12-10',v_s_chem,v_usd_cur,1,
    'NET 60','2026-01-10',v_main_wh_loc,'PARTIAL',v_proc_mgr,v_admin_user, 200*36.50+50*21.00, now(),now()
  WHERE NOT EXISTS (SELECT 1 FROM purchase_orders WHERE company_id=v_cid AND doc_no='PO-2025-004');
  SELECT id INTO v_po_4 FROM purchase_orders WHERE company_id=v_cid AND doc_no='PO-2025-004';
  INSERT INTO po_lines (id,po_id,item_id,uom_id,ordered_qty,received_qty,invoiced_qty,unit_price,discount_pct,tax_pct,net_amount,charge_code_id,line_no)
  SELECT gen_random_uuid()::text,v_po_4,v_i_lu01,v_uom_ltr,200,100,0, 36.50,0,5, 200*36.50,v_cc2,1
  WHERE NOT EXISTS (SELECT 1 FROM po_lines WHERE po_id=v_po_4 AND line_no=1);
  SELECT id INTO v_pol_4_1 FROM po_lines WHERE po_id=v_po_4 AND line_no=1;
  INSERT INTO po_lines (id,po_id,item_id,uom_id,ordered_qty,received_qty,invoiced_qty,unit_price,discount_pct,tax_pct,net_amount,charge_code_id,line_no)
  SELECT gen_random_uuid()::text,v_po_4,v_i_gr01,v_uom_kg,50,25,0, 21.00,0,5, 50*21.00,v_cc2,2
  WHERE NOT EXISTS (SELECT 1 FROM po_lines WHERE po_id=v_po_4 AND line_no=2);
  SELECT id INTO v_pol_4_2 FROM po_lines WHERE po_id=v_po_4 AND line_no=2;

  -- PO-2026-001  RECEIVED  BearingTech  Jan-2026 (very late: +11 days)
  INSERT INTO purchase_orders (id,company_id,doc_no,doc_date,supplier_id,currency_id,exchange_rate,
    payment_terms,delivery_date,ship_to_location_id,status,created_by_id,approved_by_id,total_amount,created_at,updated_at)
  SELECT gen_random_uuid()::text,v_cid,'PO-2026-001','2026-01-10',v_s_btech,v_usd_cur,1,
    'NET 45','2026-01-24',v_engg_store,'RECEIVED',v_proc_mgr,v_admin_user, 12*12.50, now(),now()
  WHERE NOT EXISTS (SELECT 1 FROM purchase_orders WHERE company_id=v_cid AND doc_no='PO-2026-001');
  SELECT id INTO v_po_5 FROM purchase_orders WHERE company_id=v_cid AND doc_no='PO-2026-001';
  INSERT INTO po_lines (id,po_id,item_id,uom_id,ordered_qty,received_qty,invoiced_qty,unit_price,discount_pct,tax_pct,net_amount,charge_code_id,line_no)
  SELECT gen_random_uuid()::text,v_po_5,v_i_br34,v_uom_nos,12,12,0, 12.50,0,5, 12*12.50,v_cc1,1
  WHERE NOT EXISTS (SELECT 1 FROM po_lines WHERE po_id=v_po_5 AND line_no=1);
  SELECT id INTO v_pol_5_1 FROM po_lines WHERE po_id=v_po_5 AND line_no=1;

  -- PO-2026-002  RECEIVED  ProSafe  Feb-2026 (early: -7 days)
  INSERT INTO purchase_orders (id,company_id,doc_no,doc_date,supplier_id,currency_id,exchange_rate,
    payment_terms,delivery_date,ship_to_location_id,status,created_by_id,approved_by_id,total_amount,created_at,updated_at)
  SELECT gen_random_uuid()::text,v_cid,'PO-2026-002','2026-02-12',v_s_safe,v_usd_cur,1,
    'NET 30','2026-03-10',v_engg_store,'RECEIVED',v_proc_mgr,v_admin_user, 50*14.50+100*7.20+30*53.00, now(),now()
  WHERE NOT EXISTS (SELECT 1 FROM purchase_orders WHERE company_id=v_cid AND doc_no='PO-2026-002');
  SELECT id INTO v_po_6 FROM purchase_orders WHERE company_id=v_cid AND doc_no='PO-2026-002';
  INSERT INTO po_lines (id,po_id,item_id,uom_id,ordered_qty,received_qty,invoiced_qty,unit_price,discount_pct,tax_pct,net_amount,charge_code_id,line_no)
  SELECT gen_random_uuid()::text,v_po_6,v_i_hl01,v_uom_nos,50,50,0, 14.50,0,5, 50*14.50,v_cc1,1
  WHERE NOT EXISTS (SELECT 1 FROM po_lines WHERE po_id=v_po_6 AND line_no=1);
  SELECT id INTO v_pol_6_1 FROM po_lines WHERE po_id=v_po_6 AND line_no=1;
  INSERT INTO po_lines (id,po_id,item_id,uom_id,ordered_qty,received_qty,invoiced_qty,unit_price,discount_pct,tax_pct,net_amount,charge_code_id,line_no)
  SELECT gen_random_uuid()::text,v_po_6,v_i_gl01,v_uom_pcs,100,100,0, 7.20,0,5, 100*7.20,v_cc1,2
  WHERE NOT EXISTS (SELECT 1 FROM po_lines WHERE po_id=v_po_6 AND line_no=2);
  SELECT id INTO v_pol_6_2 FROM po_lines WHERE po_id=v_po_6 AND line_no=2;
  INSERT INTO po_lines (id,po_id,item_id,uom_id,ordered_qty,received_qty,invoiced_qty,unit_price,discount_pct,tax_pct,net_amount,charge_code_id,line_no)
  SELECT gen_random_uuid()::text,v_po_6,v_i_bt01,v_uom_pcs,30,30,0, 53.00,0,5, 30*53.00,v_cc1,3
  WHERE NOT EXISTS (SELECT 1 FROM po_lines WHERE po_id=v_po_6 AND line_no=3);
  SELECT id INTO v_pol_6_3 FROM po_lines WHERE po_id=v_po_6 AND line_no=3;

  -- PO-2026-003  APPROVED  Al-Mansoori  Feb-2026 (pending receipt)
  INSERT INTO purchase_orders (id,company_id,doc_no,doc_date,supplier_id,currency_id,exchange_rate,
    payment_terms,delivery_date,ship_to_location_id,status,created_by_id,approved_by_id,total_amount,created_at,updated_at)
  SELECT gen_random_uuid()::text,v_cid,'PO-2026-003','2026-02-25',v_s_elec,v_usd_cur,1,
    'NET 30','2026-03-20',v_main_wh_loc,'APPROVED',v_proc_mgr,v_admin_user, 12*82.00+300*4.00, now(),now()
  WHERE NOT EXISTS (SELECT 1 FROM purchase_orders WHERE company_id=v_cid AND doc_no='PO-2026-003');
  SELECT id INTO v_po_7 FROM purchase_orders WHERE company_id=v_cid AND doc_no='PO-2026-003';
  INSERT INTO po_lines (id,po_id,item_id,uom_id,ordered_qty,received_qty,invoiced_qty,unit_price,discount_pct,tax_pct,net_amount,charge_code_id,line_no)
  SELECT gen_random_uuid()::text,v_po_7,v_i_la01,v_uom_nos,12,0,0, 82.00,0,5, 12*82.00,v_cc1,1
  WHERE NOT EXISTS (SELECT 1 FROM po_lines WHERE po_id=v_po_7 AND line_no=1);
  INSERT INTO po_lines (id,po_id,item_id,uom_id,ordered_qty,received_qty,invoiced_qty,unit_price,discount_pct,tax_pct,net_amount,charge_code_id,line_no)
  SELECT gen_random_uuid()::text,v_po_7,v_i_ca20,v_uom_mtr,300,0,0, 4.00,0,5, 300*4.00,v_cc1,2
  WHERE NOT EXISTS (SELECT 1 FROM po_lines WHERE po_id=v_po_7 AND line_no=2);

  -- PO-2026-004  APPROVED  NatGeneral  Mar-2026
  INSERT INTO purchase_orders (id,company_id,doc_no,doc_date,supplier_id,currency_id,exchange_rate,
    payment_terms,delivery_date,ship_to_location_id,status,created_by_id,approved_by_id,total_amount,created_at,updated_at)
  SELECT gen_random_uuid()::text,v_cid,'PO-2026-004','2026-03-05',v_s_genrl,v_usd_cur,1,
    'NET 45','2026-04-02',v_main_wh_loc,'APPROVED',v_proc_mgr,v_admin_user, 15*1.90+8*4.20, now(),now()
  WHERE NOT EXISTS (SELECT 1 FROM purchase_orders WHERE company_id=v_cid AND doc_no='PO-2026-004');
  SELECT id INTO v_po_8 FROM purchase_orders WHERE company_id=v_cid AND doc_no='PO-2026-004';
  INSERT INTO po_lines (id,po_id,item_id,uom_id,ordered_qty,received_qty,invoiced_qty,unit_price,discount_pct,tax_pct,net_amount,charge_code_id,line_no)
  SELECT gen_random_uuid()::text,v_po_8,v_i_vb21,v_uom_pcs,15,0,0, 1.90,0,5, 15*1.90,v_cc1,1
  WHERE NOT EXISTS (SELECT 1 FROM po_lines WHERE po_id=v_po_8 AND line_no=1);
  INSERT INTO po_lines (id,po_id,item_id,uom_id,ordered_qty,received_qty,invoiced_qty,unit_price,discount_pct,tax_pct,net_amount,charge_code_id,line_no)
  SELECT gen_random_uuid()::text,v_po_8,v_i_vb93,v_uom_nos,8,0,0, 4.20,0,5, 8*4.20,v_cc1,2
  WHERE NOT EXISTS (SELECT 1 FROM po_lines WHERE po_id=v_po_8 AND line_no=2);

  -- PO-2026-005  SUBMITTED  Aerotrans  Mar-2026 (awaiting approval)
  INSERT INTO purchase_orders (id,company_id,doc_no,doc_date,supplier_id,currency_id,exchange_rate,
    payment_terms,delivery_date,ship_to_location_id,status,created_by_id,total_amount,created_at,updated_at)
  SELECT gen_random_uuid()::text,v_cid,'PO-2026-005','2026-03-18',v_s_aero,v_usd_cur,1,
    'NET 30','2026-04-15',v_engg_store,'SUBMITTED',v_proc_mgr, 40*3.05, now(),now()
  WHERE NOT EXISTS (SELECT 1 FROM purchase_orders WHERE company_id=v_cid AND doc_no='PO-2026-005');
  SELECT id INTO v_po_9 FROM purchase_orders WHERE company_id=v_cid AND doc_no='PO-2026-005';
  INSERT INTO po_lines (id,po_id,item_id,uom_id,ordered_qty,received_qty,invoiced_qty,unit_price,discount_pct,tax_pct,net_amount,charge_code_id,line_no)
  SELECT gen_random_uuid()::text,v_po_9,v_i_sl05,v_uom_pcs,40,0,0, 3.05,0,5, 40*3.05,v_cc1,1
  WHERE NOT EXISTS (SELECT 1 FROM po_lines WHERE po_id=v_po_9 AND line_no=1);

  -- PO-2026-006  DRAFT  BearingTech  Apr-2026
  INSERT INTO purchase_orders (id,company_id,doc_no,doc_date,supplier_id,currency_id,exchange_rate,
    payment_terms,delivery_date,ship_to_location_id,status,created_by_id,total_amount,created_at,updated_at)
  SELECT gen_random_uuid()::text,v_cid,'PO-2026-006','2026-04-02',v_s_btech,v_usd_cur,1,
    'NET 45','2026-05-01',v_engg_store,'DRAFT',v_proc_mgr, 6*8.20+4*12.40, now(),now()
  WHERE NOT EXISTS (SELECT 1 FROM purchase_orders WHERE company_id=v_cid AND doc_no='PO-2026-006');
  SELECT id INTO v_po_10 FROM purchase_orders WHERE company_id=v_cid AND doc_no='PO-2026-006';
  INSERT INTO po_lines (id,po_id,item_id,uom_id,ordered_qty,received_qty,invoiced_qty,unit_price,discount_pct,tax_pct,net_amount,charge_code_id,line_no)
  SELECT gen_random_uuid()::text,v_po_10,v_i_br12,v_uom_nos,6,0,0, 8.20,0,5, 6*8.20,v_cc1,1
  WHERE NOT EXISTS (SELECT 1 FROM po_lines WHERE po_id=v_po_10 AND line_no=1);
  INSERT INTO po_lines (id,po_id,item_id,uom_id,ordered_qty,received_qty,invoiced_qty,unit_price,discount_pct,tax_pct,net_amount,charge_code_id,line_no)
  SELECT gen_random_uuid()::text,v_po_10,v_i_br34,v_uom_nos,4,0,0, 12.40,0,5, 4*12.40,v_cc1,2
  WHERE NOT EXISTS (SELECT 1 FROM po_lines WHERE po_id=v_po_10 AND line_no=2);

  -- PO-2026-007  RECEIVED  NatGeneral  Jan-2026 (price comparison: same item, different supplier+price)
  INSERT INTO purchase_orders (id,company_id,doc_no,doc_date,supplier_id,currency_id,exchange_rate,
    payment_terms,delivery_date,ship_to_location_id,status,created_by_id,approved_by_id,total_amount,created_at,updated_at)
  SELECT gen_random_uuid()::text,v_cid,'PO-2026-007','2026-01-20',v_s_genrl,v_usd_cur,1,
    'NET 45','2026-02-10',v_engg_store,'RECEIVED',v_proc_mgr,v_admin_user, 20*1.85+10*6.20, now(),now()
  WHERE NOT EXISTS (SELECT 1 FROM purchase_orders WHERE company_id=v_cid AND doc_no='PO-2026-007');
  SELECT id INTO v_po_11 FROM purchase_orders WHERE company_id=v_cid AND doc_no='PO-2026-007';
  INSERT INTO po_lines (id,po_id,item_id,uom_id,ordered_qty,received_qty,invoiced_qty,unit_price,discount_pct,tax_pct,net_amount,charge_code_id,line_no)
  SELECT gen_random_uuid()::text,v_po_11,v_i_vb96,v_uom_nos,20,20,0, 1.85,0,5, 20*1.85,v_cc1,1
  WHERE NOT EXISTS (SELECT 1 FROM po_lines WHERE po_id=v_po_11 AND line_no=1);
  SELECT id INTO v_pol_11_1 FROM po_lines WHERE po_id=v_po_11 AND line_no=1;
  INSERT INTO po_lines (id,po_id,item_id,uom_id,ordered_qty,received_qty,invoiced_qty,unit_price,discount_pct,tax_pct,net_amount,charge_code_id,line_no)
  SELECT gen_random_uuid()::text,v_po_11,v_i_vb92,v_uom_nos,10,10,0, 6.20,0,5, 10*6.20,v_cc1,2
  WHERE NOT EXISTS (SELECT 1 FROM po_lines WHERE po_id=v_po_11 AND line_no=2);
  SELECT id INTO v_pol_11_2 FROM po_lines WHERE po_id=v_po_11 AND line_no=2;

  RAISE NOTICE '✓ 11 Purchase Orders created';

  -- ── 9. GRN Records ───────────────────────────────────────────────────────
  -- GRN-2025-001  PO-2025-001  Aerotrans  received 2025-10-22 (planned 2025-10-27: 5d EARLY = -5 variance)
  INSERT INTO grn_headers (id,company_id,doc_no,po_id,supplier_id,warehouse_id,location_id,doc_date,
    status,posted_at,created_by_id,created_at,updated_at)
  SELECT gen_random_uuid()::text,v_cid,'GRN-2025-001',v_po_1,v_s_aero,v_engg_wh,v_engg_store,'2025-10-22',
    'POSTED','2025-10-22',v_inv_mgr,now(),now()
  WHERE NOT EXISTS (SELECT 1 FROM grn_headers WHERE company_id=v_cid AND doc_no='GRN-2025-001');
  DO $grn1$ DECLARE v_grn TEXT; BEGIN
    SELECT id INTO v_grn FROM grn_headers WHERE company_id=v_cid AND doc_no='GRN-2025-001';
    -- resolve pol ids fresh
    INSERT INTO grn_lines (id,grn_id,item_id,po_line_id,received_qty,accepted_qty,rejected_qty,bin_id,line_no)
    SELECT gen_random_uuid()::text,v_grn,pl.item_id,pl.id,20,20,0,
      (SELECT id FROM bins WHERE warehouse_id=wh.id AND code='RACK-A1' LIMIT 1), pl.line_no
    FROM po_lines pl JOIN purchase_orders po ON pl.po_id=po.id
    JOIN warehouses wh ON po.company_id=wh.company_id AND wh.code='ENGG_WH'
    WHERE po.doc_no='PO-2025-001' AND pl.line_no=1
      AND NOT EXISTS (SELECT 1 FROM grn_lines WHERE grn_id=v_grn AND line_no=1);

    INSERT INTO grn_lines (id,grn_id,item_id,po_line_id,received_qty,accepted_qty,rejected_qty,bin_id,line_no)
    SELECT gen_random_uuid()::text,v_grn,pl.item_id,pl.id,10,10,0,
      (SELECT id FROM bins WHERE warehouse_id=wh.id AND code='RACK-A1' LIMIT 1), pl.line_no
    FROM po_lines pl JOIN purchase_orders po ON pl.po_id=po.id
    JOIN warehouses wh ON po.company_id=wh.company_id AND wh.code='ENGG_WH'
    WHERE po.doc_no='PO-2025-001' AND pl.line_no=2
      AND NOT EXISTS (SELECT 1 FROM grn_lines WHERE grn_id=v_grn AND line_no=2);
  END $grn1$;

  -- GRN-2025-002  PO-2025-002  BearingTech  received 2025-12-06 (on time, variance 0)
  INSERT INTO grn_headers (id,company_id,doc_no,po_id,supplier_id,warehouse_id,location_id,doc_date,
    status,posted_at,created_by_id,created_at,updated_at)
  SELECT gen_random_uuid()::text,v_cid,'GRN-2025-002',v_po_2,v_s_btech,v_engg_wh,v_engg_store,'2025-12-06',
    'POSTED','2025-12-06',v_inv_mgr,now(),now()
  WHERE NOT EXISTS (SELECT 1 FROM grn_headers WHERE company_id=v_cid AND doc_no='GRN-2025-002');
  DO $grn2$ DECLARE v_grn TEXT; v_bin TEXT; BEGIN
    SELECT id INTO v_grn FROM grn_headers WHERE company_id=v_cid AND doc_no='GRN-2025-002';
    SELECT b.id INTO v_bin FROM bins b JOIN warehouses w ON b.warehouse_id=w.id WHERE w.company_id=v_cid AND w.code='ENGG_WH' AND b.code='RACK-A1' LIMIT 1;
    INSERT INTO grn_lines (id,grn_id,item_id,po_line_id,received_qty,accepted_qty,rejected_qty,bin_id,line_no)
    SELECT gen_random_uuid()::text,v_grn,pl.item_id,pl.id,8,8,0,v_bin,1
    FROM po_lines pl JOIN purchase_orders po ON pl.po_id=po.id WHERE po.doc_no='PO-2025-002' AND pl.line_no=1
      AND NOT EXISTS (SELECT 1 FROM grn_lines WHERE grn_id=v_grn AND line_no=1);
    INSERT INTO grn_lines (id,grn_id,item_id,po_line_id,received_qty,accepted_qty,rejected_qty,bin_id,line_no)
    SELECT gen_random_uuid()::text,v_grn,pl.item_id,pl.id,15,15,0,v_bin,2
    FROM po_lines pl JOIN purchase_orders po ON pl.po_id=po.id WHERE po.doc_no='PO-2025-002' AND pl.line_no=2
      AND NOT EXISTS (SELECT 1 FROM grn_lines WHERE grn_id=v_grn AND line_no=2);
  END $grn2$;

  -- GRN-2025-003  PO-2025-003  Al-Mansoori  received 2025-12-11 (planned 2025-12-04: 7d LATE = +7)
  INSERT INTO grn_headers (id,company_id,doc_no,po_id,supplier_id,warehouse_id,location_id,doc_date,
    status,posted_at,created_by_id,created_at,updated_at)
  SELECT gen_random_uuid()::text,v_cid,'GRN-2025-003',v_po_3,v_s_elec,v_main_wh,v_main_wh_loc,'2025-12-11',
    'POSTED','2025-12-11',v_inv_mgr,now(),now()
  WHERE NOT EXISTS (SELECT 1 FROM grn_headers WHERE company_id=v_cid AND doc_no='GRN-2025-003');
  DO $grn3$ DECLARE v_grn TEXT; v_bin TEXT; BEGIN
    SELECT id INTO v_grn FROM grn_headers WHERE company_id=v_cid AND doc_no='GRN-2025-003';
    SELECT b.id INTO v_bin FROM bins b JOIN warehouses w ON b.warehouse_id=w.id WHERE w.company_id=v_cid AND w.code='MAIN_WH' AND b.code='BAY-01' LIMIT 1;
    INSERT INTO grn_lines (id,grn_id,item_id,po_line_id,received_qty,accepted_qty,rejected_qty,bin_id,line_no)
    SELECT gen_random_uuid()::text,v_grn,pl.item_id,pl.id,500,500,0,v_bin,1
    FROM po_lines pl JOIN purchase_orders po ON pl.po_id=po.id WHERE po.doc_no='PO-2025-003' AND pl.line_no=1
      AND NOT EXISTS (SELECT 1 FROM grn_lines WHERE grn_id=v_grn AND line_no=1);
    INSERT INTO grn_lines (id,grn_id,item_id,po_line_id,received_qty,accepted_qty,rejected_qty,bin_id,line_no)
    SELECT gen_random_uuid()::text,v_grn,pl.item_id,pl.id,24,24,0,v_bin,2
    FROM po_lines pl JOIN purchase_orders po ON pl.po_id=po.id WHERE po.doc_no='PO-2025-003' AND pl.line_no=2
      AND NOT EXISTS (SELECT 1 FROM grn_lines WHERE grn_id=v_grn AND line_no=2);
  END $grn3$;

  -- GRN-2025-004  PO-2025-004  Partial  received 2026-01-05
  INSERT INTO grn_headers (id,company_id,doc_no,po_id,supplier_id,warehouse_id,location_id,doc_date,
    status,posted_at,created_by_id,created_at,updated_at)
  SELECT gen_random_uuid()::text,v_cid,'GRN-2025-004',v_po_4,v_s_chem,v_main_wh,v_main_wh_loc,'2026-01-05',
    'POSTED','2026-01-05',v_inv_mgr,now(),now()
  WHERE NOT EXISTS (SELECT 1 FROM grn_headers WHERE company_id=v_cid AND doc_no='GRN-2025-004');
  DO $grn4$ DECLARE v_grn TEXT; v_bin TEXT; BEGIN
    SELECT id INTO v_grn FROM grn_headers WHERE company_id=v_cid AND doc_no='GRN-2025-004';
    SELECT b.id INTO v_bin FROM bins b JOIN warehouses w ON b.warehouse_id=w.id WHERE w.company_id=v_cid AND w.code='MAIN_WH' AND b.code='BAY-01' LIMIT 1;
    INSERT INTO grn_lines (id,grn_id,item_id,po_line_id,received_qty,accepted_qty,rejected_qty,bin_id,line_no)
    SELECT gen_random_uuid()::text,v_grn,pl.item_id,pl.id,100,100,0,v_bin,1
    FROM po_lines pl JOIN purchase_orders po ON pl.po_id=po.id WHERE po.doc_no='PO-2025-004' AND pl.line_no=1
      AND NOT EXISTS (SELECT 1 FROM grn_lines WHERE grn_id=v_grn AND line_no=1);
    INSERT INTO grn_lines (id,grn_id,item_id,po_line_id,received_qty,accepted_qty,rejected_qty,bin_id,line_no)
    SELECT gen_random_uuid()::text,v_grn,pl.item_id,pl.id,25,25,0,v_bin,2
    FROM po_lines pl JOIN purchase_orders po ON pl.po_id=po.id WHERE po.doc_no='PO-2025-004' AND pl.line_no=2
      AND NOT EXISTS (SELECT 1 FROM grn_lines WHERE grn_id=v_grn AND line_no=2);
  END $grn4$;

  -- GRN-2026-001  PO-2026-001  BearingTech  received 2026-02-04 (planned 2026-01-24: 11d LATE = +11)
  INSERT INTO grn_headers (id,company_id,doc_no,po_id,supplier_id,warehouse_id,location_id,doc_date,
    status,posted_at,created_by_id,created_at,updated_at)
  SELECT gen_random_uuid()::text,v_cid,'GRN-2026-001',v_po_5,v_s_btech,v_engg_wh,v_engg_store,'2026-02-04',
    'POSTED','2026-02-04',v_inv_mgr,now(),now()
  WHERE NOT EXISTS (SELECT 1 FROM grn_headers WHERE company_id=v_cid AND doc_no='GRN-2026-001');
  DO $grn5$ DECLARE v_grn TEXT; v_bin TEXT; BEGIN
    SELECT id INTO v_grn FROM grn_headers WHERE company_id=v_cid AND doc_no='GRN-2026-001';
    SELECT b.id INTO v_bin FROM bins b JOIN warehouses w ON b.warehouse_id=w.id WHERE w.company_id=v_cid AND w.code='ENGG_WH' AND b.code='RACK-A1' LIMIT 1;
    INSERT INTO grn_lines (id,grn_id,item_id,po_line_id,received_qty,accepted_qty,rejected_qty,bin_id,line_no)
    SELECT gen_random_uuid()::text,v_grn,pl.item_id,pl.id,12,12,0,v_bin,1
    FROM po_lines pl JOIN purchase_orders po ON pl.po_id=po.id WHERE po.doc_no='PO-2026-001' AND pl.line_no=1
      AND NOT EXISTS (SELECT 1 FROM grn_lines WHERE grn_id=v_grn AND line_no=1);
  END $grn5$;

  -- GRN-2026-002  PO-2026-002  ProSafe  received 2026-03-03 (planned 2026-03-10: 7d EARLY = -7)
  INSERT INTO grn_headers (id,company_id,doc_no,po_id,supplier_id,warehouse_id,location_id,doc_date,
    status,posted_at,created_by_id,created_at,updated_at)
  SELECT gen_random_uuid()::text,v_cid,'GRN-2026-002',v_po_6,v_s_safe,v_engg_wh,v_engg_store,'2026-03-03',
    'POSTED','2026-03-03',v_inv_mgr,now(),now()
  WHERE NOT EXISTS (SELECT 1 FROM grn_headers WHERE company_id=v_cid AND doc_no='GRN-2026-002');
  DO $grn6$ DECLARE v_grn TEXT; v_bin TEXT; BEGIN
    SELECT id INTO v_grn FROM grn_headers WHERE company_id=v_cid AND doc_no='GRN-2026-002';
    SELECT b.id INTO v_bin FROM bins b JOIN warehouses w ON b.warehouse_id=w.id WHERE w.company_id=v_cid AND w.code='ENGG_WH' AND b.code='RACK-A1' LIMIT 1;
    INSERT INTO grn_lines (id,grn_id,item_id,po_line_id,received_qty,accepted_qty,rejected_qty,bin_id,line_no)
    SELECT gen_random_uuid()::text,v_grn,pl.item_id,pl.id,50,50,0,v_bin,1
    FROM po_lines pl JOIN purchase_orders po ON pl.po_id=po.id WHERE po.doc_no='PO-2026-002' AND pl.line_no=1
      AND NOT EXISTS (SELECT 1 FROM grn_lines WHERE grn_id=v_grn AND line_no=1);
    INSERT INTO grn_lines (id,grn_id,item_id,po_line_id,received_qty,accepted_qty,rejected_qty,bin_id,line_no)
    SELECT gen_random_uuid()::text,v_grn,pl.item_id,pl.id,100,100,0,v_bin,2
    FROM po_lines pl JOIN purchase_orders po ON pl.po_id=po.id WHERE po.doc_no='PO-2026-002' AND pl.line_no=2
      AND NOT EXISTS (SELECT 1 FROM grn_lines WHERE grn_id=v_grn AND line_no=2);
    INSERT INTO grn_lines (id,grn_id,item_id,po_line_id,received_qty,accepted_qty,rejected_qty,bin_id,line_no)
    SELECT gen_random_uuid()::text,v_grn,pl.item_id,pl.id,30,30,0,v_bin,3
    FROM po_lines pl JOIN purchase_orders po ON pl.po_id=po.id WHERE po.doc_no='PO-2026-002' AND pl.line_no=3
      AND NOT EXISTS (SELECT 1 FROM grn_lines WHERE grn_id=v_grn AND line_no=3);
  END $grn6$;

  -- GRN-2026-003  PO-2026-007  NatGeneral  received 2026-02-08 (planned 2026-02-10: 2d EARLY = -2)
  INSERT INTO grn_headers (id,company_id,doc_no,po_id,supplier_id,warehouse_id,location_id,doc_date,
    status,posted_at,created_by_id,created_at,updated_at)
  SELECT gen_random_uuid()::text,v_cid,'GRN-2026-003',v_po_11,v_s_genrl,v_engg_wh,v_engg_store,'2026-02-08',
    'POSTED','2026-02-08',v_inv_mgr,now(),now()
  WHERE NOT EXISTS (SELECT 1 FROM grn_headers WHERE company_id=v_cid AND doc_no='GRN-2026-003');
  DO $grn7$ DECLARE v_grn TEXT; v_bin TEXT; BEGIN
    SELECT id INTO v_grn FROM grn_headers WHERE company_id=v_cid AND doc_no='GRN-2026-003';
    SELECT b.id INTO v_bin FROM bins b JOIN warehouses w ON b.warehouse_id=w.id WHERE w.company_id=v_cid AND w.code='ENGG_WH' AND b.code='RACK-A1' LIMIT 1;
    INSERT INTO grn_lines (id,grn_id,item_id,po_line_id,received_qty,accepted_qty,rejected_qty,bin_id,line_no)
    SELECT gen_random_uuid()::text,v_grn,pl.item_id,pl.id,20,20,0,v_bin,1
    FROM po_lines pl JOIN purchase_orders po ON pl.po_id=po.id WHERE po.doc_no='PO-2026-007' AND pl.line_no=1
      AND NOT EXISTS (SELECT 1 FROM grn_lines WHERE grn_id=v_grn AND line_no=1);
    INSERT INTO grn_lines (id,grn_id,item_id,po_line_id,received_qty,accepted_qty,rejected_qty,bin_id,line_no)
    SELECT gen_random_uuid()::text,v_grn,pl.item_id,pl.id,10,10,0,v_bin,2
    FROM po_lines pl JOIN purchase_orders po ON pl.po_id=po.id WHERE po.doc_no='PO-2026-007' AND pl.line_no=2
      AND NOT EXISTS (SELECT 1 FROM grn_lines WHERE grn_id=v_grn AND line_no=2);
  END $grn7$;

  RAISE NOTICE '✓ 7 GRN records created (POSTED)';

  -- ── 10. Stock Balances ────────────────────────────────────────────────────
  INSERT INTO stock_balances (id,item_id,warehouse_id,bin_id,qty_on_hand,qty_reserved,avg_cost,updated_at)
  SELECT gen_random_uuid()::text, i.id, w.id, b.id, sb.qty, 0, sb.cost, now()
  FROM (VALUES
    ('SPR-VBELT0096', 'ENGG_WH', 'RACK-A1', 15,  1.73),
    ('SPR-VBELT0092', 'ENGG_WH', 'RACK-A1',  8,  5.93),
    ('SPR-BEAR0012',  'ENGG_WH', 'RACK-A1',  5,  8.20),
    ('SPR-SEAL0005',  'ENGG_WH', 'RACK-A1', 10,  3.10),
    ('SPR-BEAR0034',  'ENGG_WH', 'RACK-A1', 12, 12.50),
    ('ELE-CABLE0010', 'MAIN_WH', 'BAY-01', 420,  2.80),
    ('ELE-FUSE0001',  'MAIN_WH', 'BAY-01',  18,  4.40),
    ('CHM-LUBE0001',  'MAIN_WH', 'BAY-01',  80, 36.50),
    ('CHM-GRSE0001',  'MAIN_WH', 'BAY-01',  20, 21.00),
    ('SFT-HLMT0001',  'ENGG_WH', 'RACK-A1', 45, 14.50),
    ('SFT-GLVE0001',  'ENGG_WH', 'RACK-A1', 90,  7.20),
    ('SFT-BOOT0001',  'ENGG_WH', 'RACK-A1', 25, 53.00)
  ) AS sb(item_code, wh_code, bin_code, qty, cost)
  JOIN items i ON i.company_id = v_cid AND i.code = sb.item_code
  JOIN warehouses w ON w.company_id = v_cid AND w.code = sb.wh_code
  JOIN bins b ON b.warehouse_id = w.id AND b.code = sb.bin_code
  ON CONFLICT (item_id, warehouse_id, bin_id) DO UPDATE
    SET qty_on_hand = EXCLUDED.qty_on_hand, avg_cost = EXCLUDED.avg_cost, updated_at = now();

  RAISE NOTICE '✓ 12 stock balances upserted';

  RAISE NOTICE '';
  RAISE NOTICE '=== Demo data inserted successfully! ===';
  RAISE NOTICE '  Users:     proc.mgr@demo.com / inv.mgr@demo.com  (Demo@123)';
  RAISE NOTICE '  Suppliers: 6   Items: 17 across 4 categories';
  RAISE NOTICE '  MRLs: 8   PRLs: 4   POs: 11   GRNs: 7';
END $$;

COMMIT;
