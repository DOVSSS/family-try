# Семейное дерево

Интерактивное семейное дерево на React + Vite: карточки людей с фото и описанием,
ветвящиеся связи с бегущими «разрядами», модальные карточки, добавление и удаление ветвей.

## Запуск

```
npm install
npm run dev
```

Для проверки со смартфона в той же Wi-Fi сети:

```
npm run dev -- --host
```

Vite напечатает адрес вида `http://192.168.x.x:5173/`.

## Данные

Дерево хранится в **Firestore** (проект `fimily-try`), документ `tree/family`,
поле `persons` — массив людей:

```js
{ id, name, fatherId, description?, photo? }
```

- Все изменения синхронизируются в реальном времени: добавили человека на телефоне —
  он появился на компьютере.
- `localStorage` используется как офлайн-кэш: если сети нет или правила Firestore
  не пускают, приложение продолжает работать и показывает статус
  «Только на этом устройстве».
- Фото загружаются в **Cloudinary** и в документе хранится только ссылка.

### Правила Firestore

Открытый доступ (любой, кто открыл сайт, может смотреть и менять):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /tree/{docId} {
      allow read: if true;
      allow write: if true;
    }
  }
}
```

Если позже добавим вход через Google — заменить на `allow write: if request.auth != null;`
(и/или список email через `request.auth.token.email in [...]`).

### Cloudinary

Фото загружаются **подписанным** запросом: браузер спрашивает подпись у сервера,
поэтому API secret не попадает в бандл.

- В dev-режиме подпись отдаёт middleware из `vite.config.js` (`/api/cloudinary-sign`).
- На Vercel — serverless-функция `api/cloudinary-sign.js`.

Переменные окружения (без префикса `VITE_`, чтобы не уехали в браузер):

```
CLOUDINARY_CLOUD_NAME=dwd0nspfr
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

Локально — в `.env.local`, на Vercel — **Settings → Environment Variables**
(значения применяются после Redeploy).

Если облако недоступно, фото сохраняется локально как `dataURL`, а в форме
появляется пометка «Облако недоступно» — добавление человека не ломается.

> API secret, который был отправлен в переписке, лучше перевыпустить:
> Cloudinary → Settings → API Keys → Generate new key. После этого обновите
> `.env.local` и переменные на Vercel.


## Деплой на Vercel

1. Залейте проект в GitHub.
2. vercel.com → **Add New Project** → импорт репозитория.
3. Framework определится как **Vite**, Build — `npm run build`, Output — `dist`
   (это же зафиксировано в `vercel.json`).
4. Добавьте переменные `VITE_CLOUDINARY_*`.
5. **Deploy** → получите `https://<project>.vercel.app`.

Если позже включите Firebase Auth, не забудьте добавить домен Vercel в
**Authentication → Settings → Authorized domains**.
