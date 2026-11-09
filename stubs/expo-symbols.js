// Sustituto de `expo-symbols` SOLO para las NativeTabs de expo-router, que no
// usamos: evita meter la fuente Material Symbols (944 KB). Ver metro.config.js.
export async function unstable_getMaterialSymbolSourceAsync() {
  return null;
}
