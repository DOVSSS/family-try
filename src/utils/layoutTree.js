import dagre from 'dagre';

/** Пауза между поколениями: волна «электричества» идёт от корня вверх */
const FLOW_SLOT_MS = 700;
/** Минимальная длина полного цикла волны */
const FLOW_MIN_CYCLE_MS = 4200;

/**
 * @typedef {Object} Person
 * @property {string} id
 * @property {string} name
 * @property {string|null} fatherId
 */

/**
 * Глубина каждого человека: корень = 0, его сыновья = 1 и так далее.
 * @param {Person[]} persons
 * @returns {{ depth: Map<string, number>, levels: number }}
 */
function computeDepths(persons) {
  const byId = new Map(persons.map(person => [person.id, person]));
  const childrenByFather = new Map();

  persons.forEach(person => {
    if (!person.fatherId || !byId.has(person.fatherId)) return;
    const children = childrenByFather.get(person.fatherId);
    if (children) {
      children.push(person.id);
    } else {
      childrenByFather.set(person.fatherId, [person.id]);
    }
  });

  const depth = new Map();
  const queue = [];

  persons.forEach(person => {
    if (!person.fatherId || !byId.has(person.fatherId)) {
      depth.set(person.id, 0);
      queue.push(person.id);
    }
  });

  for (let i = 0; i < queue.length; i += 1) {
    const id = queue[i];
    const children = childrenByFather.get(id) ?? [];
    children.forEach(childId => {
      if (depth.has(childId)) return;
      depth.set(childId, depth.get(id) + 1);
      queue.push(childId);
    });
  }

  const levels = depth.size > 0 ? Math.max(...depth.values()) : 0;

  return { depth, levels };
}

/**
 * Основная функция раскладки с использованием dagre.
 * @param {Person[]} persons
 * @param {(person: Person) => void} onOpenPerson - открыть карточку человека
 * @param {string|null} [highlightedId] - id только что добавленного человека (для анимации)
 * @returns {{ nodes: any[], edges: any[] }}
 */
export function layoutTree(persons, onOpenPerson, highlightedId = null) {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  // Направление снизу вверх: старшее поколение внизу, младшее вверху
  dagreGraph.setGraph({ 
    rankdir: 'BT', 
    nodesep: 70,      // горизонтальное расстояние между узлами одного ранга
    ranksep: 150      // вертикальное расстояние между рангами
  });

  // Добавляем узлы с размерами (подбирайте под свои карточки)
  persons.forEach(person => {
    dagreGraph.setNode(person.id, { width: 210, height: 100 });
  });

  // Добавляем рёбра (отец -> сын), только если отец есть в дереве
  const existingIds = new Set(persons.map(person => person.id));
  persons.forEach(person => {
    if (person.fatherId && existingIds.has(person.fatherId)) {
      dagreGraph.setEdge(person.fatherId, person.id);
    }
  });

  // Вычисляем раскладку
  dagre.layout(dagreGraph);

  // Формируем узлы для React Flow
  const nodes = persons.map((person, index) => {
    const { x, y } = dagreGraph.node(person.id);
    return {
      id: person.id,
      type: 'personNode',
      position: { x, y },
      data: {
        person,
        onOpenPerson,
        order: index, // для каскадного появления карточек
        isNew: person.id === highlightedId, // подсветка нового человека
      },
    };
  });

  // Глубина поколений — по ней искра бежит от корня к последним сыновьям
  const { depth, levels } = computeDepths(persons);
  const flowCycle = Math.max(FLOW_MIN_CYCLE_MS, levels * FLOW_SLOT_MS + 1100);

  // Рёбра
  const edges = persons
    .filter(p => p.fatherId && existingIds.has(p.fatherId))
    .map(p => {
      const isNew = p.id === highlightedId;
      const fatherDepth = depth.get(p.fatherId) ?? 0;
      const flowDelay = fatherDepth * FLOW_SLOT_MS;

      return {
        id: `${p.fatherId}-${p.id}`,
        source: p.fatherId,
        target: p.id,
        type: 'flowEdge',
        className: isNew ? 'edge-new' : 'edge-default',
        // задержка и длина цикла для бегущей искры, толщина ветки — по глубине
        data: {
          flowDelay,
          flowCycle,
          branchWidth: Math.max(1.3, 2.7 - fatherDepth * 0.5),
        },
      };
    });

  return { nodes, edges };
}