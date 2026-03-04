# FichasOnline - Publisher API Setup

## Archivos creados para integración

### 1. `/api/publish.ts`
Vercel Serverless Function que permite publicar contenido en Supabase.

**Endpoint:** `POST https://www.fichasonline.uy/api/publish`

**Autenticación:** `Authorization: Bearer <PUBLISHER_TOKEN>`

**Body:**
```json
{
  "type": "article|post|event",
  "data": { ... }
}
```

### 2. `vercel.json`
Actualizado para excluir `/api/*` del rewrite a index.html.

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
      "status": "needs_review",
      "source_url": "https://...",
      "source_name": "Poker Uruguay"
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

### articles
- `slug` (string, unique)
- `headline` (string)
- `summary` (string, nullable)
- `body_markdown` (string, nullable)
- `status` (string: needs_review/draft/published)
- `source_name` (string, nullable)
- `source_url` (string, nullable)
- `created_by` (uuid, nullable)
- `created_at` (timestamp)

### posts
- `content` (string)
- `author_id` (uuid, nullable)
- `is_deleted` (boolean)
- `created_at` (timestamp)

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
