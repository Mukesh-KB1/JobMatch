import { takeRotatingSlice } from '../../src/services/ingestionService.js';
import IngestionState from '../../src/models/IngestionState.js';

describe('takeRotatingSlice', () => {
  test('takes the first N items on a fresh cursor and persists the new cursor', async () => {
    const list = ['a', 'b', 'c', 'd', 'e'];
    const { slice, nextCursor } = await takeRotatingSlice('adzuna', list, 2);
    expect(slice).toEqual(['a', 'b']);
    expect(nextCursor).toBe(2);

    const state = await IngestionState.findOne({ key: 'adzuna' });
    expect(state.cursor).toBe(2);
  });

  test('a second call continues from where the first left off', async () => {
    const list = ['a', 'b', 'c', 'd', 'e'];
    await takeRotatingSlice('adzuna', list, 2); // consumes a, b -> cursor at 2
    const { slice } = await takeRotatingSlice('adzuna', list, 2); // should get c, d
    expect(slice).toEqual(['c', 'd']);
  });

  test('wraps around to the start of the list', async () => {
    const list = ['a', 'b', 'c', 'd', 'e'];
    await takeRotatingSlice('adzuna', list, 4); // consumes a,b,c,d -> cursor at 4
    const { slice, nextCursor } = await takeRotatingSlice('adzuna', list, 3); // e, then wrap to a, b
    expect(slice).toEqual(['e', 'a', 'b']);
    expect(nextCursor).toBe(2);
  });

  test('cursor is persisted independently per source key', async () => {
    const list = ['a', 'b', 'c', 'd'];
    await takeRotatingSlice('adzuna', list, 3);
    const { slice: joobleSlice } = await takeRotatingSlice('jooble', list, 1);
    // Jooble's cursor should be untouched by adzuna's progress.
    expect(joobleSlice).toEqual(['a']);

    const adzunaState = await IngestionState.findOne({ key: 'adzuna' });
    const joobleState = await IngestionState.findOne({ key: 'jooble' });
    expect(adzunaState.cursor).toBe(3);
    expect(joobleState.cursor).toBe(1);
  });

  test('cursor survives a simulated restart (re-reading from persisted state)', async () => {
    const list = ['a', 'b', 'c'];
    await takeRotatingSlice('adzuna', list, 2); // cursor -> 2
    // Simulate a fresh process by just calling again - state comes from Mongo, not memory.
    const { slice } = await takeRotatingSlice('adzuna', list, 2); // c, then wrap to a
    expect(slice).toEqual(['c', 'a']);
  });

  test('an empty list yields an empty slice without throwing', async () => {
    const { slice, nextCursor } = await takeRotatingSlice('adzuna', [], 5);
    expect(slice).toEqual([]);
    expect(nextCursor).toBe(0);
  });
});
