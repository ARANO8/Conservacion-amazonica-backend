import { PrismaClient, Rol } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash('password123', 12);
  
  // List existing users first
  const existingUsers = await prisma.usuario.findMany();
  console.log('Existing users in DB:', existingUsers.map(u => `${u.email} (${u.rol})`));

  const targetUsers = [
    { email: 'larteaga@conservacionamazonica.org.bo', nombreCompleto: 'LUIS LEONARDO ARTEAGA BOHRT', cargo: 'DIRECTOR TÉCNICO', rol: Rol.USUARIO },
    { email: 'walba@conservacionamazonica.org.bo', nombreCompleto: 'WALTER RENE ALBA ZENTENO', cargo: 'CONTADOR II', rol: Rol.CONTADOR },
    { email: 'sramirez@conservacionamazonica.org.bo', nombreCompleto: 'SHIRLEY MARIA RAMÍREZ TEODOVICH', cargo: 'DIRECTOR FINANCIERO', rol: Rol.TESORERO },
    { email: 'mteran@conservacionamazonica.org.bo', nombreCompleto: 'MARCOS FERNANDO TERÁN VALENZUELA', cargo: 'DIRECTOR EJECUTIVO', rol: Rol.EJECUTIVO },
    { email: 'mfernandez@conservacionamazonica.org.bo', nombreCompleto: 'MARCELO FERNANDEZ CAMARGO', cargo: 'ESPECIALISTA II-IT', rol: Rol.ADMIN }
  ];

  for (const user of targetUsers) {
    await prisma.usuario.upsert({
      where: { email: user.email },
      update: { password: hash, nombreCompleto: user.nombreCompleto, cargo: user.cargo, rol: user.rol },
      create: { email: user.email, password: hash, nombreCompleto: user.nombreCompleto, cargo: user.cargo, rol: user.rol }
    });
    console.log(`Upserted password for ${user.email}`);
  }
  console.log('✅ Passwords reset successfully!');
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
