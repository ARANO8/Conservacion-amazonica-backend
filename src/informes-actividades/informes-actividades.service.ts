import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Rol } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInformeActividadesDto } from './dto/create-informe-actividades.dto';
import { UpdateInformeActividadesDto } from './dto/update-informe-actividades.dto';

/** ADMIN y EJECUTIVO ven los informes de todos; el resto sólo los suyos. */
const ROLES_VISTA_GLOBAL: Rol[] = [Rol.ADMIN, Rol.EJECUTIVO];

const INFORME_INCLUDE = {
  usuario: {
    select: { id: true, nombreCompleto: true, email: true, cargo: true },
  },
  actividades: {
    orderBy: { fecha: 'asc' as const },
  },
} satisfies Prisma.InformeActividadesInclude;

interface UsuarioContexto {
  id: number;
  rol: Rol;
}

@Injectable()
export class InformesActividadesService {
  private readonly logger = new Logger(InformesActividadesService.name);

  constructor(private readonly prisma: PrismaService) {}

  private async generarCodigo(tx: Prisma.TransactionClient): Promise<string> {
    const anioActual = new Date().getFullYear();
    const count = await tx.informeActividades.count({
      where: {
        createdAt: {
          gte: new Date(`${anioActual}-01-01`),
          lte: new Date(`${anioActual}-12-31`),
        },
      },
    });
    const correlativo = (count + 1).toString().padStart(3, '0');
    return `INF-${anioActual}-${correlativo}`;
  }

  private esVistaGlobal(rol: Rol): boolean {
    return ROLES_VISTA_GLOBAL.includes(rol);
  }

  private validarRango(fechaInicio: Date, fechaFin: Date) {
    if (fechaFin < fechaInicio) {
      throw new BadRequestException(
        'La fecha de fin no puede ser anterior a la de inicio',
      );
    }
  }

  async create(dto: CreateInformeActividadesDto, usuarioId: number) {
    this.validarRango(dto.fechaInicio, dto.fechaFin);

    return this.prisma.$transaction(async (tx) => {
      const codigoInforme = await this.generarCodigo(tx);

      const informe = await tx.informeActividades.create({
        data: {
          codigoInforme,
          fechaInicio: dto.fechaInicio,
          fechaFin: dto.fechaFin,
          usuarioId,
          actividades: {
            create: dto.actividades.map((actividad) => ({
              fecha: actividad.fecha,
              lugar: actividad.lugar,
              personaInstitucion: actividad.personaInstitucion,
              actividadesRealizadas: actividad.actividadesRealizadas,
            })),
          },
        },
        include: INFORME_INCLUDE,
      });

      this.logger.log(
        `[create] usuarioId=${usuarioId} | codigo=${codigoInforme} | actividades=${dto.actividades.length}`,
      );

      return informe;
    });
  }

  async findAll(user: UsuarioContexto) {
    const where: Prisma.InformeActividadesWhereInput = this.esVistaGlobal(
      user.rol,
    )
      ? { deletedAt: null }
      : { deletedAt: null, usuarioId: user.id };

    return this.prisma.informeActividades.findMany({
      where,
      include: INFORME_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number, user?: UsuarioContexto) {
    const informe = await this.prisma.informeActividades.findFirst({
      where: { id, deletedAt: null },
      include: INFORME_INCLUDE,
    });

    if (!informe) {
      throw new NotFoundException(`Informe ${id} no encontrado`);
    }

    if (
      user &&
      !this.esVistaGlobal(user.rol) &&
      informe.usuarioId !== user.id
    ) {
      throw new ForbiddenException(
        'No tienes permiso para acceder a este informe',
      );
    }

    return informe;
  }

  /** Sólo el autor puede modificar o eliminar su informe. */
  private async findPropio(id: number, usuarioId: number) {
    const informe = await this.prisma.informeActividades.findFirst({
      where: { id, deletedAt: null },
    });

    if (!informe) {
      throw new NotFoundException(`Informe ${id} no encontrado`);
    }

    if (informe.usuarioId !== usuarioId) {
      throw new ForbiddenException(
        'Sólo el autor puede modificar este informe',
      );
    }

    return informe;
  }

  async update(
    id: number,
    dto: UpdateInformeActividadesDto,
    usuarioId: number,
  ) {
    const actual = await this.findPropio(id, usuarioId);

    const fechaInicio = dto.fechaInicio ?? actual.fechaInicio;
    const fechaFin = dto.fechaFin ?? actual.fechaFin;
    this.validarRango(fechaInicio, fechaFin);

    return this.prisma.$transaction(async (tx) => {
      // La bitácora se reemplaza entera: el formulario manda la lista completa
      if (dto.actividades) {
        await tx.actividadInforme.deleteMany({ where: { informeId: id } });
      }

      return tx.informeActividades.update({
        where: { id },
        data: {
          fechaInicio,
          fechaFin,
          ...(dto.actividades
            ? {
                actividades: {
                  create: dto.actividades.map((actividad) => ({
                    fecha: actividad.fecha,
                    lugar: actividad.lugar,
                    personaInstitucion: actividad.personaInstitucion,
                    actividadesRealizadas: actividad.actividadesRealizadas,
                  })),
                },
              }
            : {}),
        },
        include: INFORME_INCLUDE,
      });
    });
  }

  async remove(id: number, usuarioId: number) {
    await this.findPropio(id, usuarioId);

    await this.prisma.informeActividades.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    this.logger.log(`[remove] informeId=${id} | usuarioId=${usuarioId}`);

    return { mensaje: 'Informe eliminado correctamente' };
  }
}
