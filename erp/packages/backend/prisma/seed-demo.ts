/**
 * seed-demo.ts  —  Al Wadi Construction LLC
 * Realistic construction ERP demo data for Muscat, Oman
 * Run: cd packages/backend && npx tsx prisma/seed-demo.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const d  = (y: number, m: number, day: number) => new Date(y, m - 1, day);
const hr = (n: string) => console.log(`\n── ${n} ${' '.repeat(Math.max(0, 52 - n.length))}`);
const ok = (msg: string) => console.log(`  ✓ ${msg}`);
const wn = (msg: string) => console.warn(`  ⚠ ${msg}`);

async function main() {
  console.log('🏗️  Al Wadi Construction LLC — Demo Seed\n');

  // ═══════════════════════════════════════════════════════════════════════════
  // 0. BOOTSTRAP
  // ═══════════════════════════════════════════════════════════════════════════
  hr('Bootstrap');
  const company = await prisma.company.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!company) throw new Error('No company — run main seed first');
  const adminUser = await prisma.user.findFirst({ where: { companyId: company.id }, orderBy: { createdAt: 'asc' } });
  if (!adminUser) throw new Error('No user — run main seed first');
  const omrCurrency = await prisma.currency.findFirst({ where: { companyId: company.id, code: 'OMR' } });
  if (!omrCurrency) throw new Error('OMR currency not found — run main seed first');
  ok(`Company : ${company.name}  (${company.id})`);
  ok(`User    : ${adminUser.email}`);
  ok(`Currency: ${omrCurrency.code}`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. UOMs
  // ═══════════════════════════════════════════════════════════════════════════
  hr('1 · UOMs');
  const uomMap: Record<string, string> = {};
  try {
    const defs = [
      { code: 'NOS',   name: 'Numbers',      symbol: 'NOS' },
      { code: 'TON',   name: 'Metric Tonne', symbol: 'TON' },
      { code: 'BAG',   name: 'Bag (50 kg)',  symbol: 'BAG' },
      { code: 'MTR',   name: 'Metre',        symbol: 'MTR' },
      { code: 'M3',    name: 'Cubic Metre',  symbol: 'm³'  },
      { code: 'M2',    name: 'Square Metre', symbol: 'm²'  },
      { code: 'KG',    name: 'Kilogram',     symbol: 'KG'  },
      { code: 'SHEET', name: 'Sheet',        symbol: 'SHT' },
    ];
    for (const u of defs) {
      const r = await prisma.uom.upsert({
        where: { companyId_code: { companyId: company.id, code: u.code } },
        update: {}, create: { companyId: company.id, ...u },
      });
      uomMap[u.code] = r.id;
    }
    ok(`${defs.length} UOMs`);
  } catch (e) { wn(`UOMs: ${e}`); }

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. ITEM CATEGORIES
  // ═══════════════════════════════════════════════════════════════════════════
  hr('2 · Item Categories');
  const catMap: Record<string, string> = {};
  try {
    const defs = [
      { code: 'CIVIL',    name: 'Civil & Structural Materials' },
      { code: 'CONCRETE', name: 'Concrete & Masonry'           },
      { code: 'MEP',      name: 'MEP Materials'                },
      { code: 'PIPING',   name: 'Piping & Fittings'            },
      { code: 'SAFETY',   name: 'Safety & PPE'                 },
    ];
    for (const c of defs) {
      const r = await prisma.itemCategory.upsert({
        where: { companyId_code: { companyId: company.id, code: c.code } },
        update: {}, create: { companyId: company.id, ...c },
      });
      catMap[c.code] = r.id;
    }
    ok(`${defs.length} Item Categories`);
  } catch (e) { wn(`Categories: ${e}`); }

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. GL ACCOUNTS (upsert — never overwrites existing)
  // ═══════════════════════════════════════════════════════════════════════════
  hr('3 · GL Accounts');
  const glMap: Record<string, string> = {};
  try {
    // seed existing accounts into map first
    const existing = await prisma.glAccount.findMany({ where: { companyId: company.id } });
    for (const a of existing) glMap[a.code] = a.id;

    const defs = [
      { code: '1310', name: 'Raw Materials Inventory',  accountType: 'ASSET'     as const, parentCode: '1300' },
      { code: '1320', name: 'Consumables Inventory',    accountType: 'ASSET'     as const, parentCode: '1300' },
      { code: '2100', name: 'Accounts Payable',         accountType: 'LIABILITY' as const, parentCode: '2000', isControl: true },
      { code: '4100', name: 'Contract Revenue',         accountType: 'REVENUE'   as const, parentCode: '4000' },
      { code: '4200', name: 'Variation Order Revenue',  accountType: 'REVENUE'   as const, parentCode: '4000' },
      { code: '5100', name: 'Direct Labour',            accountType: 'EXPENSE'   as const, parentCode: '5000' },
      { code: '5200', name: 'Subcontract Costs',        accountType: 'EXPENSE'   as const, parentCode: '5000' },
      { code: '5300', name: 'Material Costs',           accountType: 'EXPENSE'   as const, parentCode: '5000' },
      { code: '5400', name: 'Plant & Equipment Hire',   accountType: 'EXPENSE'   as const, parentCode: '5000' },
      { code: '6100', name: 'Site Overheads',           accountType: 'EXPENSE'   as const, parentCode: '5000' },
      { code: '6200', name: 'Head Office Overheads',    accountType: 'EXPENSE'   as const, parentCode: '5000' },
      { code: '7100', name: 'Depreciation',             accountType: 'EXPENSE'   as const, parentCode: '5000' },
    ];
    let added = 0;
    for (const gl of defs) {
      const parentId = gl.parentCode ? (glMap[gl.parentCode] ?? null) : null;
      const r = await prisma.glAccount.upsert({
        where: { companyId_code: { companyId: company.id, code: gl.code } },
        update: {},
        create: {
          companyId: company.id, code: gl.code, name: gl.name,
          accountType: gl.accountType, parentId,
          isControl: (gl as any).isControl ?? false, isActive: true,
        },
      });
      if (!glMap[gl.code]) added++;
      glMap[gl.code] = r.id;
    }
    ok(`${defs.length} GL accounts upserted (${added} new)`);
  } catch (e) { wn(`GL Accounts: ${e}`); }

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. LOCATIONS (site stores)
  // ═══════════════════════════════════════════════════════════════════════════
  hr('4 · Locations');
  const locMap: Record<string, string> = {};
  try {
    const existing = await prisma.location.findMany({ where: { companyId: company.id } });
    for (const l of existing) locMap[l.code] = l.id;

    const defs = [
      { code: 'MUSCAT-STORE', name: 'Main Store – Muscat Industrial Area',  type: 'WAREHOUSE' as const, address: 'Industrial Area, Rusayl, Muscat, Oman'             },
      { code: 'DUQM-SITE',   name: 'Site Store – Duqm Project',            type: 'WAREHOUSE' as const, address: 'Special Economic Zone, Duqm, Al Wusta, Oman'       },
      { code: 'SOHAR-SITE',  name: 'Site Store – Sohar Port Project',      type: 'WAREHOUSE' as const, address: 'Sohar Port Industrial Estate, Sohar, North Al Bat.' },
    ];
    let added = 0;
    for (const l of defs) {
      const r = await prisma.location.upsert({
        where: { companyId_code: { companyId: company.id, code: l.code } },
        update: {}, create: { companyId: company.id, ...l, isActive: true },
      });
      if (!locMap[l.code]) added++;
      locMap[l.code] = r.id;
    }
    ok(`${defs.length} Locations (${added} new)`);
  } catch (e) { wn(`Locations: ${e}`); }

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. WAREHOUSES + BINS (3 × 3)
  // ═══════════════════════════════════════════════════════════════════════════
  hr('5 · Warehouses & Bins');
  const whMap:  Record<string, string> = {};
  const binMap: Record<string, string> = {};
  try {
    const whDefs = [
      { code: 'WH-MUSCAT', name: 'Main Store – Muscat',        locCode: 'MUSCAT-STORE' },
      { code: 'WH-DUQM',   name: 'Site Store – Duqm Project',  locCode: 'DUQM-SITE'   },
      { code: 'WH-SOHAR',  name: 'Site Store – Sohar Project', locCode: 'SOHAR-SITE'  },
    ];
    for (const wh of whDefs) {
      const locationId = locMap[wh.locCode];
      if (!locationId) { wn(`Location ${wh.locCode} missing`); continue; }
      const r = await prisma.warehouse.upsert({
        where: { companyId_code: { companyId: company.id, code: wh.code } },
        update: {}, create: { companyId: company.id, code: wh.code, name: wh.name, locationId, isActive: true },
      });
      whMap[wh.code] = r.id;
    }
    const binDefs = [
      { wh: 'WH-MUSCAT', code: 'RCVNG',  name: 'Receiving Dock'  },
      { wh: 'WH-MUSCAT', code: 'BULK-A', name: 'Bulk Storage A'  },
      { wh: 'WH-MUSCAT', code: 'BULK-B', name: 'Bulk Storage B'  },
      { wh: 'WH-DUQM',   code: 'RCVNG',  name: 'Receiving Dock'  },
      { wh: 'WH-DUQM',   code: 'BULK-A', name: 'Bulk Storage A'  },
      { wh: 'WH-DUQM',   code: 'BULK-B', name: 'Bulk Storage B'  },
      { wh: 'WH-SOHAR',  code: 'RCVNG',  name: 'Receiving Dock'  },
      { wh: 'WH-SOHAR',  code: 'BULK-A', name: 'Bulk Storage A'  },
      { wh: 'WH-SOHAR',  code: 'BULK-B', name: 'Bulk Storage B'  },
    ];
    for (const b of binDefs) {
      const warehouseId = whMap[b.wh];
      if (!warehouseId) continue;
      const r = await prisma.bin.upsert({
        where: { warehouseId_code: { warehouseId, code: b.code } },
        update: {}, create: { warehouseId, code: b.code, name: b.name },
      });
      binMap[`${b.wh}:${b.code}`] = r.id;
    }
    ok(`${whDefs.length} Warehouses + ${binDefs.length} Bins`);
  } catch (e) { wn(`Warehouses/Bins: ${e}`); }

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. COST CENTRES + COST CODES
  // ═══════════════════════════════════════════════════════════════════════════
  hr('6 · Cost Centres & Cost Codes');
  const ccMap:   Record<string, string> = {};
  const codeMap: Record<string, string> = {};
  try {
    const defs = [
      { code: 'CC-CIVIL',  name: 'Civil Works Division'       },
      { code: 'CC-MEP',    name: 'MEP Division'               },
      { code: 'CC-FITOUT', name: 'Fit-Out Division'           },
      { code: 'CC-DUQM',   name: 'Duqm Project'               },
      { code: 'CC-SOHAR',  name: 'Sohar Port Project'         },
      { code: 'CC-ADMIN',  name: 'Administration & Overheads' },
    ];
    for (const cc of defs) {
      const ccRec = await prisma.costCenter.upsert({
        where: { companyId_code: { companyId: company.id, code: cc.code } },
        update: {}, create: { companyId: company.id, ...cc, isActive: true },
      });
      ccMap[cc.code] = ccRec.id;
      const cRec = await prisma.costCode.upsert({
        where: { companyId_code: { companyId: company.id, code: cc.code } },
        update: {},
        create: { companyId: company.id, code: cc.code, name: cc.name, costCenterId: ccRec.id, type: 'COST_CENTER', isActive: true },
      });
      codeMap[cc.code] = cRec.id;
    }
    ok(`${defs.length} Cost Centres + ${defs.length} Cost Codes`);
  } catch (e) { wn(`Cost Centres: ${e}`); }

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. SUPPLIERS (10)
  // ═══════════════════════════════════════════════════════════════════════════
  hr('7 · Suppliers');
  const supplierMap: Record<string, string> = {};
  try {
    const ap2100 = glMap['2100'] ?? null;
    const defs = [
      { code: 'SUP-ATURKI', name: 'Al Turki Enterprises LLC',                 short: 'Al Turki Enterprises',   days: 45, contact: { name: 'Khalid Al Turki',      desig: 'Sales Manager',       phone: '+96824565001', email: 'khalid@alturki.om'          } },
      { code: 'SUP-VOLTMP', name: 'Voltamp Transformers LLC',                 short: 'Voltamp Transformers',    days: 60, contact: { name: 'Ravi Krishnan',        desig: 'Account Manager',     phone: '+96822456780', email: 'ravi.k@voltamp.ae'          } },
      { code: 'SUP-GALFAR', name: 'Galfar Engineering & Contracting SAOG',   short: 'Galfar Engineering',      days: 30, contact: { name: 'Ahmed Al Balushi',     desig: 'Contracts Manager',   phone: '+96824491200', email: 'ahmed.balushi@galfar.com'   } },
      { code: 'SUP-CARILI', name: 'Carillion Alawi LLC',                      short: 'Carillion Alawi',         days: 45, contact: { name: 'Paul Henderson',      desig: 'Supply Chain Dir.',   phone: '+96824598100', email: 'p.henderson@carillion.om'   } },
      { code: 'SUP-KANOO',  name: 'Kanoo Machinery LLC',                      short: 'Kanoo Machinery',         days: 30, contact: { name: 'Tariq Al Lawati',     desig: 'Rental Manager',      phone: '+96824700450', email: 'tariq@kanoomachinery.com'   } },
      { code: 'SUP-ALHSN',  name: 'Al Hassan Engineering Company LLC',        short: 'Al Hassan Engineering',   days: 45, contact: { name: 'Hassan Al Rawahi',    desig: 'General Manager',     phone: '+96824367890', email: 'hassan@alhassan-eng.com'    } },
      { code: 'SUP-MUSCAB', name: 'Muscat Cables Group LLC',                  short: 'Muscat Cables',           days: 60, contact: { name: 'Saif Al Mamari',      desig: 'Sales Engineer',      phone: '+96824503210', email: 'saif@muscatcables.com'      } },
      { code: 'SUP-OMANCT', name: 'Oman Cement Company SAOG',                 short: 'Oman Cement',             days: 30, contact: { name: 'Mohammed Al Habsi',   desig: 'Commercial Manager',  phone: '+96826840000', email: 'commercial@omancem.com'     } },
      { code: 'SUP-NATPIP', name: 'National Pipe Company SAOC',               short: 'National Pipe Co',        days: 45, contact: { name: 'Bader Al Siyabi',     desig: 'Technical Sales',     phone: '+96824688200', email: 'bader@natpipe.om'           } },
      { code: 'SUP-GULFPC', name: 'Gulf Precast Concrete LLC',                short: 'Gulf Precast',            days: 45, contact: { name: 'Nasser Al Farsi',     desig: 'Project Director',    phone: '+96822456900', email: 'nasser@gulfprecast.ae'      } },
    ];
    for (const s of defs) {
      const r = await prisma.supplier.upsert({
        where: { companyId_code: { companyId: company.id, code: s.code } },
        update: {},
        create: {
          companyId: company.id, code: s.code, name: s.name, shortName: s.short,
          controlAccountId: ap2100, creditDays: s.days, creditAmount: 50000,
          shipmentMode: 'NA', isActive: true, isParentSupplier: false,
        },
      });
      supplierMap[s.code] = r.id;
      const existContact = await prisma.supplierContact.findFirst({ where: { supplierId: r.id, isPrimary: true } });
      if (!existContact) {
        await prisma.supplierContact.create({
          data: { supplierId: r.id, name: s.contact.name, designation: s.contact.desig, phone: s.contact.phone, email: s.contact.email, isPrimary: true },
        });
      }
    }
    ok(`${defs.length} Suppliers + primary contacts`);
  } catch (e) { wn(`Suppliers: ${e}`); }

  // ═══════════════════════════════════════════════════════════════════════════
  // 8. ITEMS (20 construction materials)
  // ═══════════════════════════════════════════════════════════════════════════
  hr('8 · Items (20 construction materials)');
  const itemMap: Record<string, string> = {};
  try {
    const defs = [
      { code: 'REBAR-12MM',  desc: 'Steel Rebar 12mm Grade 460B',           uom: 'TON',   cat: 'CIVIL',    cost: 185.000, rl: 5,    rq: 20   },
      { code: 'REBAR-16MM',  desc: 'Steel Rebar 16mm Grade 460B',           uom: 'TON',   cat: 'CIVIL',    cost: 188.000, rl: 5,    rq: 20   },
      { code: 'REBAR-20MM',  desc: 'Steel Rebar 20mm Grade 460B',           uom: 'TON',   cat: 'CIVIL',    cost: 192.000, rl: 5,    rq: 20   },
      { code: 'CEMENT-OPC',  desc: 'OPC Cement 50 kg Bag',                  uom: 'BAG',   cat: 'CONCRETE', cost: 2.150,   rl: 500,  rq: 2000 },
      { code: 'HLWBLK-200',  desc: 'Hollow Block 200mm Solid',              uom: 'NOS',   cat: 'CONCRETE', cost: 0.350,   rl: 1000, rq: 5000 },
      { code: 'RMC-C25',     desc: 'Ready-Mix Concrete Grade C25',          uom: 'M3',    cat: 'CONCRETE', cost: 38.500,  rl: 0,    rq: 0    },
      { code: 'RMC-C30',     desc: 'Ready-Mix Concrete Grade C30',          uom: 'M3',    cat: 'CONCRETE', cost: 42.000,  rl: 0,    rq: 0    },
      { code: 'HDPE-110',    desc: 'HDPE Pipe 110mm PN10',                  uom: 'MTR',   cat: 'PIPING',   cost: 8.750,   rl: 100,  rq: 500  },
      { code: 'HDPE-160',    desc: 'HDPE Pipe 160mm PN10',                  uom: 'MTR',   cat: 'PIPING',   cost: 14.200,  rl: 100,  rq: 300  },
      { code: 'CUCBL-4SQ',   desc: 'Cu Cable 4mm² XLPE Armoured',          uom: 'MTR',   cat: 'MEP',      cost: 1.850,   rl: 500,  rq: 2000 },
      { code: 'CUCBL-16SQ',  desc: 'Cu Cable 16mm² XLPE Armoured',         uom: 'MTR',   cat: 'MEP',      cost: 5.600,   rl: 200,  rq: 1000 },
      { code: 'CUCBL-35SQ',  desc: 'Cu Cable 35mm² XLPE Armoured',         uom: 'MTR',   cat: 'MEP',      cost: 11.200,  rl: 100,  rq: 500  },
      { code: 'COND-PVC25',  desc: 'Conduit PVC 25mm Rigid',               uom: 'MTR',   cat: 'MEP',      cost: 0.650,   rl: 500,  rq: 2000 },
      { code: 'FORMWK-TIM',  desc: 'Timber Formwork 18mm Plywood',         uom: 'M2',    cat: 'CIVIL',    cost: 7.500,   rl: 100,  rq: 500  },
      { code: 'HELMET-SAF',  desc: 'Safety Helmet Type II Class E',         uom: 'NOS',   cat: 'SAFETY',   cost: 3.200,   rl: 50,   rq: 200  },
      { code: 'GIPIPE-2IN',  desc: 'GI Pipe 2 inch Class B BS1387',        uom: 'MTR',   cat: 'PIPING',   cost: 6.800,   rl: 200,  rq: 1000 },
      { code: 'BNDWRE-16',   desc: 'Binding Wire 16 SWG Annealed',         uom: 'KG',    cat: 'CIVIL',    cost: 0.980,   rl: 200,  rq: 1000 },
      { code: 'NAILS-4IN',   desc: 'Iron Nails 4 inch Round Wire',         uom: 'KG',    cat: 'CIVIL',    cost: 0.750,   rl: 100,  rq: 500  },
      { code: 'PLYWOOD-18',  desc: 'Marine Plywood 18mm 4x8 Sheet',        uom: 'SHEET', cat: 'CIVIL',    cost: 12.500,  rl: 50,   rq: 200  },
      { code: 'CHAINLNK',   desc: 'Chain Link Fencing 1.8m Height',        uom: 'MTR',   cat: 'CIVIL',    cost: 4.200,   rl: 100,  rq: 500  },
    ];
    for (const it of defs) {
      const uomId      = uomMap[it.uom];
      const categoryId = catMap[it.cat] ?? null;
      if (!uomId) { wn(`UOM ${it.uom} missing for ${it.code}`); continue; }
      const r = await prisma.item.upsert({
        where: { companyId_code: { companyId: company.id, code: it.code } },
        update: {},
        create: {
          companyId: company.id, code: it.code, description: it.desc,
          shortDescription: it.desc.substring(0, 40), categoryId, uomId,
          standardCost: it.cost, reorderLevel: it.rl, reorderQty: it.rq,
          grade1Options: [], grade2Options: [], status: 'ACTIVE',
        },
      });
      itemMap[it.code] = r.id;
    }
    ok(`${defs.length} Items`);
  } catch (e) { wn(`Items: ${e}`); }

  // ═══════════════════════════════════════════════════════════════════════════
  // 9. MATERIAL REQUISITIONS (5) with lines
  // ═══════════════════════════════════════════════════════════════════════════
  hr('9 · Material Requisitions (MRL)');
  const mrlMap: Record<string, string> = {};
  try {
    type MLine = { ic: string; uo: string; rq: number; aq: number; ap: number };
    type MDef  = { docNo: string; dd: Date; dlv: Date; loc: string; cc: string; status: string; remarks: string; lines: MLine[] };
    const defs: MDef[] = [
      {
        docNo: 'MRL-2025-0001', dd: d(2025,1,8), dlv: d(2025,2,1),
        loc: 'DUQM-SITE', cc: 'CC-DUQM', status: 'APPROVED', remarks: 'Foundation works – Block A Duqm',
        lines: [
          { ic: 'REBAR-12MM', uo: 'TON', rq: 15,   aq: 15,   ap: 185.000 },
          { ic: 'REBAR-16MM', uo: 'TON', rq: 10,   aq: 10,   ap: 188.000 },
          { ic: 'CEMENT-OPC', uo: 'BAG', rq: 800,  aq: 800,  ap: 2.150   },
          { ic: 'HLWBLK-200', uo: 'NOS', rq: 3000, aq: 3000, ap: 0.350   },
        ],
      },
      {
        docNo: 'MRL-2025-0002', dd: d(2025,1,15), dlv: d(2025,2,10),
        loc: 'DUQM-SITE', cc: 'CC-DUQM', status: 'APPROVED', remarks: 'MEP first fix – Duqm admin building',
        lines: [
          { ic: 'CUCBL-16SQ', uo: 'MTR', rq: 500,  aq: 500,  ap: 5.600  },
          { ic: 'CUCBL-4SQ',  uo: 'MTR', rq: 800,  aq: 800,  ap: 1.850  },
          { ic: 'COND-PVC25', uo: 'MTR', rq: 1200, aq: 1200, ap: 0.650  },
          { ic: 'HELMET-SAF', uo: 'NOS', rq: 50,   aq: 50,   ap: 3.200  },
        ],
      },
      {
        docNo: 'MRL-2025-0003', dd: d(2025,2,3), dlv: d(2025,3,1),
        loc: 'SOHAR-SITE', cc: 'CC-SOHAR', status: 'APPROVED', remarks: 'Piping works – Sohar utility block',
        lines: [
          { ic: 'HDPE-110',   uo: 'MTR', rq: 400, aq: 400, ap: 8.750  },
          { ic: 'HDPE-160',   uo: 'MTR', rq: 200, aq: 200, ap: 14.200 },
          { ic: 'GIPIPE-2IN', uo: 'MTR', rq: 300, aq: 300, ap: 6.800  },
        ],
      },
      {
        docNo: 'MRL-2025-0004', dd: d(2025,2,10), dlv: d(2025,3,10),
        loc: 'SOHAR-SITE', cc: 'CC-SOHAR', status: 'APPROVED', remarks: 'Formwork – Sohar warehouse slab',
        lines: [
          { ic: 'FORMWK-TIM', uo: 'M2',   rq: 300, aq: 300, ap: 7.500  },
          { ic: 'PLYWOOD-18', uo: 'SHEET', rq: 80,  aq: 80,  ap: 12.500 },
          { ic: 'BNDWRE-16',  uo: 'KG',   rq: 200, aq: 200, ap: 0.980  },
          { ic: 'NAILS-4IN',  uo: 'KG',   rq: 100, aq: 100, ap: 0.750  },
          { ic: 'REBAR-20MM', uo: 'TON',  rq: 8,   aq: 8,   ap: 192.000},
        ],
      },
      {
        docNo: 'MRL-2025-0005', dd: d(2025,3,1), dlv: d(2025,4,1),
        loc: 'MUSCAT-STORE', cc: 'CC-CIVIL', status: 'SUBMITTED', remarks: 'Perimeter fencing – Muscat site',
        lines: [
          { ic: 'CHAINLNK',   uo: 'MTR', rq: 500, aq: 0, ap: 4.200 },
          { ic: 'GIPIPE-2IN', uo: 'MTR', rq: 200, aq: 0, ap: 6.800 },
          { ic: 'HELMET-SAF', uo: 'NOS', rq: 30,  aq: 0, ap: 3.200 },
        ],
      },
    ];
    for (const m of defs) {
      const locationId   = locMap[m.loc];
      const chargeCodeId = codeMap[m.cc];
      if (!locationId || !chargeCodeId) { wn(`Missing loc/code for MRL ${m.docNo}`); continue; }
      const existing = await prisma.materialRequisition.findFirst({ where: { companyId: company.id, docNo: m.docNo } });
      if (existing) { mrlMap[m.docNo] = existing.id; continue; }
      const r = await prisma.materialRequisition.create({
        data: {
          companyId: company.id, docNo: m.docNo, docDate: m.dd, deliveryDate: m.dlv,
          locationId, chargeCodeId, remarks: m.remarks, status: m.status as any,
          createdById: adminUser.id,
          approvedById: m.status === 'APPROVED' ? adminUser.id : null,
          approvedAt:   m.status === 'APPROVED' ? m.dd           : null,
          lines: {
            create: m.lines.map((l, i) => ({
              lineNo: i + 1, itemId: itemMap[l.ic], uomId: uomMap[l.uo],
              requestedQty: l.rq, approvedQty: l.aq, approxPrice: l.ap, freeStock: 0,
            })),
          },
        },
      });
      mrlMap[m.docNo] = r.id;
    }
    ok(`${defs.length} MRLs`);
  } catch (e) { wn(`MRLs: ${e}`); }

  // ═══════════════════════════════════════════════════════════════════════════
  // 10. PURCHASE REQUISITIONS (5) with lines
  // ═══════════════════════════════════════════════════════════════════════════
  hr('10 · Purchase Requisitions (PRL)');
  const prlMap: Record<string, string> = {};
  try {
    type PLine = { ic: string; uo: string; cc: string; rq: number; aq: number; ap: number };
    type PDef  = { docNo: string; dd: Date; dlv: Date; mrl: string; loc: string; cc: string; status: string; remarks: string; lines: PLine[] };
    const defs: PDef[] = [
      {
        docNo: 'PR-2025-0001', dd: d(2025,1,10), dlv: d(2025,2,5),
        mrl: 'MRL-2025-0001', loc: 'DUQM-SITE', cc: 'CC-DUQM', status: 'APPROVED', remarks: 'Steel & cement – Duqm foundation',
        lines: [
          { ic: 'REBAR-12MM', uo: 'TON', cc: 'CC-DUQM', rq: 15,   aq: 15,   ap: 185.000 },
          { ic: 'REBAR-16MM', uo: 'TON', cc: 'CC-DUQM', rq: 10,   aq: 10,   ap: 188.000 },
          { ic: 'CEMENT-OPC', uo: 'BAG', cc: 'CC-DUQM', rq: 800,  aq: 800,  ap: 2.150   },
          { ic: 'HLWBLK-200', uo: 'NOS', cc: 'CC-DUQM', rq: 3000, aq: 3000, ap: 0.350   },
        ],
      },
      {
        docNo: 'PR-2025-0002', dd: d(2025,1,16), dlv: d(2025,2,12),
        mrl: 'MRL-2025-0002', loc: 'DUQM-SITE', cc: 'CC-MEP', status: 'APPROVED', remarks: 'MEP cables – Duqm',
        lines: [
          { ic: 'CUCBL-16SQ', uo: 'MTR', cc: 'CC-MEP', rq: 500,  aq: 500,  ap: 5.600 },
          { ic: 'CUCBL-4SQ',  uo: 'MTR', cc: 'CC-MEP', rq: 800,  aq: 800,  ap: 1.850 },
          { ic: 'COND-PVC25', uo: 'MTR', cc: 'CC-MEP', rq: 1200, aq: 1200, ap: 0.650 },
        ],
      },
      {
        docNo: 'PR-2025-0003', dd: d(2025,2,5), dlv: d(2025,3,5),
        mrl: 'MRL-2025-0003', loc: 'SOHAR-SITE', cc: 'CC-SOHAR', status: 'APPROVED', remarks: 'HDPE & GI piping – Sohar',
        lines: [
          { ic: 'HDPE-110',   uo: 'MTR', cc: 'CC-SOHAR', rq: 400, aq: 400, ap: 8.750  },
          { ic: 'HDPE-160',   uo: 'MTR', cc: 'CC-SOHAR', rq: 200, aq: 200, ap: 14.200 },
          { ic: 'GIPIPE-2IN', uo: 'MTR', cc: 'CC-SOHAR', rq: 300, aq: 300, ap: 6.800  },
        ],
      },
      {
        docNo: 'PR-2025-0004', dd: d(2025,2,12), dlv: d(2025,3,12),
        mrl: 'MRL-2025-0004', loc: 'SOHAR-SITE', cc: 'CC-CIVIL', status: 'APPROVED', remarks: 'Formwork & rebar – Sohar slab',
        lines: [
          { ic: 'FORMWK-TIM', uo: 'M2',   cc: 'CC-CIVIL', rq: 300, aq: 300, ap: 7.500  },
          { ic: 'REBAR-20MM', uo: 'TON',  cc: 'CC-CIVIL', rq: 8,   aq: 8,   ap: 192.000},
          { ic: 'BNDWRE-16',  uo: 'KG',   cc: 'CC-CIVIL', rq: 200, aq: 200, ap: 0.980  },
          { ic: 'NAILS-4IN',  uo: 'KG',   cc: 'CC-CIVIL', rq: 100, aq: 100, ap: 0.750  },
        ],
      },
      {
        docNo: 'PR-2025-0005', dd: d(2025,3,3), dlv: d(2025,4,3),
        mrl: 'MRL-2025-0005', loc: 'MUSCAT-STORE', cc: 'CC-CIVIL', status: 'DRAFT', remarks: 'Fencing – Muscat boundary',
        lines: [
          { ic: 'CHAINLNK',   uo: 'MTR', cc: 'CC-CIVIL', rq: 500, aq: 0, ap: 4.200 },
          { ic: 'GIPIPE-2IN', uo: 'MTR', cc: 'CC-CIVIL', rq: 200, aq: 0, ap: 6.800 },
        ],
      },
    ];
    for (const p of defs) {
      const locationId   = locMap[p.loc];
      const chargeCodeId = codeMap[p.cc];
      const mrlId        = mrlMap[p.mrl] ?? null;
      if (!locationId || !chargeCodeId) { wn(`Missing data for PRL ${p.docNo}`); continue; }
      const existing = await prisma.purchaseRequisition.findFirst({ where: { companyId: company.id, docNo: p.docNo } });
      if (existing) { prlMap[p.docNo] = existing.id; continue; }
      const r = await prisma.purchaseRequisition.create({
        data: {
          companyId: company.id, docNo: p.docNo, docDate: p.dd, deliveryDate: p.dlv,
          locationId, chargeCodeId, mrlId, remarks: p.remarks, status: p.status as any,
          createdById: adminUser.id,
          approvedById: p.status === 'APPROVED' ? adminUser.id : null,
          lines: {
            create: p.lines.map((l, i) => ({
              lineNo: i + 1, itemId: itemMap[l.ic], uomId: uomMap[l.uo],
              chargeCodeId: codeMap[l.cc], requestedQty: l.rq, approvedQty: l.aq,
              approxPrice: l.ap, freeStock: 0,
            })),
          },
        },
      });
      prlMap[p.docNo] = r.id;
    }
    ok(`${defs.length} PRLs`);
  } catch (e) { wn(`PRLs: ${e}`); }

  // ═══════════════════════════════════════════════════════════════════════════
  // 10a. PR LINE SUB-SECTIONS
  //      Delivery Schedules · A/C Details · Alternate Items · Lead Times · Short Close
  // ═══════════════════════════════════════════════════════════════════════════
  hr('10a · PR Line Sub-Sections');
  try {
    // Fetch saved PRL lines for the three PRs we will enrich
    const prl1Lines = prlMap['PR-2025-0001']
      ? await prisma.prlLine.findMany({ where: { prlId: prlMap['PR-2025-0001'] }, orderBy: { lineNo: 'asc' } })
      : [];
    const prl2Lines = prlMap['PR-2025-0002']
      ? await prisma.prlLine.findMany({ where: { prlId: prlMap['PR-2025-0002'] }, orderBy: { lineNo: 'asc' } })
      : [];
    const prl4Lines = prlMap['PR-2025-0004']
      ? await prisma.prlLine.findMany({ where: { prlId: prlMap['PR-2025-0004'] }, orderBy: { lineNo: 'asc' } })
      : [];

    let dsCount = 0; let adCount = 0; let aiCount = 0;

    // ── DELIVERY SCHEDULES ───────────────────────────────────────────────────
    // PR-2025-0001 Line 1 (REBAR-12MM 15 TON) — split into two deliveries
    if (prl1Lines[0]) {
      const ex = await prisma.prDeliverySchedule.count({ where: { prlLineId: prl1Lines[0].id } });
      if (!ex) {
        await prisma.prDeliverySchedule.createMany({ data: [
          { prlLineId: prl1Lines[0].id, deliveryDate: d(2025,2,10), qty: 8, locationId: locMap['DUQM-SITE'] ?? null, remarks: 'First batch – urgent for foundation' },
          { prlLineId: prl1Lines[0].id, deliveryDate: d(2025,2,20), qty: 7, locationId: locMap['DUQM-SITE'] ?? null, remarks: 'Second batch – balance'              },
        ] }); dsCount += 2;
      }
    }
    // PR-2025-0001 Line 2 (REBAR-16MM 10 TON) — single delivery
    if (prl1Lines[1]) {
      const ex = await prisma.prDeliverySchedule.count({ where: { prlLineId: prl1Lines[1].id } });
      if (!ex) {
        await prisma.prDeliverySchedule.createMany({ data: [
          { prlLineId: prl1Lines[1].id, deliveryDate: d(2025,2,15), qty: 10, locationId: locMap['DUQM-SITE'] ?? null },
        ] }); dsCount += 1;
      }
    }
    // PR-2025-0002 Line 1 (CUCBL-16SQ 500 MTR) — split across two dates
    if (prl2Lines[0]) {
      const ex = await prisma.prDeliverySchedule.count({ where: { prlLineId: prl2Lines[0].id } });
      if (!ex) {
        await prisma.prDeliverySchedule.createMany({ data: [
          { prlLineId: prl2Lines[0].id, deliveryDate: d(2025,2,20), qty: 250, locationId: locMap['DUQM-SITE'] ?? null, remarks: 'First fix – Duqm Block A' },
          { prlLineId: prl2Lines[0].id, deliveryDate: d(2025,3,1),  qty: 250, locationId: locMap['DUQM-SITE'] ?? null, remarks: 'Second fix – Duqm Block B' },
        ] }); dsCount += 2;
      }
    }

    // ── ACCOUNT DETAILS ──────────────────────────────────────────────────────
    // PR-2025-0001 Line 1 — 60% Material Costs (5300) / 40% Site Overheads (6100) both CC-DUQM
    if (prl1Lines[0] && glMap['5300'] && glMap['6100'] && codeMap['CC-DUQM']) {
      const ex = await prisma.prAccountDetail.count({ where: { prlLineId: prl1Lines[0].id } });
      if (!ex) {
        const lv = Number(prl1Lines[0].requestedQty) * Number(prl1Lines[0].approxPrice);
        await prisma.prAccountDetail.createMany({ data: [
          { prlLineId: prl1Lines[0].id, glAccountId: glMap['5300'], costCentreId: codeMap['CC-DUQM'], percentage: 60,  amount: parseFloat((lv * 0.6).toFixed(3)), budgetYear: 2025 },
          { prlLineId: prl1Lines[0].id, glAccountId: glMap['6100'], costCentreId: codeMap['CC-DUQM'], percentage: 40,  amount: parseFloat((lv * 0.4).toFixed(3)), budgetYear: 2025 },
        ] }); adCount += 2;
      }
    }
    // PR-2025-0001 Line 3 (CEMENT-OPC) — 100% Material Costs, CC-DUQM
    if (prl1Lines[2] && glMap['5300'] && codeMap['CC-DUQM']) {
      const ex = await prisma.prAccountDetail.count({ where: { prlLineId: prl1Lines[2].id } });
      if (!ex) {
        const lv = Number(prl1Lines[2].requestedQty) * Number(prl1Lines[2].approxPrice);
        await prisma.prAccountDetail.createMany({ data: [
          { prlLineId: prl1Lines[2].id, glAccountId: glMap['5300'], costCentreId: codeMap['CC-DUQM'], percentage: 100, amount: parseFloat(lv.toFixed(3)), budgetYear: 2025 },
        ] }); adCount += 1;
      }
    }
    // PR-2025-0002 Line 1 (CUCBL-16SQ) — 100% Material Costs, CC-MEP
    if (prl2Lines[0] && glMap['5300'] && codeMap['CC-MEP']) {
      const ex = await prisma.prAccountDetail.count({ where: { prlLineId: prl2Lines[0].id } });
      if (!ex) {
        const lv = Number(prl2Lines[0].requestedQty) * Number(prl2Lines[0].approxPrice);
        await prisma.prAccountDetail.createMany({ data: [
          { prlLineId: prl2Lines[0].id, glAccountId: glMap['5300'], costCentreId: codeMap['CC-MEP'],  percentage: 100, amount: parseFloat(lv.toFixed(3)), budgetYear: 2025 },
        ] }); adCount += 1;
      }
    }

    // ── ALTERNATE ITEMS ──────────────────────────────────────────────────────
    // PR-2025-0001 Line 1 (REBAR-12MM) → REBAR-16MM (p1), REBAR-20MM (p2)
    if (prl1Lines[0] && itemMap['REBAR-16MM'] && itemMap['REBAR-20MM']) {
      const ex = await prisma.prAlternateItem.count({ where: { prlLineId: prl1Lines[0].id } });
      if (!ex) {
        await prisma.prAlternateItem.createMany({ data: [
          { prlLineId: prl1Lines[0].id, itemId: itemMap['REBAR-16MM'], uom: 'TON', approxPrice: 188.000, priority: 1, remarks: 'Acceptable grade substitution'    },
          { prlLineId: prl1Lines[0].id, itemId: itemMap['REBAR-20MM'], uom: 'TON', approxPrice: 192.000, priority: 2, remarks: 'Only if 12mm & 16mm unavailable'   },
        ] }); aiCount += 2;
      }
    }
    // PR-2025-0002 Line 1 (CUCBL-16SQ) → CUCBL-35SQ (p1)
    if (prl2Lines[0] && itemMap['CUCBL-35SQ']) {
      const ex = await prisma.prAlternateItem.count({ where: { prlLineId: prl2Lines[0].id } });
      if (!ex) {
        await prisma.prAlternateItem.createMany({ data: [
          { prlLineId: prl2Lines[0].id, itemId: itemMap['CUCBL-35SQ'], uom: 'MTR', approxPrice: 11.200, priority: 1, remarks: 'Higher gauge – use if 16mm stock exhausted' },
        ] }); aiCount += 1;
      }
    }
    // PR-2025-0002 Line 2 (CUCBL-4SQ) → CUCBL-16SQ (p1)
    if (prl2Lines[1] && itemMap['CUCBL-16SQ']) {
      const ex = await prisma.prAlternateItem.count({ where: { prlLineId: prl2Lines[1].id } });
      if (!ex) {
        await prisma.prAlternateItem.createMany({ data: [
          { prlLineId: prl2Lines[1].id, itemId: itemMap['CUCBL-16SQ'], uom: 'MTR', approxPrice: 5.600, priority: 1, remarks: 'Larger gauge accepted by site engineer' },
        ] }); aiCount += 1;
      }
    }

    // ── LEAD TIMES ───────────────────────────────────────────────────────────
    // Stamp system-derived lead times on PR-2025-0001 & PR-2025-0002 lines
    const ltUpdates: Array<{ id: string; days: number; date: Date }> = [
      ...(prl1Lines.map((l, i) => ({ id: l.id, days: 14 + i * 3, date: d(2025, 2, 10 + i * 5) }))),
      ...(prl2Lines.map((l, i) => ({ id: l.id, days: 21 + i * 2, date: d(2025, 2, 18 + i * 4) }))),
    ];
    for (const lt of ltUpdates) {
      await prisma.prlLine.updateMany({
        where: { id: lt.id, leadTimeDays: null },
        data:  { leadTimeDays: lt.days, leadTimeSource: 'SYSTEM', expectedDeliveryDate: lt.date },
      });
    }

    // ── SHORT CLOSE ──────────────────────────────────────────────────────────
    // PR-2025-0004 Line 3 (BNDWRE-16, rq=200 KG) — partial close: 150 received, 50 deferred
    if (prl4Lines[2]) {
      await prisma.prlLine.updateMany({
        where: { id: prl4Lines[2].id, shortCloseStatus: 'NONE' },
        data:  {
          shortCloseStatus:  'PARTIAL',
          shortClosedQty:     150,
          shortCloseReason:  'Remaining 50 KG deferred to Q2 – site storage full',
          shortClosedAt:      d(2025, 4, 1),
          shortClosedById:    adminUser.id,
        },
      });
    }

    ok(`${dsCount} Delivery Schedules · ${adCount} A/C Details · ${aiCount} Alternate Items · lead-time stamps · 1 short-close`);
  } catch (e) { wn(`PR Sub-Sections: ${e}`); }

  // ═══════════════════════════════════════════════════════════════════════════
  // 11. PURCHASE ENQUIRIES / RFQ (3)
  // ═══════════════════════════════════════════════════════════════════════════
  hr('11 · Purchase Enquiries (RFQ)');
  const rfqMap: Record<string, string> = {};
  try {
    const defs = [
      { docNo: 'RFQ-2025-0001', dd: d(2025,1,18), prl: 'PR-2025-0001' },
      { docNo: 'RFQ-2025-0002', dd: d(2025,1,20), prl: 'PR-2025-0002' },
      { docNo: 'RFQ-2025-0003', dd: d(2025,2,8),  prl: 'PR-2025-0003' },
    ];
    for (const r of defs) {
      const prlId = prlMap[r.prl] ?? null;
      const ex = await prisma.purchaseEnquiry.findFirst({ where: { companyId: company.id, docNo: r.docNo } });
      if (ex) { rfqMap[r.docNo] = ex.id; continue; }
      const rec = await prisma.purchaseEnquiry.create({
        data: { companyId: company.id, docNo: r.docNo, docDate: r.dd, prlId, status: 'SENT', createdById: adminUser.id },
      });
      rfqMap[r.docNo] = rec.id;
    }
    ok(`${defs.length} RFQs`);
  } catch (e) { wn(`RFQs: ${e}`); }

  // ═══════════════════════════════════════════════════════════════════════════
  // 12. SUPPLIER QUOTATIONS (6 — 2 per RFQ)
  // ═══════════════════════════════════════════════════════════════════════════
  hr('12 · Supplier Quotations');
  const quotMap: Record<string, string> = {};
  try {
    const defs = [
      { docNo: 'PQ-2025-0001', rfq: 'RFQ-2025-0001', supp: 'SUP-ALHSN',  vd: d(2025,2,18), total: 12650.000, status: 'AWARDED' },
      { docNo: 'PQ-2025-0002', rfq: 'RFQ-2025-0001', supp: 'SUP-CARILI', vd: d(2025,2,18), total: 13100.000, status: 'DRAFT'   },
      { docNo: 'PQ-2025-0003', rfq: 'RFQ-2025-0002', supp: 'SUP-MUSCAB', vd: d(2025,2,20), total:  5650.000, status: 'AWARDED' },
      { docNo: 'PQ-2025-0004', rfq: 'RFQ-2025-0002', supp: 'SUP-ATURKI', vd: d(2025,2,20), total:  5900.000, status: 'DRAFT'   },
      { docNo: 'PQ-2025-0005', rfq: 'RFQ-2025-0003', supp: 'SUP-NATPIP', vd: d(2025,3,8),  total:  8420.000, status: 'AWARDED' },
      { docNo: 'PQ-2025-0006', rfq: 'RFQ-2025-0003', supp: 'SUP-GULFPC', vd: d(2025,3,8),  total:  8800.000, status: 'DRAFT'   },
    ];
    for (const q of defs) {
      const supplierId = supplierMap[q.supp];
      const enquiryId  = rfqMap[q.rfq] ?? null;
      if (!supplierId) { wn(`Supplier ${q.supp} missing`); continue; }
      const ex = await prisma.purchaseQuotation.findFirst({ where: { companyId: company.id, docNo: q.docNo } });
      if (ex) { quotMap[q.docNo] = ex.id; continue; }
      const r = await prisma.purchaseQuotation.create({
        data: {
          companyId: company.id, docNo: q.docNo, supplierId, enquiryId,
          validityDate: q.vd, currencyId: omrCurrency.id,
          paymentTerms: 'Net 45 days', status: q.status, totalAmount: q.total,
          createdById: adminUser.id,
        },
      });
      quotMap[q.docNo] = r.id;
    }
    ok(`${defs.length} Quotations`);
  } catch (e) { wn(`Quotations: ${e}`); }

  // ═══════════════════════════════════════════════════════════════════════════
  // 13. PURCHASE ORDERS (4) with lines
  // ═══════════════════════════════════════════════════════════════════════════
  hr('13 · Purchase Orders');
  const poMap:     Record<string, string> = {};
  const poLineMap: Record<string, string> = {};
  try {
    type PLn = { ic: string; uo: string; qty: number; up: number; cc: string };
    type PO  = { docNo: string; dd: Date; dlv: Date; supp: string; status: string; terms: string; lines: PLn[] };
    const defs: PO[] = [
      {
        docNo: 'PO-2025-0001', dd: d(2025,2,1), dlv: d(2025,3,5),
        supp: 'SUP-ALHSN', status: 'APPROVED', terms: 'Net 45 days',
        lines: [
          { ic: 'REBAR-12MM', uo: 'TON', qty: 15,   up: 182.500, cc: 'CC-DUQM' },
          { ic: 'REBAR-16MM', uo: 'TON', qty: 10,   up: 185.000, cc: 'CC-DUQM' },
          { ic: 'CEMENT-OPC', uo: 'BAG', qty: 800,  up: 2.100,   cc: 'CC-DUQM' },
          { ic: 'HLWBLK-200', uo: 'NOS', qty: 3000, up: 0.340,   cc: 'CC-DUQM' },
        ],
      },
      {
        docNo: 'PO-2025-0002', dd: d(2025,2,3), dlv: d(2025,3,10),
        supp: 'SUP-MUSCAB', status: 'APPROVED', terms: 'Net 60 days',
        lines: [
          { ic: 'CUCBL-16SQ', uo: 'MTR', qty: 500,  up: 5.500, cc: 'CC-MEP' },
          { ic: 'CUCBL-4SQ',  uo: 'MTR', qty: 800,  up: 1.800, cc: 'CC-MEP' },
          { ic: 'COND-PVC25', uo: 'MTR', qty: 1200, up: 0.620, cc: 'CC-MEP' },
        ],
      },
      {
        docNo: 'PO-2025-0003', dd: d(2025,2,10), dlv: d(2025,3,20),
        supp: 'SUP-NATPIP', status: 'APPROVED', terms: 'Net 45 days',
        lines: [
          { ic: 'HDPE-110',   uo: 'MTR', qty: 400, up: 8.600,  cc: 'CC-SOHAR' },
          { ic: 'HDPE-160',   uo: 'MTR', qty: 200, up: 14.000, cc: 'CC-SOHAR' },
          { ic: 'GIPIPE-2IN', uo: 'MTR', qty: 300, up: 6.700,  cc: 'CC-SOHAR' },
        ],
      },
      {
        docNo: 'PO-2025-0004', dd: d(2025,3,5), dlv: d(2025,4,15),
        supp: 'SUP-OMANCT', status: 'DRAFT', terms: 'Net 30 days',
        lines: [
          { ic: 'CEMENT-OPC', uo: 'BAG', qty: 1500, up: 2.050,  cc: 'CC-SOHAR' },
          { ic: 'RMC-C25',    uo: 'M3',  qty: 120,  up: 37.500, cc: 'CC-SOHAR' },
        ],
      },
    ];
    for (const po of defs) {
      const supplierId = supplierMap[po.supp];
      if (!supplierId) { wn(`Supplier ${po.supp} missing`); continue; }
      const ex = await prisma.purchaseOrder.findFirst({ where: { companyId: company.id, docNo: po.docNo }, include: { lines: true } });
      if (ex) {
        poMap[po.docNo] = ex.id;
        ex.lines.forEach(l => { poLineMap[`${po.docNo}:${l.lineNo}`] = l.id; });
        continue;
      }
      const totalAmount = po.lines.reduce((s, l) => s + l.qty * l.up, 0);
      const rec = await prisma.purchaseOrder.create({
        data: {
          companyId: company.id, docNo: po.docNo, docDate: po.dd, deliveryDate: po.dlv,
          supplierId, currencyId: omrCurrency.id, exchangeRate: 1,
          paymentTerms: po.terms, status: po.status as any, totalAmount,
          createdById: adminUser.id,
          approvedById: po.status === 'APPROVED' ? adminUser.id : null,
          lines: {
            create: po.lines.map((l, i) => ({
              lineNo: i + 1, itemId: itemMap[l.ic], uomId: uomMap[l.uo],
              chargeCodeId: codeMap[l.cc], orderedQty: l.qty, unitPrice: l.up,
              netAmount: parseFloat((l.qty * l.up).toFixed(3)),
            })),
          },
        },
        include: { lines: true },
      });
      poMap[po.docNo] = rec.id;
      rec.lines.forEach(l => { poLineMap[`${po.docNo}:${l.lineNo}`] = l.id; });
    }
    ok(`${defs.length} Purchase Orders`);
  } catch (e) { wn(`Purchase Orders: ${e}`); }

  // ═══════════════════════════════════════════════════════════════════════════
  // 14. GRNs (4) with lines
  // ═══════════════════════════════════════════════════════════════════════════
  hr('14 · Goods Receipt Notes (GRN)');
  const grnMap: Record<string, string> = {};
  try {
    type GLn = { plk: string; ic: string; rq: number; bk: string };
    type GDef = { docNo: string; dd: Date; po: string; supp: string; wh: string; lines: GLn[] };
    const defs: GDef[] = [
      {
        docNo: 'GRN-2025-0001', dd: d(2025,3,7), po: 'PO-2025-0001', supp: 'SUP-ALHSN', wh: 'WH-MUSCAT',
        lines: [
          { plk: 'PO-2025-0001:1', ic: 'REBAR-12MM', rq: 15,   bk: 'WH-MUSCAT:BULK-A' },
          { plk: 'PO-2025-0001:2', ic: 'REBAR-16MM', rq: 10,   bk: 'WH-MUSCAT:BULK-A' },
          { plk: 'PO-2025-0001:3', ic: 'CEMENT-OPC', rq: 700,  bk: 'WH-MUSCAT:BULK-B' },
          { plk: 'PO-2025-0001:4', ic: 'HLWBLK-200', rq: 2500, bk: 'WH-MUSCAT:BULK-B' },
        ],
      },
      {
        docNo: 'GRN-2025-0002', dd: d(2025,3,12), po: 'PO-2025-0002', supp: 'SUP-MUSCAB', wh: 'WH-DUQM',
        lines: [
          { plk: 'PO-2025-0002:1', ic: 'CUCBL-16SQ', rq: 500,  bk: 'WH-DUQM:BULK-A' },
          { plk: 'PO-2025-0002:2', ic: 'CUCBL-4SQ',  rq: 800,  bk: 'WH-DUQM:BULK-A' },
          { plk: 'PO-2025-0002:3', ic: 'COND-PVC25', rq: 1000, bk: 'WH-DUQM:BULK-B' },
        ],
      },
      {
        docNo: 'GRN-2025-0003', dd: d(2025,3,22), po: 'PO-2025-0003', supp: 'SUP-NATPIP', wh: 'WH-SOHAR',
        lines: [
          { plk: 'PO-2025-0003:1', ic: 'HDPE-110',   rq: 300, bk: 'WH-SOHAR:BULK-A' },
          { plk: 'PO-2025-0003:2', ic: 'HDPE-160',   rq: 180, bk: 'WH-SOHAR:BULK-A' },
          { plk: 'PO-2025-0003:3', ic: 'GIPIPE-2IN', rq: 300, bk: 'WH-SOHAR:BULK-B' },
        ],
      },
      {
        docNo: 'GRN-2025-0004', dd: d(2025,3,20), po: 'PO-2025-0001', supp: 'SUP-ALHSN', wh: 'WH-DUQM',
        lines: [
          { plk: 'PO-2025-0001:3', ic: 'CEMENT-OPC', rq: 100, bk: 'WH-DUQM:RCVNG' },
          { plk: 'PO-2025-0001:4', ic: 'HLWBLK-200', rq: 500, bk: 'WH-DUQM:RCVNG' },
        ],
      },
    ];
    for (const g of defs) {
      const poId       = poMap[g.po]       ?? null;
      const supplierId = supplierMap[g.supp];
      const warehouseId = whMap[g.wh];
      if (!supplierId || !warehouseId) { wn(`Missing data for GRN ${g.docNo}`); continue; }
      const ex = await prisma.grnHeader.findFirst({ where: { companyId: company.id, docNo: g.docNo } });
      if (ex) { grnMap[g.docNo] = ex.id; continue; }
      const rec = await prisma.grnHeader.create({
        data: {
          companyId: company.id, docNo: g.docNo, poId, supplierId, warehouseId,
          docDate: g.dd, status: 'POSTED', postedAt: g.dd, createdById: adminUser.id,
          lines: {
            create: g.lines.map((l, i) => ({
              lineNo: i + 1, itemId: itemMap[l.ic],
              poLineId: poLineMap[l.plk] ?? null,
              receivedQty: l.rq, acceptedQty: l.rq, rejectedQty: 0,
              binId: binMap[l.bk] ?? null,
            })),
          },
        },
      });
      grnMap[g.docNo] = rec.id;
    }
    ok(`${defs.length} GRNs`);
  } catch (e) { wn(`GRNs: ${e}`); }

  // ═══════════════════════════════════════════════════════════════════════════
  // 15. STOCK ISSUES (3) with lines
  // ═══════════════════════════════════════════════════════════════════════════
  hr('15 · Stock Issues');
  try {
    type ILn = { ic: string; uo: string; qty: number; bk: string };
    type IDef = { docNo: string; dd: Date; wh: string; cc: string; mrl: string; lines: ILn[] };
    const defs: IDef[] = [
      {
        docNo: 'ISS-2025-0001', dd: d(2025,3,10), wh: 'WH-MUSCAT', cc: 'CC-DUQM', mrl: 'MRL-2025-0001',
        lines: [
          { ic: 'REBAR-12MM', uo: 'TON', qty: 10,  bk: 'WH-MUSCAT:BULK-A' },
          { ic: 'REBAR-16MM', uo: 'TON', qty: 8,   bk: 'WH-MUSCAT:BULK-A' },
          { ic: 'CEMENT-OPC', uo: 'BAG', qty: 500, bk: 'WH-MUSCAT:BULK-B' },
        ],
      },
      {
        docNo: 'ISS-2025-0002', dd: d(2025,3,15), wh: 'WH-DUQM', cc: 'CC-MEP', mrl: 'MRL-2025-0002',
        lines: [
          { ic: 'CUCBL-16SQ', uo: 'MTR', qty: 300, bk: 'WH-DUQM:BULK-A' },
          { ic: 'COND-PVC25', uo: 'MTR', qty: 600, bk: 'WH-DUQM:BULK-B' },
        ],
      },
      {
        docNo: 'ISS-2025-0003', dd: d(2025,3,25), wh: 'WH-SOHAR', cc: 'CC-SOHAR', mrl: 'MRL-2025-0003',
        lines: [
          { ic: 'HDPE-110',   uo: 'MTR', qty: 200, bk: 'WH-SOHAR:BULK-A' },
          { ic: 'GIPIPE-2IN', uo: 'MTR', qty: 150, bk: 'WH-SOHAR:BULK-B' },
        ],
      },
    ];
    for (const iss of defs) {
      const warehouseId  = whMap[iss.wh];
      const chargeCodeId = codeMap[iss.cc];
      const mrlId        = mrlMap[iss.mrl] ?? null;
      if (!warehouseId || !chargeCodeId) { wn(`Missing data for Issue ${iss.docNo}`); continue; }
      const ex = await prisma.stockIssue.findFirst({ where: { companyId: company.id, docNo: iss.docNo } });
      if (ex) continue;
      await prisma.stockIssue.create({
        data: {
          companyId: company.id, docNo: iss.docNo, docDate: iss.dd,
          warehouseId, chargeCodeId, mrlId, status: 'POSTED', createdById: adminUser.id,
          lines: {
            create: iss.lines.map((l, i) => ({
              lineNo: i + 1, itemId: itemMap[l.ic], uomId: uomMap[l.uo],
              issuedQty: l.qty, avgCost: 0, binId: binMap[l.bk] ?? null,
            })),
          },
        },
      });
    }
    ok(`${defs.length} Stock Issues`);
  } catch (e) { wn(`Stock Issues: ${e}`); }

  // ═══════════════════════════════════════════════════════════════════════════
  // 16. JOURNAL ENTRIES (5) — debit = credit enforced
  // ═══════════════════════════════════════════════════════════════════════════
  hr('16 · Journal Entries');
  try {
    type JLn = { ac: string; ccCode?: string; dr: number; cr: number; desc: string };
    type JDef = { docNo: string; ed: Date; desc: string; lines: JLn[] };
    const defs: JDef[] = [
      {
        docNo: 'JV-2025-0001', ed: d(2025,1,1), desc: 'Opening balances – Al Wadi Construction 2025',
        lines: [
          { ac: '1110',  dr: 125000.000, cr: 0,          desc: 'Opening bank balance – NBD Muscat' },
          { ac: '1200',  dr:  85000.000, cr: 0,          desc: 'Opening AR balance' },
          { ac: '1310',  dr:  42500.000, cr: 0,          desc: 'Opening raw materials stock' },
          { ac: '3100',  dr: 0,          cr: 252500.000, desc: 'Opening retained earnings' },
        ],
      },
      {
        docNo: 'JV-2025-0002', ed: d(2025,3,8), desc: 'GRN accrual – PO-2025-0001 steel & cement',
        lines: [
          { ac: '5300', ccCode: 'CC-DUQM', dr: 12650.000, cr: 0,          desc: 'Material costs – Duqm foundation' },
          { ac: '2200',                    dr: 0,          cr: 12650.000,  desc: 'GRN clearing – PO-2025-0001' },
        ],
      },
      {
        docNo: 'JV-2025-0003', ed: d(2025,3,15), desc: 'AP payment – Al Hassan Engineering settlement',
        lines: [
          { ac: '2100', dr: 12650.000, cr: 0,          desc: 'Clear AP – Al Hassan Eng. inv ALHSN-INV-24301' },
          { ac: '1110', dr: 0,         cr: 12650.000,  desc: 'Bank transfer – NBD TRF 20250315' },
        ],
      },
      {
        docNo: 'JV-2025-0004', ed: d(2025,3,31), desc: 'Payroll allocation Q1 2025 – site labour',
        lines: [
          { ac: '5100', ccCode: 'CC-CIVIL', dr: 18500.000, cr: 0,          desc: 'Direct labour – Civil works Q1 2025' },
          { ac: '5100', ccCode: 'CC-MEP',   dr: 12000.000, cr: 0,          desc: 'Direct labour – MEP works Q1 2025'   },
          { ac: '2100',                     dr: 0,          cr: 30500.000, desc: 'Payroll payable – March 2025'         },
        ],
      },
      {
        docNo: 'JV-2025-0005', ed: d(2025,3,31), desc: 'Depreciation charge – plant & equipment Q1 2025',
        lines: [
          { ac: '7100', ccCode: 'CC-DUQM',  dr: 4250.000, cr: 0,         desc: 'Depreciation – Duqm site plant Q1'  },
          { ac: '7100', ccCode: 'CC-SOHAR', dr: 3500.000, cr: 0,         desc: 'Depreciation – Sohar site plant Q1' },
          { ac: '2300',                     dr: 0,         cr: 7750.000, desc: 'Accumulated depreciation provision'  },
        ],
      },
    ];
    for (const jv of defs) {
      const ex = await prisma.journalEntry.findFirst({ where: { companyId: company.id, docNo: jv.docNo } });
      if (ex) continue;
      await prisma.journalEntry.create({
        data: {
          companyId: company.id, docNo: jv.docNo, entryDate: jv.ed,
          description: jv.desc, sourceModule: 'FINANCE',
          status: 'POSTED', postedAt: jv.ed, createdById: adminUser.id,
          lines: {
            create: jv.lines.map((l, i) => ({
              lineNo: i + 1,
              accountId:    glMap[l.ac],
              costCenterId: l.ccCode ? (ccMap[l.ccCode] ?? null) : null,
              debit: l.dr, credit: l.cr, description: l.desc,
            })),
          },
        },
      });
    }
    ok(`${defs.length} Journal Entries`);
  } catch (e) { wn(`Journals: ${e}`); }

  // ═══════════════════════════════════════════════════════════════════════════
  // 17. AP INVOICES (5)
  // ═══════════════════════════════════════════════════════════════════════════
  hr('17 · AP Invoices');
  const apInvMap: Record<string, string> = {};
  try {
    const defs = [
      { docNo: 'APINV-2025-0001', supp: 'SUP-ALHSN',  po: 'PO-2025-0001', grn: 'GRN-2025-0001', sinv: 'ALHSN-INV-24301',   id: d(2025,3,10), dd: d(2025,4,24), amt: 12480.500, tax: 624.025,   status: 'APPROVED', mf: 'MATCHED'  },
      { docNo: 'APINV-2025-0002', supp: 'SUP-MUSCAB', po: 'PO-2025-0002', grn: 'GRN-2025-0002', sinv: 'MCG-2025-0892',      id: d(2025,3,15), dd: d(2025,5,14), amt:  5640.000, tax: 282.000,   status: 'APPROVED', mf: 'MATCHED'  },
      { docNo: 'APINV-2025-0003', supp: 'SUP-NATPIP', po: 'PO-2025-0003', grn: 'GRN-2025-0003', sinv: 'NPC-INV-0315-88',    id: d(2025,3,25), dd: d(2025,5,9),  amt:  7310.000, tax: 365.500,   status: 'APPROVED', mf: 'MATCHED'  },
      { docNo: 'APINV-2025-0004', supp: 'SUP-ALHSN',  po: 'PO-2025-0001', grn: 'GRN-2025-0004', sinv: 'ALHSN-INV-24312',   id: d(2025,3,22), dd: d(2025,5,6),  amt:    985.000, tax:  49.250,   status: 'DRAFT',    mf: 'MATCHED'  },
      { docNo: 'APINV-2025-0005', supp: 'SUP-GALFAR', po: 'PO-2025-0003', grn: 'GRN-2025-0003', sinv: 'GALF-SC-20250398',   id: d(2025,4,1),  dd: d(2025,5,1),  amt: 48500.000, tax: 2425.000,  status: 'DRAFT',    mf: 'MISMATCH' },
    ];
    for (const inv of defs) {
      const supplierId = supplierMap[inv.supp];
      if (!supplierId) { wn(`Supplier ${inv.supp} missing`); continue; }
      const ex = await prisma.apInvoice.findFirst({ where: { companyId: company.id, docNo: inv.docNo } });
      if (ex) { apInvMap[inv.docNo] = ex.id; continue; }
      const r = await prisma.apInvoice.create({
        data: {
          companyId: company.id, docNo: inv.docNo, supplierId,
          poId: poMap[inv.po] ?? null, grnId: grnMap[inv.grn] ?? null,
          supplierInvoiceNo: inv.sinv, invoiceDate: inv.id, dueDate: inv.dd,
          amount: inv.amt, taxAmount: inv.tax, totalAmount: inv.amt + inv.tax,
          paidAmount: 0, status: inv.status as any, matchFlag: inv.mf,
          createdById: adminUser.id,
        },
      });
      apInvMap[inv.docNo] = r.id;
    }
    ok(`${defs.length} AP Invoices`);
  } catch (e) { wn(`AP Invoices: ${e}`); }

  // ═══════════════════════════════════════════════════════════════════════════
  // 18. AP PAYMENTS (3) + allocations
  // ═══════════════════════════════════════════════════════════════════════════
  hr('18 · AP Payments');
  try {
    const defs = [
      { docNo: 'APPAY-2025-0001', supp: 'SUP-ALHSN',  pd: d(2025,4,20), amt: 13104.525, inv: 'APINV-2025-0001' },
      { docNo: 'APPAY-2025-0002', supp: 'SUP-MUSCAB', pd: d(2025,5,10), amt:  5922.000, inv: 'APINV-2025-0002' },
      { docNo: 'APPAY-2025-0003', supp: 'SUP-NATPIP', pd: d(2025,5,5),  amt:  7675.500, inv: 'APINV-2025-0003' },
    ];
    for (const pay of defs) {
      const supplierId = supplierMap[pay.supp];
      const invoiceId  = apInvMap[pay.inv];
      if (!supplierId) { wn(`Supplier ${pay.supp} missing`); continue; }
      const ex = await prisma.apPayment.findFirst({ where: { companyId: company.id, docNo: pay.docNo } });
      if (ex) continue;
      const rec = await prisma.apPayment.create({
        data: {
          companyId: company.id, docNo: pay.docNo, supplierId,
          paymentDate: pay.pd, amount: pay.amt,
          paymentMethod: 'BANK_TRANSFER', status: 'POSTED',
          notes: `Bank transfer settlement – ${pay.docNo}`,
          createdById: adminUser.id,
        },
      });
      if (invoiceId) {
        await prisma.apAllocation.create({ data: { paymentId: rec.id, invoiceId, amount: pay.amt } });
        await prisma.apInvoice.update({ where: { id: invoiceId }, data: { paidAmount: pay.amt, status: 'PAID' } });
      }
    }
    ok(`${defs.length} AP Payments + allocations`);
  } catch (e) { wn(`AP Payments: ${e}`); }

  // ═══════════════════════════════════════════════════════════════════════════
  // 19. CUSTOMERS (4)
  // ═══════════════════════════════════════════════════════════════════════════
  hr('19 · Customers');
  const customerMap: Record<string, string> = {};
  try {
    const defs = [
      { code: 'PDO-OMN',  name: 'Petroleum Development Oman LLC'              },
      { code: 'OQ-CHEM',  name: 'OQ Chemicals (Oman Oil Refineries)'          },
      { code: 'OAMC-OMN', name: 'Oman Airports Management Company SAOC'       },
      { code: 'MOH-OMN',  name: 'Ministry of Housing – Sultanate of Oman'     },
    ];
    for (const c of defs) {
      const r = await prisma.customer.upsert({
        where: { companyId_code: { companyId: company.id, code: c.code } },
        update: {}, create: { companyId: company.id, ...c, isActive: true },
      });
      customerMap[c.code] = r.id;
    }
    ok(`${defs.length} Customers`);
  } catch (e) { wn(`Customers: ${e}`); }

  // ═══════════════════════════════════════════════════════════════════════════
  // 20. AR INVOICES (4)
  // ═══════════════════════════════════════════════════════════════════════════
  hr('20 · AR Invoices');
  const arInvMap: Record<string, string> = {};
  try {
    const defs = [
      { docNo: 'ARINV-2025-0001', cust: 'PDO-OMN',  id: d(2025,2,28), dd: d(2025,4,28), amt: 245000.000, tax: 12250.000, status: 'APPROVED', desc: 'Progress billing #1 – PDO Wellhead Platform Civil Works'    },
      { docNo: 'ARINV-2025-0002', cust: 'OQ-CHEM',  id: d(2025,3,15), dd: d(2025,5,14), amt: 182500.000, tax:  9125.000, status: 'APPROVED', desc: 'Progress billing #1 – OQ Sohar Refinery MEP Package'         },
      { docNo: 'ARINV-2025-0003', cust: 'OAMC-OMN', id: d(2025,3,25), dd: d(2025,5,24), amt:  95000.000, tax:  4750.000, status: 'APPROVED', desc: 'Milestone 2 – Muscat Airport Fit-Out Phase 2'               },
      { docNo: 'ARINV-2025-0004', cust: 'MOH-OMN',  id: d(2025,4,5),  dd: d(2025,6,4),  amt:  58000.000, tax:  2900.000, status: 'DRAFT',    desc: 'Variation Order #3 – MoH Housing Scheme Duqm'              },
    ];
    for (const inv of defs) {
      const customerId = customerMap[inv.cust];
      if (!customerId) { wn(`Customer ${inv.cust} missing`); continue; }
      const ex = await prisma.arInvoice.findFirst({ where: { companyId: company.id, docNo: inv.docNo } });
      if (ex) { arInvMap[inv.docNo] = ex.id; continue; }
      const r = await prisma.arInvoice.create({
        data: {
          companyId: company.id, docNo: inv.docNo, customerId, description: inv.desc,
          invoiceDate: inv.id, dueDate: inv.dd,
          amount: inv.amt, taxAmount: inv.tax, totalAmount: inv.amt + inv.tax,
          paidAmount: 0, status: inv.status, createdById: adminUser.id,
        },
      });
      arInvMap[inv.docNo] = r.id;
    }
    ok(`${defs.length} AR Invoices`);
  } catch (e) { wn(`AR Invoices: ${e}`); }

  // ═══════════════════════════════════════════════════════════════════════════
  // 21. AR RECEIPTS (2) + allocations
  // ═══════════════════════════════════════════════════════════════════════════
  hr('21 · AR Receipts');
  try {
    const defs = [
      { docNo: 'ARREC-2025-0001', cust: 'PDO-OMN',  rd: d(2025,4,25), amt: 257250.000, inv: 'ARINV-2025-0001' },
      { docNo: 'ARREC-2025-0002', cust: 'OQ-CHEM',  rd: d(2025,5,10), amt: 191625.000, inv: 'ARINV-2025-0002' },
    ];
    for (const rec of defs) {
      const customerId = customerMap[rec.cust];
      const invoiceId  = arInvMap[rec.inv];
      if (!customerId) { wn(`Customer ${rec.cust} missing`); continue; }
      const ex = await prisma.arReceipt.findFirst({ where: { companyId: company.id, docNo: rec.docNo } });
      if (ex) continue;
      const r = await prisma.arReceipt.create({
        data: {
          companyId: company.id, docNo: rec.docNo, customerId,
          receiptDate: rec.rd, amount: rec.amt,
          paymentMethod: 'BANK_TRANSFER', status: 'POSTED',
          notes: `Bank receipt – ${rec.docNo}`, createdById: adminUser.id,
        },
      });
      if (invoiceId) {
        await prisma.arAllocation.create({ data: { receiptId: r.id, invoiceId, amount: rec.amt } });
        await prisma.arInvoice.update({ where: { id: invoiceId }, data: { paidAmount: rec.amt, status: 'PAID' } });
      }
    }
    ok(`${defs.length} AR Receipts + allocations`);
  } catch (e) { wn(`AR Receipts: ${e}`); }

  // ═══════════════════════════════════════════════════════════════════════════
  // 22. BUDGETS + BUDGET PERIODS (3 plans)
  // ═══════════════════════════════════════════════════════════════════════════
  hr('22 · Budgets & Budget Periods');
  try {
    const YEAR = 2025;
    const manualWeights = [0.05, 0.06, 0.12, 0.13, 0.14, 0.13, 0.12, 0.10, 0.07, 0.06, 0.06, 0.06];

    type BLine = { ac: string; amt: number };
    type BPlan = { label: string; ccCode: string; phasing: 'EQUAL' | 'MANUAL'; lines: BLine[] };
    const plans: BPlan[] = [
      {
        label: 'Annual CAPEX Budget 2025', ccCode: 'CC-ADMIN', phasing: 'EQUAL',
        lines: [
          { ac: '5300', amt: 120000.000 }, { ac: '5400', amt: 85000.000  },
          { ac: '6100', amt: 45000.000  }, { ac: '6200', amt: 38000.000  },
          { ac: '7100', amt: 30000.000  },
        ],
      },
      {
        label: 'Duqm Project Budget 2025', ccCode: 'CC-DUQM', phasing: 'MANUAL',
        lines: [
          { ac: '5100', amt: 95000.000  }, { ac: '5200', amt: 180000.000 },
          { ac: '5300', amt: 220000.000 }, { ac: '5400', amt: 75000.000  },
          { ac: '6100', amt: 55000.000  },
        ],
      },
      {
        label: 'Sohar Project Budget 2025', ccCode: 'CC-SOHAR', phasing: 'EQUAL',
        lines: [
          { ac: '5100', amt: 80000.000  }, { ac: '5200', amt: 150000.000 },
          { ac: '5300', amt: 180000.000 }, { ac: '5400', amt: 60000.000  },
          { ac: '6100', amt: 45000.000  }, { ac: '6200', amt: 22000.000  },
        ],
      },
    ];

    let budgetsCreated = 0; let periodsCreated = 0;
    for (const plan of plans) {
      const costCenterId = ccMap[plan.ccCode] ?? null;
      for (const line of plan.lines) {
        const accountId = glMap[line.ac];
        if (!accountId) { wn(`GL ${line.ac} missing for budget`); continue; }
        let budget = await prisma.budget.findFirst({
          where: { companyId: company.id, fiscalYear: YEAR, accountId, costCenterId: costCenterId ?? undefined },
        });
        if (!budget) {
          budget = await prisma.budget.create({
            data: { companyId: company.id, fiscalYear: YEAR, accountId, costCenterId, annualAmount: line.amt },
          });
          budgetsCreated++;
        }
        for (let m = 1; m <= 12; m++) {
          const wt = plan.phasing === 'EQUAL' ? 1 / 12 : manualWeights[m - 1];
          const budgetedAmount = parseFloat((line.amt * wt).toFixed(3));
          const ex = await prisma.budgetPeriod.findFirst({
            where: { budgetId: budget.id, periodMonth: m, periodYear: YEAR },
          });
          if (!ex) {
            await prisma.budgetPeriod.create({
              data: { budgetId: budget.id, periodMonth: m, periodYear: YEAR, budgetedAmount, actualAmount: 0 },
            });
            periodsCreated++;
          }
        }
      }
    }
    ok(`${plans.length} budget plans → ${budgetsCreated} Budget rows + ${periodsCreated} BudgetPeriod rows`);
  } catch (e) { wn(`Budgets: ${e}`); }

  // ═══════════════════════════════════════════════════════════════════════════
  // 23. PERIOD CLOSES (Jan–Sep 2025 CLOSED)
  // ═══════════════════════════════════════════════════════════════════════════
  hr('23 · Period Closes');
  try {
    for (let m = 1; m <= 9; m++) {
      const ex = await prisma.periodClose.findFirst({
        where: { companyId: company.id, periodYear: 2025, periodMonth: m },
      });
      if (!ex) {
        await prisma.periodClose.create({
          data: {
            companyId: company.id, periodYear: 2025, periodMonth: m,
            closedAt: new Date(2025, m - 1, 28), closedById: adminUser.id,
          },
        });
      }
    }
    ok(`9 Period Closes created (Jan–Sep 2025 CLOSED; Oct–Dec OPEN)`);
  } catch (e) { wn(`Period Closes: ${e}`); }

  // ═══════════════════════════════════════════════════════════════════════════
  // SUMMARY TABLE
  // ═══════════════════════════════════════════════════════════════════════════
  hr('Record Count Summary');
  try {
    const rows: [string, number][] = await Promise.all([
      prisma.supplier.count({ where: { companyId: company.id } }).then(n => ['Suppliers'          , n] as [string,number]),
      prisma.supplierContact.count()                               .then(n => ['Supplier Contacts'  , n] as [string,number]),
      prisma.item.count({ where: { companyId: company.id } })     .then(n => ['Items'              , n] as [string,number]),
      prisma.uom.count({ where: { companyId: company.id } })      .then(n => ['UOMs'               , n] as [string,number]),
      prisma.itemCategory.count({ where: { companyId: company.id } }).then(n => ['Item Categories' , n] as [string,number]),
      prisma.warehouse.count({ where: { companyId: company.id } }).then(n => ['Warehouses'          , n] as [string,number]),
      prisma.bin.count()                                           .then(n => ['Bins'               , n] as [string,number]),
      prisma.costCenter.count({ where: { companyId: company.id } }).then(n => ['Cost Centres'      , n] as [string,number]),
      prisma.costCode.count({ where: { companyId: company.id } }) .then(n => ['Cost Codes'         , n] as [string,number]),
      prisma.glAccount.count({ where: { companyId: company.id } }).then(n => ['GL Accounts'        , n] as [string,number]),
      prisma.materialRequisition.count({ where: { companyId: company.id } }).then(n => ['MRLs'     , n] as [string,number]),
      prisma.mrlLine.count()                                       .then(n => ['MRL Lines'          , n] as [string,number]),
      prisma.purchaseRequisition.count({ where: { companyId: company.id } }).then(n => ['PRLs'     , n] as [string,number]),
      prisma.prlLine.count()                                       .then(n => ['PRL Lines'          , n] as [string,number]),
      prisma.prDeliverySchedule.count()                            .then(n => ['PR Delivery Schedules', n] as [string,number]),
      prisma.prAccountDetail.count()                               .then(n => ['PR Account Details' , n] as [string,number]),
      prisma.prAlternateItem.count()                               .then(n => ['PR Alternate Items' , n] as [string,number]),
      prisma.purchaseEnquiry.count({ where: { companyId: company.id } }).then(n => ['RFQs'         , n] as [string,number]),
      prisma.purchaseQuotation.count({ where: { companyId: company.id } }).then(n => ['Quotations' , n] as [string,number]),
      prisma.purchaseOrder.count({ where: { companyId: company.id } }).then(n => ['Purchase Orders', n] as [string,number]),
      prisma.poLine.count()                                        .then(n => ['PO Lines'           , n] as [string,number]),
      prisma.grnHeader.count({ where: { companyId: company.id } }).then(n => ['GRNs'              , n] as [string,number]),
      prisma.grnLine.count()                                       .then(n => ['GRN Lines'          , n] as [string,number]),
      prisma.stockIssue.count({ where: { companyId: company.id } }).then(n => ['Stock Issues'      , n] as [string,number]),
      prisma.stockIssueLine.count()                                .then(n => ['Issue Lines'        , n] as [string,number]),
      prisma.journalEntry.count({ where: { companyId: company.id } }).then(n => ['Journal Entries' , n] as [string,number]),
      prisma.journalLine.count()                                   .then(n => ['Journal Lines'      , n] as [string,number]),
      prisma.apInvoice.count({ where: { companyId: company.id } }).then(n => ['AP Invoices'        , n] as [string,number]),
      prisma.apPayment.count({ where: { companyId: company.id } }).then(n => ['AP Payments'        , n] as [string,number]),
      prisma.apAllocation.count()                                  .then(n => ['AP Allocations'     , n] as [string,number]),
      prisma.customer.count({ where: { companyId: company.id } }) .then(n => ['Customers'          , n] as [string,number]),
      prisma.arInvoice.count({ where: { companyId: company.id } }).then(n => ['AR Invoices'        , n] as [string,number]),
      prisma.arReceipt.count({ where: { companyId: company.id } }).then(n => ['AR Receipts'        , n] as [string,number]),
      prisma.arAllocation.count()                                  .then(n => ['AR Allocations'     , n] as [string,number]),
      prisma.budget.count({ where: { companyId: company.id } })   .then(n => ['Budgets'            , n] as [string,number]),
      prisma.budgetPeriod.count()                                  .then(n => ['Budget Periods'     , n] as [string,number]),
      prisma.periodClose.count({ where: { companyId: company.id } }).then(n => ['Period Closes'    , n] as [string,number]),
    ]);

    const W = Math.max(...rows.map(([l]) => l.length)) + 2;
    const line = '─'.repeat(W + 10);
    console.log('\n' + line);
    console.log(` ${'Model'.padEnd(W)} Count`);
    console.log(line);
    let total = 0;
    for (const [label, count] of rows) {
      console.log(` ${label.padEnd(W)} ${String(count).padStart(5)}`);
      total += count;
    }
    console.log(line);
    console.log(` ${'TOTAL'.padEnd(W)} ${String(total).padStart(5)}`);
    console.log(line);
    console.log('\n✅  Demo seed complete!\n');
  } catch (e) { wn(`Summary: ${e}`); }
}

main()
  .catch((e) => { console.error('\n❌ Seed failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
