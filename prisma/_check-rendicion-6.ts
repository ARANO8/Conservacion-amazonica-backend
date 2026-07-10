import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  const r = await prisma.rendicion.findUnique({
    where: { id: 6 },
    include: { aprobadorActual: true, solicitud: { select: { usuarioEmisorId: true, codigoSolicitud: true } } },
  })
  console.log('aprobadorActualId:', r?.aprobadorActualId)
  console.log('aprobadorActual:', r?.aprobadorActual?.email, r?.aprobadorActual?.nombreCompleto)
  console.log('Usuario emisor:', r?.solicitud?.usuarioEmisorId)
  console.log('Codigo:', r?.solicitud?.codigoSolicitud)
  await prisma.$disconnect()
}
main()
