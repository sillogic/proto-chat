import { DeleteObjectsCommand, S3Client } from '@aws-sdk/client-s3';

function createS3Client() {
  const { S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_REGION, S3_ENABLE_PATH_STYLE } =
    process.env;

  if (!S3_ENDPOINT || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) return null;

  return new S3Client({
    credentials: { accessKeyId: S3_ACCESS_KEY_ID, secretAccessKey: S3_SECRET_ACCESS_KEY },
    endpoint: S3_ENDPOINT,
    forcePathStyle: S3_ENABLE_PATH_STYLE === '1',
    region: S3_REGION || 'us-east-1',
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });
}

/**
 * Extract S3 object key from a full URL.
 * e.g. "https://protochat.oss-cn-shenzhen.aliyuncs.com/files/abc" → "files/abc"
 */
function extractKey(url: string, publicDomain: string): string | null {
  try {
    const base = publicDomain.endsWith('/') ? publicDomain : publicDomain + '/';
    if (url.startsWith(base)) return url.slice(base.length);
    // fallback: try stripping endpoint + bucket (path-style)
    const endpoint = process.env.S3_ENDPOINT || '';
    const bucket = process.env.S3_BUCKET || '';
    const pathBase = `${endpoint.endsWith('/') ? endpoint : endpoint + '/'}${bucket}/`;
    if (url.startsWith(pathBase)) return url.slice(pathBase.length);
    return null;
  } catch {
    return null;
  }
}

/**
 * Delete a list of OSS/S3 objects by their full URLs.
 * Silently skips if S3 is not configured or keys cannot be extracted.
 * Returns the count of successfully deleted objects.
 */
export async function deleteS3ObjectsByUrls(urls: string[]): Promise<number> {
  const client = createS3Client();
  const bucket = process.env.S3_BUCKET;
  const publicDomain = process.env.S3_PUBLIC_DOMAIN || '';

  if (!client || !bucket || urls.length === 0) return 0;

  const keys = urls.map((u) => extractKey(u, publicDomain)).filter(Boolean) as string[];
  if (keys.length === 0) return 0;

  // DeleteObjects supports up to 1000 keys per request
  const CHUNK = 1000;
  let deleted = 0;
  for (let i = 0; i < keys.length; i += CHUNK) {
    const chunk = keys.slice(i, i + CHUNK);
    try {
      const res = await client.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: { Objects: chunk.map((Key) => ({ Key })) },
        }),
      );
      deleted += res.Deleted?.length ?? 0;
    } catch (err) {
      console.error('[S3] deleteObjects error:', err);
    }
  }
  return deleted;
}
