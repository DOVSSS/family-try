import React from 'react';
import { BaseEdge } from 'reactflow';

/** Стабильный «характер» ветки: из одного id всегда получается один и тот же изгиб */
function hashId(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/**
 * Ветка вместо ортогональной линии: кубическая кривая, которая выходит
 * из отца вверх, а входит в сына снизу — с небольшим боковым изгибом.
 */
export function buildBranchPath({ id, sourceX, sourceY, targetX, targetY }) {
  const seed = hashId(id);
  const vertical = targetY - sourceY; // отрицательная: сын выше отца
  const bend = 0.34 + ((seed % 100) / 100) * 0.18; // 0.34…0.52
  const sway = (seed % 2 === 0 ? 1 : -1) * (11 + (seed % 9)); // 11…19 px

  const c1x = sourceX + sway;
  const c1y = sourceY + vertical * bend;
  const c2x = targetX - sway;
  const c2y = targetY - vertical * (1 - bend);

  return `M ${sourceX} ${sourceY} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${targetX} ${targetY}`;
}

/**
 * Связь-ветка с бегущим разрядом: линия + подсвеченная искра,
 * которая проносится от отца к сыну.
 */
export default function FlowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  style,
  markerEnd,
  data,
}) {
  const edgePath = buildBranchPath({ id, sourceX, sourceY, targetX, targetY });

  const delay = data?.flowDelay ?? 0;
  const duration = data?.flowCycle ?? 4200;
  const width = data?.branchWidth ?? 1.6;

  const sparkStyle = {
    animationDelay: `${delay}ms`,
    animationDuration: `${duration}ms`,
  };

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{ ...style, '--edge-width': `${width}px` }}
        markerEnd={markerEnd}
      />
      <path d={edgePath} pathLength={100} className="edge-spark edge-spark--glow" style={sparkStyle} />
      <path d={edgePath} pathLength={100} className="edge-spark" style={sparkStyle} />
    </>
  );
}
