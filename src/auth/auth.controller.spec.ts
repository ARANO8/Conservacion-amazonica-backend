import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { AuthController } from './auth.controller';

describe('AuthController — GET /auth/sesion', () => {
  // Solo se lee la metadata del método, no se invoca
  const handler = Object.getOwnPropertyDescriptor(
    AuthController.prototype,
    'sesion',
  )?.value as object;

  it('es un GET a /auth/sesion protegido por el JWT', () => {
    expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe('sesion');
    expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(
      RequestMethod.GET,
    );
    // Solo el guard del JWT: con RolesGuard y sin roles rechazaría a todos
    expect(Reflect.getMetadata('__guards__', handler)).toHaveLength(1);
  });

  it('no cuenta para el throttling: nginx lo llama en cada página', () => {
    expect(Reflect.getMetadata('THROTTLER:SKIPdefault', handler)).toBe(true);
  });
});
