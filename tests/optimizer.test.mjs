import test from 'node:test';
import assert from 'node:assert/strict';
import { optimize } from '../server/optimizer.mjs';
import { validate, readLibrary } from '../src/lib/routes.ts';
test('single destination', () => assert.deepEqual(optimize([[0, 12], [30, 0]]), { seconds: 12, order: [1] }));
test('chooses global minimum instead of nearest neighbor', () => {
  assert.deepEqual(optimize([[0, 1, 2], [9, 0, 100], [9, 1, 0]]), { seconds: 3, order: [2, 1] });
});
test('unreachable stops fail instead of inventing a path', () => assert.throws(() => optimize([[0, Infinity], [0, 0]])));
test('can route around unavailable directed edges', () => assert.deepEqual(optimize([[0, 2, Infinity], [1, 0, 3], [1, Infinity, 0]]), { seconds: 5, order: [1, 2] }));
test('matches exhaustive enumeration for eight destinations', () => {
  const matrix = Array.from({ length: 9 }, (_, i) => Array.from({ length: 9 }, (_, j) => i === j ? 0 : ((i * 31 + j * 17 + i * j * 7) % 97) + 1));
  let minimum = Infinity;
  function enumerate(current, remaining, total) {
    if (!remaining.length) minimum = Math.min(minimum, total);
    for (const next of remaining) enumerate(next, remaining.filter(i => i !== next), total + matrix[current][next]);
  }
  enumerate(0, [1, 2, 3, 4, 5, 6, 7, 8], 0);
  const result = optimize(matrix);
  assert.equal(result.seconds, minimum);
  assert.equal(new Set(result.order).size, 8);
});
test('rejects empty, duplicated and oversized forms', () => {
  assert.ok(validate('', ['B'])); assert.ok(validate('A', [''])); assert.ok(validate(' A ', ['a']));
  assert.ok(validate('A', Array(9).fill('B'))); assert.equal(validate('A', ['B', 'C']), null);
});
test('local storage round trip and corruption protection', () => {
  const library = { favorites: [{ id: '1', origin: 'A', stops: ['B'], date: '2026-09-10' }], history: [] };
  assert.deepEqual(readLibrary(JSON.stringify(library)), library);
  assert.deepEqual(readLibrary(null), { favorites: [], history: [] });
  assert.throws(() => readLibrary('{')); assert.throws(() => readLibrary('{"favorites":42}'));
});
