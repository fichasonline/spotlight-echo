/**
 * Monedas de los premios de campeones.
 *
 * El circuito es regional, así que un premio puede venir en reales, guaraníes
 * o euros. Antes esto era un `"UYU" | "USD"` con el símbolo resuelto por un
 * ternario (`currency === "USD" ? "US$" : "$"`), que mostraba cualquier moneda
 * que no fuera dólar como `$` — un premio en reales quedaba idéntico a uno en
 * pesos uruguayos.
 *
 * El código es ISO 4217 y es lo que se guarda en la base; el símbolo y el
 * nombre salen de acá, así que sumar una moneda es agregar una línea.
 */

export interface Currency {
  code: string;
  /** Nombre para el selector del panel. */
  label: string;
  /** Símbolo que se antepone al monto en el portal. */
  symbol: string;
}

/** Primero las de la región, después las de los circuitos internacionales. */
export const CURRENCIES: Currency[] = [
  { code: "UYU", label: "Peso uruguayo", symbol: "$" },
  { code: "USD", label: "Dólar", symbol: "US$" },
  { code: "ARS", label: "Peso argentino", symbol: "AR$" },
  { code: "BRL", label: "Real brasileño", symbol: "R$" },
  { code: "CLP", label: "Peso chileno", symbol: "CL$" },
  { code: "PYG", label: "Guaraní", symbol: "₲" },
  { code: "BOB", label: "Boliviano", symbol: "Bs" },
  { code: "PEN", label: "Sol peruano", symbol: "S/" },
  { code: "COP", label: "Peso colombiano", symbol: "CO$" },
  { code: "MXN", label: "Peso mexicano", symbol: "MX$" },
  { code: "CRC", label: "Colón costarricense", symbol: "₡" },
  { code: "DOP", label: "Peso dominicano", symbol: "RD$" },
  { code: "EUR", label: "Euro", symbol: "€" },
  { code: "GBP", label: "Libra", symbol: "£" },
];

export const DEFAULT_CURRENCY = "UYU";

const BY_CODE = new Map(CURRENCIES.map((c) => [c.code, c]));

/**
 * Formatea un monto con el símbolo de su moneda.
 *
 * Una moneda que no esté en la lista cae al propio código (`"XYZ 40.000"`) en
 * vez de a un `$` genérico: mostrar el código es feo pero honesto, mientras
 * que el `$` genérico afirma una moneda que no es.
 */
export function formatAmount(amount: number, currency: string | null | undefined) {
  const value = Math.round(amount).toLocaleString("es-UY");
  const match = currency ? BY_CODE.get(currency) : undefined;
  if (match) return `${match.symbol}${value}`;
  return currency ? `${currency} ${value}` : value;
}

/** Nombre largo, para tooltips y textos del panel. */
export function currencyLabel(code: string | null | undefined) {
  if (!code) return "";
  return BY_CODE.get(code)?.label ?? code;
}
