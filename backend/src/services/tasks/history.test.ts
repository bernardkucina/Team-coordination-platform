import { describe, expect, it } from 'vitest';
import { describeChanges, joinParts, type TaskFields } from './history';

const base: TaskFields = {
  projectId: 'p1', workstream: 'Speakers', title: 'Book venue', status: 'priority', owner: null, helpers: [],
  priority: 'Medium', startWeek: null, endWeek: null, due: null, notes: '', links: [],
};
const names = { member: (id: string) => ({ ana: 'Ana', luka: 'Luka' })[id] ?? id, project: () => 'Shape Talks' };

describe('task history text', () => {
  it('describes each change', () => {
    const parts = describeChanges(base, { ...base, status: 'done', owner: 'ana', priority: 'High', due: '2026-10-30' }, names);
    expect(joinParts(parts)).toBe('moved it to Done, set the owner to Ana, changed the priority to High and set the due date to 30 Oct');
  });

  it('ignores helper order and reports nothing when nothing changed', () => {
    const a = { ...base, helpers: ['ana', 'luka'] };
    expect(describeChanges(a, { ...a, helpers: ['luka', 'ana'] }, names)).toEqual([]);
  });

  it('describes removals', () => {
    const a = { ...base, owner: 'ana', due: '2026-10-30' };
    expect(describeChanges(a, { ...a, owner: null, due: null }, names)).toEqual(['removed the owner', 'removed the due date']);
  });
});
