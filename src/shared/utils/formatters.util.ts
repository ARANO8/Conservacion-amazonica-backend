import {
  LOCALE_DEFAULT,
  MONEDA_DEFAULT,
} from '../../common/constants/financial.constants';

/**
 * Formatea una fecha en formato local (DD/MM/YYYY).
 */
export const formatDate = (date: Date | string | null | undefined): string => {
  if (!date) return 'N/A';
  const d = new Date(date);
  return d.toLocaleDateString(LOCALE_DEFAULT, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

/**
 * Formatea un monto numérico a formato de moneda (Bs 1.234,56).
 */
export const formatCurrency = (
  amount: number | string | { toString(): string } | null | undefined,
): string => {
  const val = parseFloat(amount?.toString() || '0');
  const formatted = val.toLocaleString(LOCALE_DEFAULT, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${MONEDA_DEFAULT} ${formatted}`;
};
