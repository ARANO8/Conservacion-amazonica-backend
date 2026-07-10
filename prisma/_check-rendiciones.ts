import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  const rendiciones = await prisma.rendicion.findMany({
    where: { deletedAt: null },
    include: { _count: { select: { gastosRendicion: true } } },
    orderBy: { id: 'asc' },
  })
  for (const r of rendiciones) {
    console.log(`ID: ${r.id} | Estado: ${r.estado} | Gastos: ${r._count.gastosRendicion} | Solicitud: ${r.solicitudId}`)
  }
  await prisma.$disconnect()
}
main()
