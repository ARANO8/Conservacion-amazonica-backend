import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Prisma } from '@prisma/client';

/**
 * Filtro global que intercepta errores conocidos de Prisma Client y los
 * convierte en respuestas HTTP limpias sin exponer detalles internos de la BD.
 *
 * Códigos manejados:
 *   P2002 → 409 Conflict   (violación de restricción UNIQUE)
 *   P2025 → 404 Not Found  (registro no encontrado al hacer UPDATE/DELETE)
 */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaClientExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaClientExceptionFilter.name);

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(
    exception: Prisma.PrismaClientKnownRequestError,
    host: ArgumentsHost,
  ): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();

    let status: HttpStatus;
    let message: string;

    switch (exception.code) {
      case 'P2002':
        status = HttpStatus.CONFLICT;
        message = 'Ya existe un registro con esos datos únicos';
        break;
      case 'P2025':
        status = HttpStatus.NOT_FOUND;
        message = 'El registro solicitado no fue encontrado';
        break;
      default:
        status = HttpStatus.INTERNAL_SERVER_ERROR;
        message = 'Error interno del servidor';
        this.logger.error(
          `Error de Prisma no manejado — código: ${exception.code} | meta: ${JSON.stringify(exception.meta)} | mensaje: ${exception.message}`,
        );
        break;
    }

    const responseBody = {
      statusCode: status,
      message,
      error: HttpStatus[status],
    };

    httpAdapter.reply(ctx.getResponse<unknown>(), responseBody, status);
  }
}
