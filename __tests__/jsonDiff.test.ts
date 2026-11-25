import { describe, expect, it } from '@jest/globals';
import { diffJson } from '../src/core/diff/jsonDiff';

describe('diffJson', () => {
  it('returns nested added, removed, and modified paths', () => {
    expect(
      diffJson(
        { name: 'Ada', profile: { active: true, obsolete: 1 }, tags: ['old'] },
        { name: 'Grace', profile: { active: false, added: 2 }, tags: ['old', 'new'] },
      ),
    ).toEqual([
      { path: '$.name', type: 'modified', left: 'Ada', right: 'Grace' },
      { path: '$.profile.active', type: 'modified', left: true, right: false },
      { path: '$.profile.obsolete', type: 'removed', left: 1 },
      { path: '$.profile.added', type: 'added', right: 2 },
      { path: '$.tags[1]', type: 'added', right: 'new' },
    ]);
  });

  it('reports keys containing punctuation with unambiguous paths', () => {
    expect(diffJson({ 'x-y': 1 }, { 'x-y': 2 })).toEqual([
      { path: '$["x-y"]', type: 'modified', left: 1, right: 2 },
    ]);
  });

  it('handles root value changes and identical JSON values', () => {
    expect(diffJson(null, { value: 1 })).toEqual([
      { path: '$', type: 'modified', left: null, right: { value: 1 } },
    ]);
    expect(diffJson({ a: [1, 2] }, { a: [1, 2] })).toEqual([]);
  });
});
