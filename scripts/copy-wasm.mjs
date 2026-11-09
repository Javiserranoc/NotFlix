// El motor SQLite (WebAssembly) se sirve como archivo estático desde public/.
import { copyFileSync, mkdirSync } from 'node:fs';

mkdirSync('public', { recursive: true });
copyFileSync('node_modules/sql.js/dist/sql-wasm.wasm', 'public/sql-wasm.wasm');
