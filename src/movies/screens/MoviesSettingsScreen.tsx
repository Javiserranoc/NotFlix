import { Stack } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { setSetting, useSetting } from '../../core/settings';
import { Icon } from '../../core/ui/Icon';
import { BackupSection } from '../components/BackupSection';
import { checkTmdbKey } from '../tmdb';
import { moviesTheme as th } from '../theme';

/** La key de TMDB. Sin ella la app funciona igual, pero sin búsqueda. */
export function MoviesSettingsScreen() {
  const value = useSetting('tmdbKey');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const cancel = () => {
    setEditing(false);
    setDraft('');
    setProblem(null);
  };

  const store = async () => {
    try {
      await setSetting('tmdbKey', draft);
      cancel();
    } catch {
      setProblem('No se ha podido guardar cifrada. La app tiene que abrirse por HTTPS.');
    }
  };

  /** Prueba la key; si falla avisa, pero deja guardarla: sin red no se puede comprobar. */
  const save = async () => {
    if (!draft.trim() || busy) return;
    setBusy(true);
    const error = await checkTmdbKey(draft.trim());
    setBusy(false);
    if (error) setProblem(error);
    else await store();
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: 'Ajustes' }} />
      <View style={styles.section}>
        <View style={styles.head}>
          <Icon name="filmstrip" size={18} color={th.accent} />
          <Text style={styles.sectionTitle}>TMDB</Text>
        </View>
        <Text style={styles.label}>API KEY (V3)</Text>

        {editing ? (
          <>
            <TextInput
              value={draft}
              onChangeText={(t) => {
                setDraft(t);
                setProblem(null);
              }}
              placeholder="Pega aquí la key"
              placeholderTextColor={th.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              secureTextEntry
              onSubmitEditing={save}
              style={styles.input}
            />
            {problem ? (
              <View style={{ gap: 4 }}>
                <Text style={styles.problem}>{problem}</Text>
                <Pressable onPress={store} hitSlop={6}>
                  <Text style={styles.link}>Guardar igualmente</Text>
                </Pressable>
              </View>
            ) : null}
            <View style={styles.row}>
              <Pressable onPress={cancel} style={styles.button}>
                <Text style={styles.buttonText}>Cancelar</Text>
              </Pressable>
              <Pressable onPress={save} disabled={busy} style={[styles.button, styles.primary]}>
                {busy ? (
                  <ActivityIndicator size="small" color={th.onAccent} />
                ) : (
                  <Text style={[styles.buttonText, { color: th.onAccent }]}>Probar y guardar</Text>
                )}
              </Pressable>
            </View>
          </>
        ) : (
          <View style={styles.keyRow}>
            <Icon name={value ? 'key-variant' : 'key-remove'} size={16} color={value ? th.accent : th.textMuted} />
            <Text style={[styles.keyStatus, !value && { color: th.textMuted }]} numberOfLines={1}>
              {value ? `••••${value.slice(-4)}` : 'Sin key'}
            </Text>
            {value ? (
              <Pressable onPress={() => setSetting('tmdbKey', '')} style={styles.button}>
                <Text style={styles.buttonText}>Quitar</Text>
              </Pressable>
            ) : null}
            <Pressable onPress={() => setEditing(true)} style={[styles.button, !value && styles.primary]}>
              <Text style={[styles.buttonText, !value && { color: th.onAccent }]}>{value ? 'Cambiar' : 'Añadir'}</Text>
            </Pressable>
          </View>
        )}

        <Text style={styles.help}>Gratis en themoviedb.org → Ajustes → API. Sin ella la app funciona igual, pero sin búsqueda.</Text>
        <Pressable onPress={() => Linking.openURL('https://www.themoviedb.org/settings/api')} hitSlop={6} style={styles.linkRow}>
          <Text style={styles.link}>Conseguir una key</Text>
          <Icon name="open-in-new" size={13} color={th.accent} />
        </Pressable>
      </View>

      <BackupSection />

      <Text style={styles.footer}>La key se guarda cifrada en este dispositivo y solo se envía a TMDB.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: th.background },
  content: { padding: 16, gap: 14 },
  section: { backgroundColor: th.surface, borderRadius: 16, borderWidth: 1, borderColor: th.border, padding: 16, gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { color: th.text, fontSize: 16, fontWeight: '700' },
  label: { color: th.textMuted, fontSize: 12, fontWeight: '600', letterSpacing: 0.6 },
  input: { color: th.text, borderWidth: 1, borderColor: th.border, backgroundColor: th.background, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  problem: { color: '#FF6B7A', fontSize: 13 },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  keyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  keyStatus: { flex: 1, color: th.text, fontSize: 15, fontFamily: 'monospace' },
  help: { color: th.textMuted, fontSize: 12, lineHeight: 17 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
  link: { color: th.accent, fontSize: 13, fontWeight: '700' },
  button: { minWidth: 64, minHeight: 36, borderRadius: 999, borderWidth: 1, borderColor: th.border, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  primary: { backgroundColor: th.accent, borderColor: th.accent },
  buttonText: { color: th.text, fontSize: 13, fontWeight: '700' },
  footer: { color: th.textMuted, fontSize: 12, lineHeight: 17, paddingHorizontal: 4 },
});
