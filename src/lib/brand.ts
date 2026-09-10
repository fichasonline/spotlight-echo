/**
 * Identidad de marca del portal.
 *
 * La ruta del logo vive acá y no repetida en cada componente: hasta ahora
 * convivían dos archivos distintos (`Group 789.svg` en header/footer y
 * `logo_fichas.png` en login, sorteos y los datos estructurados de SEO), que
 * es justo cómo se llega a que un cambio de logo quede a medias.
 */

/** Lockup principal: isotipo + "FICHAS NEWS" sobre la pastilla violeta. */
export const BRAND_LOGO_URL = "/logo-portal.png";

/** Nombre para el `alt`. Un solo string, así no se escribe de dos formas. */
export const BRAND_NAME = "Fichas News";
