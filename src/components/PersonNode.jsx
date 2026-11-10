import React from 'react';
import { Handle, Position } from 'reactflow';
import { photoUrl } from '../cloudinary';

export default function PersonNode({ data }) {
  const { person, onOpenPerson, order = 0, isNew = false } = data;

  const handleClick = () => {
    onOpenPerson(person);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleClick();
    }
  };

  const initial = (person.name || '?').trim().charAt(0).toUpperCase();

  return (
    <>
      {/* ВХОДЯЩАЯ стрелка (от отца) — снизу, потому что отец находится ниже */}
      <Handle type="target" position={Position.Bottom} className="person-handle" />

      <div className={`person-node ${isNew ? 'person-node--new' : ''}`}>
        <div
          className="person-node__card flex items-center gap-3 bg-white rounded-xl p-4 w-[210px] text-center cursor-pointer border border-gray-200 shadow-md select-none"
          // Лёгкий каскад: карточки появляются одна за другой
          style={{ animationDelay: `${Math.min(order, 8) * 60}ms` }}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          role="button"
          tabIndex={0}
          aria-label={`${person.name} — открыть карточку`}
        >
          <span
            className={`person-node__avatar ${person.photo ? 'person-node__avatar--photo' : ''}`}
            aria-hidden="true"
          >
            {person.photo ? <img src={photoUrl(person.photo, 128)} alt="" /> : initial}
          </span>

          <span className="flex min-w-0 flex-1 flex-col items-start">
            <span
              className="w-full truncate text-left font-medium leading-tight text-gray-800"
              title={person.name}
            >
              {person.name}
            </span>

            {person.description && (
              <span className="person-node__desc" title={person.description}>
                {person.description}
              </span>
            )}
          </span>
        </div>
      </div>

      {/* ИСХОДЯЩАЯ стрелка (к сыну) — сверху, потому что сын находится выше */}
      <Handle type="source" position={Position.Top} className="person-handle" />
    </>
  );
}
