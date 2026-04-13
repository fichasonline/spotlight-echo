UPDATE storage.buckets
SET
  public = true,
  file_size_limit = 104857600,
  allowed_mime_types = NULL
WHERE id = 'home-banners';
