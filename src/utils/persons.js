/**
 * Собирает id человека и всех его потомков (всю ветку).
 * @param {{ id: string, fatherId: string|null }[]} persons
 * @param {string} rootId
 * @returns {Set<string>}
 */
export function collectBranchIds(persons, rootId) {
  const childrenByFather = new Map();

  persons.forEach(person => {
    if (!person.fatherId) return;
    const children = childrenByFather.get(person.fatherId);
    if (children) {
      children.push(person.id);
    } else {
      childrenByFather.set(person.fatherId, [person.id]);
    }
  });

  const ids = new Set();
  const stack = [rootId];

  while (stack.length > 0) {
    const id = stack.pop();
    if (ids.has(id)) continue;

    ids.add(id);
    const children = childrenByFather.get(id);
    if (children) stack.push(...children);
  }

  return ids;
}

/**
 * «1 человек», «2 человека», «5 человек».
 * @param {number} count
 * @returns {string}
 */
export function peopleWord(count) {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 === 1 && mod100 !== 11) return 'человек';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'человека';
  return 'человек';
}
