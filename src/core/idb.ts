/**
 * Almacén clave-valor sobre IndexedDB.
 *
 * La conexión se abre y se cierra en cada operación porque Safari puede perder
 * las conexiones largas al suspender la app ("Connection to Indexed Database
 * server lost").
 */
const DB_NAME = 'notflix';
const STORE = 'files';

function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB_NAME, 1);
    open.onupgradeneeded = () => open.result.createObjectStore(STORE);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const idb = open.result;
      const tx = idb.transaction(STORE, mode);
      const request = run(tx.objectStore(STORE));
      tx.oncomplete = () => {
        idb.close();
        resolve(request.result);
      };
      tx.onabort = tx.onerror = () => {
        idb.close();
        reject(tx.error);
      };
    };
  });
}

export const idbGet = <T>(key: string) => withStore<T | undefined>('readonly', (s) => s.get(key));

export const idbPut = (key: string, value: unknown) => withStore('readwrite', (s) => s.put(value, key)).then(() => {});

export const idbDelete = (key: string) => withStore('readwrite', (s) => s.delete(key)).then(() => {});
