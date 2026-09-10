/**
 * Nacionalidades para fichas de campeones y jugadores.
 *
 * El código es ISO 3166-1 alfa-2, que es lo que se guarda en la base. La
 * bandera no se almacena: se deriva del código con `countryFlag`, así que
 * agregar un país acá alcanza para que aparezca en el panel y en el portal.
 */

export interface Country {
  code: string;
  name: string;
}

/** Primero la región donde juega la mayoría, después el resto por alfabético. */
export const COUNTRIES: Country[] = [
  { code: "UY", name: "Uruguay" },
  { code: "AR", name: "Argentina" },
  { code: "BR", name: "Brasil" },
  { code: "CL", name: "Chile" },
  { code: "PY", name: "Paraguay" },
  { code: "BO", name: "Bolivia" },
  { code: "PE", name: "Perú" },
  { code: "CO", name: "Colombia" },
  { code: "VE", name: "Venezuela" },
  { code: "EC", name: "Ecuador" },
  { code: "MX", name: "México" },
  { code: "CR", name: "Costa Rica" },
  { code: "PA", name: "Panamá" },
  { code: "DO", name: "República Dominicana" },
  { code: "CU", name: "Cuba" },
  { code: "US", name: "Estados Unidos" },
  { code: "CA", name: "Canadá" },
  { code: "ES", name: "España" },
  { code: "PT", name: "Portugal" },
  { code: "IT", name: "Italia" },
  { code: "FR", name: "Francia" },
  { code: "DE", name: "Alemania" },
  { code: "GB", name: "Reino Unido" },
  { code: "RU", name: "Rusia" },
  { code: "CN", name: "China" },
  { code: "AU", name: "Australia" },
];

const BY_CODE = new Map(COUNTRIES.map((c) => [c.code, c]));

/** Emoji de bandera a partir del ISO-2 (A→🇦 con un offset fijo de Unicode). */
export function countryFlag(code: string | null | undefined): string {
  if (!code || code.length !== 2) return "";
  const upper = code.toUpperCase();
  if (!/^[A-Z]{2}$/.test(upper)) return "";
  return String.fromCodePoint(...[...upper].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));
}

/** Nombre en español; devuelve el propio código si es uno que no listamos. */
export function countryName(code: string | null | undefined): string {
  if (!code) return "";
  return BY_CODE.get(code.toUpperCase())?.name ?? code.toUpperCase();
}
