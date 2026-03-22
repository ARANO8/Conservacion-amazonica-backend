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
import { RendicionesModule } from './rendiciones/rendiciones.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { PdfModule } from './pdf/pdf.module';

const DEFAULT_THROTTLE_TTL_MS = 60000;
const DEFAULT_THROTTLE_LIMIT = 10;

function getPositiveIntFromEnv(
  value: string | undefined,
  fallback: number,
): number {
  if (!value) {
    return fallback;
  }

  const parsedValue = Number(value);
  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    return fallback;
  }

  return parsedValue;
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      {
        ttl: getPositiveIntFromEnv(
          process.env.THROTTLE_TTL_MS,
          DEFAULT_THROTTLE_TTL_MS,
        ),
        limit: getPositiveIntFromEnv(
          process.env.THROTTLE_LIMIT,
          DEFAULT_THROTTLE_LIMIT,
        ),
      },
    ]),

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
    RendicionesModule,
    DashboardModule,
    PdfModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
