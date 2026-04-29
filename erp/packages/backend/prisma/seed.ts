import { PrismaClient, Module, PermissionAction, LocationType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding CloudERP database...\n');

  // ── 1. Company ─────────────────────────────────────────────────────────────
  console.log('Creating company...');
  const company = await prisma.company.upsert({
    where: { code: 'DEMO01' },
    update: {},
    create: {
      code: 'DEMO01',
      name: 'Demo Trading LLC',
      baseCurrency: 'USD',
      modulesEnabled: ['PROCUREMENT', 'INVENTORY', 'FINANCE'],
      timezone: 'Asia/Muscat',
      fiscalYearStart: 1,
      isActive: true,
    },
  });
  console.log(`  ✓ Company: ${company.name} (${company.id})`);

  // ── 2. Locations ──────────────────────────────────────────────────────────
  console.log('Creating locations...');
  const [headOffice, enggStore, mainWarehouse] = await Promise.all([
    prisma.location.upsert({
      where: { companyId_code: { companyId: company.id, code: 'HEAD_OFFICE' } },
      update: {},
      create: { companyId: company.id, code: 'HEAD_OFFICE', name: 'Head Office', type: LocationType.OFFICE, address: 'Muscat, Oman' },
    }),
    prisma.location.upsert({
      where: { companyId_code: { companyId: company.id, code: 'ENGG_STORE' } },
      update: {},
      create: { companyId: company.id, code: 'ENGG_STORE', name: 'Store for Engineering Items', type: LocationType.WAREHOUSE, address: 'Muscat, Oman' },
    }),
    prisma.location.upsert({
      where: { companyId_code: { companyId: company.id, code: 'MAIN_WH' } },
      update: {},
      create: { companyId: company.id, code: 'MAIN_WH', name: 'Main Warehouse', type: LocationType.WAREHOUSE, address: 'Muscat, Oman' },
    }),
  ]);
  console.log(`  ✓ 3 Locations created`);

  // ── 3. Currencies ─────────────────────────────────────────────────────────
  console.log('Creating currencies...');
  const currencyData = [
    { code: 'USD', name: 'US Dollar',      symbol: '$',  isBase: true  },
    { code: 'EUR', name: 'Euro',           symbol: '€',  isBase: false },
    { code: 'GBP', name: 'British Pound',  symbol: '£',  isBase: false },
    { code: 'OMR', name: 'Omani Rial',     symbol: 'OMR', isBase: false },
    { code: 'AED', name: 'UAE Dirham',     symbol: 'AED', isBase: false },
  ];
  const currencies: Record<string, any> = {};
  for (const c of currencyData) {
    const cur = await prisma.currency.upsert({
      where: { companyId_code: { companyId: company.id, code: c.code } },
      update: {},
      create: { companyId: company.id, ...c },
    });
    currencies[c.code] = cur;
  }
  console.log(`  ✓ 5 Currencies created`);

  // ── 4. GL Accounts (minimal chart of accounts for seed) ──────────────────
  console.log('Creating GL accounts...');
  const glData = [
    // Assets
    { code: '1000', name: 'Current Assets',      accountType: 'ASSET' as const,     parentId: null },
    { code: '1100', name: 'Cash and Bank',        accountType: 'ASSET' as const,     parentCode: '1000' },
    { code: '1110', name: 'Main Bank Account',    accountType: 'ASSET' as const,     parentCode: '1100' },
    { code: '1200', name: 'Accounts Receivable',  accountType: 'ASSET' as const,     parentCode: '1000', isControl: true },
    { code: '1300', name: 'Inventory Account',    accountType: 'ASSET' as const,     parentCode: '1000' },
    { code: '1310', name: 'Raw Materials Stock',  accountType: 'ASSET' as const,     parentCode: '1300' },
    // Liabilities
    { code: '2000', name: 'Current Liabilities',  accountType: 'LIABILITY' as const, parentId: null },
    { code: '2100', name: 'Accounts Payable',     accountType: 'LIABILITY' as const, parentCode: '2000', isControl: true },
    { code: '2200', name: 'GRN Clearing',         accountType: 'LIABILITY' as const, parentCode: '2000' },
    { code: '2300', name: 'Sundry Creditors',     accountType: 'LIABILITY' as const, parentCode: '2000', isControl: true },
    // Equity
    { code: '3000', name: 'Equity',               accountType: 'EQUITY' as const,    parentId: null },
    { code: '3100', name: 'Retained Earnings',    accountType: 'EQUITY' as const,    parentCode: '3000' },
    // Revenue
    { code: '4000', name: 'Revenue',              accountType: 'REVENUE' as const,   parentId: null },
    { code: '4100', name: 'Sales Revenue',        accountType: 'REVENUE' as const,   parentCode: '4000' },
    // Expenses
    { code: '5000', name: 'Operating Expenses',   accountType: 'EXPENSE' as const,   parentId: null },
    { code: '5100', name: 'Cost of Goods Sold',   accountType: 'EXPENSE' as const,   parentCode: '5000' },
    { code: '5200', name: 'General & Admin',      accountType: 'EXPENSE' as const,   parentCode: '5000' },
    { code: '5300', name: 'Purchase Expense',     accountType: 'EXPENSE' as const,   parentCode: '5000' },
  ];

  const glMap: Record<string, string> = {}; // code -> id
  for (const gl of glData) {
    const parentId = gl.parentCode ? glMap[gl.parentCode] : null;
    const account = await prisma.glAccount.upsert({
      where: { companyId_code: { companyId: company.id, code: gl.code } },
      update: {},
      create: {
        companyId: company.id,
        code: gl.code,
        name: gl.name,
        accountType: gl.accountType,
        parentId,
        isControl: (gl as any).isControl ?? false,
        isActive: true,
      },
    });
    glMap[gl.code] = account.id;
  }
  console.log(`  ✓ ${glData.length} GL Accounts created`);

  // ── 5. Cost Centers ───────────────────────────────────────────────────────
  console.log('Creating cost centers & cost codes...');
  const cc1 = await prisma.costCenter.upsert({
    where: { companyId_code: { companyId: company.id, code: 'CC001' } },
    update: {},
    create: { companyId: company.id, code: 'CC001', name: 'Operations', isActive: true },
  });
  const cc2 = await prisma.costCenter.upsert({
    where: { companyId_code: { companyId: company.id, code: 'CC002' } },
    update: {},
    create: { companyId: company.id, code: 'CC002', name: 'Engineering', isActive: true },
  });

  const [costCode1, costCode2] = await Promise.all([
    prisma.costCode.upsert({
      where: { companyId_code: { companyId: company.id, code: 'COSTCTRE1' } },
      update: {},
      create: { companyId: company.id, code: 'COSTCTRE1', name: 'Cost Centre 1', costCenterId: cc1.id, type: 'COST_CENTER', isActive: true },
    }),
    prisma.costCode.upsert({
      where: { companyId_code: { companyId: company.id, code: 'COSTCTRE2' } },
      update: {},
      create: { companyId: company.id, code: 'COSTCTRE2', name: 'Cost Centre 2', costCenterId: cc2.id, type: 'COST_CENTER', isActive: true },
    }),
  ]);
  console.log(`  ✓ 2 Cost Centers + 2 Cost Codes created`);

  // ── 6. System Roles ───────────────────────────────────────────────────────
  console.log('Creating system roles...');

  type PermDef = { module: Module; resource: string; action: PermissionAction };

  const adminPerms: PermDef[] = [
    // Full access to everything
    ...['USERS', 'ROLES', 'CONFIG', 'SEQUENCES'].map(r => ([
      { module: Module.CORE, resource: r, action: PermissionAction.VIEW },
      { module: Module.CORE, resource: r, action: PermissionAction.CREATE },
      { module: Module.CORE, resource: r, action: PermissionAction.EDIT },
      { module: Module.CORE, resource: r, action: PermissionAction.DELETE },
      { module: Module.CORE, resource: r, action: PermissionAction.CONFIGURE },
    ])).flat(),
    ...['SUPPLIERS', 'MRL', 'PRL', 'ENQUIRY', 'QUOTATION', 'PO', 'SUPPLIER_RETURN'].map(r => ([
      { module: Module.PROCUREMENT, resource: r, action: PermissionAction.VIEW },
      { module: Module.PROCUREMENT, resource: r, action: PermissionAction.CREATE },
      { module: Module.PROCUREMENT, resource: r, action: PermissionAction.EDIT },
      { module: Module.PROCUREMENT, resource: r, action: PermissionAction.APPROVE },
      { module: Module.PROCUREMENT, resource: r, action: PermissionAction.DELETE },
      { module: Module.PROCUREMENT, resource: r, action: PermissionAction.VOID },
    ])).flat(),
    { module: Module.PROCUREMENT, resource: 'REPORTS', action: PermissionAction.VIEW },
    ...['ITEMS', 'WAREHOUSES', 'BIN', 'GRN', 'STOCK_ISSUE', 'STOCK_TRANSFER', 'STOCK_ADJUSTMENT', 'PHYSICAL_COUNT'].map(r => ([
      { module: Module.INVENTORY, resource: r, action: PermissionAction.VIEW },
      { module: Module.INVENTORY, resource: r, action: PermissionAction.CREATE },
      { module: Module.INVENTORY, resource: r, action: PermissionAction.EDIT },
      { module: Module.INVENTORY, resource: r, action: PermissionAction.APPROVE },
      { module: Module.INVENTORY, resource: r, action: PermissionAction.DELETE },
    ])).flat(),
    { module: Module.INVENTORY, resource: 'REPORTS', action: PermissionAction.VIEW },
    { module: Module.INVENTORY, resource: 'STOCK_SUMMARY', action: PermissionAction.VIEW },
    ...['GL_ACCOUNT', 'COST_CENTER', 'JOURNAL', 'AP', 'AR', 'BUDGET', 'PERIOD', 'ACCOUNT_MAPPING', 'REPORT'].map(r => ([
      { module: Module.FINANCE, resource: r, action: PermissionAction.VIEW },
      { module: Module.FINANCE, resource: r, action: PermissionAction.CREATE },
      { module: Module.FINANCE, resource: r, action: PermissionAction.EDIT },
      { module: Module.FINANCE, resource: r, action: PermissionAction.APPROVE },
      { module: Module.FINANCE, resource: r, action: PermissionAction.DELETE },
    ])).flat(),
  ];

  const procMgrPerms: PermDef[] = [
    ...['SUPPLIERS', 'MRL', 'PRL', 'ENQUIRY', 'QUOTATION', 'PO', 'SUPPLIER_RETURN'].map(r => ([
      { module: Module.PROCUREMENT, resource: r, action: PermissionAction.VIEW },
      { module: Module.PROCUREMENT, resource: r, action: PermissionAction.CREATE },
      { module: Module.PROCUREMENT, resource: r, action: PermissionAction.EDIT },
      { module: Module.PROCUREMENT, resource: r, action: PermissionAction.APPROVE },
      { module: Module.PROCUREMENT, resource: r, action: PermissionAction.DELETE },
    ])).flat(),
    { module: Module.PROCUREMENT, resource: 'REPORTS', action: PermissionAction.VIEW },
    // Read-only inventory
    ...['ITEMS', 'WAREHOUSES', 'GRN'].map(r => ([
      { module: Module.INVENTORY, resource: r, action: PermissionAction.VIEW },
    ])).flat(),
  ];

  const invMgrPerms: PermDef[] = [
    ...['ITEMS', 'WAREHOUSES', 'BIN', 'GRN', 'STOCK_ISSUE', 'STOCK_TRANSFER', 'STOCK_ADJUSTMENT', 'PHYSICAL_COUNT'].map(r => ([
      { module: Module.INVENTORY, resource: r, action: PermissionAction.VIEW },
      { module: Module.INVENTORY, resource: r, action: PermissionAction.CREATE },
      { module: Module.INVENTORY, resource: r, action: PermissionAction.EDIT },
      { module: Module.INVENTORY, resource: r, action: PermissionAction.APPROVE },
      { module: Module.INVENTORY, resource: r, action: PermissionAction.DELETE },
    ])).flat(),
    { module: Module.INVENTORY, resource: 'REPORTS', action: PermissionAction.VIEW },
    { module: Module.INVENTORY, resource: 'STOCK_SUMMARY', action: PermissionAction.VIEW },
    // Read-only procurement
    ...['SUPPLIERS', 'PO'].map(r => ([
      { module: Module.PROCUREMENT, resource: r, action: PermissionAction.VIEW },
    ])).flat(),
  ];

  const finMgrPerms: PermDef[] = [
    ...['GL_ACCOUNT', 'COST_CENTER', 'JOURNAL', 'AP', 'AR', 'BUDGET', 'PERIOD', 'ACCOUNT_MAPPING', 'REPORT'].map(r => ([
      { module: Module.FINANCE, resource: r, action: PermissionAction.VIEW },
      { module: Module.FINANCE, resource: r, action: PermissionAction.CREATE },
      { module: Module.FINANCE, resource: r, action: PermissionAction.EDIT },
      { module: Module.FINANCE, resource: r, action: PermissionAction.APPROVE },
      { module: Module.FINANCE, resource: r, action: PermissionAction.DELETE },
    ])).flat(),
    // Read-only on other modules
    ...['ITEMS', 'STOCK_ADJUSTMENT'].map(r => ([
      { module: Module.INVENTORY, resource: r, action: PermissionAction.VIEW },
    ])).flat(),
    ...['SUPPLIERS', 'PO', 'GRN'].map(r => ([
      { module: Module.PROCUREMENT, resource: r, action: PermissionAction.VIEW },
    ])).flat(),
  ];

  const roleDefs = [
    { name: 'SYSTEM_ADMIN',        description: 'Full system access',           perms: adminPerms   },
    { name: 'PROCUREMENT_MANAGER', description: 'Procurement module manager',   perms: procMgrPerms },
    { name: 'INVENTORY_MANAGER',   description: 'Inventory module manager',     perms: invMgrPerms  },
    { name: 'FINANCE_MANAGER',     description: 'Finance module manager',       perms: finMgrPerms  },
  ];

  const roles: Record<string, string> = {};
  for (const rd of roleDefs) {
    const existing = await prisma.role.findFirst({ where: { companyId: company.id, name: rd.name } });
    let role;
    if (existing) {
      role = existing;
    } else {
      role = await prisma.role.create({
        data: { companyId: company.id, name: rd.name, description: rd.description, isSystem: true },
      });
    }
    roles[rd.name] = role.id;

    // Create permissions (upsert individually)
    await prisma.permission.deleteMany({ where: { roleId: role.id } });
    await prisma.permission.createMany({ data: rd.perms.map(p => ({ ...p, roleId: role.id })), skipDuplicates: true });
  }
  console.log(`  ✓ 4 System Roles created with permissions`);

  // ── 7. Admin User ─────────────────────────────────────────────────────────
  console.log('Creating admin user...');
  const passwordHash = await bcrypt.hash('Admin@123', 12);
  const adminUser = await prisma.user.upsert({
    where: { companyId_email: { companyId: company.id, email: 'admin@demo.com' } },
    update: {},
    create: {
      companyId: company.id,
      email: 'admin@demo.com',
      passwordHash,
      firstName: 'System',
      lastName: 'Administrator',
      roleId: roles['SYSTEM_ADMIN'],
      locationId: headOffice.id,
      isActive: true,
    },
  });
  console.log(`  ✓ Admin user: admin@demo.com / Admin@123 (${adminUser.id})`);

  // ── 8. Document Sequences ─────────────────────────────────────────────────
  console.log('Creating document sequences...');
  const sequenceDefs = [
    { module: 'PROCUREMENT', docType: 'MRL',  prefix: 'MRL',  nextNo: 1, padLength: 4 },
    { module: 'PROCUREMENT', docType: 'PRL',  prefix: 'PRL',  nextNo: 1, padLength: 4 },
    { module: 'PROCUREMENT', docType: 'PE',   prefix: 'PE',   nextNo: 1, padLength: 4 },
    { module: 'PROCUREMENT', docType: 'PQ',   prefix: 'PQ',   nextNo: 1, padLength: 4 },
    { module: 'PROCUREMENT', docType: 'PO',   prefix: 'PO',   nextNo: 1, padLength: 4 },
    { module: 'INVENTORY',   docType: 'GRN',  prefix: 'GRN',  nextNo: 1, padLength: 4 },
    { module: 'INVENTORY',   docType: 'SI',   prefix: 'SI',   nextNo: 1, padLength: 4 },
    { module: 'INVENTORY',   docType: 'ST',   prefix: 'ST',   nextNo: 1, padLength: 4 },
    { module: 'INVENTORY',   docType: 'SA',   prefix: 'SA',   nextNo: 1, padLength: 4 },
    { module: 'FINANCE',     docType: 'JE',    prefix: 'JE',    nextNo: 1, padLength: 4 },
    { module: 'FINANCE',     docType: 'APINV', prefix: 'APINV', nextNo: 1, padLength: 4 },
    { module: 'FINANCE',     docType: 'APPAY', prefix: 'APPAY', nextNo: 1, padLength: 4 },
    { module: 'FINANCE',     docType: 'ARINV', prefix: 'ARINV', nextNo: 1, padLength: 4 },
    { module: 'FINANCE',     docType: 'ARREC', prefix: 'ARREC', nextNo: 1, padLength: 4 },
  ];

  for (const seq of sequenceDefs) {
    await prisma.docSequence.upsert({
      where: { companyId_module_docType: { companyId: company.id, module: seq.module, docType: seq.docType } },
      update: {},
      create: { companyId: company.id, ...seq },
    });
  }
  console.log(`  ✓ ${sequenceDefs.length} Document Sequences created`);

  // ── 9. Warehouses & Bins ──────────────────────────────────────────────────
  console.log('Creating warehouses and bins...');
  const [engWh, mainWh] = await Promise.all([
    prisma.warehouse.upsert({
      where: { companyId_code: { companyId: company.id, code: 'ENGG_WH' } },
      update: {},
      create: { companyId: company.id, code: 'ENGG_WH', name: 'Engineering Warehouse', locationId: enggStore.id },
    }),
    prisma.warehouse.upsert({
      where: { companyId_code: { companyId: company.id, code: 'MAIN_WH' } },
      update: {},
      create: { companyId: company.id, code: 'MAIN_WH', name: 'Main Warehouse', locationId: mainWarehouse.id },
    }),
  ]);

  // Add a few bins to each warehouse
  const binDefs = [
    { warehouseId: engWh.id, code: 'RACK-A1', name: 'Rack A - Shelf 1' },
    { warehouseId: engWh.id, code: 'RACK-A2', name: 'Rack A - Shelf 2' },
    { warehouseId: engWh.id, code: 'RACK-B1', name: 'Rack B - Shelf 1' },
    { warehouseId: mainWh.id, code: 'BAY-01', name: 'Bay 01' },
    { warehouseId: mainWh.id, code: 'BAY-02', name: 'Bay 02' },
  ];
  for (const bin of binDefs) {
    await prisma.bin.upsert({
      where: { warehouseId_code: { warehouseId: bin.warehouseId, code: bin.code } },
      update: {},
      create: bin,
    });
  }
  console.log(`  ✓ 2 Warehouses + 5 Bins created`);

  // ── 10. Sample Items (V-Belts matching the screenshots) ───────────────────
  console.log('Creating sample items...');
  const engCat = await prisma.itemCategory.upsert({
    where: { companyId_code: { companyId: company.id, code: 'ENG' } },
    update: {},
    create: { companyId: company.id, code: 'ENG', name: 'Engineering Spares' },
  });

  const nosUom = await prisma.uom.upsert({
    where: { companyId_code: { companyId: company.id, code: 'NOS' } },
    update: {},
    create: { companyId: company.id, code: 'NOS', name: 'Numbers', symbol: 'NOS' },
  });
  const pcsUom = await prisma.uom.upsert({
    where: { companyId_code: { companyId: company.id, code: 'PCS' } },
    update: {},
    create: { companyId: company.id, code: 'PCS', name: 'Pieces', symbol: 'PCS' },
  });

  const sampleItems = [
    { code: 'SPR-VBELT0096', description: 'SPA 1150 V BELT', uomId: nosUom.id, standardCost: 1.729 },
    { code: 'SPR-VBELT0021', description: 'SPA 1180 V BELT', uomId: pcsUom.id, standardCost: 1.955 },
    { code: 'SPR-VBELT0092', description: 'SPA 2732 V BELT', uomId: nosUom.id, standardCost: 5.930 },
    { code: 'SPR-VBELT0093', description: 'SPA 2282 V BELT', uomId: nosUom.id, standardCost: 4.300 },
  ];

  for (const item of sampleItems) {
    await prisma.item.upsert({
      where: { companyId_code: { companyId: company.id, code: item.code } },
      update: {},
      create: {
        companyId: company.id,
        code: item.code,
        description: item.description,
        categoryId: engCat.id,
        uomId: item.uomId,
        grade1Options: ['NA'],
        grade2Options: ['NA'],
        standardCost: item.standardCost,
        reorderLevel: 5,
        reorderQty: 10,
        status: 'ACTIVE',
      },
    });
  }
  console.log(`  ✓ ${sampleItems.length} Sample Items created`);

  // ── 11. Sample Supplier (matching screenshot) ─────────────────────────────
  console.log('Creating sample supplier...');
  const supplier = await prisma.supplier.upsert({
    where: { companyId_code: { companyId: company.id, code: 'MCLSA028' } },
    update: {},
    create: {
      companyId: company.id,
      code: 'MCLSA028',
      name: 'Aerotrans Global Forwarding LLC',
      shortName: 'Aerotrans Global Forwarding LL',
      controlAccountId: glMap['2300'] ?? null,
      creditDays: 0,
      creditAmount: 0,
      shipmentMode: 'NA',
      isActive: true,
      isParentSupplier: true,
    },
  });
  console.log(`  ✓ Sample Supplier: ${supplier.name}`);

  // ── 12. Finance: Account Mappings ────────────────────────────────────────
  console.log('Creating account mappings...');
  const accountMappingDefs = [
    { mappingType: 'INVENTORY_ACCOUNT', accountCode: '1310' },  // Raw Materials Stock
    { mappingType: 'GRN_CLEARING',      accountCode: '2200' },  // GRN Clearing
    { mappingType: 'SUPPLIER_CONTROL',  accountCode: '2100' },  // Accounts Payable
    { mappingType: 'CUSTOMER_CONTROL',  accountCode: '1200' },  // Accounts Receivable
    { mappingType: 'BANK_ACCOUNT',      accountCode: '1110' },  // Main Bank Account
    { mappingType: 'AP_EXPENSE',        accountCode: '5300' },  // Purchase Expense
    { mappingType: 'AR_REVENUE',        accountCode: '4100' },  // Sales Revenue
  ];
  for (const m of accountMappingDefs) {
    const accountId = glMap[m.accountCode];
    if (!accountId) { console.warn(`  ⚠ GL account ${m.accountCode} not found — skipping ${m.mappingType}`); continue; }
    // Prisma does not support null in compound unique where clauses, so use findFirst + create/update
    const existing = await prisma.accountMapping.findFirst({
      where: { companyId: company.id, mappingType: m.mappingType, refId: null },
    });
    if (existing) {
      await prisma.accountMapping.update({ where: { id: existing.id }, data: { accountId } });
    } else {
      await prisma.accountMapping.create({ data: { companyId: company.id, mappingType: m.mappingType, accountId, refId: null } });
    }
  }
  console.log(`  ✓ ${accountMappingDefs.length} Account Mappings created`);

  // ── 13. Sample Customers (AR) ─────────────────────────────────────────────
  console.log('Creating sample customers...');
  const customerDefs = [
    { code: 'CUST001', name: 'Oman Oil Company SAOC' },
    { code: 'CUST002', name: 'PDO Petroleum Development Oman' },
    { code: 'CUST003', name: 'Sohar Aluminium Company LLC' },
  ];
  for (const c of customerDefs) {
    await prisma.customer.upsert({
      where: { companyId_code: { companyId: company.id, code: c.code } },
      update: {},
      create: { companyId: company.id, ...c, isActive: true },
    });
  }
  console.log(`  ✓ ${customerDefs.length} Sample Customers created`);

  // ── 14. Workflow Configs ──────────────────────────────────────────────────
  console.log('Creating workflow configurations...');
  const workflowDefs = [
    {
      module: 'PROCUREMENT', docType: 'MRL',
      levels: [{ level: 1, roleId: roles['PROCUREMENT_MANAGER'], maxAmount: null }],
      escalationHours: 24,
    },
    {
      module: 'PROCUREMENT', docType: 'PRL',
      levels: [{ level: 1, roleId: roles['PROCUREMENT_MANAGER'], maxAmount: null }],
      escalationHours: 48,
    },
    {
      module: 'PROCUREMENT', docType: 'PO',
      levels: [
        { level: 1, roleId: roles['PROCUREMENT_MANAGER'], maxAmount: 50000 },
        { level: 2, roleId: roles['SYSTEM_ADMIN'],         maxAmount: null   },
      ],
      escalationHours: 24,
    },
    {
      module: 'INVENTORY', docType: 'SA',
      levels: [{ level: 1, roleId: roles['INVENTORY_MANAGER'], maxAmount: null }],
      escalationHours: 24,
    },
    {
      module: 'FINANCE', docType: 'JE',
      levels: [{ level: 1, roleId: roles['FINANCE_MANAGER'], maxAmount: null }],
      escalationHours: 24,
    },
  ];

  for (const wf of workflowDefs) {
    await prisma.workflowConfig.upsert({
      where: { companyId_module_docType: { companyId: company.id, module: wf.module, docType: wf.docType } },
      update: {},
      create: { companyId: company.id, ...wf },
    });
  }
  console.log(`  ✓ ${workflowDefs.length} Workflow Configs created`);

  // ── 15. Adjustment Reasons ────────────────────────────────────────────────
  const reasonDefs = [
    { code: 'DMGD',  name: 'Damaged Goods'        },
    { code: 'EXPRD', name: 'Expired Items'         },
    { code: 'THEFT', name: 'Theft / Missing'       },
    { code: 'CYCLC', name: 'Cycle Count Variance'  },
    { code: 'WROFF', name: 'Write-off'             },
    { code: 'RECLS', name: 'Reclassification'      },
    { code: 'SAMP',  name: 'Sample / Testing'      },
    { code: 'RTRN',  name: 'Customer Return'       },
    { code: 'OVER',  name: 'Stock Overage'         },
    { code: 'UNDR',  name: 'Stock Shortage'        },
  ];
  for (const r of reasonDefs) {
    await prisma.adjustmentReason.upsert({
      where: { companyId_code: { companyId: company.id, code: r.code } },
      update: {},
      create: { companyId: company.id, code: r.code, name: r.name },
    });
  }
  console.log(`  ✓ ${reasonDefs.length} adjustment reasons`);

  console.log('\n✅ Seed completed successfully!\n');
  console.log('┌────────────────────────────────────────────┐');
  console.log('│  Default Login Credentials                 │');
  console.log('│  Email:    admin@demo.com                  │');
  console.log('│  Password: Admin@123                       │');
  console.log('└────────────────────────────────────────────┘\n');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
