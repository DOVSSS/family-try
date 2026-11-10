import { useCallback, useEffect, useState } from 'react';
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

const STORAGE_KEY = 'family-tree';
/**
 * Новый документ: старые вкладки продолжают писать в tree/family,
 * а актуальная версия живёт отдельно, поэтому их записи ничего не ломают.
 */
const DOC_REF = doc(db, 'tree', 'family-2');
/** Сколько ждём первый ответ Firestore, прежде чем работать локально */
const CONNECT_TIMEOUT_MS = 6000;
/** Метка сборки и клиента — помогают понять, кто именно записал данные */
const BUILD_TAG = '2026-11-10-build-5';
const CLIENT_ID = Math.random().toString(36).slice(2, 10);

function readLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeLocal(persons) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persons));
  } catch (error) {
    console.warn('localStorage:', error);
  }
}

/**
 * Общее дерево в Firestore + локальный кэш в localStorage.
 *
 * В облако пишем только по явному действию пользователя (savePersons),
 * а не по факту изменения состояния: иначе клиент с устаревшими данными
 * может «вернуть» удалённых людей в тот момент, когда получит снимок.
 *
 * Пустое облако = пустое дерево: демо-пример в базу не заливается.
 */
export function useTreeSync() {
  const [persons, setPersons] = useState(() => readLocal() ?? []);
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState('connecting'); // connecting | live | offline
  const [errorCode, setErrorCode] = useState(null);
  // документ прочитан — знаем состояние облака
  const [remoteReady, setRemoteReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const unsubscribe = onSnapshot(
      DOC_REF,
      (snapshot) => {
        if (cancelled) return;

        if (snapshot.exists()) {
          const remote = snapshot.data().persons;
          setPersons(Array.isArray(remote) ? remote : []);
        } else {
          // документа ещё нет — начинаем с пустого дерева,
          // чтобы старые кэши не «воскрешали» удалённых людей
          setPersons([]);
          setDoc(DOC_REF, {
            persons: [],
            updatedAt: serverTimestamp(),
            build: BUILD_TAG,
            by: CLIENT_ID,
          }).catch((error) => {
            console.error('Firestore create:', error);
            setStatus('offline');
            setErrorCode(error.code ?? 'unknown');
          });
        }

        setRemoteReady(true);
        setStatus('live');
        setErrorCode(null);
        setLoaded(true);
      },
      (error) => {
        if (cancelled) return;
        // нет доступа или сети — остаёмся на локальном кэше
        console.error('Firestore subscribe:', error);
        setStatus('offline');
        setErrorCode(error.code ?? 'unknown');
        setLoaded(true);
      }
    );

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  // если облако не ответило за отведённое время — показываем локальный режим
  useEffect(() => {
    if (status !== 'connecting') return undefined;
    const timer = setTimeout(() => {
      setStatus((prev) => (prev === 'connecting' ? 'offline' : prev));
      setErrorCode((prev) => prev ?? 'timeout');
      setLoaded(true);
    }, CONNECT_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [status]);

  // кэшируем любое состояние, чтобы дерево не пропадало без сети
  useEffect(() => {
    if (!loaded) return;
    writeLocal(persons);
  }, [persons, loaded]);

  /**
   * Явное сохранение дерева: сначала локально, затем в облако.
   * @param {{ id: string, name: string, fatherId: string|null }[]} next
   */
  const savePersons = useCallback(
    (next) => {
      setPersons(next);
      writeLocal(next);

      if (!remoteReady) return;

      // Firestore не принимает undefined — чистим данные перед записью
      let clean;
      try {
        clean = JSON.parse(JSON.stringify(next));
      } catch (error) {
        console.error('Не удалось подготовить дерево к записи', error);
        return;
      }

      try {
        setDoc(
          DOC_REF,
          { persons: clean, updatedAt: serverTimestamp(), build: BUILD_TAG, by: CLIENT_ID },
          { merge: true }
        )
          .then(() => {
            setStatus('live');
            setErrorCode(null);
          })
          .catch((error) => {
            console.error('Firestore save:', error);
            setStatus('offline');
            setErrorCode(error.code ?? 'unknown');
          });
      } catch (error) {
        // синхронная ошибка SDK не должна ломать интерфейс
        console.error('Firestore save (sync):', error);
        setStatus('offline');
      }
    },
    [remoteReady]
  );

  return { persons, setPersons, savePersons, loaded, status, errorCode };
}
