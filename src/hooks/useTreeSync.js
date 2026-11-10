import { useEffect, useRef, useState } from 'react';
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

const STORAGE_KEY = 'family-tree';
const DOC_REF = doc(db, 'tree', 'family');
const SAVE_DEBOUNCE_MS = 400;
/** Сколько ждём первый ответ Firestore, прежде чем работать локально */
const CONNECT_TIMEOUT_MS = 6000;

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

/**
 * Общее дерево в Firestore + локальный кэш в localStorage.
 *
 * Приложение сразу работает с тем, что есть в кэше (или с примером), а облако
 * подключается в фоне: когда придёт снимок документа — данные заменятся
 * актуальными. Если доступа нет, остаётся локальный режим.
 *
 * @param {{ id: string, name: string, fatherId: string|null }[]} fallbackPersons
 */
export function useTreeSync(fallbackPersons) {
  // стартуем только с того, что реально лежит в кэше: демо-пример не должен
  // попадать в localStorage и «восстанавливаться» в облако
  const [persons, setPersons] = useState(() => readLocal() ?? []);
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState('connecting'); // connecting | live | offline
  const [errorCode, setErrorCode] = useState(null);
  // первый снимок получен — только после этого можно писать в облако
  const [remoteReady, setRemoteReady] = useState(false);

  // данные пришли из Firestore — не нужно писать их обратно
  const skipNextWrite = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const unsubscribe = onSnapshot(
      DOC_REF,
      (snapshot) => {
        if (cancelled) return;

        if (snapshot.exists()) {
          const data = snapshot.data();
          const remote = Array.isArray(data.persons) ? data.persons : [];

          // облако — источник истины: если там пусто, значит дерево удалили намеренно
          skipNextWrite.current = true;
          setPersons(remote);
        } else {
          // документа ещё нет — переносим туда текущее локальное дерево
          skipNextWrite.current = true;
          const seed = readLocal() ?? fallbackPersons;
          setPersons(seed);
          setDoc(DOC_REF, { persons: seed, updatedAt: serverTimestamp() }).catch((error) => {
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
  }, [fallbackPersons]);

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

  // локальный кэш пишем только после того, как узнали состояние облака,
  // иначе пустой старт затрёт сохранённое дерево
  useEffect(() => {
    if (!loaded) return undefined;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(persons));
    } catch (error) {
      console.warn('localStorage:', error);
    }

    if (!remoteReady) return undefined;

    if (skipNextWrite.current) {
      skipNextWrite.current = false;
      return undefined;
    }

    const timer = setTimeout(() => {
      setDoc(DOC_REF, { persons, updatedAt: serverTimestamp() }, { merge: true })
        .then(() => {
          setStatus('live');
          setErrorCode(null);
        })
        .catch((error) => {
          console.error('Firestore save:', error);
          setStatus('offline');
          setErrorCode(error.code ?? 'unknown');
        });
    }, SAVE_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [persons, remoteReady, loaded]);

  return { persons, setPersons, loaded, status, errorCode };
}
