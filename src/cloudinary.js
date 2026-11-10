const SIGN_ENDPOINT = '/api/cloudinary-sign';

/**
 * Загрузка фото в Cloudinary.
 *
 * Подпись запрашивается у сервера (в dev — middleware Vite,
 * на Vercel — функция api/cloudinary-sign.js), поэтому API secret
 * никогда не попадает в браузерный бандл.
 *
 * @param {File} file
 * @returns {Promise<string>} secure_url загруженного изображения
 */
export async function uploadPhoto(file) {
  const signResponse = await fetch(SIGN_ENDPOINT, { cache: 'no-store' });
  if (!signResponse.ok) {
    throw new Error(`Не удалось получить подпись Cloudinary (${signResponse.status})`);
  }

  const { timestamp, signature, apiKey, cloudName, folder } = await signResponse.json();

  const form = new FormData();
  form.append('file', file);
  form.append('api_key', apiKey);
  form.append('timestamp', String(timestamp));
  form.append('signature', signature);
  form.append('folder', folder);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: 'POST',
    body: form,
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Cloudinary ${response.status}: ${details.slice(0, 160)}`);
  }

  const data = await response.json();
  return data.secure_url;
}

/**
 * Готовые трансформации Cloudinary: маленькая для карточки, крупная для профиля.
 * Локальные dataURL-фотографии возвращаются как есть.
 * @param {string|undefined} url
 * @param {number} width
 */
export function photoUrl(url, width = 256) {
  if (!url || !url.includes('/upload/')) return url;
  return url.replace('/upload/', `/upload/f_auto,q_auto,w_${width},c_fill/`);
}
