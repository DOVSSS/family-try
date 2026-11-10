import React, { useEffect, useRef, useState } from 'react';
import { uploadPhoto } from '../cloudinary';

// Фото уменьшаем до миниатюры, чтобы дерево не раздувало localStorage
const MAX_PHOTO_SIDE = 256;

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function makeThumbnail(file) {
  const dataUrl = await fileToDataUrl(file);
  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image decode failed'));
    img.src = dataUrl;
  });

  const scale = Math.min(1, MAX_PHOTO_SIDE / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').drawImage(image, 0, 0, width, height);

  return canvas.toDataURL('image/jpeg', 0.85);
}

export default function AddPersonModal({
  target,
  onClose,
  onSubmit,
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState(null);
  const [error, setError] = useState('');
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoNote, setPhotoNote] = useState('');

  const nameRef = useRef(null);
  const cardRef = useRef(null);
  const fileRef = useRef(null);

  const isRoot = !target?.id;
  const personName = target?.name ?? '';

  // Автофокус на имени + Esc + удержание фокуса внутри окна
  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }

      if (event.key !== 'Tab' || !cardRef.current) return;

      const focusable = Array.from(
        cardRef.current.querySelectorAll(
          'button, input, textarea, [href], [tabindex]:not([tabindex="-1"])'
        )
      ).filter(el => !el.disabled && el.offsetParent !== null);

      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [onClose]);

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    // сбрасываем input, чтобы можно было выбрать тот же файл повторно
    event.target.value = '';
    if (!file) return;

    setPhotoBusy(true);
    setError('');
    setPhotoNote('');
    try {
      // фото уходит в Cloudinary, в дереве храним только ссылку
      setPhoto(await uploadPhoto(file));
    } catch (e) {
      console.error('Cloudinary upload failed', e);
      // облако недоступно — не ломаем добавление, сохраняем фото локально
      try {
        setPhoto(await makeThumbnail(file));
        setPhotoNote('Облако недоступно — фото сохранено локально');
      } catch (inner) {
        setError('Не удалось прочитать изображение');
      }
    } finally {
      setPhotoBusy(false);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const trimmedName = name.trim();

    if (!trimmedName) {
      setError('Введите имя');
      nameRef.current?.focus();
      return;
    }

    onSubmit({
      name: trimmedName,
      description: description.trim(),
      photo,
    });
  };

  const title = isRoot ? 'Добавить человека' : 'Добавить сына';
  const subtitle = isRoot ? 'Первый в дереве' : `Отец: ${personName}`;

  return (
    <div
      className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
      onMouseDown={onClose}
    >
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-person-title"
        className="modal-card w-full max-w-md rounded-2xl border border-gray-200 bg-white shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-6 pt-5">
          <div>
            <h2 id="add-person-title" className="text-lg font-semibold text-gray-900">
              {title}
            </h2>
            <p className="text-sm text-gray-500">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-lg leading-none text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 pb-6 pt-4">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                aria-label="Выбрать фото"
                className="modal-photo flex-none"
              >
                {photo ? (
                  <img src={photo} alt="" className="modal-photo__img" />
                ) : (
                  <span className="text-2xl leading-none text-gray-300">+</span>
                )}
              </button>

              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-700">
                  Фото <span className="font-normal text-gray-400">— необязательно</span>
                </p>
                <div className="mt-1 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={photoBusy}
                    className="text-xs font-medium text-blue-600 transition hover:text-blue-700 disabled:text-gray-400"
                  >
                    {photoBusy ? 'Обработка…' : photo ? 'Заменить' : 'Загрузить'}
                  </button>
                  {photo && (
                    <button
                      type="button"
                      onClick={() => setPhoto(null)}
                      className="text-xs text-gray-500 transition hover:text-gray-700"
                    >
                      Удалить фото
                    </button>
                  )}
                </div>
                {photoNote && (
                  <p className="mt-1 text-[11px] text-amber-600">{photoNote}</p>
                )}
              </div>

              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFile}
              />
            </div>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">
                Имя <span className="text-red-500">*</span>
              </span>
              <input
                ref={nameRef}
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  if (error) setError('');
                }}
                maxLength={40}
                placeholder="Например, Алексей"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">
                Краткое описание
              </span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={3}
                maxLength={160}
                placeholder="Пара слов о человеке"
                className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
              />
              <span className="mt-1 block text-right text-[11px] text-gray-400">
                {description.length}/160
              </span>
            </label>

            {error && (
              <p role="alert" className="text-sm text-red-500">
                {error}
              </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50 active:scale-[0.98]"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={photoBusy}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.98] disabled:opacity-60"
              >
                Добавить
              </button>
            </div>
          </form>
      </div>
    </div>
  );
}
