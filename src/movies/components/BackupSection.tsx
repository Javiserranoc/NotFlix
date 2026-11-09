import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { pickFile, saveTextFile } from '../../core/files';
import { showToast } from '../../core/toast';
import { Icon } from '../../core/ui/Icon';
import { backupFileName, BackupError, exportBackup, type Library, readBackup, restoreBackup } from '../backup';
import { MOVIE_STATUSES } from '../enums';
import { useMovieCounts } from '../repo';
import { moviesTheme as th } from '../theme';

const live = (rows: Library['titles']) => rows.filter((r) => r.deleted_at == null).length;
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Exportar e importar. Importar enseña qué trae el archivo antes de sustituir nada. */
export function BackupSection() {
  const counts = useMovieCounts();
  const total = MOVIE_STATUSES.reduce((n, s) => n + counts[s], 0);
  const [incoming, setIncoming] = useState<Library | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const fail = (e: unknown, fallback: string) => setProblem(e instanceof BackupError ? e.message : fallback);

  const exportNow = async () => {
    setProblem(null);
    try {
      if (await saveTextFile(backupFileName(), exportBackup(), 'application/json')) showToast('Copia lista');
    } catch (e) {
      fail(e, 'No se ha podido exportar');
    }
  };

  const chooseFile = async () => {
    setProblem(null);
    try {
      const bytes = await pickFile();
      if (bytes) setIncoming(await readBackup(bytes));
    } catch (e) {
      fail(e, 'No se ha podido leer el archivo');
    }
  };

  const confirm = async () => {
    if (!incoming || busy) return;
    setBusy(true);
    try {
      await restoreBackup(incoming);
      showToast(`${plural(live(incoming.titles), 'título importado', 'títulos importados')}`);
      setIncoming(null);
    } catch (e) {
      fail(e, 'No se ha podido importar');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.section}>
      <View style={styles.head}>
        <Icon name="backup-restore" size={18} color={th.accent} />
        <Text style={styles.title}>Copia de seguridad</Text>
      </View>
      <Text style={styles.help}>
        Tu biblioteca solo está en este dispositivo: si borras la app, se borra con ella. Guarda una copia de vez en cuando en
        Archivos o en iCloud. No incluye la key de TMDB.
      </Text>

      {incoming ? (
        <View style={styles.confirm}>
          <Text style={styles.confirmText}>
            El archivo tiene {plural(live(incoming.titles), 'título', 'títulos')} y{' '}
            {plural(live(incoming.watches), 'visionado', 'visionados')}.
            {total > 0 ? ` Sustituirá tu biblioteca actual (${plural(total, 'título', 'títulos')}).` : ''}
          </Text>
          <View style={styles.row}>
            <Pressable onPress={() => setIncoming(null)} style={[styles.button, styles.flex]}>
              <Text style={styles.buttonText}>Cancelar</Text>
            </Pressable>
            <Pressable onPress={confirm} disabled={busy} style={[styles.button, styles.flex, styles.primary]}>
              <Text style={[styles.buttonText, { color: th.onAccent }]}>{total > 0 ? 'Sustituir' : 'Importar'}</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.row}>
          <Pressable onPress={exportNow} style={[styles.button, styles.flex]}>
            <Icon name="export-variant" size={16} color={th.text} />
            <Text style={styles.buttonText}>Exportar</Text>
          </Pressable>
          <Pressable onPress={chooseFile} style={[styles.button, styles.flex]}>
            <Icon name="import" size={16} color={th.text} />
            <Text style={styles.buttonText}>Importar</Text>
          </Pressable>
        </View>
      )}
      {problem ? <Text style={styles.problem}>{problem}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { backgroundColor: th.surface, borderRadius: 16, borderWidth: 1, borderColor: th.border, padding: 16, gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { color: th.text, fontSize: 16, fontWeight: '700' },
  help: { color: th.textMuted, fontSize: 12, lineHeight: 17 },
  row: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1 },
  button: {
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: th.border,
    flexDirection: 'row',
    gap: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: { backgroundColor: th.accent, borderColor: th.accent },
  buttonText: { color: th.text, fontSize: 14, fontWeight: '700' },
  confirm: { gap: 10 },
  confirmText: { color: th.text, fontSize: 14, lineHeight: 20 },
  problem: { color: '#FF6B7A', fontSize: 13 },
});
