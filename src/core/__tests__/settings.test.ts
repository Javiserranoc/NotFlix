/** Ajustes: la key se guarda cifrada, sobrevive a reabrir la app y vaciarla la borra. */

const mockStore = new Map<string, unknown>();

jest.mock('../idb', () => ({
  idbGet: async (k: string) => mockStore.get(k),
  idbPut: async (k: string, v: unknown) => void mockStore.set(k, v),
  idbDelete: async (k: string) => void mockStore.delete(k),
}));

type Settings = typeof import('../settings');

/** Cada carga es la app recién abierta: sin nada en memoria. */
function open(): Settings {
  let mod!: Settings;
  jest.isolateModules(() => {
    mod = require('../settings');
  });
  return mod;
}

const SAVED = 'setting.tmdb_key';
const text = (bytes: ArrayBuffer) => Buffer.from(bytes).toString('latin1');

beforeEach(() => mockStore.clear());

describe('settings', () => {
  it('sin nada guardado no hay key, aunque exista la variable del .env', async () => {
    process.env.EXPO_PUBLIC_TMDB_KEY = 'env-key';
    const s = open();
    await s.loadSettings();
    expect(s.getSetting('tmdbKey')).toBe('');
    delete process.env.EXPO_PUBLIC_TMDB_KEY;
  });

  it('no guarda la key en claro', async () => {
    await open().setSetting('tmdbKey', '  mi-key-secreta  ');
    const saved = mockStore.get(SAVED) as { iv: Uint8Array; data: ArrayBuffer };
    expect(saved.iv).toHaveLength(12);
    expect(text(saved.data)).not.toContain('mi-key-secreta');
  });

  it('la clave de cifrado no se puede extraer', async () => {
    await open().setSetting('tmdbKey', 'x');
    expect((mockStore.get('setting.cipher_key') as CryptoKey).extractable).toBe(false);
  });

  it('la descifra al volver a abrir la app', async () => {
    await open().setSetting('tmdbKey', '  mia  ');
    const reopened = open();
    expect(reopened.getSetting('tmdbKey')).toBe('');
    await reopened.loadSettings();
    expect(reopened.getSetting('tmdbKey')).toBe('mia');
  });

  it('cada guardado usa un IV distinto', async () => {
    const s = open();
    await s.setSetting('tmdbKey', 'mia');
    const first = (mockStore.get(SAVED) as { iv: Uint8Array }).iv;
    await s.setSetting('tmdbKey', 'mia');
    expect((mockStore.get(SAVED) as { iv: Uint8Array }).iv).not.toEqual(first);
  });

  it('vaciar el campo la borra', async () => {
    const s = open();
    await s.setSetting('tmdbKey', 'mia');
    await s.setSetting('tmdbKey', '');
    expect(mockStore.has(SAVED)).toBe(false);
    expect(s.getSetting('tmdbKey')).toBe('');
  });

  it('si lo guardado está dañado, arranca sin key en vez de fallar', async () => {
    await open().setSetting('tmdbKey', 'mia');
    mockStore.set(SAVED, { iv: new Uint8Array(12), data: new ArrayBuffer(32) });
    const reopened = open();
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(reopened.loadSettings()).resolves.toBeUndefined();
    warn.mockRestore();
    expect(reopened.getSetting('tmdbKey')).toBe('');
  });
});
