import { CookieOptions } from 'express';

/** Nombre de la cookie httpOnly que transporta el JWT de acceso. */
export const ACCESS_TOKEN_COOKIE = 'access_token';

// 24h en ms, alineado con la vigencia por defecto del JWT (JWT_EXPIRES_IN).
const COOKIE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Opciones de la cookie de acceso. Se usan tanto al setearla (login) como al
 * limpiarla (logout) para que los atributos coincidan y el navegador la borre.
 * `secure` solo en producción (en desarrollo se sirve por HTTP).
 */
export function buildAccessTokenCookieOptions(): CookieOptions {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE_MS,
  };
}
