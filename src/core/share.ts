import { showToast } from './toast';

/** Más que esto en un mensaje no se lee: se corta con "…y N más". */
export const SHARE_LIMIT = 40;

/**
 * Una lista como texto para mandar por WhatsApp, Telegram…: cabecera con el
 * total, una línea por elemento y, si no caben, cuántos faltan.
 */
export function listText(title: string, lines: readonly string[], limit = SHARE_LIMIT): string {
  const head = `${title} (${lines.length})`;
  const body = lines.slice(0, limit).map((l) => `• ${l}`);
  if (lines.length > limit) body.push(`…y ${lines.length - limit} más`);
  return [head, '', ...body].join('\n');
}

/** Abre la hoja de compartir del sistema; donde no exista, copia el texto. */
export async function shareList(title: string, lines: readonly string[]): Promise<void> {
  const text = listText(title, lines);
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ text });
    } catch {
      // Cerrar la hoja de compartir también llega aquí: no es un error.
    }
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    showToast('Lista copiada');
  } catch {
    showToast('No se ha podido compartir');
  }
}
