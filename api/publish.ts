import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PUBLISHER_TOKEN = process.env.PUBLISHER_TOKEN;

type SocialAssetInput = {
  url: string;
  asset_type?: 'image' | 'video';
  order_index?: number;
  metadata?: Record<string, unknown>;
};

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
      // Fields: slug, headline, summary, body_markdown, status, created_by
      const slug = data.slug || data.headline.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      
      result = await supabase.from('articles').insert({
        slug,
        headline: data.headline,
        summary: data.summary || null,
        body_markdown: data.body_markdown || null,
        status: data.status || 'needs_review',
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
    } else if (type === 'social_post') {
      const assets = Array.isArray(data.assets) ? data.assets as SocialAssetInput[] : [];
      const shouldQueue = data.create_job !== false && (data.status || 'needs_approval') === 'queued';

      result = await supabase
        .from('social_posts')
        .insert({
          platform: data.platform || 'instagram',
          format: data.format || 'carousel',
          headline: data.headline || null,
          caption: data.caption,
          hashtags: Array.isArray(data.hashtags) ? data.hashtags : [],
          status: data.status || 'needs_approval',
          scheduled_at: data.scheduled_at || null,
          metadata: data.metadata || {},
        })
        .select()
        .single();

      if (result.error) {
        return res.status(400).json({ error: 'Could not create social post', details: result.error.message });
      }

      const socialPost = result.data;
      let insertedAssets = null;
      let queuedJob = null;

      if (assets.length > 0) {
        const assetRows = assets.map((asset, index) => ({
          post_id: socialPost.id,
          asset_type: asset.asset_type || 'image',
          url: asset.url,
          order_index: asset.order_index || index + 1,
          metadata: asset.metadata || {},
        }));

        const assetsResult = await supabase.from('social_assets').insert(assetRows).select();
        if (assetsResult.error) {
          return res.status(400).json({ error: 'Could not create social assets', details: assetsResult.error.message });
        }
        insertedAssets = assetsResult.data;
      }

      if (shouldQueue) {
        const jobResult = await supabase
          .from('social_publish_jobs')
          .insert({ post_id: socialPost.id, status: 'queued' })
          .select()
          .single();

        if (jobResult.error) {
          return res.status(400).json({ error: 'Could not queue social publish job', details: jobResult.error.message });
        }
        queuedJob = jobResult.data;
      }

      return res.status(200).json({
        success: true,
        data: {
          post: socialPost,
          assets: insertedAssets,
          job: queuedJob,
        },
      });
    } else {
      return res.status(400).json({ error: 'Invalid type. Use: article, post, event, or social_post' });
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
