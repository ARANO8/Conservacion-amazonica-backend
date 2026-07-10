const MIN_JWT_SECRET_LENGTH = 32;

/**
 * Devuelve el JWT_SECRET validado desde las variables de entorno.
 * Lanza si no está definido o si es demasiado corto para ser seguro.
 * Centraliza la validación que antes estaba duplicada en jwt.strategy y
 * auth.module.
 */
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('JWT_SECRET no está definido en las variables de entorno');
  }

  if (secret.length < MIN_JWT_SECRET_LENGTH) {
    throw new Error(
      `JWT_SECRET es demasiado corto (mínimo ${MIN_JWT_SECRET_LENGTH} caracteres). ` +
        'Usa un valor aleatorio fuerte, por ejemplo: openssl rand -hex 32',
    );
  }

  return secret;
}
