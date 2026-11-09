/**
 * La intro vive en index.html para verse antes de que cargue JS. La app solo
 * avisa de que ya hay algo pintado; el tiempo mínimo lo decide la propia intro.
 */
export function finishIntro() {
  if (typeof window === 'undefined') return;
  const done = (window as unknown as { __introDone?: () => void }).__introDone;
  // Dos frames: el primero aún no ha pintado lo que React acaba de montar.
  requestAnimationFrame(() => requestAnimationFrame(() => done?.()));
}
