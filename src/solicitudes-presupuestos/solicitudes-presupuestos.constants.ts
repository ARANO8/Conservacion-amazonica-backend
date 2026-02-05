/**
 * Tiempo de vida para las reservas de presupuesto.
 * Usado para calcular expiresAt en nuevas reservas.
 */
export const RESERVA_TTL_MINUTES = 2;
export const RESERVA_TTL_MS = RESERVA_TTL_MINUTES * 60 * 1000;
