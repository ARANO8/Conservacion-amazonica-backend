import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

/**
 * Filtro global de último recurso: captura CUALQUIER excepción que no fue
 * manejada por los demás filtros (errores de Prisma no-P2002/P2025, TypeErrors, etc.)
 * y la registra con contexto detallado para facilitar el debugging.
 *
 * Debe registrarse ANTES del PrismaClientExceptionFilter en main.ts,
 * ya que NestJS aplica los filtros en orden inverso al registro.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('AllExceptionsFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Error interno del servidor';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      message =
        typeof res === 'string'
          ? res
          : ((res as { message?: string }).message ?? message);

      // Las HttpException (400, 401, 403, 404) no necesitan stack trace
      if ((status as number) >= 500) {
        this.logger.error(
          `[${request.method}] ${request.url} → HTTP ${status} | ${message}`,
          (exception as Error).stack,
        );
      }
    } else if (exception instanceof Error) {
      // Error de JavaScript / Prisma no HttpException
      this.logger.error(
        `[${request.method}] ${request.url} → ${exception.constructor.name}: ${exception.message}`,
        exception.stack,
      );
      this.logger.error(
        `Payload recibido: ${JSON.stringify(request.body).slice(0, 2000)}`,
      );
    } else {
      this.logger.error(
        `[${request.method}] ${request.url} → Excepción desconocida: ${JSON.stringify(exception)}`,
      );
    }

    response.status(status).json({
      statusCode: status,
      message,
      error: HttpStatus[status],
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
