import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { UsuariosModule } from './usuarios/usuarios.module';
import { PoaModule } from './poa/poa.module';
import { SolicitudesModule } from './solicitudes/solicitudes.module';
import { ConceptosModule } from './catalogos/conceptos/conceptos.module';
import { TipoGastosModule } from './catalogos/tipo-gastos/tipo-gastos.module';
import { GruposModule } from './catalogos/grupos/grupos.module';
import { PartidasModule } from './catalogos/partidas/partidas.module';
import { ProyectosModule } from './catalogos/proyectos/proyectos.module';
import { CodigosPresupuestariosModule } from './catalogos/codigos-presupuestarios/codigos-presupuestarios.module';
import { ReportsModule } from './reports/reports.module';
import { SolicitudPresupuestoModule } from './solicitudes-presupuestos/solicitudes-presupuestos.module';
import { CuentasBancariasModule } from './catalogos/cuentas-bancarias/cuentas-bancarias.module';
import { NotificacionesModule } from './notificaciones/notificaciones.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 10 }]),

    PrismaModule,
    AuthModule,
    UsuariosModule,
    PoaModule,
    SolicitudesModule,
    ConceptosModule,
    TipoGastosModule,
    GruposModule,
    PartidasModule,
    ProyectosModule,
    CodigosPresupuestariosModule,
    ReportsModule,
    SolicitudPresupuestoModule,
    CuentasBancariasModule,
    NotificacionesModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
