import crypto from 'node:crypto';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * В dev-режиме Vite сам подписывает загрузки в Cloudinary,
 * чтобы секрет не попадал в браузер. На Vercel это делает
 * serverless-функция api/cloudinary-sign.js.
 */
function cloudinarySignPlugin(env) {
  return {
    name: 'cloudinary-sign-dev',
    configureServer(server) {
      server.middlewares.use('/api/cloudinary-sign', (req, res) => {
        const secret = env.CLOUDINARY_API_SECRET;
        const apiKey = env.CLOUDINARY_API_KEY;
        const cloudName = env.CLOUDINARY_CLOUD_NAME || 'dwd0nspfr';

        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Content-Type', 'application/json');

        if (!secret || !apiKey) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: 'cloudinary is not configured' }));
          return;
        }

        const timestamp = Math.round(Date.now() / 1000);
        const folder = 'family-tree';
        const signature = crypto
          .createHash('sha1')
          .update(`folder=${folder}&timestamp=${timestamp}${secret}`)
          .digest('hex');

        res.statusCode = 200;
        res.end(JSON.stringify({ timestamp, folder, signature, apiKey, cloudName }));
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // третий аргумент '' — читаем и переменные без префикса VITE_
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react(), cloudinarySignPlugin(env)],
    server: {
      hmr: {
        overlay: true,
      },
    },
  };
});
