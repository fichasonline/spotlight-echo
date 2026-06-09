# Instagram Sorteos Admin MVP

## Objetivo

Crear una herramienta privada para administradores de Fichas.uy que permita pegar el link de un post de Instagram, leer sus comentarios y elegir una persona al azar entre los comentaristas.

## Alcance

- Ruta admin oculta: `/admin/sorteos`.
- Acceso solo para usuarios con rol `admin`.
- Endpoint server-side: `/api/instagram-giveaway`.
- El token de Meta vive solo en variables de entorno (`META_API` o `META_ACCESS_TOKEN`).
- El frontend nunca recibe ni guarda el token.
- El sorteo considera una participacion por username de Instagram.
- Comentarios duplicados del mismo username se deduplican.
- La cuenta autora del post se excluye automaticamente cuando Meta devuelve su username.
- La validacion automatica de "sigue a la cuenta" queda fuera del MVP porque la API oficial de Instagram no expone lista de seguidores ni un chequeo follower-by-user.

## Flujo

1. El admin entra a `/admin/sorteos`.
2. Pega una URL de Instagram o un media ID.
3. La pagina llama al endpoint con la sesion Supabase del admin.
4. El endpoint valida el JWT, verifica rol `admin`, resuelve el media y lee comentarios desde Meta.
5. La pagina muestra total de comentarios, participantes unicos y muestra una tabla.
6. El admin presiona "Elegir ganador".
7. El endpoint vuelve a cargar comentarios y elige un ganador con aleatoriedad del servidor.
8. La pagina muestra username, comentario y link del post.

## Errores Esperados

- Falta `META_API`: mostrar mensaje de configuracion.
- Token sin permisos suficientes: explicar que se necesitan permisos de comentarios de Instagram.
- Post no encontrado por URL: pedir `META_IG_USER_ID` o usar media ID.
- Post sin participantes: deshabilitar sorteo.

## Verificacion

- `npm run build`.
- Revision visual local de `/admin/sorteos` si hay sesion admin disponible.
