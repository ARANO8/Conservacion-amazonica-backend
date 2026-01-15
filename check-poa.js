const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const count = await prisma.poaActivity.count();
  console.log('POA Activities Count:', count);
  const sample = await prisma.poaActivity.findFirst({
    orderBy: { code: 'asc' },
  });
  console.log('Sample Activity:', sample);
}

main()
  .catch(console.error)
  .finally(() => {
    void prisma.$disconnect();
  });
