import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ReactFlow, {
  Controls,
  ReactFlowProvider,
  useNodesInitialized,
  useReactFlow,
} from 'reactflow';
import 'reactflow/dist/style.css';

import PersonNode from './components/PersonNode';
import PersonCardModal from './components/PersonCardModal';
import AddPersonModal from './components/AddPersonModal';
import FlowEdge from './components/FlowEdge';
import { useTreeSync } from './hooks/useTreeSync';
import { layoutTree } from './utils/layoutTree';
import { collectBranchIds } from './utils/persons';

// Генератор простого id
const generateId = () => Date.now() + '-' + Math.random().toString(36).substr(2, 9);

// Сколько держать подсветку нового человека, мс
const HIGHLIGHT_MS = 2700;

// Сколько висит уведомление с «Вернуть», мс
const NOTICE_MS = 6000;

// Начальные данные (если в localStorage пусто)
const DEFAULT_PERSONS = [
  { id: '1', name: 'Иван', fatherId: null, description: 'Основатель семьи' },
  { id: '2', name: 'Пётр', fatherId: '1', description: 'Старший сын, любит рыбалку' },
  { id: '3', name: 'Сидор', fatherId: '1' },
];

function FamilyTree() {
  // Общее дерево: Firestore + локальный кэш
  const { persons, savePersons, loaded } = useTreeSync();

  // id человека, которого только что добавили — для анимации
  const [justAddedId, setJustAddedId] = useState(null);
  // для кого открыта форма добавления сына: { id, name } | null
  const [addTarget, setAddTarget] = useState(null);
  // чья карточка открыта: id | null
  const [viewingId, setViewingId] = useState(null);
  // уведомление после удаления (с возможностью вернуть)
  const [notice, setNotice] = useState(null);

  const { fitView } = useReactFlow();
  // true, когда React Flow измерил размеры всех узлов
  const nodesInitialized = useNodesInitialized();


  // Гасим подсветку через пару секунд
  useEffect(() => {
    if (!justAddedId) return undefined;
    const timer = setTimeout(() => setJustAddedId(null), HIGHLIGHT_MS);
    return () => clearTimeout(timer);
  }, [justAddedId]);

  // Уведомление живёт несколько секунд
  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  // Плавно подстраиваем масштаб, когда дерево меняется:
  // ждём, пока React Flow измерит новые узлы, иначе fitView их проигнорирует
  useEffect(() => {
    if (!nodesInitialized || persons.length === 0) return undefined;
    const timer = setTimeout(() => fitView({ duration: 700, padding: 0.22 }), 80);
    return () => clearTimeout(timer);
  }, [nodesInitialized, persons, fitView]);

  // Открыть карточку человека
  const handleOpenPerson = useCallback((person) => {
    setViewingId(person.id);
  }, []);

  const handleClosePerson = useCallback(() => setViewingId(null), []);

  // Из карточки — в форму добавления сына
  const handleAddFromProfile = useCallback(() => {
    if (!viewingId) return;
    const person = persons.find(item => item.id === viewingId);
    if (!person) return;

    setAddTarget({ id: person.id, name: person.name });
    setViewingId(null);
  }, [persons, viewingId]);

  // Открыть форму для первого человека в пустом дереве
  const handleOpenAddRoot = useCallback(() => {
    setAddTarget({ id: null, name: null });
  }, []);

  const handleCloseAdd = useCallback(() => setAddTarget(null), []);

  // Отправить форму: имя обязательно, фото и описание — по желанию
  const handleSubmitAdd = useCallback(
    ({ name, description, photo }) => {
      if (!addTarget) return;

      // поля без значения не добавляем вовсе: Firestore не принимает undefined
      const newPerson = {
        id: generateId(),
        name,
        fatherId: addTarget.id ?? null,
      };
      if (description) newPerson.description = description;
      if (photo) newPerson.photo = photo;

      // сначала закрываем форму, потом сохраняем — ошибка записи
      // не должна оставлять модалку открытой
      setAddTarget(null);
      setJustAddedId(newPerson.id);
      savePersons([...persons, newPerson]);
    },
    [addTarget, persons, savePersons]
  );

  // Удаление человека вместе с его потомками
  const handleDelete = useCallback(() => {
    if (!viewingId) return;

    const ids = collectBranchIds(persons, viewingId);
    const removed = persons.filter(person => ids.has(person.id));
    if (removed.length === 0) return;

    savePersons(persons.filter(person => !ids.has(person.id)));
    setViewingId(null);
    setNotice({
      text:
        removed.length > 1
          ? `Удалено: ${removed[0].name} и ещё ${removed.length - 1}`
          : `Удалено: ${removed[0].name}`,
      removed,
    });
  }, [viewingId, persons, savePersons]);

  const handleUndoDelete = useCallback(() => {
    if (!notice?.removed) return;
    const { removed } = notice;
    savePersons([...persons, ...removed]);
    setNotice(null);
  }, [notice, persons, savePersons]);

  const handleRestoreExample = useCallback(() => {
    savePersons(DEFAULT_PERSONS.map(person => ({ ...person })));
  }, [savePersons]);

  // Данные для открытой карточки
  const viewingPerson = useMemo(
    () => (viewingId ? persons.find(person => person.id === viewingId) ?? null : null),
    [persons, viewingId]
  );

  const viewingFather = useMemo(
    () =>
      viewingPerson?.fatherId
        ? persons.find(person => person.id === viewingPerson.fatherId) ?? null
        : null,
    [persons, viewingPerson]
  );

  const viewingChildren = useMemo(
    () => (viewingPerson ? persons.filter(person => person.fatherId === viewingPerson.id) : []),
    [persons, viewingPerson]
  );

  // Сколько человек исчезнет вместе с открытым
  const branchSize = useMemo(
    () => (viewingPerson ? collectBranchIds(persons, viewingPerson.id).size : 1),
    [viewingPerson, persons]
  );

  // Типы узлов и рёбер: регистрируем кастомные компоненты
  const nodeTypes = useMemo(() => ({ personNode: PersonNode }), []);
  const edgeTypes = useMemo(() => ({ flowEdge: FlowEdge }), []);

  // Получаем узлы и рёбра через layoutTree
  const { nodes, edges } = useMemo(
    () => layoutTree(persons, handleOpenPerson, justAddedId),
    [persons, handleOpenPerson, justAddedId]
  );

  return (
    <div className="app-canvas relative h-full w-full">
      {/* фото Кавказа фоном на весь экран */}
      <div className="app-photo" aria-hidden="true" />
      <div className="app-veil" aria-hidden="true" />

      <div className="absolute inset-0">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          minZoom={0.1}
          maxZoom={2.5}
          attributionPosition="bottom-left"
        >
          <Controls />
        </ReactFlow>
      </div>

      {loaded && persons.length === 0 && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center p-4">
          <div className="pointer-events-auto max-w-sm rounded-2xl border border-white/70 bg-white/85 px-7 py-6 text-center shadow-xl backdrop-blur">
            <p className="text-lg font-semibold text-gray-900">Дерево пустое</p>
            <p className="mt-1 text-sm text-gray-600">
              Добавьте первого человека или верните пример.
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <button
                type="button"
                onClick={handleOpenAddRoot}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.98]"
              >
                Добавить человека
              </button>
              <button
                type="button"
                onClick={handleRestoreExample}
                className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50 active:scale-[0.98]"
              >
                Вернуть пример
              </button>
            </div>
          </div>
        </div>
      )}

      {notice && (
        <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2">
          <div className="ca-toast flex items-center gap-3 rounded-xl bg-slate-900/90 px-4 py-2.5 text-sm text-white shadow-xl backdrop-blur">
            <span>{notice.text}</span>
            <button
              type="button"
              onClick={handleUndoDelete}
              className="font-medium text-sky-300 transition hover:text-sky-200"
            >
              Вернуть
            </button>
            <button
              type="button"
              onClick={() => setNotice(null)}
              aria-label="Закрыть"
              className="text-slate-400 transition hover:text-white"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {viewingPerson && (
        <PersonCardModal
          person={viewingPerson}
          fatherName={viewingFather?.name ?? null}
          children={viewingChildren}
          branchSize={branchSize}
          onClose={handleClosePerson}
          onAddSon={handleAddFromProfile}
          onDelete={handleDelete}
        />
      )}

      {addTarget && (
        <AddPersonModal
          target={addTarget}
          onClose={handleCloseAdd}
          onSubmit={handleSubmitAdd}
        />
      )}
    </div>
  );
}

function App() {
  return (
    <ReactFlowProvider>
      <FamilyTree />
    </ReactFlowProvider>
  );
}

export default App;
