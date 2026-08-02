import { Prisma } from '@prisma/client';

export const USER_SAFE_SELECT = {
  id: true,
  nombreCompleto: true,
  email: true,
  cargo: true,
  rol: true,
};

export const SOLICITUD_INCLUDE = {
  usuarioEmisor: { select: USER_SAFE_SELECT },
  aprobador: { select: USER_SAFE_SELECT },
  usuarioBeneficiado: { select: USER_SAFE_SELECT },
  historialAprobaciones: {
    include: {
      usuario: { select: USER_SAFE_SELECT },
      derivadoA: { select: USER_SAFE_SELECT },
    },
    orderBy: {
      fecha: 'asc',
    },
  },
  viaticos: {
    include: {
      concepto: true,
      planificaciones: true,
      solicitudPresupuesto: {
        include: {
          poa: {
            include: {
              estructura: {
                include: { partida: true },
              },
            },
          },
        },
      },
    },
  },
  gastos: {
    include: {
      tipoGasto: true,
      solicitudPresupuesto: {
        include: {
          poa: {
            include: {
              estructura: {
                include: { partida: true },
              },
            },
          },
        },
      },
    },
  },
  gastosCompra: {
    include: {
      pagos: {
        orderBy: { numero: 'asc' as const },
      },
      solicitudPresupuesto: {
        include: {
          poa: {
            include: {
              estructura: {
                include: { partida: true },
              },
            },
          },
        },
      },
    },
  },
  planificaciones: true,
  hospedajes: true,
  personasExternas: true,
  rendicion: {
    select: {
      id: true,
      estado: true,
    },
  },
  presupuestos: {
    include: {
      poa: {
        include: {
          estructura: {
            include: {
              proyecto: {
                include: {
                  cuentaBancaria: true,
                },
              },
              grupo: true,
              partida: true,
            },
          },
          actividad: true,
          codigoPresupuestario: true,
        },
      },
      viaticos: true,
      gastos: true,
    },
  },
} satisfies Prisma.SolicitudInclude;
