interface HomeSplashScreenProps {
  visible: boolean;
}

/**
 * Velo de carga de la home. Antes era una portada de marca a pantalla completa
 * con logo y barra de progreso; ahora es el mismo fondo de la página con una
 * ruedita, así la espera no tapa el portal con otra pieza gráfica.
 *
 * Dos detalles a propósito:
 * - Se desmonta en vez de apagarse con una animación de salida. Con la pestaña
 *   en segundo plano el navegador congela los frames, y una salida animada
 *   podía dejar el velo pegado encima de la home ya cargada.
 * - La ruedita aparece recién a los 250ms, así que una carga rápida no muestra
 *   ningún destello. El velo en sí es del color del fondo: no se ve.
 */
export function HomeSplashScreen({ visible }: HomeSplashScreenProps) {
  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-background"
      role="status"
      aria-label="Cargando"
    >
      <span className="splash-spinner-in">
        <span className="block h-7 w-7 animate-spin rounded-full border-2 border-primary/20 border-t-primary motion-reduce:animate-none" />
      </span>
    </div>
  );
}
