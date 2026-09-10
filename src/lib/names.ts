/**
 * Normalización de nombres de personas (campeones, jugadores).
 *
 * Los nombres se cargan copiados de posteos y planillas, así que llegan en
 * MAYÚSCULAS, en minúsculas o mezclados. Esto los lleva siempre a la misma
 * forma: inicial mayúscula y el resto minúscula.
 *
 * No alcanza con `text-transform: capitalize` de CSS: esa regla sólo levanta
 * la primera letra de cada palabra y no baja las demás, así que sobre
 * "MARCOS VIGNOLO" no cambia nada.
 */

/**
 * Partículas que van en minúscula dentro de un nombre ("Juan de la Cruz", no
 * "Juan De La Cruz"). Si caen al principio sí se capitalizan, porque ahí son
 * el apellido con el que la persona figura ("De la Cruz, Juan").
 */
const PARTICLES = new Set([
  "de", "del", "la", "las", "lo", "los", "y", "e",
  "da", "das", "do", "dos", "di", "du", "le",
  "van", "von", "der", "den", "ter", "bin", "al",
]);

/** Capitaliza un fragmento respetando apóstrofes y guiones internos. */
function capitalizeChunk(chunk: string): string {
  if (!chunk) return chunk;

  // "j.p." → "J.P."; una inicial suelta siempre va en mayúscula.
  if (/^[a-záéíóúüñ]\.$/i.test(chunk)) return chunk.toUpperCase();

  // Nombres compuestos: "jean-pierre" → "Jean-Pierre", "o'brien" → "O'Brien".
  return chunk.replace(/[^\s\-'’]+/g, (word, offset: number) => {
    const lower = word.toLowerCase();

    // "McDonald" y "MacGregor" llevan mayúscula interna.
    const mc = /^(mac|mc)(.{2,})$/.exec(lower);
    if (mc) return mc[1][0].toUpperCase() + mc[1].slice(1) + mc[2][0].toUpperCase() + mc[2].slice(1);

    // Tras un apóstrofe la letra siguiente sube sólo si arranca palabra real:
    // "D'Angelo" sí, pero el plural inglés "O'Brien's" no vuelve a subir.
    if (offset > 0 && lower.length === 1) return lower;

    return lower.charAt(0).toUpperCase() + lower.slice(1);
  });
}

/**
 * Devuelve el nombre con cada palabra capitalizada.
 *
 * Es idempotente: aplicarlo dos veces da el mismo resultado, así que se puede
 * usar tanto al guardar como al mostrar sin que se pisen.
 */
export function toPersonName(value: string | null | undefined): string {
  if (!value) return "";

  const words = value.trim().replace(/\s+/g, " ").split(" ");

  return words
    .map((word, i) => {
      const lower = word.toLowerCase();
      // Las partículas van en minúscula salvo que abran el nombre.
      if (i > 0 && PARTICLES.has(lower)) return lower;
      return capitalizeChunk(word);
    })
    .join(" ");
}
