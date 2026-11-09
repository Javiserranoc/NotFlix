import { router, Stack } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';

import { Icon } from '../../core/ui/Icon';
import { TmdbSuggestions } from '../components/TmdbSuggestions';
import { KIND_META, MOVIE_KINDS, type MovieKind, type MovieStatus, STATUS_CHOICES, STATUS_META } from '../enums';
import { findByTmdbId, insertMovieReturningId, setStatus as applyStatus, updateMovie, useMovie } from '../repo';
import type { MovieEntry } from '../schema';
import { serializeSeasons } from '../seasons';
import { fetchDetails, type TmdbHit, useTmdbEnabled } from '../tmdb';
import { moviesTheme as th } from '../theme';
import { nowIso } from '../../core/db/sync';

/** Alta (sin id) o edición (con id). */
export function MovieEditScreen({ id, kind }: { id?: string; kind?: MovieKind }) {
  const existing = useMovie(id ?? '__none__');
  // Monta el formulario solo cuando (si hay id) ya tenemos los datos.
  if (id && !existing) return <View style={styles.root} />;
  return <Form key={existing?.id ?? 'new'} existing={id ? existing : undefined} initialKind={kind} />;
}

function Form({ existing, initialKind }: { existing?: MovieEntry; initialKind?: MovieKind }) {
  const tmdbOn = useTmdbEnabled();
  const [kind, setKind] = useState<MovieKind>(existing?.kind ?? initialKind ?? 'movie');
  const [status, setStatus] = useState<MovieStatus>(existing?.status ?? 'wishlist');
  const [title, setTitle] = useState(existing?.title ?? '');
  const [year, setYear] = useState(existing?.year?.toString() ?? '');
  const [genres, setGenres] = useState(existing?.genres ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [poster, setPoster] = useState(existing?.posterUrl ?? '');
  const [runtime, setRuntime] = useState(existing?.runtimeMinutes?.toString() ?? '');
  const [seasons, setSeasons] = useState(existing?.totalSeasons?.toString() ?? '');
  const [error, setError] = useState<string | null>(null);

  // Lo que viene de TMDB y no se edita a mano.
  const [tmdb, setTmdb] = useState<
    Pick<
      MovieEntry,
      | 'tmdbId'
      | 'overview'
      | 'backdropUrl'
      | 'tmdbSyncedAt'
      | 'seasonsJson'
      | 'collectionId'
      | 'collectionName'
    >
  >({
    tmdbId: existing?.tmdbId ?? null,
    overview: existing?.overview ?? '',
    backdropUrl: existing?.backdropUrl ?? null,
    tmdbSyncedAt: existing?.tmdbSyncedAt ?? null,
    seasonsJson: existing?.seasonsJson ?? null,
    collectionId: existing?.collectionId ?? null,
    collectionName: existing?.collectionName ?? null,
  });
  /** true = no molestar con sugerencias (aún no he escrito, o ya he elegido una). */
  const [dismissed, setDismissed] = useState(Boolean(existing));
  const [filling, setFilling] = useState(false);
  /** Título que ya está en la biblioteca con ese mismo tmdb_id. */
  const [dupe, setDupe] = useState<MovieEntry | null>(null);

  const series = kind === 'series';

  const int = (s: string) => {
    const n = parseInt(s.trim(), 10);
    return Number.isFinite(n) ? n : null;
  };

  /** Un resultado de TMDB rellena el formulario; lo escrito se sustituye. */
  const pick = async (hit: TmdbHit) => {
    setDismissed(true);
    setError(null);
    const already = findByTmdbId(hit.tmdbId);
    if (already && already.id !== existing?.id) {
      setDupe(already);
      return;
    }
    setDupe(null);
    setKind(hit.kind);
    setTitle(hit.title);
    setFilling(true);
    try {
      const d = await fetchDetails(hit.kind, hit.tmdbId);
      setTitle(d.title || hit.title);
      setYear(d.year?.toString() ?? '');
      setGenres(d.genres);
      setPoster(d.posterUrl ?? '');
      setRuntime(d.runtimeMinutes?.toString() ?? '');
      setSeasons(d.totalSeasons?.toString() ?? '');
      setTmdb({
        tmdbId: hit.tmdbId,
        overview: d.overview,
        backdropUrl: d.backdropUrl,
        tmdbSyncedAt: nowIso(),
        seasonsJson: serializeSeasons(d.seasons),
        collectionId: d.collectionId,
        collectionName: d.collectionName,
      });
    } catch (e) {
      // El título y el tipo ya están puestos: se puede terminar a mano.
      setError(e instanceof Error ? e.message : 'No se han podido traer los datos');
    } finally {
      setFilling(false);
    }
  };

  const unlink = () => {
    setTmdb({
      tmdbId: null,
      overview: '',
      backdropUrl: null,
      tmdbSyncedAt: null,
      seasonsJson: null,
      collectionId: null,
      collectionName: null,
    });
    setDupe(null);
  };

  const save = () => {
    if (!title.trim()) {
      setError('Escribe un título');
      return;
    }
    // El estado no va en `values`: lo aplica setStatus, que es quien apunta el
    // visionado y la fecha. Si no, algo añadido a mano como Vista no salía ni
    // en Números ni en "Lo último que viste".
    const values = {
      kind,
      title: title.trim(),
      year: int(year),
      genres: genres.trim(),
      notes: notes.trim(),
      posterUrl: poster.trim() || null,
      runtimeMinutes: int(runtime),
      totalSeasons: series ? int(seasons) : null,
      ...tmdb,
    };
    try {
      if (existing) {
        updateMovie(existing.id, values);
        applyStatus(existing.id, status, existing.status);
      } else {
        const id = insertMovieReturningId({ ...values, status: 'wishlist' });
        applyStatus(id, status, 'wishlist');
      }
    } catch {
      // Solo puede saltar el índice único de tmdb_id.
      setError('Ya tienes ese título en la biblioteca');
      return;
    }
    router.back();
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: existing ? 'Editar' : 'Nuevo título' }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.segmented}>
          {MOVIE_KINDS.map((k) => (
            <Pressable
              key={k}
              onPress={() => setKind(k)}
              style={[styles.segment, kind === k && { backgroundColor: th.accent }]}
            >
              <Icon name={KIND_META[k].icon} size={16} color={kind === k ? th.onAccent : th.text} />
              <Text style={[styles.segmentText, kind === k && { color: th.onAccent }]}>{KIND_META[k].label}</Text>
            </Pressable>
          ))}
        </View>

        <Field
          label={tmdbOn ? 'Título (busca en TMDB al escribir)' : 'Título'}
          value={title}
          onChangeText={(v) => {
            setTitle(v);
            setError(null);
            setDismissed(false);
          }}
          autoFocus={!existing}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TmdbSuggestions query={title} enabled={!dismissed && !filling} onPick={pick} />

        {dupe ? (
          <View style={styles.card}>
            <Text style={styles.cardText}>Ya tienes “{dupe.title}” en la biblioteca.</Text>
            <View style={styles.row}>
              <Pressable style={[styles.btn, { backgroundColor: th.surfaceHigh }]} onPress={() => setDupe(null)}>
                <Text style={styles.btnText}>Seguir aquí</Text>
              </Pressable>
              <Pressable
                style={[styles.btn, { backgroundColor: th.accent }]}
                onPress={() => router.replace(`/titulo/${dupe.id}` as never)}
              >
                <Text style={[styles.btnText, { color: th.onAccent }]}>Abrir su ficha</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {filling ? (
          <View style={styles.linked}>
            <ActivityIndicator size="small" color={th.textMuted} />
            <Text style={styles.linkedText}>Trayendo los datos de TMDB…</Text>
          </View>
        ) : tmdb.tmdbId != null ? (
          <View style={styles.linked}>
            <Icon name="link-variant" size={16} color={th.textMuted} />
            <Text style={styles.linkedText}>Datos de TMDB</Text>
            <Pressable hitSlop={8} onPress={unlink}>
              <Text style={styles.unlink}>Desvincular</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.row}>
          <Field label="Año" value={year} onChangeText={setYear} keyboardType="number-pad" style={{ flex: 1 }} />
          <Field label="Géneros" value={genres} onChangeText={setGenres} style={{ flex: 2 }} />
        </View>

        <View style={styles.wrap}>
          {STATUS_CHOICES.map((s) => {
            const m = STATUS_META[s];
            const active = status === s;
            return (
              <Pressable
                key={s}
                onPress={() => setStatus(s)}
                style={[
                  styles.choice,
                  { borderColor: active ? m.color : th.border, backgroundColor: active ? m.color + '40' : 'transparent' },
                ]}
              >
                <Icon name={m.icon} size={16} color={m.color} />
                <Text style={styles.choiceText}>{m.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.row}>
          <Field
            label={series ? 'Min. por episodio' : 'Duración (min)'}
            value={runtime}
            onChangeText={setRuntime}
            keyboardType="number-pad"
            style={{ flex: 1 }}
          />
          {series ? (
            <Field label="Temporadas" value={seasons} onChangeText={setSeasons} keyboardType="number-pad" style={{ flex: 1 }} />
          ) : null}
        </View>

        <Field label="URL del póster (opcional)" value={poster} onChangeText={setPoster} keyboardType="url" autoCapitalize="none" />
        <Field label="Mi reseña" value={notes} onChangeText={setNotes} multiline style={{ minHeight: 90 }} />

        <Pressable onPress={save} style={({ pressed }) => [styles.save, { opacity: pressed ? 0.85 : 1 }]}>
          <Text style={styles.saveText}>{existing ? 'Guardar cambios' : 'Añadir'}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, style, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={[{ gap: 6 }, style as object]}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...props}
        placeholderTextColor={th.textMuted}
        style={[styles.input, props.multiline && { minHeight: 90, textAlignVertical: 'top', paddingTop: 12 }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: th.background },
  content: { padding: 20, gap: 16, paddingBottom: 48 },
  row: { flexDirection: 'row', gap: 12 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  label: { color: th.textMuted, fontSize: 12, fontWeight: '600' },
  input: {
    backgroundColor: th.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: th.border,
    color: th.text,
    fontSize: 15,
    paddingHorizontal: 12,
    minHeight: 46,
  },
  error: { color: '#FF6B7A', fontSize: 12, marginTop: -8 },
  linked: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: -8 },
  linkedText: { color: th.textMuted, fontSize: 12, flex: 1 },
  unlink: { color: th.accent, fontSize: 12, fontWeight: '700' },
  card: { backgroundColor: th.surface, borderRadius: 16, padding: 16, gap: 12 },
  cardText: { color: th.text, fontSize: 15, fontWeight: '600' },
  btn: { flex: 1, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: th.text, fontSize: 14, fontWeight: '700' },
  segmented: { flexDirection: 'row', backgroundColor: th.surface, borderRadius: 14, padding: 4, gap: 4 },
  segment: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  segmentText: { color: th.text, fontSize: 14, fontWeight: '600' },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 99,
    paddingHorizontal: 12,
    height: 36,
  },
  choiceText: { color: th.text, fontSize: 13, fontWeight: '600' },
  save: { marginTop: 8, height: 52, borderRadius: 16, backgroundColor: th.accent, alignItems: 'center', justifyContent: 'center' },
  saveText: { color: th.onAccent, fontSize: 16, fontWeight: '700' },
});
