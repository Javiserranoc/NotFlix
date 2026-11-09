import {
  MOVIES_MIGRATION_V1,
  MOVIES_MIGRATION_V2,
  MOVIES_MIGRATION_V3,
  MOVIES_MIGRATION_V4,
  MOVIES_MIGRATION_V5,
  MOVIES_MIGRATION_V6,
} from '../../movies/schema';

/**
 * Lista ÚNICA y ordenada de migraciones. Solo se añade al final; nunca se
 * edita una que ya se haya ejecutado en un dispositivo.
 */
export const MIGRATIONS: { version: number; name: string; sql: string }[] = [
  { version: 1, name: 'títulos', sql: MOVIES_MIGRATION_V1 },
  { version: 2, name: 'sin episodios + campos de TMDB', sql: MOVIES_MIGRATION_V2 },
  { version: 3, name: 'temporadas', sql: MOVIES_MIGRATION_V3 },
  { version: 4, name: 'temporadas vistas + saga', sql: MOVIES_MIGRATION_V4 },
  { version: 5, name: 'historial de visionados', sql: MOVIES_MIGRATION_V5 },
  { version: 6, name: 'sin el estado En curso', sql: MOVIES_MIGRATION_V6 },
];
