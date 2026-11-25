import type { JsonDiffEntry } from '../types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function childPath(parentPath: string, key: string): string {
  if (/^[A-Za-z_$][\w$]*$/.test(key)) {
    return `${parentPath}.${key}`;
  }
  return `${parentPath}[${JSON.stringify(key)}]`;
}

function compareValues(
  left: unknown,
  right: unknown,
  path: string,
  entries: JsonDiffEntry[],
): void {
  if (Object.is(left, right)) {
    return;
  }

  if (Array.isArray(left) && Array.isArray(right)) {
    const sharedLength = Math.min(left.length, right.length);
    for (let index = 0; index < sharedLength; index += 1) {
      compareValues(left[index], right[index], `${path}[${index}]`, entries);
    }
    for (let index = sharedLength; index < left.length; index += 1) {
      entries.push({ path: `${path}[${index}]`, type: 'removed', left: left[index] });
    }
    for (let index = sharedLength; index < right.length; index += 1) {
      entries.push({ path: `${path}[${index}]`, type: 'added', right: right[index] });
    }
    return;
  }

  if (isRecord(left) && isRecord(right)) {
    const leftKeys = Object.keys(left);
    const rightKeySet = new Set(Object.keys(right));

    for (const key of leftKeys) {
      const pathForKey = childPath(path, key);
      if (!rightKeySet.has(key)) {
        entries.push({ path: pathForKey, type: 'removed', left: left[key] });
      } else {
        compareValues(left[key], right[key], pathForKey, entries);
      }
    }

    const leftKeySet = new Set(leftKeys);
    for (const key of Object.keys(right)) {
      if (!leftKeySet.has(key)) {
        entries.push({ path: childPath(path, key), type: 'added', right: right[key] });
      }
    }
    return;
  }

  entries.push({ path, type: 'modified', left, right });
}

export function diffJson(left: unknown, right: unknown): JsonDiffEntry[] {
  const entries: JsonDiffEntry[] = [];
  compareValues(left, right, '$', entries);
  return entries;
}
