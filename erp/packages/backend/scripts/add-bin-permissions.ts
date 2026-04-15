import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Find the roles that need BIN permissions
  const roles = await prisma.role.findMany({
    where: { name: { in: ['SYSTEM_ADMIN', 'INVENTORY_MANAGER'] } },
    select: { id: true, name: true },
  });

  if (roles.length === 0) {
    console.error('No matching roles found. Check role names in DB.');
    process.exit(1);
  }

  console.log('Found roles:', roles.map((r) => r.name).join(', '));

  const actions = ['VIEW', 'CREATE', 'EDIT', 'APPROVE', 'DELETE'] as const;

  for (const role of roles) {
    for (const action of actions) {
      const existing = await prisma.permission.findFirst({
        where: { roleId: role.id, module: 'INVENTORY' as any, resource: 'BIN', action: action as any },
      });

      if (existing) {
        console.log(`  [SKIP] ${role.name} → INVENTORY.BIN.${action} already exists`);
        continue;
      }

      await prisma.permission.create({
        data: {
          roleId: role.id,
          module: 'INVENTORY' as any,
          resource: 'BIN',
          action: action as any,
        },
      });
      console.log(`  [ADD]  ${role.name} → INVENTORY.BIN.${action}`);
    }
  }

  // Flush Redis permission cache for all users so changes take effect immediately
  console.log('\nDone. Remember to flush Redis perms cache for affected users.');
  console.log('Run: redis-cli -a redispassword KEYS "perms:*" | xargs redis-cli -a redispassword DEL');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
