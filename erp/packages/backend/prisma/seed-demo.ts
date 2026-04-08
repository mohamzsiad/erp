/**
 * CloudERP — Demo Data Seeder
 * Inserts realistic procurement transactions so all 7 reports have meaningful data.
 * Run after the base seed: npx ts-node --project tsconfig.json prisma/seed-demo.ts
 */

import { PrismaClient, MrlStatus, PrlStatus, PoStatus, GrnStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ── helpers ────────────────────────────────────────────────────────────────────
const d = (iso: string) => new Date(iso);

async function main() {
  console.log('🌱 Inserting CloudERP demo data...\n');

  // ── Resolve base entities ──────────────────────────────────────────────────
  const company = await prisma.company.findFirstOrThrow({ where: { code: 'DEMO01' } });
  const cid = company.id;

  const [headOffice, enggStore, mainWarehouse] = await Promise.all([
    prisma.location.findFirstOrThrow({ where: { companyId: cid, code: 'HEAD_OFFICE' } }),
    prisma.location.findFirstOrThrow({ where: { companyId: cid, code: 'ENGG_STORE' } }),
    prisma.location.findFirstOrThrow({ where: { companyId: cid, code: 'MAIN_WH' } }),
  ]);

  const [engWh, mainWh] = await Promise.all([
    prisma.warehouse.findFirstOrThrow({ where: { companyId: cid, code: 'ENGG_WH' } }),
    prisma.warehouse.findFirstOrThrow({ where: { companyId: cid, code: 'MAIN_WH' } }),
  ]);

  const usdCurrency = await prisma.currency.findFirstOrThrow({ where: { companyId: cid, code: 'USD' } });

  const [costCode1, costCode2] = await Promise.all([
    prisma.costCode.findFirstOrThrow({ where: { companyId: cid, code: 'COSTCTRE1' } }),
    prisma.costCode.findFirstOrThrow({ where: { companyId: cid, code: 'COSTCTRE2' } }),
  ]);

  const procMgrRole = await prisma.role.findFirstOrThrow({ where: { companyId: cid, name: 'PROCUREMENT_MANAGER' } });
  const invMgrRole  = await prisma.role.findFirstOrThrow({ where: { companyId: cid, name: 'INVENTORY_MANAGER' } });
  const adminRole   = await prisma.role.findFirstOrThrow({ where: { companyId: cid, name: 'SYSTEM_ADMIN' } });
  const adminUser   = await prisma.user.findFirstOrThrow({ where: { companyId: cid, email: 'admin@demo.com' } });

  const bin1 = await prisma.bin.findFirstOrThrow({ where: { warehouseId: engWh.id, code: 'RACK-A1' } });
  const bin2 = await prisma.bin.findFirstOrThrow({ where: { warehouseId: mainWh.id, code: 'BAY-01' } });

  // ── 1. Additional Users ────────────────────────────────────────────────────
  console.log('Creating demo users...');
  const pwHash = await bcrypt.hash('Demo@123', 10);

  const procMgr = await prisma.user.upsert({
    where: { companyId_email: { companyId: cid, email: 'proc.mgr@demo.com' } },
    update: {},
    create: {
      companyId: cid, email: 'proc.mgr@demo.com', passwordHash: pwHash,
      firstName: 'Ahmed', lastName: 'Al-Rashidi',
      roleId: procMgrRole.id, locationId: headOffice.id, isActive: true,
    },
  });

  const invMgr = await prisma.user.upsert({
    where: { companyId_email: { companyId: cid, email: 'inv.mgr@demo.com' } },
    update: {},
    create: {
      companyId: cid, email: 'inv.mgr@demo.com', passwordHash: pwHash,
      firstName: 'Sara', lastName: 'Al-Balushi',
      roleId: invMgrRole.id, locationId: enggStore.id, isActive: true,
    },
  });
  console.log(`  ✓ 2 demo users (proc.mgr@demo.com / inv.mgr@demo.com — password: Demo@123)`);

  // ── 2. Additional UOMs ────────────────────────────────────────────────────
  console.log('Creating UOMs...');
  const uomMap: Record<string, string> = {};
  const uomDefs = [
    { code: 'NOS', name: 'Numbers',  symbol: 'NOS' },
    { code: 'PCS', name: 'Pieces',   symbol: 'PCS' },
    { code: 'MTR', name: 'Metres',   symbol: 'M'   },
    { code: 'KG',  name: 'Kilograms',symbol: 'KG'  },
    { code: 'LTR', name: 'Litres',   symbol: 'L'   },
    { code: 'BOX', name: 'Box',      symbol: 'BOX' },
    { code: 'SET', name: 'Set',      symbol: 'SET' },
  ];
  for (const u of uomDefs) {
    const rec = await prisma.uom.upsert({
      where: { companyId_code: { companyId: cid, code: u.code } },
      update: {},
      create: { companyId: cid, ...u },
    });
    uomMap[u.code] = rec.id;
  }
  console.log(`  ✓ ${uomDefs.length} UOMs`);

  // ── 3. Item Categories & More Items ───────────────────────────────────────
  console.log('Creating item categories and items...');

  const catEng = await prisma.itemCategory.upsert({
    where: { companyId_code: { companyId: cid, code: 'ENG' } },
    update: {},
    create: { companyId: cid, code: 'ENG', name: 'Engineering Spares' },
  });
  const catElec = await prisma.itemCategory.upsert({
    where: { companyId_code: { companyId: cid, code: 'ELEC' } },
    update: {},
    create: { companyId: cid, code: 'ELEC', name: 'Electrical & Instrumentation' },
  });
  const catChem = await prisma.itemCategory.upsert({
    where: { companyId_code: { companyId: cid, code: 'CHEM' } },
    update: {},
    create: { companyId: cid, code: 'CHEM', name: 'Chemicals & Lubricants' },
  });
  const catSafety = await prisma.itemCategory.upsert({
    where: { companyId_code: { companyId: cid, code: 'SAFE' } },
    update: {},
    create: { companyId: cid, code: 'SAFE', name: 'Safety & PPE' },
  });

  const itemDefs = [
    // Engineering
    { code: 'SPR-VBELT0096', desc: 'SPA 1150 V BELT',            catId: catEng.id,    uom: 'NOS', cost: 1.729 },
    { code: 'SPR-VBELT0021', desc: 'SPA 1180 V BELT',            catId: catEng.id,    uom: 'PCS', cost: 1.955 },
    { code: 'SPR-VBELT0092', desc: 'SPA 2732 V BELT',            catId: catEng.id,    uom: 'NOS', cost: 5.930 },
    { code: 'SPR-VBELT0093', desc: 'SPA 2282 V BELT',            catId: catEng.id,    uom: 'NOS', cost: 4.300 },
    { code: 'SPR-BEAR0012',  desc: '6205-2RS Deep Groove Bearing',catId: catEng.id,    uom: 'NOS', cost: 8.50  },
    { code: 'SPR-BEAR0034',  desc: '6306-Z Ball Bearing',         catId: catEng.id,    uom: 'NOS', cost: 12.75 },
    { code: 'SPR-SEAL0005',  desc: 'Oil Seal 40x62x8 NBR',        catId: catEng.id,    uom: 'PCS', cost: 3.20  },
    { code: 'SPR-PUMP0001',  desc: 'Centrifugal Pump 2" SS316',   catId: catEng.id,    uom: 'NOS', cost: 1250.00 },
    // Electrical
    { code: 'ELE-CABLE0010', desc: '2.5mm² Cu XLPE Cable (per m)',catId: catElec.id,   uom: 'MTR', cost: 2.85  },
    { code: 'ELE-CABLE0020', desc: '4mm² Cu XLPE Cable (per m)',  catId: catElec.id,   uom: 'MTR', cost: 4.10  },
    { code: 'ELE-LAMP0001',  desc: 'LED Flood Light 100W IP65',   catId: catElec.id,   uom: 'NOS', cost: 85.00 },
    { code: 'ELE-FUSE0001',  desc: '63A HRC Fuse Link',           catId: catElec.id,   uom: 'PCS', cost: 4.50  },
    // Chemicals
    { code: 'CHM-LUBE0001',  desc: 'Shell Tellus S2 M 46 (20L)',  catId: catChem.id,   uom: 'LTR', cost: 38.00 },
    { code: 'CHM-GRSE0001',  desc: 'Molykote BR2 Plus Grease 1KG',catId: catChem.id,   uom: 'KG',  cost: 22.50 },
    // Safety
    { code: 'SFT-HLMT0001',  desc: 'Safety Helmet Type II Yellow',catId: catSafety.id, uom: 'NOS', cost: 15.00 },
    { code: 'SFT-GLVE0001',  desc: 'Cut Resistant Gloves Lv5',    catId: catSafety.id, uom: 'PCS', cost: 7.50  },
    { code: 'SFT-BOOT0001',  desc: 'Safety Boot S3 Steel Toe',    catId: catSafety.id, uom: 'PCS', cost: 55.00 },
  ];

  const itemMap: Record<string, string> = {}; // code -> id
  for (const it of itemDefs) {
    const rec = await prisma.item.upsert({
      where: { companyId_code: { companyId: cid, code: it.code } },
      update: {},
      create: {
        companyId: cid, code: it.code, description: it.desc,
        categoryId: it.catId, uomId: uomMap[it.uom],
        grade1Options: ['NA'], grade2Options: ['NA'],
        standardCost: it.cost, reorderLevel: 5, reorderQty: 20, status: 'ACTIVE',
      },
    });
    itemMap[it.code] = rec.id;
  }
  console.log(`  ✓ ${itemDefs.length} Items across 4 categories`);

  // ── 4. Additional Suppliers ───────────────────────────────────────────────
  console.log('Creating suppliers...');
  const glAP = await prisma.glAccount.findFirstOrThrow({ where: { companyId: cid, code: '2300' } });

  const supplierDefs = [
    { code: 'MCLSA028', name: 'Aerotrans Global Forwarding LLC',  short: 'Aerotrans Global',    creditDays: 30 },
    { code: 'SUP-BTECH', name: 'Bearing Technology Solutions LLC', short: 'Bearing Tech',        creditDays: 45 },
    { code: 'SUP-ELECA', name: 'Al-Mansoori Electrical Supplies', short: 'Al-Mansoori Elec',    creditDays: 30 },
    { code: 'SUP-CHEMX', name: 'Gulf Chemical & Industrial Oils', short: 'Gulf Chemicals',      creditDays: 60 },
    { code: 'SUP-SAFEP', name: 'ProSafe Arabia FZE',              short: 'ProSafe Arabia',      creditDays: 30 },
    { code: 'SUP-GENRL', name: 'National General Trading Co.',    short: 'Natl General Trading', creditDays: 45 },
  ];

  const supplierMap: Record<string, string> = {};
  for (const s of supplierDefs) {
    const rec = await prisma.supplier.upsert({
      where: { companyId_code: { companyId: cid, code: s.code } },
      update: {},
      create: {
        companyId: cid, code: s.code, name: s.name, shortName: s.short,
        controlAccountId: glAP.id, creditDays: s.creditDays,
        creditAmount: 50000, shipmentMode: 'LAND', isActive: true, isParentSupplier: true,
      },
    });
    supplierMap[s.code] = rec.id;
  }
  console.log(`  ✓ ${supplierDefs.length} Suppliers`);

  // ── helper: next doc no ───────────────────────────────────────────────────
  async function nextDocNo(module: string, docType: string, prefix: string): Promise<string> {
    const seq = await prisma.docSequence.update({
      where: { companyId_module_docType: { companyId: cid, module, docType } },
      data: { nextNo: { increment: 1 } },
    });
    const no = seq.nextNo - 1;
    return `${prefix}${String(no).padStart(seq.padLength, '0')}`;
  }

  // ── 5. Material Requisitions (MRLs) ───────────────────────────────────────
  console.log('Creating Material Requisitions...');

  type MrlData = {
    docNo: string; docDate: string; locationId: string; status: MrlStatus;
    deliveryDate: string; chargeCodeId: string; createdById: string; approvedById?: string;
    lines: { itemCode: string; qty: number; approvedQty?: number; price: number }[];
  };

  const mrlDefs: MrlData[] = [
    // Oct 2025 — converted to PRL+PO (for tracking report)
    {
      docNo: 'MRL-2025-001', docDate: '2025-10-05', locationId: enggStore.id, status: MrlStatus.CONVERTED,
      deliveryDate: '2025-10-25', chargeCodeId: costCode1.id, createdById: procMgr.id, approvedById: adminUser.id,
      lines: [
        { itemCode: 'SPR-VBELT0096', qty: 20, approvedQty: 20, price: 1.73 },
        { itemCode: 'SPR-VBELT0092', qty: 10, approvedQty: 10, price: 5.93 },
      ],
    },
    // Nov 2025 — approved, converted
    {
      docNo: 'MRL-2025-002', docDate: '2025-11-12', locationId: enggStore.id, status: MrlStatus.CONVERTED,
      deliveryDate: '2025-12-05', chargeCodeId: costCode1.id, createdById: procMgr.id, approvedById: adminUser.id,
      lines: [
        { itemCode: 'SPR-BEAR0012', qty: 8, approvedQty: 8, price: 8.50 },
        { itemCode: 'SPR-SEAL0005', qty: 15, approvedQty: 15, price: 3.20 },
      ],
    },
    // Dec 2025 — approved
    {
      docNo: 'MRL-2025-003', docDate: '2025-12-03', locationId: enggStore.id, status: MrlStatus.APPROVED,
      deliveryDate: '2025-12-30', chargeCodeId: costCode1.id, createdById: procMgr.id, approvedById: adminUser.id,
      lines: [
        { itemCode: 'ELE-CABLE0010', qty: 500, approvedQty: 500, price: 2.85 },
        { itemCode: 'ELE-FUSE0001',  qty: 24, approvedQty: 24,  price: 4.50 },
      ],
    },
    // Jan 2026 — submitted, waiting approval
    {
      docNo: 'MRL-2026-001', docDate: '2026-01-07', locationId: mainWarehouse.id, status: MrlStatus.SUBMITTED,
      deliveryDate: '2026-01-28', chargeCodeId: costCode2.id, createdById: procMgr.id,
      lines: [
        { itemCode: 'CHM-LUBE0001', qty: 200, price: 38.00 },
        { itemCode: 'CHM-GRSE0001', qty: 50,  price: 22.50 },
      ],
    },
    // Feb 2026 — converted (recent)
    {
      docNo: 'MRL-2026-002', docDate: '2026-02-10', locationId: enggStore.id, status: MrlStatus.CONVERTED,
      deliveryDate: '2026-03-05', chargeCodeId: costCode1.id, createdById: procMgr.id, approvedById: adminUser.id,
      lines: [
        { itemCode: 'SFT-HLMT0001', qty: 50, approvedQty: 50, price: 15.00 },
        { itemCode: 'SFT-GLVE0001', qty: 100, approvedQty: 100, price: 7.50 },
        { itemCode: 'SFT-BOOT0001', qty: 30, approvedQty: 30, price: 55.00 },
      ],
    },
    // Mar 2026 — approved, pending PRL
    {
      docNo: 'MRL-2026-003', docDate: '2026-03-15', locationId: mainWarehouse.id, status: MrlStatus.APPROVED,
      deliveryDate: '2026-04-10', chargeCodeId: costCode2.id, createdById: procMgr.id, approvedById: adminUser.id,
      lines: [
        { itemCode: 'SPR-PUMP0001', qty: 2, approvedQty: 2, price: 1250.00 },
      ],
    },
    // Mar 2026 — draft (just created)
    {
      docNo: 'MRL-2026-004', docDate: '2026-03-28', locationId: enggStore.id, status: MrlStatus.DRAFT,
      deliveryDate: '2026-04-20', chargeCodeId: costCode1.id, createdById: procMgr.id,
      lines: [
        { itemCode: 'SPR-BEAR0034', qty: 6, price: 12.75 },
        { itemCode: 'SPR-SEAL0005', qty: 20, price: 3.20 },
      ],
    },
    // Apr 2026 — submitted (recent, overdue-ish)
    {
      docNo: 'MRL-2026-005', docDate: '2026-04-01', locationId: enggStore.id, status: MrlStatus.SUBMITTED,
      deliveryDate: '2026-04-22', chargeCodeId: costCode1.id, createdById: procMgr.id,
      lines: [
        { itemCode: 'ELE-LAMP0001', qty: 12, price: 85.00 },
        { itemCode: 'ELE-CABLE0020', qty: 300, price: 4.10 },
      ],
    },
  ];

  const mrlIds: Record<string, string> = {};
  for (const m of mrlDefs) {
    const existing = await prisma.materialRequisition.findFirst({ where: { companyId: cid, docNo: m.docNo } });
    let mrl;
    if (existing) {
      mrl = existing;
    } else {
      mrl = await prisma.materialRequisition.create({
        data: {
          companyId: cid, docNo: m.docNo, docDate: d(m.docDate),
          locationId: m.locationId, chargeCodeId: m.chargeCodeId,
          deliveryDate: d(m.deliveryDate), status: m.status,
          createdById: m.createdById, approvedById: m.approvedById ?? null,
          approvedAt: m.approvedById ? d(m.docDate) : null,
          lines: {
            create: m.lines.map((l, i) => ({
              itemId: itemMap[l.itemCode], uomId: uomMap['NOS'],
              requestedQty: l.qty, approvedQty: l.approvedQty ?? 0,
              approxPrice: l.price, lineNo: i + 1,
            })),
          },
        },
      });
    }
    mrlIds[m.docNo] = mrl.id;
  }
  console.log(`  ✓ ${mrlDefs.length} MRLs (DRAFT, SUBMITTED, APPROVED, CONVERTED)`);

  // ── 6. Purchase Requisitions (PRLs) ───────────────────────────────────────
  console.log('Creating Purchase Requisitions...');

  type PrlData = {
    docNo: string; docDate: string; mrlDocNo: string; locationId: string;
    chargeCodeId: string; status: PrlStatus; createdById: string;
    deliveryDate: string;
    lines: { itemCode: string; qty: number; price: number }[];
  };

  const prlDefs: PrlData[] = [
    {
      docNo: 'PRL-2025-001', docDate: '2025-10-06', mrlDocNo: 'MRL-2025-001',
      locationId: enggStore.id, chargeCodeId: costCode1.id,
      status: PrlStatus.PO_CREATED, createdById: procMgr.id, deliveryDate: '2025-10-25',
      lines: [
        { itemCode: 'SPR-VBELT0096', qty: 20, price: 1.73 },
        { itemCode: 'SPR-VBELT0092', qty: 10, price: 5.93 },
      ],
    },
    {
      docNo: 'PRL-2025-002', docDate: '2025-11-13', mrlDocNo: 'MRL-2025-002',
      locationId: enggStore.id, chargeCodeId: costCode1.id,
      status: PrlStatus.PO_CREATED, createdById: procMgr.id, deliveryDate: '2025-12-05',
      lines: [
        { itemCode: 'SPR-BEAR0012', qty: 8, price: 8.50 },
        { itemCode: 'SPR-SEAL0005', qty: 15, price: 3.20 },
      ],
    },
    {
      docNo: 'PRL-2026-001', docDate: '2026-02-11', mrlDocNo: 'MRL-2026-002',
      locationId: enggStore.id, chargeCodeId: costCode1.id,
      status: PrlStatus.PO_CREATED, createdById: procMgr.id, deliveryDate: '2026-03-05',
      lines: [
        { itemCode: 'SFT-HLMT0001', qty: 50, price: 15.00 },
        { itemCode: 'SFT-GLVE0001', qty: 100, price: 7.50 },
        { itemCode: 'SFT-BOOT0001', qty: 30, price: 55.00 },
      ],
    },
    // One approved PRL waiting for PO
    {
      docNo: 'PRL-2026-002', docDate: '2026-03-16', mrlDocNo: 'MRL-2026-003',
      locationId: mainWarehouse.id, chargeCodeId: costCode2.id,
      status: PrlStatus.APPROVED, createdById: procMgr.id, deliveryDate: '2026-04-10',
      lines: [
        { itemCode: 'SPR-PUMP0001', qty: 2, price: 1250.00 },
      ],
    },
  ];

  const prlIds: Record<string, string> = {};
  for (const p of prlDefs) {
    const existing = await prisma.purchaseRequisition.findFirst({ where: { companyId: cid, docNo: p.docNo } });
    let prl;
    if (existing) {
      prl = existing;
    } else {
      prl = await prisma.purchaseRequisition.create({
        data: {
          companyId: cid, docNo: p.docNo, docDate: d(p.docDate),
          locationId: p.locationId, chargeCodeId: p.chargeCodeId,
          deliveryDate: d(p.deliveryDate), status: p.status,
          mrlId: mrlIds[p.mrlDocNo] ?? null,
          createdById: p.createdById,
          lines: {
            create: p.lines.map((l, i) => ({
              itemId: itemMap[l.itemCode], uomId: uomMap['NOS'],
              requestedQty: l.qty, approvedQty: l.qty, approxPrice: l.price,
              chargeCodeId: p.chargeCodeId, lineNo: i + 1,
            })),
          },
        },
      });
    }
    prlIds[p.docNo] = prl.id;
  }
  console.log(`  ✓ ${prlDefs.length} PRLs`);

  // ── 7. Purchase Orders ────────────────────────────────────────────────────
  console.log('Creating Purchase Orders...');

  type PoData = {
    docNo: string; docDate: string; suppCode: string; status: PoStatus;
    deliveryDate: string; shipToLocationId: string; paymentTerms: string;
    createdById: string; approvedById?: string;
    lines: { itemCode: string; qty: number; price: number; received?: number }[];
  };

  const poDefs: PoData[] = [
    // PO-2025-001 — Oct 2025 — RECEIVED (early: planned 20d, actual 15d)
    {
      docNo: 'PO-2025-001', docDate: '2025-10-07', suppCode: 'MCLSA028',
      status: PoStatus.RECEIVED, deliveryDate: '2025-10-27',
      shipToLocationId: enggStore.id, paymentTerms: 'NET 30',
      createdById: procMgr.id, approvedById: adminUser.id,
      lines: [
        { itemCode: 'SPR-VBELT0096', qty: 20, price: 1.73, received: 20 },
        { itemCode: 'SPR-VBELT0092', qty: 10, price: 5.93, received: 10 },
      ],
    },
    // PO-2025-002 — Nov 2025 — RECEIVED (on time: planned 22d, actual 22d)
    {
      docNo: 'PO-2025-002', docDate: '2025-11-14', suppCode: 'SUP-BTECH',
      status: PoStatus.RECEIVED, deliveryDate: '2025-12-06',
      shipToLocationId: enggStore.id, paymentTerms: 'NET 45',
      createdById: procMgr.id, approvedById: adminUser.id,
      lines: [
        { itemCode: 'SPR-BEAR0012', qty: 8, price: 8.20, received: 8 },
        { itemCode: 'SPR-SEAL0005', qty: 15, price: 3.10, received: 15 },
      ],
    },
    // PO-2025-003 — Nov 2025 — RECEIVED (late: planned 14d, actual 21d)
    {
      docNo: 'PO-2025-003', docDate: '2025-11-20', suppCode: 'SUP-ELECA',
      status: PoStatus.RECEIVED, deliveryDate: '2025-12-04',
      shipToLocationId: mainWarehouse.id, paymentTerms: 'NET 30',
      createdById: procMgr.id, approvedById: adminUser.id,
      lines: [
        { itemCode: 'ELE-CABLE0010', qty: 500, price: 2.80, received: 500 },
        { itemCode: 'ELE-FUSE0001',  qty: 24,  price: 4.40, received: 24  },
      ],
    },
    // PO-2025-004 — Dec 2025 — PARTIAL (only some received)
    {
      docNo: 'PO-2025-004', docDate: '2025-12-10', suppCode: 'SUP-CHEMX',
      status: PoStatus.PARTIAL, deliveryDate: '2026-01-10',
      shipToLocationId: mainWarehouse.id, paymentTerms: 'NET 60',
      createdById: procMgr.id, approvedById: adminUser.id,
      lines: [
        { itemCode: 'CHM-LUBE0001', qty: 200, price: 36.50, received: 100 },
        { itemCode: 'CHM-GRSE0001', qty: 50,  price: 21.00, received: 25  },
      ],
    },
    // PO-2026-001 — Jan 2026 — RECEIVED (very late: planned 14d, actual 25d)
    {
      docNo: 'PO-2026-001', docDate: '2026-01-10', suppCode: 'SUP-BTECH',
      status: PoStatus.RECEIVED, deliveryDate: '2026-01-24',
      shipToLocationId: enggStore.id, paymentTerms: 'NET 45',
      createdById: procMgr.id, approvedById: adminUser.id,
      lines: [
        { itemCode: 'SPR-BEAR0034', qty: 12, price: 12.50, received: 12 },
      ],
    },
    // PO-2026-002 — Feb 2026 — RECEIVED (early)
    {
      docNo: 'PO-2026-002', docDate: '2026-02-12', suppCode: 'SUP-SAFEP',
      status: PoStatus.RECEIVED, deliveryDate: '2026-03-10',
      shipToLocationId: enggStore.id, paymentTerms: 'NET 30',
      createdById: procMgr.id, approvedById: adminUser.id,
      lines: [
        { itemCode: 'SFT-HLMT0001', qty: 50, price: 14.50, received: 50 },
        { itemCode: 'SFT-GLVE0001', qty: 100, price: 7.20, received: 100 },
        { itemCode: 'SFT-BOOT0001', qty: 30,  price: 53.00, received: 30 },
      ],
    },
    // PO-2026-003 — Feb 2026 — APPROVED (pending receipt)
    {
      docNo: 'PO-2026-003', docDate: '2026-02-25', suppCode: 'SUP-ELECA',
      status: PoStatus.APPROVED, deliveryDate: '2026-03-20',
      shipToLocationId: mainWarehouse.id, paymentTerms: 'NET 30',
      createdById: procMgr.id, approvedById: adminUser.id,
      lines: [
        { itemCode: 'ELE-LAMP0001',  qty: 12, price: 82.00 },
        { itemCode: 'ELE-CABLE0020', qty: 300, price: 4.00 },
      ],
    },
    // PO-2026-004 — Mar 2026 — APPROVED
    {
      docNo: 'PO-2026-004', docDate: '2026-03-05', suppCode: 'SUP-GENRL',
      status: PoStatus.APPROVED, deliveryDate: '2026-04-02',
      shipToLocationId: mainWarehouse.id, paymentTerms: 'NET 45',
      createdById: procMgr.id, approvedById: adminUser.id,
      lines: [
        { itemCode: 'SPR-VBELT0021', qty: 15, price: 1.90 },
        { itemCode: 'SPR-VBELT0093', qty: 8,  price: 4.20 },
      ],
    },
    // PO-2026-005 — Mar 2026 — SUBMITTED (awaiting approval)
    {
      docNo: 'PO-2026-005', docDate: '2026-03-18', suppCode: 'MCLSA028',
      status: PoStatus.SUBMITTED, deliveryDate: '2026-04-15',
      shipToLocationId: enggStore.id, paymentTerms: 'NET 30',
      createdById: procMgr.id,
      lines: [
        { itemCode: 'SPR-SEAL0005', qty: 40, price: 3.05 },
      ],
    },
    // PO-2026-006 — Apr 2026 — DRAFT (very recent)
    {
      docNo: 'PO-2026-006', docDate: '2026-04-02', suppCode: 'SUP-BTECH',
      status: PoStatus.DRAFT, deliveryDate: '2026-05-01',
      shipToLocationId: enggStore.id, paymentTerms: 'NET 45',
      createdById: procMgr.id,
      lines: [
        { itemCode: 'SPR-BEAR0012', qty: 6, price: 8.20 },
        { itemCode: 'SPR-BEAR0034', qty: 4, price: 12.40 },
      ],
    },
    // PO-2026-007 — price comparison: same items as PO-2025-001 but different price & supplier
    {
      docNo: 'PO-2026-007', docDate: '2026-01-20', suppCode: 'SUP-GENRL',
      status: PoStatus.RECEIVED, deliveryDate: '2026-02-10',
      shipToLocationId: enggStore.id, paymentTerms: 'NET 45',
      createdById: procMgr.id, approvedById: adminUser.id,
      lines: [
        { itemCode: 'SPR-VBELT0096', qty: 20, price: 1.85, received: 20 },
        { itemCode: 'SPR-VBELT0092', qty: 10, price: 6.20, received: 10 },
      ],
    },
  ];

  const poIds: Record<string, string> = {};
  const poLineIds: Record<string, string[]> = {}; // docNo -> [lineId,...]

  for (const po of poDefs) {
    const totalAmount = po.lines.reduce((s, l) => s + l.qty * l.price, 0);
    const existing = await prisma.purchaseOrder.findFirst({ where: { companyId: cid, docNo: po.docNo } });
    let poRec;
    if (existing) {
      poRec = existing;
      const lines = await prisma.poLine.findMany({ where: { poId: existing.id }, orderBy: { lineNo: 'asc' } });
      poLineIds[po.docNo] = lines.map(l => l.id);
    } else {
      poRec = await prisma.purchaseOrder.create({
        data: {
          companyId: cid, docNo: po.docNo, docDate: d(po.docDate),
          supplierId: supplierMap[po.suppCode],
          currencyId: usdCurrency.id, exchangeRate: 1,
          paymentTerms: po.paymentTerms, deliveryDate: d(po.deliveryDate),
          shipToLocationId: po.shipToLocationId,
          status: po.status,
          createdById: po.createdById, approvedById: po.approvedById ?? null,
          totalAmount,
          lines: {
            create: po.lines.map((l, i) => ({
              itemId: itemMap[l.itemCode], uomId: uomMap['NOS'],
              orderedQty: l.qty, receivedQty: l.received ?? 0, invoicedQty: 0,
              unitPrice: l.price, discountPct: 0, taxPct: 5,
              netAmount: l.qty * l.price,
              chargeCodeId: costCode1.id, lineNo: i + 1,
            })),
          },
        },
        include: { lines: true },
      });
      poLineIds[po.docNo] = (poRec as any).lines.map((l: any) => l.id);
    }
    poIds[po.docNo] = poRec.id;
  }
  console.log(`  ✓ ${poDefs.length} Purchase Orders (DRAFT, SUBMITTED, APPROVED, PARTIAL, RECEIVED)`);

  // ── 8. GRN Records (for RECEIVED & PARTIAL POs) ───────────────────────────
  console.log('Creating GRN records...');

  // GRN dates: actual receipt dates — some early, some late relative to PO delivery date
  const grnDefs = [
    // PO-2025-001 planned 2025-10-27, actual receipt 2025-10-22 (5d early → variance -5)
    { docNo: 'GRN-2025-001', poDocNo: 'PO-2025-001', suppCode: 'MCLSA028',
      grnDate: '2025-10-22', whId: engWh.id, locId: enggStore.id,
      lines: [
        { itemCode: 'SPR-VBELT0096', poLineIdx: 0, qty: 20 },
        { itemCode: 'SPR-VBELT0092', poLineIdx: 1, qty: 10 },
      ],
    },
    // PO-2025-002 planned 2025-12-06, actual receipt 2025-12-06 (on time → variance 0)
    { docNo: 'GRN-2025-002', poDocNo: 'PO-2025-002', suppCode: 'SUP-BTECH',
      grnDate: '2025-12-06', whId: engWh.id, locId: enggStore.id,
      lines: [
        { itemCode: 'SPR-BEAR0012', poLineIdx: 0, qty: 8 },
        { itemCode: 'SPR-SEAL0005', poLineIdx: 1, qty: 15 },
      ],
    },
    // PO-2025-003 planned 2025-12-04, actual receipt 2025-12-11 (7d late → variance +7)
    { docNo: 'GRN-2025-003', poDocNo: 'PO-2025-003', suppCode: 'SUP-ELECA',
      grnDate: '2025-12-11', whId: mainWh.id, locId: mainWarehouse.id,
      lines: [
        { itemCode: 'ELE-CABLE0010', poLineIdx: 0, qty: 500 },
        { itemCode: 'ELE-FUSE0001',  poLineIdx: 1, qty: 24 },
      ],
    },
    // PO-2025-004 partial: only 100 lube + 25 grease received
    { docNo: 'GRN-2025-004', poDocNo: 'PO-2025-004', suppCode: 'SUP-CHEMX',
      grnDate: '2026-01-05', whId: mainWh.id, locId: mainWarehouse.id,
      lines: [
        { itemCode: 'CHM-LUBE0001', poLineIdx: 0, qty: 100 },
        { itemCode: 'CHM-GRSE0001', poLineIdx: 1, qty: 25 },
      ],
    },
    // PO-2026-001 planned 2026-01-24, actual 2026-02-04 (11d late → variance +11)
    { docNo: 'GRN-2026-001', poDocNo: 'PO-2026-001', suppCode: 'SUP-BTECH',
      grnDate: '2026-02-04', whId: engWh.id, locId: enggStore.id,
      lines: [
        { itemCode: 'SPR-BEAR0034', poLineIdx: 0, qty: 12 },
      ],
    },
    // PO-2026-002 planned 2026-03-10, actual 2026-03-03 (7d early → variance -7)
    { docNo: 'GRN-2026-002', poDocNo: 'PO-2026-002', suppCode: 'SUP-SAFEP',
      grnDate: '2026-03-03', whId: engWh.id, locId: enggStore.id,
      lines: [
        { itemCode: 'SFT-HLMT0001', poLineIdx: 0, qty: 50 },
        { itemCode: 'SFT-GLVE0001', poLineIdx: 1, qty: 100 },
        { itemCode: 'SFT-BOOT0001', poLineIdx: 2, qty: 30 },
      ],
    },
    // PO-2026-007 planned 2026-02-10, actual 2026-02-08 (2d early → variance -2)
    { docNo: 'GRN-2026-003', poDocNo: 'PO-2026-007', suppCode: 'SUP-GENRL',
      grnDate: '2026-02-08', whId: engWh.id, locId: enggStore.id,
      lines: [
        { itemCode: 'SPR-VBELT0096', poLineIdx: 0, qty: 20 },
        { itemCode: 'SPR-VBELT0092', poLineIdx: 1, qty: 10 },
      ],
    },
  ];

  for (const g of grnDefs) {
    const existing = await prisma.grnHeader.findFirst({ where: { companyId: cid, docNo: g.docNo } });
    if (!existing) {
      const grnLineData = g.lines.map((l, i) => ({
        itemId: itemMap[l.itemCode],
        poLineId: poLineIds[g.poDocNo]?.[l.poLineIdx] ?? null,
        receivedQty: l.qty,
        acceptedQty: l.qty,
        rejectedQty: 0,
        binId: g.whId === engWh.id ? bin1.id : bin2.id,
        lineNo: i + 1,
      }));

      await prisma.grnHeader.create({
        data: {
          companyId: cid, docNo: g.docNo,
          poId: poIds[g.poDocNo],
          supplierId: supplierMap[g.suppCode],
          warehouseId: g.whId, locationId: g.locId,
          docDate: d(g.grnDate), status: GrnStatus.POSTED,
          postedAt: d(g.grnDate), createdById: invMgr.id,
          lines: { create: grnLineData },
        },
      });
    }
  }
  console.log(`  ✓ ${grnDefs.length} GRN records (POSTED)`);

  // ── 9. Stock Balances ─────────────────────────────────────────────────────
  console.log('Creating stock balances...');
  const stockItems = [
    { itemCode: 'SPR-VBELT0096', whId: engWh.id, binId: bin1.id, qty: 15, cost: 1.73 },
    { itemCode: 'SPR-VBELT0092', whId: engWh.id, binId: bin1.id, qty: 8,  cost: 5.93 },
    { itemCode: 'SPR-BEAR0012',  whId: engWh.id, binId: bin1.id, qty: 5,  cost: 8.20 },
    { itemCode: 'SPR-SEAL0005',  whId: engWh.id, binId: bin1.id, qty: 10, cost: 3.10 },
    { itemCode: 'SPR-BEAR0034',  whId: engWh.id, binId: bin1.id, qty: 12, cost: 12.50 },
    { itemCode: 'ELE-CABLE0010', whId: mainWh.id, binId: bin2.id, qty: 420, cost: 2.80 },
    { itemCode: 'ELE-FUSE0001',  whId: mainWh.id, binId: bin2.id, qty: 18, cost: 4.40 },
    { itemCode: 'CHM-LUBE0001',  whId: mainWh.id, binId: bin2.id, qty: 80, cost: 36.50 },
    { itemCode: 'CHM-GRSE0001',  whId: mainWh.id, binId: bin2.id, qty: 20, cost: 21.00 },
    { itemCode: 'SFT-HLMT0001',  whId: engWh.id, binId: bin1.id, qty: 45, cost: 14.50 },
    { itemCode: 'SFT-GLVE0001',  whId: engWh.id, binId: bin1.id, qty: 90, cost: 7.20 },
    { itemCode: 'SFT-BOOT0001',  whId: engWh.id, binId: bin1.id, qty: 25, cost: 53.00 },
  ];

  for (const sb of stockItems) {
    await prisma.stockBalance.upsert({
      where: { itemId_warehouseId_binId: { itemId: itemMap[sb.itemCode], warehouseId: sb.whId, binId: sb.binId } },
      update: { qtyOnHand: sb.qty, avgCost: sb.cost },
      create: { itemId: itemMap[sb.itemCode], warehouseId: sb.whId, binId: sb.binId, qtyOnHand: sb.qty, avgCost: sb.cost },
    });
  }
  console.log(`  ✓ ${stockItems.length} Stock balances`);

  // ── Done ──────────────────────────────────────────────────────────────────
  console.log('\n✅ Demo data inserted successfully!\n');
  console.log('Summary:');
  console.log('  • 2 extra users  (proc.mgr@demo.com, inv.mgr@demo.com — Demo@123)');
  console.log('  • 6 suppliers, 17 items across 4 categories');
  console.log(`  • ${mrlDefs.length} MRLs, ${prlDefs.length} PRLs, ${poDefs.length} POs, ${grnDefs.length} GRNs`);
  console.log('  • Stock balances for received goods');
  console.log('\nReports ready to use:');
  console.log('  ✓ PR Status             — 8 MRLs across all statuses');
  console.log('  ✓ PO Status             — 10 POs across all statuses');
  console.log('  ✓ PO History by Supplier— 6 suppliers with PO history');
  console.log('  ✓ Procurement Tracking  — MRL → PRL → PO conversion chains');
  console.log('  ✓ Lead Time Variance    — 7 GRNs vs planned delivery dates');
  console.log('  ✓ Price Comparison      — Same items across multiple suppliers');
  console.log('  ✓ Pending PRs           — MRLs not yet converted to PO');
}

main()
  .catch((e) => { console.error('❌ Demo seed failed:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
