/**
 * Guarda un archivo de texto. En iOS abre la hoja de compartir, que ofrece
 * "Guardar en Archivos": en una PWA instalada, un enlace de descarga no es fiable.
 * Devuelve false si la persona cancela.
 */
export async function saveTextFile(name: string, text: string, type: string): Promise<boolean> {
  const file = new File([text], name, { type });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return true;
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return false;
      // Otro motivo (p. ej. tipo no permitido): queda la descarga normal.
    }
  }
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return true;
}

/**
 * Pide un archivo y devuelve su contenido, o null si se cancela. Sin `accept`
 * a propósito: iOS deja en gris las extensiones que no conoce, como `.db`.
 */
export function pickFile(): Promise<Uint8Array | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.style.cssText = 'position:fixed;left:-9999px;opacity:0';
    document.body.appendChild(input);
    input.oncancel = () => {
      input.remove();
      resolve(null);
    };
    input.onchange = () => {
      const file = input.files?.[0];
      input.remove();
      if (!file) return resolve(null);
      file.arrayBuffer().then((buffer) => resolve(new Uint8Array(buffer)), reject);
    };
    input.click();
  });
}
