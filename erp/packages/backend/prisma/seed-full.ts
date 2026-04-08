/**
 * CloudERP — Full 50-Record Seeder
 * Populates every major table with ~50 realistic records.
 *
 * Prerequisites:
 *   1. Base seed applied:  npx ts-node prisma/seed.ts
 *   2. Demo seed applied:  npx ts-node prisma/seed-demo.ts
 *
 * Run:
 *   cd packages/backend
 *   npx ts-node --project tsconfig.json prisma/seed-full.ts
 */

import {
  PrismaClient,
  LocationType,
  Module,
  PermissionAction,
  ShipmentMode,
  MrlStatus,
  PrlStatus,
  PoStatus,
  GrnStatus,
  ItemStatus,
  TrackingType,
  StockDocStatus,
  AccountType,
  JournalStatus,
  ApInvoiceStatus,
  PaymentMethod,
  CostCodeType,
  AuditAction,
} from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const d = (iso: string) => new Date(iso);
const fmt = (n: number) => String(n).padStart(3, '0');

// ── Seeded IDs registry ───────────────────────────────────────────────────────
let CID: string;
let adminUserId: string;
const itemMap:      Record<string, string> = {};
const uomMap:       Record<string, string> = {};
const warehouseMap: Record<string, string> = {};
const binMap:       Record<string, string> = {};
const supplierMap:  Record<string, string> = {};
const accountMap:   Record<string, string> = {};
const costCenterMap:Record<string, string> = {};
const costCodeMap:  Record<string, string> = {};
const userMap:      Record<string, string> = {};
const locationMap:  Record<string, string> = {};
const reasonMap:    Record<string, string> = {};
const currencyMap:  Record<string, string> = {};

// ── Helpers ───────────────────────────────────────────────────────────────────
async function upsertUom(code: string, name: string, symbol: string) {
  const r = await prisma.uom.upsert({
    where: { companyId_code: { companyId: CID, code } },
    update: {},
    create: { companyId: CID, code, name, symbol },
  });
  uomMap[code] = r.id;
  return r;
}

async function upsertItem(
  code: string, description: string, categoryId: string | null, uomCode: string,
  stdCost: number, reorderLevel: number, reorderQty: number,
  status: ItemStatus = ItemStatus.ACTIVE,
) {
  const r = await prisma.item.upsert({
    where: { companyId_code: { companyId: CID, code } },
    update: {},
    create: {
      companyId: CID, code, description, categoryId,
      uomId: uomMap[uomCode], standardCost: stdCost,
      reorderLevel, reorderQty, status,
      trackingType: TrackingType.NONE,
    },
  });
  itemMap[code] = r.id;
  return r;
}

// ═════════════════════════════════════════════════════════════════════════════
async function main() {
  console.log('🌱 CloudERP Full Seeder — 50 records per table\n');

  // ── 0. Resolve company + admin ────────────────────────────────────────────
  const company = await prisma.company.findFirstOrThrow({ where: { code: 'DEMO01' } });
  CID = company.id;
  const admin = await prisma.user.findFirstOrThrow({ where: { companyId: CID, email: 'admin@demo.com' } });
  adminUserId = admin.id;

  // Resolve existing maps
  const allUsers = await prisma.user.findMany({ where: { companyId: CID } });
  allUsers.forEach(u => { userMap[u.email] = u.id; });

  const allCurrencies = await prisma.currency.findMany({ where: { companyId: CID } });
  allCurrencies.forEach(c => { currencyMap[c.code] = c.id; });

  const allLocations = await prisma.location.findMany({ where: { companyId: CID } });
  allLocations.forEach(l => { locationMap[l.code] = l.id; });

  const allUoms = await prisma.uom.findMany({ where: { companyId: CID } });
  allUoms.forEach(u => { uomMap[u.code] = u.id; });

  const allItems = await prisma.item.findMany({ where: { companyId: CID } });
  allItems.forEach(i => { itemMap[i.code] = i.id; });

  const allWarehouses = await prisma.warehouse.findMany({ where: { companyId: CID } });
  allWarehouses.forEach(w => { warehouseMap[w.code] = w.id; });

  const allBins = await prisma.bin.findMany();
  allBins.forEach(b => { binMap[b.code] = b.id; });

  const allSuppliers = await prisma.supplier.findMany({ where: { companyId: CID } });
  allSuppliers.forEach(s => { supplierMap[s.code] = s.id; });

  const allAccounts = await prisma.glAccount.findMany({ where: { companyId: CID } });
  allAccounts.forEach(a => { accountMap[a.code] = a.id; });

  const allCostCenters = await prisma.costCenter.findMany({ where: { companyId: CID } });
  allCostCenters.forEach(c => { costCenterMap[c.code] = c.id; });

  const allCostCodes = await prisma.costCode.findMany({ where: { companyId: CID } });
  allCostCodes.forEach(c => { costCodeMap[c.code] = c.id; });

  const allReasons = await prisma.adjustmentReason.findMany({ where: { companyId: CID } });
  allReasons.forEach(r => { reasonMap[r.code] = r.id; });

  // ── 1. Locations (target: 10) ─────────────────────────────────────────────
  console.log('📍 Locations...');
  const newLocations = [
    { code: 'NORTH_WH',  name: 'North Warehouse',    type: LocationType.WAREHOUSE },
    { code: 'SOUTH_WH',  name: 'South Warehouse',    type: LocationType.WAREHOUSE },
    { code: 'EAST_OFF',  name: 'East Office',         type: LocationType.OFFICE    },
    { code: 'WEST_OFF',  name: 'West Office',         type: LocationType.OFFICE    },
    { code: 'PROD_SITE', name: 'Production Site',     type: LocationType.BRANCH    },
    { code: 'PORT_WH',   name: 'Port Warehouse',      type: LocationType.WAREHOUSE },
    { code: 'COLD_STR',  name: 'Cold Storage',        type: LocationType.WAREHOUSE },
  ];
  for (const loc of newLocations) {
    const r = await prisma.location.upsert({
      where: { companyId_code: { companyId: CID, code: loc.code } },
      update: {},
      create: { companyId: CID, ...loc, address: 'Muscat, Oman' },
    });
    locationMap[loc.code] = r.id;
  }
  console.log(`  ✓ Locations`);

  // ── 2. Roles + Users (target: 50 users) ──────────────────────────────────
  console.log('👤 Users...');
  const pwHash = await bcrypt.hash('Demo@123', 10);
  const baseRole = await prisma.role.findFirstOrThrow({ where: { companyId: CID, name: 'SYSTEM_ADMIN' } });

  // Extra roles
  const roleDefs = [
    { name: 'STORE_KEEPER',    desc: 'Inventory store keeper'   },
    { name: 'ACCOUNTANT',      desc: 'Finance accountant'       },
    { name: 'FINANCE_MANAGER', desc: 'Finance manager'          },
    { name: 'PURCHASE_CLERK',  desc: 'Purchase department clerk' },
    { name: 'STORE_MANAGER',   desc: 'Stores department manager' },
  ];
  const roleMap: Record<string, string> = {};
  for (const ro of roleDefs) {
    const r = await prisma.role.upsert({
      where: { companyId_name: { companyId: CID, name: ro.name } },
      update: {},
      create: { companyId: CID, name: ro.name, description: ro.desc, isSystem: false },
    });
    roleMap[ro.name] = r.id;
  }

  const firstNames = ['Ali','Omar','Salim','Khaled','Yusuf','Nasser','Hassan','Reem','Fatima','Sara',
                      'Maha','Layla','Dana','Hind','Noura','Wafa','Suha','Aisha','Dina','Rana'];
  const lastNames  = ['Al-Rashidi','Al-Balushi','Al-Harthi','Al-Habsi','Al-Siyabi','Al-Kindi',
                      'Al-Farsi','Al-Lawati','Al-Ghafri','Al-Wahaibi'];

  const userDefs = [
    { email: 'store1@demo.com',   role: 'STORE_KEEPER',    loc: 'ENGG_STORE' },
    { email: 'store2@demo.com',   role: 'STORE_KEEPER',    loc: 'MAIN_WH'    },
    { email: 'store3@demo.com',   role: 'STORE_MANAGER',   loc: 'NORTH_WH'   },
    { email: 'store4@demo.com',   role: 'STORE_KEEPER',    loc: 'SOUTH_WH'   },
    { email: 'acc1@demo.com',     role: 'ACCOUNTANT',      loc: 'HEAD_OFFICE' },
    { email: 'acc2@demo.com',     role: 'ACCOUNTANT',      loc: 'HEAD_OFFICE' },
    { email: 'acc3@demo.com',     role: 'ACCOUNTANT',      loc: 'EAST_OFF'   },
    { email: 'fin.mgr@demo.com',  role: 'FINANCE_MANAGER', loc: 'HEAD_OFFICE' },
    { email: 'purch1@demo.com',   role: 'PURCHASE_CLERK',  loc: 'HEAD_OFFICE' },
    { email: 'purch2@demo.com',   role: 'PURCHASE_CLERK',  loc: 'WEST_OFF'   },
  ];

  for (let i = 0; i < userDefs.length; i++) {
    const ud = userDefs[i];
    const fn = firstNames[i % firstNames.length];
    const ln = lastNames[i % lastNames.length];
    const loc = locationMap[ud.loc];
    const r = await prisma.user.upsert({
      where: { companyId_email: { companyId: CID, email: ud.email } },
      update: {},
      create: {
        companyId: CID, email: ud.email, passwordHash: pwHash,
        firstName: fn, lastName: ln,
        roleId: roleMap[ud.role] ?? baseRole.id,
        locationId: loc ?? null, isActive: true,
      },
    });
    userMap[ud.email] = r.id;
  }
  console.log(`  ✓ ${userDefs.length} new users`);

  // ── 3. Exchange Rates (target: 50) ────────────────────────────────────────
  console.log('💱 Exchange rates...');
  const fxCurrencies = ['EUR','GBP','OMR','AED'];
  const fxBase = [
    { code: 'EUR', rates: [0.92,0.93,0.91,0.90,0.92,0.93,0.91,0.92,0.90,0.91,0.92,0.93] },
    { code: 'GBP', rates: [0.79,0.80,0.78,0.79,0.80,0.78,0.79,0.80,0.78,0.79,0.80,0.78] },
    { code: 'OMR', rates: [0.385,0.384,0.385,0.386,0.385,0.384,0.385,0.386,0.385,0.384,0.385,0.386] },
    { code: 'AED', rates: [3.67,3.67,3.67,3.67,3.67,3.67,3.67,3.67,3.67,3.67,3.67,3.67] },
  ];
  const months = ['2025-01','2025-02','2025-03','2025-04','2025-05','2025-06',
                  '2025-07','2025-08','2025-09','2025-10','2025-11','2025-12'];
  for (const fx of fxBase) {
    if (!currencyMap[fx.code]) continue;
    for (let m = 0; m < months.length; m++) {
      const rateDate = new Date(`${months[m]}-01`);
      await prisma.exchangeRate.upsert({
        where: { currencyId_rateDate: { currencyId: currencyMap[fx.code], rateDate } },
        update: {},
        create: { currencyId: currencyMap[fx.code], rateDate, rate: fx.rates[m] },
      });
    }
  }
  console.log(`  ✓ ${fxBase.length * months.length} exchange rates`);

  // ── 4. UOMs (target: 12) ──────────────────────────────────────────────────
  console.log('📦 UOMs...');
  const newUoms = [
    { code: 'NOS',  name: 'Numbers',    symbol: 'NOS' },
    { code: 'PCS',  name: 'Pieces',     symbol: 'PCS' },
    { code: 'MTR',  name: 'Metres',     symbol: 'M'   },
    { code: 'KG',   name: 'Kilograms',  symbol: 'KG'  },
    { code: 'LTR',  name: 'Litres',     symbol: 'L'   },
    { code: 'BOX',  name: 'Box',        symbol: 'BOX' },
    { code: 'SET',  name: 'Set',        symbol: 'SET' },
    { code: 'TN',   name: 'Tonnes',     symbol: 'TN'  },
    { code: 'RL',   name: 'Roll',       symbol: 'RL'  },
    { code: 'BAG',  name: 'Bag',        symbol: 'BAG' },
    { code: 'DRM',  name: 'Drum',       symbol: 'DRM' },
    { code: 'PR',   name: 'Pair',       symbol: 'PR'  },
  ];
  for (const u of newUoms) await upsertUom(u.code, u.name, u.symbol);
  console.log(`  ✓ UOMs`);

  // ── 5. Item Categories ────────────────────────────────────────────────────
  console.log('🗂️  Item categories...');
  const catDefs = [
    { code: 'ENG',   name: 'Engineering Spares'  },
    { code: 'ELE',   name: 'Electrical'           },
    { code: 'CHM',   name: 'Chemicals & Lubricants'},
    { code: 'SFT',   name: 'Safety Equipment'     },
    { code: 'CIVIL', name: 'Civil & Construction' },
    { code: 'TOOL',  name: 'Tools & Hardware'     },
    { code: 'IT',    name: 'IT & Office Equipment'},
    { code: 'CONS',  name: 'Consumables'          },
    { code: 'PKG',   name: 'Packaging Materials'  },
    { code: 'AUTO',  name: 'Automotive'           },
  ];
  const catMap: Record<string, string> = {};
  for (const c of catDefs) {
    const r = await prisma.itemCategory.upsert({
      where: { companyId_code: { companyId: CID, code: c.code } },
      update: {},
      create: { companyId: CID, code: c.code, name: c.name },
    });
    catMap[c.code] = r.id;
  }
  console.log(`  ✓ ${catDefs.length} categories`);

  // ── 6. Items (target: 50) ─────────────────────────────────────────────────
  console.log('📦 Items...');
  const itemDefs = [
    // Engineering Spares
    { code: 'SPR-VBELT0096', cat: 'ENG', uom: 'NOS', cost: 1.73, rl: 20,  rq: 50  },
    { code: 'SPR-VBELT0092', cat: 'ENG', uom: 'NOS', cost: 5.93, rl: 10,  rq: 25  },
    { code: 'SPR-BEAR0012',  cat: 'ENG', uom: 'NOS', cost: 8.20, rl: 5,   rq: 20  },
    { code: 'SPR-SEAL0005',  cat: 'ENG', uom: 'NOS', cost: 3.10, rl: 15,  rq: 30  },
    { code: 'SPR-BEAR0034',  cat: 'ENG', uom: 'NOS', cost: 12.50,rl: 8,   rq: 20  },
    { code: 'SPR-VBELT0021', cat: 'ENG', uom: 'NOS', cost: 1.90, rl: 10,  rq: 25  },
    { code: 'SPR-VBELT0093', cat: 'ENG', uom: 'NOS', cost: 4.20, rl: 8,   rq: 20  },
    { code: 'SPR-COUP0001',  cat: 'ENG', uom: 'NOS', cost: 25.00,rl: 4,   rq: 10  },
    { code: 'SPR-GASKET001', cat: 'ENG', uom: 'SET', cost: 45.00,rl: 3,   rq: 10  },
    { code: 'SPR-IMPEL001',  cat: 'ENG', uom: 'NOS', cost: 180.00,rl: 2,  rq: 5   },
    // Electrical
    { code: 'ELE-CABLE0010', cat: 'ELE', uom: 'MTR', cost: 2.80, rl: 200, rq: 500 },
    { code: 'ELE-FUSE0001',  cat: 'ELE', uom: 'NOS', cost: 4.40, rl: 20,  rq: 50  },
    { code: 'ELE-LAMP0001',  cat: 'ELE', uom: 'NOS', cost: 82.00,rl: 5,   rq: 15  },
    { code: 'ELE-CABLE0020', cat: 'ELE', uom: 'MTR', cost: 4.00, rl: 100, rq: 300 },
    { code: 'ELE-SWCH0001',  cat: 'ELE', uom: 'NOS', cost: 12.50,rl: 10,  rq: 30  },
    { code: 'ELE-BRKR0001',  cat: 'ELE', uom: 'NOS', cost: 65.00,rl: 5,   rq: 15  },
    { code: 'ELE-TRNS0001',  cat: 'ELE', uom: 'NOS', cost: 320.00,rl: 2,  rq: 5   },
    { code: 'ELE-CONDUIT01', cat: 'ELE', uom: 'MTR', cost: 3.50, rl: 100, rq: 200 },
    // Chemicals
    { code: 'CHM-LUBE0001',  cat: 'CHM', uom: 'LTR', cost: 36.50,rl: 50,  rq: 100 },
    { code: 'CHM-GRSE0001',  cat: 'CHM', uom: 'KG',  cost: 21.00,rl: 20,  rq: 50  },
    { code: 'CHM-SOLV0001',  cat: 'CHM', uom: 'LTR', cost: 18.50,rl: 30,  rq: 60  },
    { code: 'CHM-ACID0001',  cat: 'CHM', uom: 'LTR', cost: 8.40, rl: 40,  rq: 80  },
    { code: 'CHM-PNTB0001',  cat: 'CHM', uom: 'LTR', cost: 22.00,rl: 20,  rq: 50  },
    { code: 'CHM-THNN0001',  cat: 'CHM', uom: 'LTR', cost: 6.50, rl: 30,  rq: 60  },
    // Safety Equipment
    { code: 'SFT-HLMT0001',  cat: 'SFT', uom: 'NOS', cost: 14.50,rl: 20,  rq: 50  },
    { code: 'SFT-GLVE0001',  cat: 'SFT', uom: 'PR',  cost: 7.20, rl: 50,  rq: 100 },
    { code: 'SFT-BOOT0001',  cat: 'SFT', uom: 'PR',  cost: 53.00,rl: 10,  rq: 30  },
    { code: 'SFT-VEST0001',  cat: 'SFT', uom: 'NOS', cost: 9.80, rl: 20,  rq: 50  },
    { code: 'SFT-GOGG0001',  cat: 'SFT', uom: 'NOS', cost: 5.50, rl: 30,  rq: 60  },
    { code: 'SFT-MASK0001',  cat: 'SFT', uom: 'BOX', cost: 28.00,rl: 10,  rq: 20  },
    // Tools & Hardware
    { code: 'TOOL-SPNR001',  cat: 'TOOL',uom: 'SET', cost: 85.00,rl: 2,   rq: 5   },
    { code: 'TOOL-DRIL001',  cat: 'TOOL',uom: 'NOS', cost: 120.00,rl: 2,  rq: 5   },
    { code: 'TOOL-GRND001',  cat: 'TOOL',uom: 'NOS', cost: 95.00,rl: 2,   rq: 5   },
    { code: 'TOOL-BOLT001',  cat: 'TOOL',uom: 'BOX', cost: 15.00,rl: 5,   rq: 20  },
    { code: 'TOOL-NUT0001',  cat: 'TOOL',uom: 'BOX', cost: 8.50, rl: 10,  rq: 30  },
    // Civil & Construction
    { code: 'CIVIL-CEMT01',  cat: 'CIVIL',uom: 'BAG', cost: 6.50,rl: 50,  rq: 200 },
    { code: 'CIVIL-SAND01',  cat: 'CIVIL',uom: 'TN',  cost: 25.00,rl: 5,  rq: 20  },
    { code: 'CIVIL-PIPE01',  cat: 'CIVIL',uom: 'MTR', cost: 12.00,rl: 50, rq: 100 },
    { code: 'CIVIL-WIRE01',  cat: 'CIVIL',uom: 'KG',  cost: 4.80, rl: 100,rq: 200 },
    // Consumables
    { code: 'CONS-PPPR001',  cat: 'CONS', uom: 'BOX', cost: 8.50,rl: 10,  rq: 30  },
    { code: 'CONS-TNER001',  cat: 'CONS', uom: 'NOS', cost: 42.00,rl: 3,  rq: 10  },
    { code: 'CONS-CLNR001',  cat: 'CONS', uom: 'LTR', cost: 4.20,rl: 20,  rq: 50  },
    // Automotive
    { code: 'AUTO-ENOF001',  cat: 'AUTO', uom: 'LTR', cost: 18.50,rl: 20, rq: 50  },
    { code: 'AUTO-BATT001',  cat: 'AUTO', uom: 'NOS', cost: 85.00,rl: 3,  rq: 10  },
    { code: 'AUTO-FILT001',  cat: 'AUTO', uom: 'NOS', cost: 12.50,rl: 10, rq: 30  },
    { code: 'AUTO-TIRE001',  cat: 'AUTO', uom: 'NOS', cost: 220.00,rl: 4, rq: 16  },
    // IT & Office
    { code: 'IT-MOUSE001',   cat: 'IT',   uom: 'NOS', cost: 15.00,rl: 5,  rq: 20  },
    { code: 'IT-KEYBD001',   cat: 'IT',   uom: 'NOS', cost: 25.00,rl: 5,  rq: 20  },
    { code: 'IT-CABL0001',   cat: 'IT',   uom: 'NOS', cost: 8.50, rl: 10, rq: 30  },
    { code: 'IT-HEADSET01',  cat: 'IT',   uom: 'NOS', cost: 45.00,rl: 3,  rq: 10  },
    // Dead/Inactive items (for aging report)
    { code: 'OLD-PART0001',  cat: 'ENG',  uom: 'NOS', cost: 55.00,rl: 0,  rq: 0, status: ItemStatus.DEAD     },
    { code: 'OLD-PART0002',  cat: 'ELE',  uom: 'NOS', cost: 30.00,rl: 0,  rq: 0, status: ItemStatus.INACTIVE },
    { code: 'OLD-PART0003',  cat: 'ENG',  uom: 'NOS', cost: 18.00,rl: 0,  rq: 0, status: ItemStatus.OBSOLETE },
  ];

  for (const item of itemDefs) {
    await upsertItem(
      item.code,
      item.code.replace(/-/g,' ') + ' — ' + (catDefs.find(c=>c.code===item.cat)?.name ?? item.cat),
      catMap[item.cat] ?? null,
      item.uom,
      item.cost,
      item.rl,
      item.rq,
      (item as any).status ?? ItemStatus.ACTIVE,
    );
  }
  console.log(`  ✓ ${itemDefs.length} items`);

  // ── 7. Warehouses + Bins (target: 5 WH, 50+ bins) ────────────────────────
  console.log('🏭 Warehouses & Bins...');
  const whDefs = [
    { code: 'ENGG_WH',  name: 'Engineering Warehouse',  loc: 'ENGG_STORE' },
    { code: 'MAIN_WH',  name: 'Main Warehouse',         loc: 'MAIN_WH'    },
    { code: 'NORTH_WH', name: 'North Warehouse',        loc: 'NORTH_WH'   },
    { code: 'SOUTH_WH', name: 'South Warehouse',        loc: 'SOUTH_WH'   },
    { code: 'COLD_WH',  name: 'Cold Storage Warehouse', loc: 'COLD_STR'   },
  ];
  for (const wh of whDefs) {
    const r = await prisma.warehouse.upsert({
      where: { companyId_code: { companyId: CID, code: wh.code } },
      update: {},
      create: {
        companyId: CID, code: wh.code, name: wh.name,
        locationId: locationMap[wh.loc] ?? allLocations[0].id,
        isActive: true,
      },
    });
    warehouseMap[wh.code] = r.id;
  }

  // Create ~10 bins per warehouse
  const binDefs: { wh: string; code: string; name: string }[] = [];
  for (const wh of whDefs) {
    ['RACK-A1','RACK-A2','RACK-B1','RACK-B2','RACK-C1',
     'BAY-01','BAY-02','SHELF-1','SHELF-2','FLOOR'].forEach(bc => {
      binDefs.push({ wh: wh.code, code: `${wh.code}-${bc}`, name: `${bc} in ${wh.name}` });
    });
  }
  for (const bin of binDefs) {
    const r = await prisma.bin.upsert({
      where: { warehouseId_code: { warehouseId: warehouseMap[bin.wh], code: bin.code } },
      update: {},
      create: { warehouseId: warehouseMap[bin.wh], code: bin.code, name: bin.name },
    });
    binMap[bin.code] = r.id;
  }
  console.log(`  ✓ ${whDefs.length} warehouses, ${binDefs.length} bins`);

  // ── 8. Suppliers (target: 50) ─────────────────────────────────────────────
  console.log('🏢 Suppliers...');
  const supplierDefs = [
    { code: 'MCLSA028',   name: 'McLaren Supply Arabia',         short: 'McLaren SA' },
    { code: 'SUP-BTECH',  name: 'Bearings & Technology LLC',     short: 'B-Tech'     },
    { code: 'SUP-ELECA',  name: 'Electra Arabia Co.',            short: 'Electra'    },
    { code: 'SUP-CHEMX',  name: 'ChemX International',           short: 'ChemX'      },
    { code: 'SUP-SAFEP',  name: 'SafePoint Products LLC',        short: 'SafePoint'  },
    { code: 'SUP-GENRL',  name: 'General Supplies Co.',          short: 'GenSupplies'},
    { code: 'SUP-CIVIL',  name: 'Oman Civil Suppliers',          short: 'OmanCivil'  },
    { code: 'SUP-TOOLS',  name: 'Gulf Tools Trading',            short: 'GulfTools'  },
    { code: 'SUP-AUTO',   name: 'Auto Parts Gulf',               short: 'AutoGulf'   },
    { code: 'SUP-ITPRO',  name: 'IT Pro Solutions',              short: 'IT Pro'     },
    { code: 'SUP-CONS',   name: 'Consumables Direct',            short: 'ConsDirect' },
    { code: 'SUP-PACK',   name: 'Packaging Masters',             short: 'PkgMasters' },
    { code: 'SUP-MECH',   name: 'Mechanical Parts Arabia',       short: 'MechArabia' },
    { code: 'SUP-PUMP',   name: 'Pump & Valve Specialists',      short: 'PumpValve'  },
    { code: 'SUP-INSTR',  name: 'Instrumentation Tech LLC',      short: 'InstrTech'  },
    { code: 'SUP-HYDR',   name: 'Hydraulics & Pneumatics Co.',   short: 'HydroPneu'  },
    { code: 'SUP-WELD',   name: 'Welding Supplies Oman',         short: 'WeldOman'   },
    { code: 'SUP-PAINT',  name: 'Paint & Coatings Arabia',       short: 'PaintArab'  },
    { code: 'SUP-PIPE',   name: 'Pipe & Fittings LLC',           short: 'PipeFit'    },
    { code: 'SUP-CABLE',  name: 'Cable Industries Oman',         short: 'CableOman'  },
  ];
  for (const s of supplierDefs) {
    const r = await prisma.supplier.upsert({
      where: { companyId_code: { companyId: CID, code: s.code } },
      update: {},
      create: {
        companyId: CID, code: s.code, name: s.name, shortName: s.short,
        creditDays: [30,45,60][supplierDefs.indexOf(s) % 3],
        creditAmount: 50000,
        shipmentMode: [ShipmentMode.LAND, ShipmentMode.AIR, ShipmentMode.SEA][supplierDefs.indexOf(s) % 3],
        isActive: true,
      },
    });
    supplierMap[s.code] = r.id;

    // Bank details for each supplier
    const bkCount = await prisma.supplierBankDetail.count({ where: { supplierId: r.id } });
    if (bkCount === 0) {
      await prisma.supplierBankDetail.create({
        data: {
          supplierId: r.id,
          bankName: ['Bank Muscat','HSBC Oman','BankDhofar','Ahli Bank','NBO'][supplierDefs.indexOf(s) % 5],
          accountNo: `ACC${String(supplierDefs.indexOf(s)).padStart(8,'0')}`,
          iban: `OM${String(supplierDefs.indexOf(s)).padStart(20,'0')}`,
          isActive: true,
        },
      });
    }

    // Contact for each supplier
    const ctCount = await prisma.supplierContact.count({ where: { supplierId: r.id } });
    if (ctCount === 0) {
      await prisma.supplierContact.create({
        data: {
          supplierId: r.id,
          name: `${firstNames[supplierDefs.indexOf(s) % firstNames.length]} Contact`,
          designation: 'Sales Manager',
          email: `sales@${s.code.toLowerCase()}.com`,
          phone: `+968 9${String(supplierDefs.indexOf(s)).padStart(7,'0')}`,
          isPrimary: true,
        },
      });
    }
  }
  console.log(`  ✓ ${supplierDefs.length} suppliers (+ bank details + contacts)`);

  // ── 9. GL Accounts (target: 50) ───────────────────────────────────────────
  console.log('📊 GL Accounts...');
  const glDefs = [
    // Assets
    { code: '1000', name: 'Cash in Hand',           type: AccountType.ASSET     },
    { code: '1010', name: 'Bank — Muscat',           type: AccountType.ASSET     },
    { code: '1020', name: 'Bank — HSBC',             type: AccountType.ASSET     },
    { code: '1100', name: 'Accounts Receivable',     type: AccountType.ASSET, isControl: true },
    { code: '1110', name: 'Trade Debtors',           type: AccountType.ASSET     },
    { code: '1200', name: 'Inventory — Engineering', type: AccountType.ASSET     },
    { code: '1210', name: 'Inventory — Electrical',  type: AccountType.ASSET     },
    { code: '1220', name: 'Inventory — Chemicals',   type: AccountType.ASSET     },
    { code: '1230', name: 'Inventory — Safety',      type: AccountType.ASSET     },
    { code: '1240', name: 'Inventory — General',     type: AccountType.ASSET     },
    { code: '1300', name: 'Prepaid Expenses',        type: AccountType.ASSET     },
    { code: '1400', name: 'Fixed Assets — Machinery',type: AccountType.ASSET     },
    { code: '1410', name: 'Fixed Assets — Vehicles', type: AccountType.ASSET     },
    { code: '1500', name: 'Accumulated Depreciation',type: AccountType.ASSET     },
    // Liabilities
    { code: '2000', name: 'Accounts Payable',        type: AccountType.LIABILITY, isControl: true },
    { code: '2010', name: 'Trade Creditors',         type: AccountType.LIABILITY },
    { code: '2100', name: 'Accrued Expenses',        type: AccountType.LIABILITY },
    { code: '2200', name: 'VAT Payable',             type: AccountType.LIABILITY },
    { code: '2300', name: 'Short-term Loans',        type: AccountType.LIABILITY },
    { code: '2400', name: 'Advance from Customers',  type: AccountType.LIABILITY },
    { code: '2500', name: 'Salary Payable',          type: AccountType.LIABILITY },
    { code: '2600', name: 'Long-term Loans',         type: AccountType.LIABILITY },
    // Equity
    { code: '3000', name: 'Share Capital',           type: AccountType.EQUITY    },
    { code: '3100', name: 'Retained Earnings',       type: AccountType.EQUITY    },
    { code: '3200', name: 'Dividends Paid',          type: AccountType.EQUITY    },
    // Revenue
    { code: '4000', name: 'Sales Revenue',           type: AccountType.REVENUE   },
    { code: '4010', name: 'Service Revenue',         type: AccountType.REVENUE   },
    { code: '4020', name: 'Other Income',            type: AccountType.REVENUE   },
    { code: '4030', name: 'Foreign Exchange Gain',   type: AccountType.REVENUE   },
    // Expenses
    { code: '5000', name: 'Cost of Goods Sold',      type: AccountType.EXPENSE   },
    { code: '5100', name: 'Engineering Consumables', type: AccountType.EXPENSE   },
    { code: '5110', name: 'Electrical Supplies',     type: AccountType.EXPENSE   },
    { code: '5120', name: 'Chemical & Lubricants',   type: AccountType.EXPENSE   },
    { code: '5130', name: 'Safety Equipment Exp.',   type: AccountType.EXPENSE   },
    { code: '5200', name: 'Salaries & Wages',        type: AccountType.EXPENSE   },
    { code: '5210', name: 'Employee Benefits',       type: AccountType.EXPENSE   },
    { code: '5300', name: 'Rent & Utilities',        type: AccountType.EXPENSE   },
    { code: '5310', name: 'Electricity',             type: AccountType.EXPENSE   },
    { code: '5320', name: 'Water',                   type: AccountType.EXPENSE   },
    { code: '5400', name: 'Depreciation Expense',    type: AccountType.EXPENSE   },
    { code: '5500', name: 'Vehicle Running Costs',   type: AccountType.EXPENSE   },
    { code: '5600', name: 'Office Supplies',         type: AccountType.EXPENSE   },
    { code: '5700', name: 'Travel & Entertainment',  type: AccountType.EXPENSE   },
    { code: '5800', name: 'Insurance',               type: AccountType.EXPENSE   },
    { code: '5900', name: 'Miscellaneous Expenses',  type: AccountType.EXPENSE   },
    { code: '5910', name: 'Foreign Exchange Loss',   type: AccountType.EXPENSE   },
    { code: '5920', name: 'Bank Charges',            type: AccountType.EXPENSE   },
    { code: '6000', name: 'Stock Write-off',         type: AccountType.EXPENSE   },
    { code: '6010', name: 'Inventory Adjustment',    type: AccountType.EXPENSE   },
    { code: '6020', name: 'Stock Obsolescence',      type: AccountType.EXPENSE   },
  ];
  for (const gl of glDefs) {
    const r = await prisma.glAccount.upsert({
      where: { companyId_code: { companyId: CID, code: gl.code } },
      update: {},
      create: {
        companyId: CID, code: gl.code, name: gl.name,
        accountType: gl.type, isControl: (gl as any).isControl ?? false,
        isActive: true,
      },
    });
    accountMap[gl.code] = r.id;
  }
  console.log(`  ✓ ${glDefs.length} GL accounts`);

  // ── 10. Cost Centers + Cost Codes (target: 10 CC, 20+ codes) ─────────────
  console.log('💼 Cost Centers & Codes...');
  const ccDefs = [
    { code: 'CC-MAINT',  name: 'Maintenance Department'  },
    { code: 'CC-PROD',   name: 'Production Department'   },
    { code: 'CC-ENGG',   name: 'Engineering Department'  },
    { code: 'CC-ADMIN',  name: 'Administration'          },
    { code: 'CC-FINCE',  name: 'Finance & Accounts'      },
    { code: 'CC-HR',     name: 'Human Resources'         },
    { code: 'CC-IT',     name: 'IT Department'           },
    { code: 'CC-SALES',  name: 'Sales Department'        },
    { code: 'CC-PROC',   name: 'Procurement Department'  },
    { code: 'CC-LOG',    name: 'Logistics & Warehouse'   },
  ];
  for (const cc of ccDefs) {
    const r = await prisma.costCenter.upsert({
      where: { companyId_code: { companyId: CID, code: cc.code } },
      update: {},
      create: { companyId: CID, code: cc.code, name: cc.name, isActive: true },
    });
    costCenterMap[cc.code] = r.id;
  }

  const codeDefs = [
    { code: 'COSTCTRE1', name: 'Cost Centre 1',           ccCode: 'CC-MAINT',  type: CostCodeType.COST_CENTER },
    { code: 'COSTCTRE2', name: 'Cost Centre 2',           ccCode: 'CC-PROD',   type: CostCodeType.COST_CENTER },
    { code: 'PROJ-001',  name: 'Plant Upgrade Project',   ccCode: 'CC-ENGG',   type: CostCodeType.PROJECT     },
    { code: 'PROJ-002',  name: 'Electrical Revamp',       ccCode: 'CC-ENGG',   type: CostCodeType.PROJECT     },
    { code: 'PROJ-003',  name: 'Safety Enhancement',      ccCode: 'CC-MAINT',  type: CostCodeType.PROJECT     },
    { code: 'PROJ-004',  name: 'Warehouse Expansion',     ccCode: 'CC-LOG',    type: CostCodeType.PROJECT     },
    { code: 'DEPT-ADM',  name: 'Admin Department Code',   ccCode: 'CC-ADMIN',  type: CostCodeType.DEPARTMENT  },
    { code: 'DEPT-FIN',  name: 'Finance Department Code', ccCode: 'CC-FINCE',  type: CostCodeType.DEPARTMENT  },
    { code: 'DEPT-HR',   name: 'HR Department Code',      ccCode: 'CC-HR',     type: CostCodeType.DEPARTMENT  },
    { code: 'DEPT-IT',   name: 'IT Department Code',      ccCode: 'CC-IT',     type: CostCodeType.DEPARTMENT  },
    { code: 'DEPT-PROC', name: 'Procurement Code',        ccCode: 'CC-PROC',   type: CostCodeType.DEPARTMENT  },
    { code: 'DEPT-LOG',  name: 'Logistics Code',          ccCode: 'CC-LOG',    type: CostCodeType.DEPARTMENT  },
    { code: 'DEPT-SALE', name: 'Sales Department Code',   ccCode: 'CC-SALES',  type: CostCodeType.DEPARTMENT  },
    { code: 'DEPT-PROD', name: 'Production Code',         ccCode: 'CC-PROD',   type: CostCodeType.DEPARTMENT  },
    { code: 'PROJ-005',  name: 'Civil Works 2026',        ccCode: 'CC-MAINT',  type: CostCodeType.PROJECT     },
  ];
  for (const cd of codeDefs) {
    const r = await prisma.costCode.upsert({
      where: { companyId_code: { companyId: CID, code: cd.code } },
      update: {},
      create: {
        companyId: CID, code: cd.code, name: cd.name,
        costCenterId: costCenterMap[cd.ccCode] ?? null,
        type: cd.type, isActive: true,
      },
    });
    costCodeMap[cd.code] = r.id;
  }
  console.log(`  ✓ ${ccDefs.length} cost centers, ${codeDefs.length} cost codes`);

  // ── 11. Adjustment Reasons ────────────────────────────────────────────────
  console.log('📝 Adjustment reasons...');
  const reasonDefs = [
    { code: 'DMGD',   name: 'Damaged Goods'           },
    { code: 'EXPRD',  name: 'Expired Items'            },
    { code: 'THEFT',  name: 'Theft / Missing'          },
    { code: 'CYCLC',  name: 'Cycle Count Variance'     },
    { code: 'WROFF',  name: 'Write-off'                },
    { code: 'RECLS',  name: 'Reclassification'         },
    { code: 'SAMP',   name: 'Sample / Testing'         },
    { code: 'RTRN',   name: 'Customer Return'          },
    { code: 'OVER',   name: 'Stock Overage'            },
    { code: 'UNDR',   name: 'Stock Shortage'           },
  ];
  for (const r of reasonDefs) {
    const rec = await prisma.adjustmentReason.upsert({
      where: { companyId_code: { companyId: CID, code: r.code } },
      update: {},
      create: { companyId: CID, code: r.code, name: r.name },
    });
    reasonMap[r.code] = rec.id;
  }
  console.log(`  ✓ ${reasonDefs.length} adjustment reasons`);

  // ── 12. Stock Balances (target: 50) ───────────────────────────────────────
  console.log('📊 Stock balances...');
  // Pick 3 warehouses and spread items across them
  const mainWhId  = warehouseMap['MAIN_WH'];
  const enggWhId  = warehouseMap['ENGG_WH'];
  const northWhId = warehouseMap['NORTH_WH'];

  const bin_main_a1  = binMap['MAIN_WH-RACK-A1'];
  const bin_main_a2  = binMap['MAIN_WH-RACK-A2'];
  const bin_engg_a1  = binMap['ENGG_WH-RACK-A1'];
  const bin_engg_b1  = binMap['ENGG_WH-RACK-B1'];
  const bin_north_a1 = binMap['NORTH_WH-BAY-01'];

  const stockBalanceDefs = [
    // Engg Warehouse
    { item:'SPR-VBELT0096', wh:enggWhId, bin:bin_engg_a1, qty: 15, cost: 1.73 },
    { item:'SPR-VBELT0092', wh:enggWhId, bin:bin_engg_a1, qty: 8,  cost: 5.93 },
    { item:'SPR-BEAR0012',  wh:enggWhId, bin:bin_engg_a1, qty: 5,  cost: 8.20 },
    { item:'SPR-SEAL0005',  wh:enggWhId, bin:bin_engg_a1, qty: 10, cost: 3.10 },
    { item:'SPR-BEAR0034',  wh:enggWhId, bin:bin_engg_a1, qty: 12, cost: 12.50 },
    { item:'SPR-COUP0001',  wh:enggWhId, bin:bin_engg_b1, qty: 6,  cost: 25.00 },
    { item:'SPR-GASKET001', wh:enggWhId, bin:bin_engg_b1, qty: 4,  cost: 45.00 },
    { item:'SFT-HLMT0001',  wh:enggWhId, bin:bin_engg_b1, qty: 45, cost: 14.50 },
    { item:'SFT-GLVE0001',  wh:enggWhId, bin:bin_engg_b1, qty: 90, cost: 7.20  },
    { item:'SFT-BOOT0001',  wh:enggWhId, bin:bin_engg_b1, qty: 25, cost: 53.00 },
    { item:'SFT-VEST0001',  wh:enggWhId, bin:bin_engg_a1, qty: 30, cost: 9.80  },
    { item:'SFT-GOGG0001',  wh:enggWhId, bin:bin_engg_a1, qty: 40, cost: 5.50  },
    { item:'TOOL-SPNR001',  wh:enggWhId, bin:bin_engg_b1, qty: 3,  cost: 85.00 },
    { item:'TOOL-DRIL001',  wh:enggWhId, bin:bin_engg_b1, qty: 2,  cost: 120.00},
    { item:'TOOL-BOLT001',  wh:enggWhId, bin:bin_engg_b1, qty: 8,  cost: 15.00 },
    // Main Warehouse
    { item:'ELE-CABLE0010', wh:mainWhId, bin:bin_main_a1, qty: 420,  cost: 2.80  },
    { item:'ELE-FUSE0001',  wh:mainWhId, bin:bin_main_a1, qty: 18,   cost: 4.40  },
    { item:'ELE-LAMP0001',  wh:mainWhId, bin:bin_main_a1, qty: 10,   cost: 82.00 },
    { item:'ELE-CABLE0020', wh:mainWhId, bin:bin_main_a2, qty: 180,  cost: 4.00  },
    { item:'ELE-SWCH0001',  wh:mainWhId, bin:bin_main_a2, qty: 22,   cost: 12.50 },
    { item:'CHM-LUBE0001',  wh:mainWhId, bin:bin_main_a2, qty: 80,   cost: 36.50 },
    { item:'CHM-GRSE0001',  wh:mainWhId, bin:bin_main_a2, qty: 20,   cost: 21.00 },
    { item:'CHM-SOLV0001',  wh:mainWhId, bin:bin_main_a1, qty: 40,   cost: 18.50 },
    { item:'CHM-PNTB0001',  wh:mainWhId, bin:bin_main_a1, qty: 30,   cost: 22.00 },
    { item:'CIVIL-CEMT01',  wh:mainWhId, bin:bin_main_a2, qty: 120,  cost: 6.50  },
    { item:'CIVIL-PIPE01',  wh:mainWhId, bin:bin_main_a2, qty: 80,   cost: 12.00 },
    { item:'CIVIL-WIRE01',  wh:mainWhId, bin:bin_main_a1, qty: 200,  cost: 4.80  },
    { item:'AUTO-ENOF001',  wh:mainWhId, bin:bin_main_a2, qty: 50,   cost: 18.50 },
    { item:'AUTO-BATT001',  wh:mainWhId, bin:bin_main_a2, qty: 8,    cost: 85.00 },
    { item:'AUTO-FILT001',  wh:mainWhId, bin:bin_main_a1, qty: 25,   cost: 12.50 },
    // North Warehouse
    { item:'SPR-VBELT0021', wh:northWhId, bin:bin_north_a1, qty: 18,  cost: 1.90  },
    { item:'SPR-VBELT0093', wh:northWhId, bin:bin_north_a1, qty: 12,  cost: 4.20  },
    { item:'CONS-PPPR001',  wh:northWhId, bin:bin_north_a1, qty: 25,  cost: 8.50  },
    { item:'CONS-TNER001',  wh:northWhId, bin:bin_north_a1, qty: 6,   cost: 42.00 },
    { item:'CONS-CLNR001',  wh:northWhId, bin:bin_north_a1, qty: 30,  cost: 4.20  },
    { item:'IT-MOUSE001',   wh:northWhId, bin:bin_north_a1, qty: 12,  cost: 15.00 },
    { item:'IT-KEYBD001',   wh:northWhId, bin:bin_north_a1, qty: 10,  cost: 25.00 },
    { item:'IT-CABL0001',   wh:northWhId, bin:bin_north_a1, qty: 20,  cost: 8.50  },
    // Aged / dead stock (low movement for aging report)
    { item:'OLD-PART0001',  wh:enggWhId, bin:bin_engg_a1, qty: 5,   cost: 55.00 },
    { item:'OLD-PART0002',  wh:mainWhId, bin:bin_main_a1, qty: 8,   cost: 30.00 },
    { item:'OLD-PART0003',  wh:enggWhId, bin:bin_engg_b1, qty: 3,   cost: 18.00 },
    // Below reorder items (for reorder report)
    { item:'SFT-MASK0001',  wh:enggWhId, bin:bin_engg_a1, qty: 2,   cost: 28.00 },
    { item:'ELE-BRKR0001',  wh:mainWhId, bin:bin_main_a1, qty: 1,   cost: 65.00 },
    { item:'SPR-IMPEL001',  wh:enggWhId, bin:bin_engg_b1, qty: 0,   cost: 180.00},
    { item:'AUTO-TIRE001',  wh:northWhId, bin:bin_north_a1, qty: 2,  cost: 220.00},
  ];

  for (const sb of stockBalanceDefs) {
    if (!itemMap[sb.item] || !sb.wh || !sb.bin) continue;
    await prisma.stockBalance.upsert({
      where: { itemId_warehouseId_binId: { itemId: itemMap[sb.item], warehouseId: sb.wh, binId: sb.bin } },
      update: { qtyOnHand: sb.qty, avgCost: sb.cost },
      create: { itemId: itemMap[sb.item], warehouseId: sb.wh, binId: sb.bin, qtyOnHand: sb.qty, avgCost: sb.cost },
    });
  }
  console.log(`  ✓ ${stockBalanceDefs.length} stock balances`);

  // ── 13. Stock Movements (50+ log entries) ─────────────────────────────────
  console.log('📈 Stock movements...');
  const movData = [
    // Engineering items — GRN receipts
    { item:'SPR-VBELT0096', wh:enggWhId,  bin:bin_engg_a1,  qty: 20,   cost:1.73,  bal:20,  type:'GRN',    docNo:'GRN-2025-001', date:'2025-10-22' },
    { item:'SPR-VBELT0092', wh:enggWhId,  bin:bin_engg_a1,  qty: 10,   cost:5.93,  bal:10,  type:'GRN',    docNo:'GRN-2025-001', date:'2025-10-22' },
    { item:'SPR-BEAR0012',  wh:enggWhId,  bin:bin_engg_a1,  qty: 8,    cost:8.20,  bal:8,   type:'GRN',    docNo:'GRN-2025-002', date:'2025-12-06' },
    { item:'SPR-SEAL0005',  wh:enggWhId,  bin:bin_engg_a1,  qty: 15,   cost:3.10,  bal:15,  type:'GRN',    docNo:'GRN-2025-002', date:'2025-12-06' },
    { item:'SPR-BEAR0034',  wh:enggWhId,  bin:bin_engg_a1,  qty: 12,   cost:12.50, bal:12,  type:'GRN',    docNo:'GRN-2026-001', date:'2026-02-04' },
    { item:'SFT-HLMT0001',  wh:enggWhId,  bin:bin_engg_b1,  qty: 50,   cost:14.50, bal:50,  type:'GRN',    docNo:'GRN-2026-002', date:'2026-03-03' },
    { item:'SFT-GLVE0001',  wh:enggWhId,  bin:bin_engg_b1,  qty: 100,  cost:7.20,  bal:100, type:'GRN',    docNo:'GRN-2026-002', date:'2026-03-03' },
    { item:'SFT-BOOT0001',  wh:enggWhId,  bin:bin_engg_b1,  qty: 30,   cost:53.00, bal:30,  type:'GRN',    docNo:'GRN-2026-002', date:'2026-03-03' },
    { item:'ELE-CABLE0010', wh:mainWhId,  bin:bin_main_a1,  qty: 500,  cost:2.80,  bal:500, type:'GRN',    docNo:'GRN-2025-003', date:'2025-12-11' },
    { item:'ELE-FUSE0001',  wh:mainWhId,  bin:bin_main_a1,  qty: 24,   cost:4.40,  bal:24,  type:'GRN',    docNo:'GRN-2025-003', date:'2025-12-11' },
    { item:'CHM-LUBE0001',  wh:mainWhId,  bin:bin_main_a2,  qty: 100,  cost:36.50, bal:100, type:'GRN',    docNo:'GRN-2025-004', date:'2026-01-05' },
    { item:'CHM-GRSE0001',  wh:mainWhId,  bin:bin_main_a2,  qty: 25,   cost:21.00, bal:25,  type:'GRN',    docNo:'GRN-2025-004', date:'2026-01-05' },
    // Issues
    { item:'SPR-VBELT0096', wh:enggWhId,  bin:bin_engg_a1,  qty: -5,   cost:1.73,  bal:15,  type:'ISSUE',  docNo:'ISS-2026-001', date:'2026-01-20' },
    { item:'SPR-BEAR0012',  wh:enggWhId,  bin:bin_engg_a1,  qty: -3,   cost:8.20,  bal:5,   type:'ISSUE',  docNo:'ISS-2026-001', date:'2026-01-20' },
    { item:'CHM-LUBE0001',  wh:mainWhId,  bin:bin_main_a2,  qty: -20,  cost:36.50, bal:80,  type:'ISSUE',  docNo:'ISS-2026-002', date:'2026-02-10' },
    { item:'SFT-HLMT0001',  wh:enggWhId,  bin:bin_engg_b1,  qty: -5,   cost:14.50, bal:45,  type:'ISSUE',  docNo:'ISS-2026-003', date:'2026-02-15' },
    { item:'ELE-CABLE0010', wh:mainWhId,  bin:bin_main_a1,  qty: -80,  cost:2.80,  bal:420, type:'ISSUE',  docNo:'ISS-2026-004', date:'2026-02-28' },
    { item:'SFT-GLVE0001',  wh:enggWhId,  bin:bin_engg_b1,  qty: -10,  cost:7.20,  bal:90,  type:'ISSUE',  docNo:'ISS-2026-005', date:'2026-03-05' },
    { item:'TOOL-SPNR001',  wh:enggWhId,  bin:bin_engg_b1,  qty: -1,   cost:85.00, bal:3,   type:'ISSUE',  docNo:'ISS-2026-005', date:'2026-03-05' },
    { item:'SPR-SEAL0005',  wh:enggWhId,  bin:bin_engg_a1,  qty: -5,   cost:3.10,  bal:10,  type:'ISSUE',  docNo:'ISS-2026-006', date:'2026-03-12' },
    // Adjustments
    { item:'SPR-VBELT0092', wh:enggWhId,  bin:bin_engg_a1,  qty: -2,   cost:5.93,  bal:8,   type:'ADJ',    docNo:'ADJ-2026-001', date:'2026-02-01' },
    { item:'ELE-FUSE0001',  wh:mainWhId,  bin:bin_main_a1,  qty: -6,   cost:4.40,  bal:18,  type:'ADJ',    docNo:'ADJ-2026-002', date:'2026-03-15' },
    { item:'CHM-GRSE0001',  wh:mainWhId,  bin:bin_main_a2,  qty: -5,   cost:21.00, bal:20,  type:'ADJ',    docNo:'ADJ-2026-003', date:'2026-03-20' },
    // Transfers
    { item:'SPR-VBELT0021', wh:northWhId, bin:bin_north_a1, qty: 20,   cost:1.90,  bal:18,  type:'XFER',   docNo:'TRF-2026-001', date:'2026-03-10' },
    { item:'SFT-VEST0001',  wh:enggWhId,  bin:bin_engg_a1,  qty: -10,  cost:9.80,  bal:30,  type:'XFER',   docNo:'TRF-2026-002', date:'2026-03-18' },
    // More GRNs for additional items
    { item:'SPR-COUP0001',  wh:enggWhId,  bin:bin_engg_b1,  qty: 6,    cost:25.00, bal:6,   type:'GRN',    docNo:'GRN-SUPP-001', date:'2026-01-15' },
    { item:'CIVIL-CEMT01',  wh:mainWhId,  bin:bin_main_a2,  qty: 200,  cost:6.50,  bal:200, type:'GRN',    docNo:'GRN-SUPP-002', date:'2026-01-25' },
    { item:'CIVIL-PIPE01',  wh:mainWhId,  bin:bin_main_a2,  qty: 100,  cost:12.00, bal:100, type:'GRN',    docNo:'GRN-SUPP-002', date:'2026-01-25' },
    { item:'AUTO-ENOF001',  wh:mainWhId,  bin:bin_main_a2,  qty: 60,   cost:18.50, bal:60,  type:'GRN',    docNo:'GRN-SUPP-003', date:'2026-02-05' },
    { item:'AUTO-BATT001',  wh:mainWhId,  bin:bin_main_a2,  qty: 10,   cost:85.00, bal:10,  type:'GRN',    docNo:'GRN-SUPP-003', date:'2026-02-05' },
    { item:'AUTO-FILT001',  wh:mainWhId,  bin:bin_main_a1,  qty: 30,   cost:12.50, bal:30,  type:'GRN',    docNo:'GRN-SUPP-003', date:'2026-02-05' },
    { item:'CONS-PPPR001',  wh:northWhId, bin:bin_north_a1, qty: 30,   cost:8.50,  bal:30,  type:'GRN',    docNo:'GRN-SUPP-004', date:'2026-02-20' },
    { item:'IT-MOUSE001',   wh:northWhId, bin:bin_north_a1, qty: 15,   cost:15.00, bal:15,  type:'GRN',    docNo:'GRN-SUPP-005', date:'2026-03-01' },
    { item:'IT-KEYBD001',   wh:northWhId, bin:bin_north_a1, qty: 12,   cost:25.00, bal:12,  type:'GRN',    docNo:'GRN-SUPP-005', date:'2026-03-01' },
    // More issues for complete movement history
    { item:'AUTO-ENOF001',  wh:mainWhId,  bin:bin_main_a2,  qty: -10,  cost:18.50, bal:50,  type:'ISSUE',  docNo:'ISS-2026-007', date:'2026-03-10' },
    { item:'CIVIL-CEMT01',  wh:mainWhId,  bin:bin_main_a2,  qty: -80,  cost:6.50,  bal:120, type:'ISSUE',  docNo:'ISS-2026-008', date:'2026-03-15' },
    { item:'AUTO-BATT001',  wh:mainWhId,  bin:bin_main_a2,  qty: -2,   cost:85.00, bal:8,   type:'ISSUE',  docNo:'ISS-2026-009', date:'2026-03-25' },
    { item:'CONS-PPPR001',  wh:northWhId, bin:bin_north_a1, qty: -5,   cost:8.50,  bal:25,  type:'ISSUE',  docNo:'ISS-2026-010', date:'2026-03-30' },
    { item:'IT-MOUSE001',   wh:northWhId, bin:bin_north_a1, qty: -3,   cost:15.00, bal:12,  type:'ISSUE',  docNo:'ISS-2026-010', date:'2026-03-30' },
    // Old stock — last movement is very old (dead stock test)
    { item:'OLD-PART0001',  wh:enggWhId,  bin:bin_engg_a1,  qty: 5,    cost:55.00, bal:5,   type:'GRN',    docNo:'GRN-2024-999', date:'2024-06-01' },
    { item:'OLD-PART0002',  wh:mainWhId,  bin:bin_main_a1,  qty: 8,    cost:30.00, bal:8,   type:'GRN',    docNo:'GRN-2024-999', date:'2024-09-15' },
    { item:'OLD-PART0003',  wh:enggWhId,  bin:bin_engg_b1,  qty: 3,    cost:18.00, bal:3,   type:'GRN',    docNo:'GRN-2023-001', date:'2023-01-10' },
  ];

  let movInserted = 0;
  for (const mv of movData) {
    if (!itemMap[mv.item] || !mv.wh || !mv.bin) continue;
    const existing = await prisma.stockMovement.findFirst({
      where: { sourceDocNo: mv.docNo, itemId: itemMap[mv.item], warehouseId: mv.wh },
    });
    if (!existing) {
      await prisma.stockMovement.create({
        data: {
          itemId: itemMap[mv.item],
          warehouseId: mv.wh,
          binId: mv.bin,
          qty: mv.qty,
          avgCost: mv.cost,
          balanceAfter: mv.bal,
          transactionType: mv.type,
          sourceDocId: `doc-${mv.docNo}`,
          sourceDocNo: mv.docNo,
          companyId: CID,
          userId: adminUserId,
          createdAt: new Date(mv.date),
        },
      });
      movInserted++;
    }
  }
  console.log(`  ✓ ${movInserted} stock movements`);

  // ── 14. Stock Issues (10 docs × 5 lines) ──────────────────────────────────
  console.log('📤 Stock issues...');
  const issueDefs = [
    { docNo:'ISS-2026-001', date:'2026-01-20', wh:'ENGG_WH', cc:'COSTCTRE1', user:'store1@demo.com',
      lines:[ {item:'SPR-VBELT0096',qty:5,cost:1.73}, {item:'SPR-BEAR0012',qty:3,cost:8.20} ] },
    { docNo:'ISS-2026-002', date:'2026-02-10', wh:'MAIN_WH', cc:'COSTCTRE2', user:'store2@demo.com',
      lines:[ {item:'CHM-LUBE0001',qty:20,cost:36.50}, {item:'CHM-GRSE0001',qty:5,cost:21.00} ] },
    { docNo:'ISS-2026-003', date:'2026-02-15', wh:'ENGG_WH', cc:'PROJ-001', user:'store1@demo.com',
      lines:[ {item:'SFT-HLMT0001',qty:5,cost:14.50}, {item:'SFT-GLVE0001',qty:10,cost:7.20} ] },
    { docNo:'ISS-2026-004', date:'2026-02-28', wh:'MAIN_WH', cc:'PROJ-001', user:'store2@demo.com',
      lines:[ {item:'ELE-CABLE0010',qty:80,cost:2.80}, {item:'ELE-FUSE0001',qty:6,cost:4.40} ] },
    { docNo:'ISS-2026-005', date:'2026-03-05', wh:'ENGG_WH', cc:'COSTCTRE1', user:'store1@demo.com',
      lines:[ {item:'SFT-GLVE0001',qty:10,cost:7.20}, {item:'TOOL-SPNR001',qty:1,cost:85.00}, {item:'SPR-SEAL0005',qty:5,cost:3.10} ] },
    { docNo:'ISS-2026-006', date:'2026-03-12', wh:'ENGG_WH', cc:'PROJ-003', user:'store1@demo.com',
      lines:[ {item:'SFT-VEST0001',qty:8,cost:9.80}, {item:'SFT-GOGG0001',qty:10,cost:5.50} ] },
    { docNo:'ISS-2026-007', date:'2026-03-10', wh:'MAIN_WH', cc:'DEPT-LOG', user:'store2@demo.com',
      lines:[ {item:'AUTO-ENOF001',qty:10,cost:18.50} ] },
    { docNo:'ISS-2026-008', date:'2026-03-15', wh:'MAIN_WH', cc:'PROJ-005', user:'store2@demo.com',
      lines:[ {item:'CIVIL-CEMT01',qty:80,cost:6.50}, {item:'CIVIL-PIPE01',qty:20,cost:12.00} ] },
    { docNo:'ISS-2026-009', date:'2026-03-25', wh:'MAIN_WH', cc:'DEPT-LOG', user:'store2@demo.com',
      lines:[ {item:'AUTO-BATT001',qty:2,cost:85.00}, {item:'AUTO-FILT001',qty:5,cost:12.50} ] },
    { docNo:'ISS-2026-010', date:'2026-03-30', wh:'NORTH_WH', cc:'DEPT-ADM', user:'store3@demo.com',
      lines:[ {item:'CONS-PPPR001',qty:5,cost:8.50}, {item:'IT-MOUSE001',qty:3,cost:15.00}, {item:'IT-KEYBD001',qty:2,cost:25.00} ] },
  ];

  for (const iss of issueDefs) {
    const existing = await prisma.stockIssue.findFirst({ where: { companyId: CID, docNo: iss.docNo } });
    if (!existing) {
      const uid = userMap[iss.user] ?? adminUserId;
      const whId = warehouseMap[iss.wh];
      const ccId = costCodeMap[iss.cc];
      if (!whId || !ccId) continue;
      await prisma.stockIssue.create({
        data: {
          companyId: CID, docNo: iss.docNo,
          docDate: new Date(iss.date),
          warehouseId: whId, chargeCodeId: ccId,
          status: StockDocStatus.POSTED,
          createdById: uid,
          lines: {
            create: iss.lines.map((l, i) => ({
              itemId: itemMap[l.item],
              binId: iss.wh === 'ENGG_WH' ? bin_engg_a1 : iss.wh === 'MAIN_WH' ? bin_main_a1 : bin_north_a1,
              issuedQty: l.qty,
              uomId: uomMap['NOS'] ?? allUoms[0].id,
              avgCost: l.cost,
              lineNo: i + 1,
            })),
          },
        },
      });
    }
  }
  console.log(`  ✓ ${issueDefs.length} stock issues`);

  // ── 15. Stock Transfers (10 docs) ─────────────────────────────────────────
  console.log('🔄 Stock transfers...');
  const transferDefs = [
    { docNo:'TRF-2026-001', date:'2026-03-10', from:'ENGG_WH', to:'NORTH_WH',
      lines:[ {item:'SPR-VBELT0021',qty:20}, {item:'SFT-VEST0001',qty:5} ] },
    { docNo:'TRF-2026-002', date:'2026-03-18', from:'MAIN_WH', to:'ENGG_WH',
      lines:[ {item:'SFT-GLVE0001',qty:20}, {item:'SFT-GOGG0001',qty:10} ] },
    { docNo:'TRF-2026-003', date:'2026-03-20', from:'MAIN_WH', to:'NORTH_WH',
      lines:[ {item:'CONS-PPPR001',qty:10}, {item:'CONS-TNER001',qty:2} ] },
    { docNo:'TRF-2026-004', date:'2026-03-22', from:'NORTH_WH', to:'MAIN_WH',
      lines:[ {item:'IT-MOUSE001',qty:5}, {item:'IT-KEYBD001',qty:3} ] },
    { docNo:'TRF-2026-005', date:'2026-03-25', from:'ENGG_WH', to:'MAIN_WH',
      lines:[ {item:'TOOL-BOLT001',qty:3}, {item:'TOOL-NUT0001',qty:5} ] },
    { docNo:'TRF-2026-006', date:'2026-03-28', from:'MAIN_WH', to:'ENGG_WH',
      lines:[ {item:'CHM-SOLV0001',qty:10}, {item:'CHM-PNTB0001',qty:8} ] },
    { docNo:'TRF-2026-007', date:'2026-04-01', from:'NORTH_WH', to:'ENGG_WH',
      lines:[ {item:'SFT-HLMT0001',qty:5} ] },
    { docNo:'TRF-2026-008', date:'2026-04-02', from:'MAIN_WH', to:'NORTH_WH',
      lines:[ {item:'AUTO-FILT001',qty:5}, {item:'CIVIL-WIRE01',qty:50} ] },
    { docNo:'TRF-2026-009', date:'2026-04-03', from:'ENGG_WH', to:'NORTH_WH',
      lines:[ {item:'SPR-VBELT0096',qty:3}, {item:'SPR-SEAL0005',qty:4} ] },
    { docNo:'TRF-2026-010', date:'2026-04-04', from:'MAIN_WH', to:'ENGG_WH',
      lines:[ {item:'ELE-SWCH0001',qty:5}, {item:'ELE-CABLE0020',qty:50} ] },
  ];

  for (const tf of transferDefs) {
    const existing = await prisma.stockTransfer.findFirst({ where: { companyId: CID, docNo: tf.docNo } });
    if (!existing) {
      const fromWh = warehouseMap[tf.from];
      const toWh   = warehouseMap[tf.to];
      if (!fromWh || !toWh) continue;
      await prisma.stockTransfer.create({
        data: {
          companyId: CID, docNo: tf.docNo,
          docDate: new Date(tf.date),
          fromWarehouseId: fromWh, toWarehouseId: toWh,
          status: StockDocStatus.POSTED,
          createdById: adminUserId,
          lines: {
            create: tf.lines.map((l, i) => ({
              itemId: itemMap[l.item],
              fromBinId: tf.from === 'ENGG_WH' ? bin_engg_a1 : bin_main_a1,
              toBinId:   tf.to   === 'ENGG_WH' ? bin_engg_a1 : bin_north_a1,
              transferQty: l.qty,
              uomId: uomMap['NOS'] ?? allUoms[0].id,
              lineNo: i + 1,
            })),
          },
        },
      });
    }
  }
  console.log(`  ✓ ${transferDefs.length} stock transfers`);

  // ── 16. Stock Adjustments (10 docs) ───────────────────────────────────────
  console.log('🔧 Stock adjustments...');
  const adjDefs = [
    { docNo:'ADJ-2026-001', date:'2026-02-01', wh:'ENGG_WH', reason:'CYCLC',
      lines:[ {item:'SPR-VBELT0092',sys:10,phy:8,cost:5.93} ] },
    { docNo:'ADJ-2026-002', date:'2026-03-15', wh:'MAIN_WH', reason:'DMGD',
      lines:[ {item:'ELE-FUSE0001',sys:24,phy:18,cost:4.40} ] },
    { docNo:'ADJ-2026-003', date:'2026-03-20', wh:'MAIN_WH', reason:'EXPRD',
      lines:[ {item:'CHM-GRSE0001',sys:25,phy:20,cost:21.00} ] },
    { docNo:'ADJ-2026-004', date:'2026-03-22', wh:'ENGG_WH', reason:'THEFT',
      lines:[ {item:'TOOL-DRIL001',sys:3,phy:2,cost:120.00} ] },
    { docNo:'ADJ-2026-005', date:'2026-03-28', wh:'NORTH_WH', reason:'CYCLC',
      lines:[ {item:'IT-CABL0001',sys:25,phy:20,cost:8.50}, {item:'CONS-CLNR001',sys:35,phy:30,cost:4.20} ] },
    { docNo:'ADJ-2026-006', date:'2026-04-01', wh:'MAIN_WH', reason:'WROFF',
      lines:[ {item:'OLD-PART0002',sys:8,phy:0,cost:30.00} ] },
    { docNo:'ADJ-2026-007', date:'2026-04-02', wh:'ENGG_WH', reason:'WROFF',
      lines:[ {item:'OLD-PART0001',sys:5,phy:2,cost:55.00} ] },
    { docNo:'ADJ-2026-008', date:'2026-04-03', wh:'MAIN_WH', reason:'SAMP',
      lines:[ {item:'CHM-SOLV0001',sys:40,phy:38,cost:18.50} ] },
    { docNo:'ADJ-2026-009', date:'2026-04-04', wh:'ENGG_WH', reason:'OVER',
      lines:[ {item:'SFT-MASK0001',sys:2,phy:4,cost:28.00} ] },
    { docNo:'ADJ-2026-010', date:'2026-04-05', wh:'NORTH_WH', reason:'CYCLC',
      lines:[ {item:'CONS-PPPR001',sys:25,phy:22,cost:8.50}, {item:'IT-MOUSE001',sys:12,phy:11,cost:15.00} ] },
  ];

  for (const adj of adjDefs) {
    const existing = await prisma.stockAdjustment.findFirst({ where: { companyId: CID, docNo: adj.docNo } });
    if (!existing) {
      const whId = warehouseMap[adj.wh];
      const rid  = reasonMap[adj.reason];
      if (!whId || !rid) continue;
      await prisma.stockAdjustment.create({
        data: {
          companyId: CID, docNo: adj.docNo,
          docDate: new Date(adj.date),
          warehouseId: whId, reasonId: rid,
          status: StockDocStatus.APPROVED,
          approvedById: adminUserId,
          createdById: userMap['store1@demo.com'] ?? adminUserId,
          lines: {
            create: adj.lines.map((l, i) => ({
              itemId: itemMap[l.item],
              binId: adj.wh === 'ENGG_WH' ? bin_engg_a1 : adj.wh === 'MAIN_WH' ? bin_main_a1 : bin_north_a1,
              systemQty: l.sys,
              physicalQty: l.phy,
              varianceQty: l.phy - l.sys,
              uomId: uomMap['NOS'] ?? allUoms[0].id,
              avgCost: l.cost,
              lineNo: i + 1,
            })),
          },
        },
      });
    }
  }
  console.log(`  ✓ ${adjDefs.length} stock adjustments`);

  // ── 17. Journal Entries (25 docs) ─────────────────────────────────────────
  console.log('📒 Journal entries...');

  const journalDefs = [
    // Opening balances
    { docNo:'JV-2025-001', date:'2025-01-01', desc:'Opening Balance — Cash',
      status: JournalStatus.POSTED,
      lines:[ {acc:'1010',dr:500000,cr:0,cc:'CC-FINCE'}, {acc:'3100',dr:0,cr:500000,cc:'CC-FINCE'} ] },
    { docNo:'JV-2025-002', date:'2025-01-01', desc:'Opening Balance — Inventory',
      status: JournalStatus.POSTED,
      lines:[ {acc:'1200',dr:125000,cr:0,cc:'CC-LOG'}, {acc:'3100',dr:0,cr:125000,cc:'CC-LOG'} ] },
    // Monthly expenses
    { docNo:'JV-2025-010', date:'2025-01-31', desc:'Salary Expense — January 2025',
      status: JournalStatus.POSTED,
      lines:[ {acc:'5200',dr:85000,cr:0,cc:'CC-HR'}, {acc:'2500',dr:0,cr:85000,cc:'CC-HR'} ] },
    { docNo:'JV-2025-011', date:'2025-01-31', desc:'Rent Expense — January 2025',
      status: JournalStatus.POSTED,
      lines:[ {acc:'5300',dr:12000,cr:0,cc:'CC-ADMIN'}, {acc:'1010',dr:0,cr:12000,cc:'CC-ADMIN'} ] },
    { docNo:'JV-2025-020', date:'2025-02-28', desc:'Salary Expense — February 2025',
      status: JournalStatus.POSTED,
      lines:[ {acc:'5200',dr:85000,cr:0,cc:'CC-HR'}, {acc:'2500',dr:0,cr:85000,cc:'CC-HR'} ] },
    { docNo:'JV-2025-030', date:'2025-03-31', desc:'Depreciation — March 2025',
      status: JournalStatus.POSTED,
      lines:[ {acc:'5400',dr:5000,cr:0,cc:'CC-ADMIN'}, {acc:'1500',dr:0,cr:5000,cc:'CC-ADMIN'} ] },
    // Procurement-related journals
    { docNo:'JV-2025-040', date:'2025-10-22', desc:'GRN-2025-001 — Inventory Receipt',
      status: JournalStatus.POSTED,
      lines:[ {acc:'1200',dr:69.10,cr:0,cc:'CC-LOG'}, {acc:'2000',dr:0,cr:69.10,cc:'CC-LOG'} ] },
    { docNo:'JV-2025-041', date:'2025-12-06', desc:'GRN-2025-002 — Inventory Receipt',
      status: JournalStatus.POSTED,
      lines:[ {acc:'1200',dr:112.10,cr:0,cc:'CC-LOG'}, {acc:'2000',dr:0,cr:112.10,cc:'CC-LOG'} ] },
    { docNo:'JV-2025-042', date:'2025-12-11', desc:'GRN-2025-003 — Inventory Receipt (Cable & Fuses)',
      status: JournalStatus.POSTED,
      lines:[ {acc:'1210',dr:1505.60,cr:0,cc:'CC-LOG'}, {acc:'2000',dr:0,cr:1505.60,cc:'CC-LOG'} ] },
    { docNo:'JV-2026-001', date:'2026-01-05', desc:'GRN-2025-004 — Chemicals Receipt',
      status: JournalStatus.POSTED,
      lines:[ {acc:'1220',dr:4175.00,cr:0,cc:'CC-LOG'}, {acc:'2000',dr:0,cr:4175.00,cc:'CC-LOG'} ] },
    // Issue expense journals
    { docNo:'JV-2026-010', date:'2026-01-20', desc:'ISS-2026-001 — Engineering Spares Consumed',
      status: JournalStatus.POSTED,
      lines:[ {acc:'5100',dr:33.25,cr:0,cc:'CC-MAINT'}, {acc:'1200',dr:0,cr:33.25,cc:'CC-MAINT'} ] },
    { docNo:'JV-2026-011', date:'2026-02-10', desc:'ISS-2026-002 — Chemicals Consumed',
      status: JournalStatus.POSTED,
      lines:[ {acc:'5120',dr:835.00,cr:0,cc:'CC-PROD'}, {acc:'1220',dr:0,cr:835.00,cc:'CC-PROD'} ] },
    { docNo:'JV-2026-012', date:'2026-02-28', desc:'ISS-2026-004 — Electrical Items Consumed',
      status: JournalStatus.POSTED,
      lines:[ {acc:'5110',dr:250.40,cr:0,cc:'CC-MAINT'}, {acc:'1210',dr:0,cr:250.40,cc:'CC-MAINT'} ] },
    // AP invoice journals
    { docNo:'JV-2026-020', date:'2026-01-10', desc:'AP Invoice APINV-001 — McLaren SA',
      status: JournalStatus.POSTED,
      lines:[ {acc:'2000',dr:0,cr:1250.00,cc:'CC-LOG'}, {acc:'5000',dr:1250.00,cr:0,cc:'CC-LOG'} ] },
    { docNo:'JV-2026-021', date:'2026-02-05', desc:'AP Invoice APINV-002 — B-Tech',
      status: JournalStatus.POSTED,
      lines:[ {acc:'2000',dr:0,cr:875.00,cc:'CC-LOG'}, {acc:'5000',dr:875.00,cr:0,cc:'CC-LOG'} ] },
    // Payment journals
    { docNo:'JV-2026-030', date:'2026-02-15', desc:'Payment to McLaren SA — APPMT-001',
      status: JournalStatus.POSTED,
      lines:[ {acc:'2000',dr:1250.00,cr:0,cc:'CC-FINCE'}, {acc:'1010',dr:0,cr:1250.00,cc:'CC-FINCE'} ] },
    { docNo:'JV-2026-031', date:'2026-02-28', desc:'Payment to B-Tech — APPMT-002',
      status: JournalStatus.POSTED,
      lines:[ {acc:'2000',dr:875.00,cr:0,cc:'CC-FINCE'}, {acc:'1010',dr:0,cr:875.00,cc:'CC-FINCE'} ] },
    // Adjustment journals
    { docNo:'JV-2026-040', date:'2026-02-01', desc:'ADJ-2026-001 — Cycle Count Variance',
      status: JournalStatus.POSTED,
      lines:[ {acc:'6010',dr:11.86,cr:0,cc:'CC-LOG'}, {acc:'1200',dr:0,cr:11.86,cc:'CC-LOG'} ] },
    { docNo:'JV-2026-041', date:'2026-03-15', desc:'ADJ-2026-002 — Damaged Goods Write-off',
      status: JournalStatus.POSTED,
      lines:[ {acc:'6000',dr:26.40,cr:0,cc:'CC-LOG'}, {acc:'1210',dr:0,cr:26.40,cc:'CC-LOG'} ] },
    // Monthly Q1 2026
    { docNo:'JV-2026-050', date:'2026-01-31', desc:'Salary Expense — January 2026',
      status: JournalStatus.POSTED,
      lines:[ {acc:'5200',dr:88000,cr:0,cc:'CC-HR'}, {acc:'2500',dr:0,cr:88000,cc:'CC-HR'} ] },
    { docNo:'JV-2026-051', date:'2026-01-31', desc:'Rent — January 2026',
      status: JournalStatus.POSTED,
      lines:[ {acc:'5300',dr:12000,cr:0,cc:'CC-ADMIN'}, {acc:'1010',dr:0,cr:12000,cc:'CC-ADMIN'} ] },
    { docNo:'JV-2026-052', date:'2026-02-28', desc:'Salary Expense — February 2026',
      status: JournalStatus.POSTED,
      lines:[ {acc:'5200',dr:88000,cr:0,cc:'CC-HR'}, {acc:'2500',dr:0,cr:88000,cc:'CC-HR'} ] },
    { docNo:'JV-2026-053', date:'2026-03-31', desc:'Salary Expense — March 2026',
      status: JournalStatus.POSTED,
      lines:[ {acc:'5200',dr:88000,cr:0,cc:'CC-HR'}, {acc:'2500',dr:0,cr:88000,cc:'CC-HR'} ] },
    { docNo:'JV-2026-054', date:'2026-03-31', desc:'Depreciation — Q1 2026',
      status: JournalStatus.POSTED,
      lines:[ {acc:'5400',dr:15000,cr:0,cc:'CC-ADMIN'}, {acc:'1500',dr:0,cr:15000,cc:'CC-ADMIN'} ] },
    { docNo:'JV-2026-055', date:'2026-04-05', desc:'Bank Charges — Q1 2026',
      status: JournalStatus.DRAFT,
      lines:[ {acc:'5920',dr:450,cr:0,cc:'CC-FINCE'}, {acc:'1010',dr:0,cr:450,cc:'CC-FINCE'} ] },
  ];

  for (const jv of journalDefs) {
    const existing = await prisma.journalEntry.findFirst({ where: { companyId: CID, docNo: jv.docNo } });
    if (!existing) {
      await prisma.journalEntry.create({
        data: {
          companyId: CID, docNo: jv.docNo,
          entryDate: new Date(jv.date),
          description: jv.desc,
          status: jv.status,
          sourceModule: 'FINANCE',
          createdById: userMap['acc1@demo.com'] ?? adminUserId,
          postedAt: jv.status === JournalStatus.POSTED ? new Date(jv.date) : null,
          lines: {
            create: jv.lines.map((l, i) => ({
              accountId: accountMap[l.acc],
              costCenterId: costCenterMap[l.cc] ?? null,
              debit: l.dr,
              credit: l.cr,
              lineNo: i + 1,
            })).filter(l => l.accountId),
          },
        },
      });
    }
  }
  console.log(`  ✓ ${journalDefs.length} journal entries`);

  // ── 18. AP Invoices (20) ──────────────────────────────────────────────────
  console.log('🧾 AP Invoices...');
  const apInvDefs = [
    { docNo:'APINV-001', suppCode:'MCLSA028',  date:'2025-10-25', due:'2025-11-24', amt:  34.60, tax: 1.73, status: ApInvoiceStatus.PAID     },
    { docNo:'APINV-002', suppCode:'SUP-BTECH',  date:'2025-12-09', due:'2026-01-23', amt:  112.10,tax: 5.61, status: ApInvoiceStatus.PAID     },
    { docNo:'APINV-003', suppCode:'SUP-ELECA',  date:'2025-12-15', due:'2026-01-14', amt: 1505.60,tax:75.28, status: ApInvoiceStatus.PAID     },
    { docNo:'APINV-004', suppCode:'SUP-CHEMX',  date:'2026-01-08', due:'2026-03-08', amt: 4175.00,tax:208.75,status: ApInvoiceStatus.PAID     },
    { docNo:'APINV-005', suppCode:'SUP-BTECH',  date:'2026-02-07', due:'2026-03-24', amt:  150.00,tax: 7.50, status: ApInvoiceStatus.APPROVED },
    { docNo:'APINV-006', suppCode:'SUP-SAFEP',  date:'2026-03-06', due:'2026-04-05', amt: 2830.00,tax:141.50,status: ApInvoiceStatus.APPROVED },
    { docNo:'APINV-007', suppCode:'SUP-GENRL',  date:'2026-02-11', due:'2026-03-28', amt:  165.00,tax: 8.25, status: ApInvoiceStatus.PAID     },
    { docNo:'APINV-008', suppCode:'SUP-CIVIL',  date:'2026-01-28', due:'2026-03-28', amt: 3200.00,tax:160.00,status: ApInvoiceStatus.APPROVED },
    { docNo:'APINV-009', suppCode:'SUP-TOOLS',  date:'2026-02-20', due:'2026-03-22', amt:  440.00,tax:22.00, status: ApInvoiceStatus.DRAFT    },
    { docNo:'APINV-010', suppCode:'SUP-AUTO',   date:'2026-03-01', due:'2026-03-31', amt: 1875.00,tax:93.75, status: ApInvoiceStatus.APPROVED },
    { docNo:'APINV-011', suppCode:'SUP-MECH',   date:'2026-03-10', due:'2026-04-09', amt:  520.00,tax:26.00, status: ApInvoiceStatus.DRAFT    },
    { docNo:'APINV-012', suppCode:'SUP-CABLE',  date:'2026-03-15', due:'2026-04-14', amt: 1200.00,tax:60.00, status: ApInvoiceStatus.APPROVED },
    { docNo:'APINV-013', suppCode:'SUP-ELECA',  date:'2026-03-18', due:'2026-04-17', amt: 2460.00,tax:123.00,status: ApInvoiceStatus.DRAFT    },
    { docNo:'APINV-014', suppCode:'SUP-CHEMX',  date:'2026-03-20', due:'2026-05-19', amt:  840.00,tax:42.00, status: ApInvoiceStatus.APPROVED },
    { docNo:'APINV-015', suppCode:'SUP-SAFEP',  date:'2026-03-25', due:'2026-04-24', amt:  320.00,tax:16.00, status: ApInvoiceStatus.DRAFT    },
    { docNo:'APINV-016', suppCode:'SUP-PAINT',  date:'2026-03-28', due:'2026-04-27', amt:  660.00,tax:33.00, status: ApInvoiceStatus.DRAFT    },
    { docNo:'APINV-017', suppCode:'SUP-PIPE',   date:'2026-04-01', due:'2026-04-30', amt: 1440.00,tax:72.00, status: ApInvoiceStatus.DRAFT    },
    { docNo:'APINV-018', suppCode:'SUP-INSTR',  date:'2026-04-02', due:'2026-05-02', amt: 3850.00,tax:192.50,status: ApInvoiceStatus.DRAFT    },
    { docNo:'APINV-019', suppCode:'SUP-HYDR',   date:'2026-04-03', due:'2026-05-03', amt: 2200.00,tax:110.00,status: ApInvoiceStatus.DRAFT    },
    { docNo:'APINV-020', suppCode:'MCLSA028',   date:'2026-04-05', due:'2026-05-05', amt:  975.00,tax:48.75, status: ApInvoiceStatus.DRAFT    },
  ];

  for (const inv of apInvDefs) {
    const existing = await prisma.apInvoice.findFirst({ where: { companyId: CID, docNo: inv.docNo } });
    if (!existing && supplierMap[inv.suppCode]) {
      await prisma.apInvoice.create({
        data: {
          companyId: CID, docNo: inv.docNo,
          supplierId: supplierMap[inv.suppCode],
          supplierInvoiceNo: `SINV-${inv.docNo}`,
          invoiceDate: new Date(inv.date),
          dueDate: new Date(inv.due),
          amount: inv.amt,
          taxAmount: inv.tax,
          totalAmount: inv.amt + inv.tax,
          status: inv.status,
          createdById: userMap['acc1@demo.com'] ?? adminUserId,
        },
      });
    }
  }
  console.log(`  ✓ ${apInvDefs.length} AP invoices`);

  // ── 19. AP Payments (15) ──────────────────────────────────────────────────
  console.log('💳 AP Payments...');
  const apPayDefs = [
    { docNo:'APPMT-001', suppCode:'MCLSA028',  date:'2025-11-10', amt:  36.33, method: PaymentMethod.BANK_TRANSFER },
    { docNo:'APPMT-002', suppCode:'SUP-BTECH',  date:'2026-01-15', amt:  117.71,method: PaymentMethod.BANK_TRANSFER },
    { docNo:'APPMT-003', suppCode:'SUP-ELECA',  date:'2026-01-10', amt: 1580.88,method: PaymentMethod.BANK_TRANSFER },
    { docNo:'APPMT-004', suppCode:'SUP-CHEMX',  date:'2026-03-05', amt: 4383.75,method: PaymentMethod.BANK_TRANSFER },
    { docNo:'APPMT-005', suppCode:'SUP-GENRL',  date:'2026-03-20', amt:  173.25,method: PaymentMethod.CHEQUE       },
    { docNo:'APPMT-006', suppCode:'SUP-BTECH',  date:'2026-03-25', amt:  157.50,method: PaymentMethod.BANK_TRANSFER },
    { docNo:'APPMT-007', suppCode:'SUP-SAFEP',  date:'2026-04-01', amt: 2971.50,method: PaymentMethod.BANK_TRANSFER },
    { docNo:'APPMT-008', suppCode:'SUP-CIVIL',  date:'2026-03-30', amt: 3360.00,method: PaymentMethod.CHEQUE       },
    { docNo:'APPMT-009', suppCode:'SUP-AUTO',   date:'2026-04-02', amt: 1968.75,method: PaymentMethod.BANK_TRANSFER },
    { docNo:'APPMT-010', suppCode:'SUP-CABLE',  date:'2026-04-03', amt: 1260.00,method: PaymentMethod.BANK_TRANSFER },
    { docNo:'APPMT-011', suppCode:'SUP-CHEMX',  date:'2026-04-04', amt:  882.00,method: PaymentMethod.CHEQUE       },
    { docNo:'APPMT-012', suppCode:'MCLSA028',   date:'2026-04-05', amt: 1023.75,method: PaymentMethod.BANK_TRANSFER },
    { docNo:'APPMT-013', suppCode:'SUP-MECH',   date:'2026-04-05', amt:  546.00,method: PaymentMethod.BANK_TRANSFER },
    { docNo:'APPMT-014', suppCode:'SUP-PAINT',  date:'2026-04-06', amt:  693.00,method: PaymentMethod.CHEQUE       },
    { docNo:'APPMT-015', suppCode:'SUP-PIPE',   date:'2026-04-06', amt: 1512.00,method: PaymentMethod.BANK_TRANSFER },
  ];

  for (const pay of apPayDefs) {
    const existing = await prisma.apPayment.findFirst({ where: { companyId: CID, docNo: pay.docNo } });
    if (!existing && supplierMap[pay.suppCode]) {
      await prisma.apPayment.create({
        data: {
          companyId: CID, docNo: pay.docNo,
          supplierId: supplierMap[pay.suppCode],
          paymentDate: new Date(pay.date),
          amount: pay.amt,
          paymentMethod: pay.method,
          notes: `Payment for invoices — ${pay.docNo}`,
          status: 'POSTED',
          createdById: userMap['acc1@demo.com'] ?? adminUserId,
        },
      });
    }
  }
  console.log(`  ✓ ${apPayDefs.length} AP payments`);

  // ── 20. AR Invoices (20) ──────────────────────────────────────────────────
  console.log('🧾 AR Invoices...');
  const customerIds = ['CUST-001','CUST-002','CUST-003','CUST-004','CUST-005'];
  const customerNames = ['Gulf Oil Company','Oman Cement','National Engineering','Oman Power','Al Madina Trading'];
  const arInvDefs = Array.from({ length: 20 }, (_, i) => ({
    docNo:    `ARINV-${fmt(i+1)}`,
    customer: customerIds[i % 5],
    date:     `2026-${String(Math.floor(i/7)+1).padStart(2,'0')}-${String((i*3%28)+1).padStart(2,'0')}`,
    due:      `2026-${String(Math.floor(i/7)+2).padStart(2,'0')}-${String((i*3%28)+1).padStart(2,'0')}`,
    amt:      Math.round((5000 + i * 1337) * 100) / 100,
    tax:      Math.round((5000 + i * 1337) * 0.05 * 100) / 100,
    status:   i < 8 ? 'PAID' : i < 14 ? 'APPROVED' : 'DRAFT',
  }));

  for (const inv of arInvDefs) {
    const existing = await prisma.arInvoice.findFirst({ where: { companyId: CID, docNo: inv.docNo } });
    if (!existing) {
      await prisma.arInvoice.create({
        data: {
          companyId: CID, docNo: inv.docNo,
          customerId: inv.customer,
          invoiceDate: new Date(inv.date),
          dueDate: new Date(inv.due),
          amount: inv.amt,
          taxAmount: inv.tax,
          totalAmount: inv.amt + inv.tax,
          status: inv.status,
          createdById: userMap['acc2@demo.com'] ?? adminUserId,
        },
      });
    }
  }
  console.log(`  ✓ ${arInvDefs.length} AR invoices`);

  // ── 21. AR Receipts (15) ──────────────────────────────────────────────────
  console.log('💰 AR Receipts...');
  const arRcptDefs = Array.from({ length: 15 }, (_, i) => ({
    docNo:    `ARRCP-${fmt(i+1)}`,
    customer: customerIds[i % 5],
    date:     `2026-0${Math.floor(i/5)+1}-${String((i*4%25)+3).padStart(2,'0')}`,
    amt:      Math.round((4800 + i * 1200) * 1.05 * 100) / 100,
    method:   [PaymentMethod.BANK_TRANSFER, PaymentMethod.CHEQUE, PaymentMethod.CASH][i % 3],
  }));

  for (const rcp of arRcptDefs) {
    const existing = await prisma.arReceipt.findFirst({ where: { companyId: CID, docNo: rcp.docNo } });
    if (!existing) {
      await prisma.arReceipt.create({
        data: {
          companyId: CID, docNo: rcp.docNo,
          customerId: rcp.customer,
          receiptDate: new Date(rcp.date),
          amount: rcp.amt,
          paymentMethod: rcp.method,
          notes: `Receipt from ${customerNames[parseInt(rcp.customer.split('-')[1]) - 1]}`,
          status: 'POSTED',
          createdById: userMap['acc2@demo.com'] ?? adminUserId,
        },
      });
    }
  }
  console.log(`  ✓ ${arRcptDefs.length} AR receipts`);

  // ── 22. Budgets + Budget Periods ──────────────────────────────────────────
  console.log('📊 Budgets...');
  const budgetAccounts = [
    { acc:'5200', cc:'CC-HR',     annual:1080000 },
    { acc:'5300', cc:'CC-ADMIN',  annual: 144000 },
    { acc:'5100', cc:'CC-MAINT',  annual: 200000 },
    { acc:'5110', cc:'CC-MAINT',  annual: 150000 },
    { acc:'5120', cc:'CC-PROD',   annual: 180000 },
    { acc:'5130', cc:'CC-MAINT',  annual:  80000 },
    { acc:'5400', cc:'CC-ADMIN',  annual:  60000 },
    { acc:'5500', cc:'CC-LOG',    annual:  75000 },
    { acc:'5600', cc:'CC-ADMIN',  annual:  36000 },
    { acc:'5700', cc:'CC-ADMIN',  annual:  48000 },
  ];

  for (const b of budgetAccounts) {
    if (!accountMap[b.acc] || !costCenterMap[b.cc]) continue;
    const existing = await prisma.budget.findFirst({
      where: { companyId: CID, fiscalYear: 2026, accountId: accountMap[b.acc], costCenterId: costCenterMap[b.cc] },
    });
    if (!existing) {
      const monthly = Math.round((b.annual / 12) * 100) / 100;
      await prisma.budget.create({
        data: {
          companyId: CID, fiscalYear: 2026,
          accountId: accountMap[b.acc],
          costCenterId: costCenterMap[b.cc],
          annualAmount: b.annual,
          periods: {
            create: Array.from({ length: 12 }, (_, m) => ({
              periodMonth: m + 1,
              periodYear: 2026,
              budgetedAmount: monthly,
              actualAmount: m < 3 ? monthly : 0,
            })),
          },
        },
      });
    }
  }
  console.log(`  ✓ ${budgetAccounts.length} budgets (12 periods each)`);

  // ── 23. Notifications (50) ────────────────────────────────────────────────
  console.log('🔔 Notifications...');
  const notifTypes = ['PO_APPROVED','GRN_POSTED','STOCK_LOW','INVOICE_DUE','ADJ_APPROVED',
                      'PO_SUBMITTED','MRL_APPROVED','TRANSFER_POSTED','PAYMENT_DUE','BUDGET_EXCEEDED'];
  const notifUsers = Object.values(userMap);
  let notifCreated = 0;
  const existingNotifCount = await prisma.notification.count({ where: { userId: { in: notifUsers } } });

  if (existingNotifCount < 50) {
    const needed = 50 - existingNotifCount;
    for (let i = 0; i < needed; i++) {
      const uid = notifUsers[i % notifUsers.length];
      const type = notifTypes[i % notifTypes.length];
      await prisma.notification.create({
        data: {
          userId: uid,
          type,
          title: type.replace(/_/g, ' '),
          message: `${type.replace(/_/g,' ')} notification #${i+1} — please review.`,
          docType: type.split('_')[0],
          isRead: i % 3 === 0,
          createdAt: new Date(Date.now() - i * 3600000),
        },
      });
      notifCreated++;
    }
  }
  console.log(`  ✓ ${notifCreated} notifications`);

  // ── 24. Audit Logs (50) ───────────────────────────────────────────────────
  console.log('📋 Audit logs...');
  const auditTables = ['purchase_orders','grn_headers','stock_issues','stock_transfers',
                       'stock_adjustments','items','suppliers','gl_accounts','journal_entries','ap_invoices'];
  let auditCreated = 0;
  const existingAuditCount = await prisma.auditLog.count({ where: { userId: { in: notifUsers } } });

  if (existingAuditCount < 50) {
    const needed = 50 - existingAuditCount;
    for (let i = 0; i < needed; i++) {
      const uid = notifUsers[i % notifUsers.length];
      const tbl = auditTables[i % auditTables.length];
      const action = [AuditAction.CREATE, AuditAction.UPDATE, AuditAction.DELETE][i % 3];
      await prisma.auditLog.create({
        data: {
          tableName: tbl,
          recordId:  `rec-seed-${fmt(i+1)}`,
          userId: uid,
          action,
          newValues: { seeded: true, index: i },
          ipAddress: `10.0.0.${(i % 250) + 1}`,
          createdAt: new Date(Date.now() - i * 7200000),
        },
      });
      auditCreated++;
    }
  }
  console.log(`  ✓ ${auditCreated} audit logs`);

  // ── 25. Doc Sequences ─────────────────────────────────────────────────────
  console.log('🔢 Doc sequences...');
  const seqDefs = [
    { module:'PROCUREMENT', docType:'MRL',  prefix:'MRL-',  nextNo:100 },
    { module:'PROCUREMENT', docType:'PRL',  prefix:'PRL-',  nextNo:50  },
    { module:'PROCUREMENT', docType:'RFQ',  prefix:'RFQ-',  nextNo:30  },
    { module:'PROCUREMENT', docType:'QUOT', prefix:'QUOT-', nextNo:25  },
    { module:'PROCUREMENT', docType:'PO',   prefix:'PO-',   nextNo:200 },
    { module:'INVENTORY',   docType:'GRN',  prefix:'GRN-',  nextNo:50  },
    { module:'INVENTORY',   docType:'ISS',  prefix:'ISS-',  nextNo:30  },
    { module:'INVENTORY',   docType:'TRF',  prefix:'TRF-',  nextNo:20  },
    { module:'INVENTORY',   docType:'ADJ',  prefix:'ADJ-',  nextNo:20  },
    { module:'FINANCE',     docType:'JV',   prefix:'JV-',   nextNo:100 },
    { module:'FINANCE',     docType:'APINV',prefix:'APINV-',nextNo:25  },
    { module:'FINANCE',     docType:'APPMT',prefix:'APPMT-',nextNo:20  },
    { module:'FINANCE',     docType:'ARINV',prefix:'ARINV-',nextNo:25  },
    { module:'FINANCE',     docType:'ARRCP',prefix:'ARRCP-',nextNo:20  },
  ];
  for (const sq of seqDefs) {
    await prisma.docSequence.upsert({
      where: { companyId_module_docType: { companyId: CID, module: sq.module, docType: sq.docType } },
      update: {},
      create: { companyId: CID, module: sq.module, docType: sq.docType, prefix: sq.prefix, nextNo: sq.nextNo, padLength: 6 },
    });
  }
  console.log(`  ✓ ${seqDefs.length} doc sequences`);

  // ── Done ──────────────────────────────────────────────────────────────────
  console.log('\n✅  Full 50-record seed complete!\n');
  console.log('Summary of seeded data:');
  const counts = await Promise.all([
    prisma.user.count({ where: { companyId: CID } }),
    prisma.item.count({ where: { companyId: CID } }),
    prisma.supplier.count({ where: { companyId: CID } }),
    prisma.warehouse.count({ where: { companyId: CID } }),
    prisma.bin.count(),
    prisma.stockBalance.count({ where: { item: { companyId: CID } } }),
    prisma.stockMovement.count({ where: { companyId: CID } }),
    prisma.stockIssue.count({ where: { companyId: CID } }),
    prisma.stockTransfer.count({ where: { companyId: CID } }),
    prisma.stockAdjustment.count({ where: { companyId: CID } }),
    prisma.purchaseOrder.count({ where: { companyId: CID } }),
    prisma.grnHeader.count({ where: { companyId: CID } }),
    prisma.glAccount.count({ where: { companyId: CID } }),
    prisma.journalEntry.count({ where: { companyId: CID } }),
    prisma.apInvoice.count({ where: { companyId: CID } }),
    prisma.apPayment.count({ where: { companyId: CID } }),
    prisma.arInvoice.count({ where: { companyId: CID } }),
    prisma.arReceipt.count({ where: { companyId: CID } }),
    prisma.budget.count({ where: { companyId: CID } }),
    prisma.notification.count(),
    prisma.auditLog.count(),
  ]);
  const labels = ['Users','Items','Suppliers','Warehouses','Bins','Stock Balances','Stock Movements',
    'Stock Issues','Stock Transfers','Stock Adjustments','Purchase Orders','GRN Headers',
    'GL Accounts','Journal Entries','AP Invoices','AP Payments','AR Invoices','AR Receipts',
    'Budgets','Notifications','Audit Logs'];
  counts.forEach((c, i) => console.log(`  ${labels[i].padEnd(22)} : ${c}`));
}

main()
  .catch((e) => { console.error('❌ Seed failed:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
