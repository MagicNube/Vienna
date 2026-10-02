export function validateProfileImage(file: Pick<File, 'type' | 'size'>) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    throw Error('Elige una imagen JPG, PNG o WebP.');
  if (file.size > 10 * 1024 * 1024) throw Error('La imagen debe ocupar menos de 10 MB.');
  if (!file.size) throw Error('La imagen está vacía.');
}

export async function profileImage(file: File): Promise<string> {
  validateProfileImage(file);
  // Packaged Vienna permits self/data: images. Read the file as data: instead
  // of blob:, which is blocked by its content security policy.
  const source = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === 'string'
        ? resolve(reader.result)
        : reject(Error('No se pudo leer la imagen.'));
    reader.onerror = () => reject(Error('No se pudo leer la imagen.'));
    reader.onabort = () => reject(Error('Se canceló la lectura de la imagen.'));
    reader.readAsDataURL(file);
  });
  const image = new Image();
  image.src = source;
  try {
    await image.decode();
  } catch {
    throw Error('No se pudo abrir la imagen. Prueba con otro archivo JPG, PNG o WebP.');
  }
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const context = canvas.getContext('2d');
  if (!context) throw Error('No se pudo preparar la imagen.');
  const size = Math.min(image.naturalWidth, image.naturalHeight);
  context.drawImage(
    image,
    (image.naturalWidth - size) / 2,
    (image.naturalHeight - size) / 2,
    size,
    size,
    0,
    0,
    256,
    256,
  );
  return canvas.toDataURL('image/png');
}

export function profileInitials(username: string) {
  return (username.match(/[A-Z]/g)?.slice(0, 2).join('') || username.slice(0, 2)).toUpperCase();
}
