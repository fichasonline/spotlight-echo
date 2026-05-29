# FichasOnline - Publisher API Setup

## Archivos creados para integración

### 1. `/api/publish.ts`
Vercel Serverless Function que permite publicar contenido en Supabase.

**Endpoint:** `POST https://www.fichasonline.uy/api/publish`

**Autenticación:** `Authorization: Bearer <PUBLISHER_TOKEN>`

**Body:**
```json
{
  "type": "article|post|event|social_post",
  "data": { ... }
}
```

### 2. `vercel.json`
Actualizado para excluir `/api/*` del rewrite a index.html.

### 3. `social-cm`

Supabase queda como contrato de contenido y cola. Open Cloud, con acceso directo a la base y credenciales de Meta, es quien debe:

1. leer `social_publish_jobs` con `status = 'queued'`
2. cargar el post desde `social_posts`
3. cargar imágenes desde `social_assets`
4. publicar en Instagram usando Graph API
5. escribir `published`/`failed`, `remote_media_id`, `remote_permalink` y errores en Supabase

La web no necesita correr un worker ni publicar por su cuenta.

---

## Configuración en Vercel (Environment Variables)

Ir a **Vercel Dashboard → Project → Settings → Environment Variables** y agregar:

| Variable | Valor |
|----------|-------|
| `SUPABASE_URL` | `https://ownmyadhrsdypoimywha.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | *(tu service role key - NO la anon key)* |
| `PUBLISHER_TOKEN` | `fichas_pub_<generar_random>` |

**⚠️ Importante:** La `SUPABASE_SERVICE_ROLE_KEY` se obtiene en:
- Supabase Dashboard → Project Settings → API → **Service Role Key (secret)**

---

## Ejemplo de uso desde OpenClaw

### Crear noticia (draft/review)
```bash
curl -X POST https://www.fichasonline.uy/api/publish \
  -H "Authorization: Bearer fichas_pub_xyz" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "article",
    "data": {
      "headline": "Gran torneo en Montevideo este fin de semana",
      "summary": "El Casino Central recibe el UY Poker Open 2026...",
      "body_markdown": "# Contenido en Markdown...\n\nMás detalles aquí.",
      "status": "needs_review"
    }
  }'
```

### Crear post en el foro (Feed)
```bash
curl -X POST https://www.fichasonline.uy/api/publish \
  -H "Authorization: Bearer fichas_pub_xyz" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "post",
    "data": {
      "content": "¿Qué opinan de las nuevas blinds en el Casino?",
      "author_id": "user-uuid-opcional"
    }
  }'
```

### Crear evento
```bash
curl -X POST https://www.fichasonline.uy/api/publish \
  -H "Authorization: Bearer fichas_pub_xyz" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "event",
    "data": {
      "name": "UY Poker Open 2026",
      "start_date": "2026-03-15T19:00:00-03:00",
      "end_date": "2026-03-17T23:00:00-03:00",
      "country": "UY",
      "city": "Montevideo",
      "venue": "Casino Central",
      "description": "Torneo principal con garantía de $500k",
      "details": "Más información...",
      "links": [{"label": "Inscripción", "url": "https://..."}]
    }
  }'
```

### Crear carrusel de Instagram
```bash
curl -X POST https://www.fichasonline.uy/api/publish \
  -H "Authorization: Bearer fichas_pub_xyz" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "social_post",
    "data": {
      "platform": "instagram",
      "format": "carousel",
      "headline": "Torneo destacado",
      "caption": "Este finde se juega fuerte en Montevideo.",
      "hashtags": ["FichasUy", "PokerUruguay"],
      "status": "queued",
      "scheduled_at": "2026-05-19T21:00:00-03:00",
      "assets": [
        {
          "asset_type": "image",
          "url": "https://ownmyadhrsdypoimywha.supabase.co/storage/v1/object/public/social/slide-1.png",
          "order_index": 1
        },
        {
          "asset_type": "image",
          "url": "https://ownmyadhrsdypoimywha.supabase.co/storage/v1/object/public/social/slide-2.png",
          "order_index": 2
        }
      ]
    }
  }'
```

Ese request crea `social_posts`, `social_assets` y, si `status` es `queued`, también `social_publish_jobs`.

Si Open Cloud tiene acceso directo a Supabase, puede insertar exactamente esos mismos registros sin pasar por `/api/publish`.

### SQL directo para Open Cloud
```sql
WITH new_post AS (
  INSERT INTO public.social_posts (
    platform,
    format,
    headline,
    caption,
    hashtags,
    status,
    scheduled_at
  )
  VALUES (
    'instagram',
    'carousel',
    'Torneo destacado',
    'Este finde se juega fuerte en Montevideo.',
    ARRAY['FichasUy', 'PokerUruguay'],
    'queued',
    '2026-05-19T21:00:00-03:00'
  )
  RETURNING id
),
new_assets AS (
  INSERT INTO public.social_assets (post_id, asset_type, url, order_index)
  SELECT id, 'image', 'https://example.com/slide-1.png', 1 FROM new_post
  UNION ALL
  SELECT id, 'image', 'https://example.com/slide-2.png', 2 FROM new_post
)
INSERT INTO public.social_publish_jobs (post_id, status)
SELECT id, 'queued' FROM new_post;
```

---

## Próximos pasos

1. **Hacer commit y push:**
   ```bash
   git add vercel.json api/publish.ts
   git commit -m "feat: agregar Publisher API para automatización de contenido"
   git push
   ```

2. **Deploy en Vercel** (automático con push o manual desde dashboard)

3. **Configurar Environment Variables** en Vercel (ver tabla arriba)

4. **Testear endpoint:**
   ```bash
   curl -X POST https://www.fichasonline.uy/api/publish \
     -H "Authorization: Bearer <TOKEN>" \
     -H "Content-Type: application/json" \
     -d '{"type":"article","data":{"headline":"Test","status":"needs_review"}}'
   ```

5. **Configurar OpenClaw:**
   - Una vez el endpoint funcione, programo los cron jobs para:
     - Diario 09:00 UY: Buscar noticias → crear drafts
     - Diario 18:00 UY: Publicar 1 post + chequear eventos
     - Semanal (dom): Resumen + agenda

---

## Schema real de la DB (Supabase)

### articles (campos usados por la app)
- `slug` (string, unique)
- `headline` (string)
- `summary` (string, nullable)
- `body_markdown` (string, nullable)
- `status` (string: needs_review/draft/published)
- `created_by` (uuid, nullable)
- `created_at` (timestamp)

### posts
- `content` (string)
- `author_id` (uuid, nullable)
- `is_deleted` (boolean)
- `created_at` (timestamp)

### social_posts
- `platform` (`instagram`)
- `format` (`carousel`/`image`/`story`)
- `headline` (string, nullable)
- `caption` (string)
- `hashtags` (text[])
- `status` (`needs_approval`/`queued`/`publishing`/`published`/`failed`/`cancelled`)
- `scheduled_at` (timestamp, nullable)
- `remote_media_id` / `remote_permalink` (nullable)

### social_assets
- `post_id` (uuid)
- `asset_type` (`image`/`video`)
- `url` (public URL)
- `order_index` (integer)
- `remote_container_id` (nullable)

### social_publish_jobs
- `post_id` (uuid)
- `status` (`queued`/`processing`/`published`/`failed`/`cancelled`)
- `attempts` (integer)
- `last_error` (nullable)

### events
- `name` (string)
- `start_date` (timestamp)
- `end_date` (timestamp, nullable)
- `country` (string)
- `city` (string, nullable)
- `venue` (string, nullable)
- `description` (string, nullable)
- `details` (string, nullable)
- `hero_image_url` (string, nullable)
- `links` (jsonb, nullable)
- `gallery` (jsonb, nullable)

---

## Notas de seguridad

- **NUNCA** exponer `SUPABASE_SERVICE_ROLE_KEY` en el frontend
- `PUBLISHER_TOKEN` debe ser secreto (no compartir por chat)
- El endpoint tiene CORS habilitado solo para POST/OPTIONS
- Considerar agregar rate limiting si se expone públicamente

---

*Generado por FichasOnline CEO Agent - 2026-03-04*
