import crypto from 'node:crypto';

/**
 * Vercel serverless: подписывает загрузку фото в Cloudinary.
 * Секрет живёт только в переменных окружения Vercel
 * (Settings → Environment Variables), в браузер не попадает.
 */
export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }

  const secret = process.env.CLOUDINARY_API_SECRET;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME || 'dwd0nspfr';

  if (!secret || !apiKey) {
    res.status(500).json({ error: 'cloudinary is not configured' });
    return;
  }

  const timestamp = Math.round(Date.now() / 1000);
  const folder = 'family-tree';
  const signature = crypto
    .createHash('sha1')
    .update(`folder=${folder}&timestamp=${timestamp}${secret}`)
    .digest('hex');

  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ timestamp, folder, signature, apiKey, cloudName });
}
