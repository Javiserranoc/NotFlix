import { uuidv7 } from '../db/sync';


const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('uuidv7', () => {
  it('sale en orden aunque se creen muchos en el mismo milisegundo', () => {
    const ids = Array.from({ length: 5000 }, () => uuidv7());
    expect(ids.every((id) => UUID_V7.test(id))).toBe(true);
    expect([...ids].sort()).toEqual(ids);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
