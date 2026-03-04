import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PUBLISHER_TOKEN = process.env.PUBLISHER_TOKEN;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = req.headers.authorization;
  if (!auth || auth !== `Bearer ${PUBLISHER_TOKEN}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { type, data } = req.body;

  try {
    let result;
    
    if (type === 'article') {
      // Noticias: articles (needs_review/draft/published)
      // Fields: slug, headline, summary, body_markdown, status, source_name, source_url, created_by
      const slug = data.slug || data.headline.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      
      result = await supabase.from('articles').insert({
        slug,
        headline: data.headline,
        summary: data.summary || null,
        body_markdown: data.body_markdown || null,
        status: data.status || 'needs_review',
        source_name: data.source_name || null,
        source_url: data.source_url || null,
        created_by: data.created_by || null,
      }).select();
    } else if (type === 'post') {
      // Comunidad/foro: posts
      // Fields: content, author_id, is_deleted
      result = await supabase.from('posts').insert({
        content: data.content,
        author_id: data.author_id || null,
        is_deleted: false,
      }).select();
    } else if (type === 'event') {
      // Agenda: events
      // Fields: name, start_date, end_date, country, city, venue, description, details, hero_image_url, links, gallery
      result = await supabase.from('events').insert({
        name: data.name,
        start_date: data.start_date,
        end_date: data.end_date || null,
        country: data.country || 'UY',
        city: data.city || null,
        venue: data.venue || null,
        description: data.description || null,
        details: data.details || null,
        hero_image_url: data.hero_image_url || null,
        links: data.links || null,
        gallery: data.gallery || null,
      }).select();
    } else {
      return res.status(400).json({ error: 'Invalid type. Use: article, post, or event' });
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error('Publish error:', error);
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(500).json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : String(error) 
    });
  }
}
