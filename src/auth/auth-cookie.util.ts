import { CookieOptions } from 'express';

/** Nombre de la cookie httpOnly que transporta el JWT de acceso. */
export const ACCESS_TOKEN_COOKIE = 'access_token';

// 24h en ms, alineado con la vigencia por defecto del JWT (JWT_EXPIRES_IN).
const COOKIE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

const DEFAULT_COOKIE_PATH = '/';

/**
 * Opciones de la cookie de acceso. Se usan tanto al setearla (login) como al
 * limpiarla (logout) para que los atributos coincidan y el navegador la borre.
 * `secure` solo en producción (en desarrollo se sirve por HTTP).
 *
 * `path` es configurable porque en producción el dominio aloja varios sistemas
 * bajo prefijos distintos. Con el valor por defecto la cookie viajaría también
 * a las aplicaciones vecinas; acotándola a su propio prefijo (por ejemplo
 * `/amzdesk`) el JWT no sale de esta aplicación.
 */
export function buildAccessTokenCookieOptions(): CookieOptions {
  const isProd = process.env.NODE_ENV === 'production';
  const path = process.env.COOKIE_PATH?.trim() || DEFAULT_COOKIE_PATH;

  return {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path,
    maxAge: COOKIE_MAX_AGE_MS,
  };
}
