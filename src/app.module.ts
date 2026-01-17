import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { UsuariosModule } from './usuarios/usuarios.module';
import { PoaModule } from './poa/poa.module';
import { SolicitudesModule } from './solicitudes/solicitudes.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsuariosModule,
    PoaModule,
    SolicitudesModule,
  ],
})
export class AppModule {}
