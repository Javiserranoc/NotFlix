import { createElement, useState, useSyncExternalStore } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { moviesTheme as th } from '../../movies/theme';

type Request = { key: number; value: string; onPick: (date: Date) => void };

let current: Request | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
const close = () => {
  current = null;
  emit();
};

const pad = (n: number) => String(n).padStart(2, '0');
const toInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/**
 * Pide un día, sin fechas futuras. El campo se enseña de verdad en vez de
 * abrirlo con `showPicker()`: en iOS, un input oculto no siempre abre la rueda.
 */
export function pickDay(initial: Date, onPick: (date: Date) => void) {
  current = { key: Date.now(), value: toInput(initial), onPick };
  emit();
}

/** Va una vez, en el layout raíz. */
export function DatePickerHost() {
  const request = useSyncExternalStore(subscribe, () => current);
  if (!request) return null;
  return <Picker key={request.key} request={request} />;
}

function Picker({ request }: { request: Request }) {
  const [value, setValue] = useState(request.value);
  const today = toInput(new Date());
  // El selector de iOS deja llegar a días futuros aunque el campo tenga `max`.
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(value) && value <= today;

  const confirm = () => {
    if (!valid) return;
    const [y, m, d] = value.split('-').map(Number) as [number, number, number];
    close();
    request.onPick(new Date(y, m - 1, d));
  };

  return (
    <Modal transparent visible animationType="fade" onRequestClose={close}>
      <Pressable style={styles.scrim} onPress={close} accessibilityLabel="Cerrar" />
      <View style={styles.center} pointerEvents="box-none">
        <View style={styles.box}>
          <Text style={styles.title}>¿Qué día fue?</Text>
          {createElement('input', {
            type: 'date',
            value,
            max: today,
            'aria-label': 'Fecha',
            onChange: (e: { target: { value: string } }) => setValue(e.target.value),
            style: inputStyle,
          })}
          {value > today ? <Text style={styles.hint}>No puede ser un día futuro</Text> : null}
          <View style={styles.row}>
            <Pressable onPress={close} style={[styles.button, styles.cancel]}>
              <Text style={styles.cancelText}>Cancelar</Text>
            </Pressable>
            <Pressable onPress={confirm} disabled={!valid} style={[styles.button, styles.ok, !valid && { opacity: 0.45 }]}>
              <Text style={styles.okText}>Guardar</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const inputStyle = {
  boxSizing: 'border-box',
  width: '100%',
  minHeight: 48,
  padding: '10px 12px',
  border: `1px solid ${th.border}`,
  borderRadius: 12,
  background: th.background,
  color: th.text,
  colorScheme: 'dark',
  fontSize: 16,
  WebkitAppearance: 'none',
} as const;

const styles = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.6)' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  box: { width: '100%', maxWidth: 360, backgroundColor: th.surfaceHigh, borderRadius: 18, padding: 20, gap: 14 },
  title: { color: th.text, fontSize: 18, fontWeight: '700' },
  hint: { color: '#FF6B7A', fontSize: 12 },
  row: { flexDirection: 'row', gap: 10 },
  button: { flex: 1, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cancel: { borderWidth: 1, borderColor: th.border },
  cancelText: { color: th.text, fontSize: 15, fontWeight: '700' },
  ok: { backgroundColor: th.accent },
  okText: { color: th.onAccent, fontSize: 15, fontWeight: '700' },
});
