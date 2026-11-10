import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

/**
 * Публичная конфигурация веб-приложения Firebase.
 * Это не секрет: ключи видны в браузере у любого веб-приложения,
 * доступ к данным ограничивают правила Firestore (см. README).
 */
const firebaseConfig = {
  apiKey: 'AIzaSyBm9MT8ZFfHmlRHTj7eXP1gjeu-wHre1C8',
  authDomain: 'fimily-try.firebaseapp.com',
  projectId: 'fimily-try',
  storageBucket: 'fimily-try.firebasestorage.app',
  messagingSenderId: '994558046500',
  appId: '1:994558046500:web:b83fcf16dd715208eac3b1',
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
