import React, { useEffect, useRef, useState } from 'react';
import { peopleWord } from '../utils/persons';
import { photoUrl } from '../cloudinary';

/**
 * Карточка человека: крупное фото, сведения и действия —
 * «Добавить сына» и «Удалить».
 */
export default function PersonCardModal({
  person,
  fatherName,
  children = [],
  branchSize = 1,
  onClose,
  onAddSon,
  onDelete,
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const cardRef = useRef(null);
  const addRef = useRef(null);
  const cancelRef = useRef(null);

  const initial = (person.name || '?').trim().charAt(0).toUpperCase();
  const descendants = Math.max(0, branchSize - 1);

  useEffect(() => {
    addRef.current?.focus();
  }, []);

  useEffect(() => {
    if (confirmDelete) cancelRef.current?.focus();
  }, [confirmDelete]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        if (confirmDelete) {
          setConfirmDelete(false);
        } else {
          onClose();
        }
        return;
      }

      if (event.key !== 'Tab' || !cardRef.current) return;

      const focusable = Array.from(
        cardRef.current.querySelectorAll(
          'button, [href], [tabindex]:not([tabindex="-1"])'
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
  }, [confirmDelete, onClose]);

  return (
    <div
      className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
      onMouseDown={onClose}
    >
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="person-card-title"
        className="modal-card w-full max-w-md rounded-2xl border border-gray-200 bg-white shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-6 pt-5">
          <div>
            <h2 id="person-card-title" className="text-lg font-semibold text-gray-900">
              {confirmDelete ? 'Удалить человека' : 'Карточка человека'}
            </h2>
            <p className="text-sm text-gray-500">
              {confirmDelete ? `Карточка: ${person.name}` : 'Фото и сведения'}
            </p>
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

        {confirmDelete ? (
          <div className="ca-confirm px-6 pb-6 pt-4">
            <div className="rounded-xl border border-red-200 bg-red-50/70 p-4">
              <p className="text-sm font-medium text-gray-900">
                Удалить «{person.name}»?
              </p>
              <p className="mt-1 text-sm text-gray-600">
                {branchSize > 1 ? (
                  <>
                    Вместе с ним исчезнут его потомки — всего{' '}
                    {branchSize} {peopleWord(branchSize)}.
                  </>
                ) : (
                  'Карточка исчезнет из дерева.'
                )}{' '}
                Сразу после удаления можно будет вернуть.
              </p>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                ref={cancelRef}
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50 active:scale-[0.98]"
              >
                Назад
              </button>
              <button
                type="button"
                onClick={onDelete}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-red-700 active:scale-[0.98]"
              >
                Удалить
              </button>
            </div>
          </div>
        ) : (
          <div className="px-6 pb-6 pt-4">
            <div className="flex flex-col items-center">
              <div className="person-photo">
                {person.photo ? (
                  <img src={photoUrl(person.photo, 640)} alt={person.name} />
                ) : (
                  <span className="person-photo__initial" aria-hidden="true">{initial}</span>
                )}
              </div>

              <p className="mt-4 text-xl font-semibold leading-tight text-gray-900">
                {person.name}
              </p>

              {person.description ? (
                <p className="mt-1 text-center text-sm text-gray-600">{person.description}</p>
              ) : (
                <p className="mt-1 text-center text-sm text-gray-400">Без описания</p>
              )}
            </div>

            <dl className="mt-5 rounded-xl border border-gray-100 bg-gray-50/70 px-4 py-1">
              <div className="person-meta">
                <dt>Отец</dt>
                <dd>{fatherName ?? 'Корень дерева'}</dd>
              </div>
              <div className="person-meta">
                <dt>Дети</dt>
                <dd>{children.length > 0 ? children.map(child => child.name).join(', ') : 'Пока нет'}</dd>
              </div>
              {descendants > 0 && (
                <div className="person-meta">
                  <dt>В ветке</dt>
                  <dd>{descendants} {peopleWord(descendants)}</dd>
                </div>
              )}
            </dl>

            <div className="mt-5 flex gap-2">
              <button
                ref={addRef}
                type="button"
                onClick={onAddSon}
                className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.98]"
              >
                Добавить сына
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50 active:scale-[0.98]"
              >
                Удалить
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
