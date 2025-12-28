export function getImageSize(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const width = img.naturalWidth;
      const height = img.naturalHeight;
      URL.revokeObjectURL(url);
      resolve({ width, height });
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    img.src = url;
  });
}

export async function validateImage(file, options = {}) {
  const { maxMB = 5, minWidth = 600, minHeight = 600, maxWidth = 3000, maxHeight = 3000 } = options;
  if (!file) throw new Error('No file selected');
  if (!file.type.startsWith('image/')) throw new Error('Only image files are allowed');
  const sizeMB = file.size / (1024 * 1024);
  if (sizeMB > maxMB) throw new Error(`Image is too large (${sizeMB.toFixed(2)}MB). Max ${maxMB}MB.`);
  const { width, height } = await getImageSize(file);
  if (width < minWidth || height < minHeight) {
    throw new Error(`Image is too small (${width}x${height}). Min ${minWidth}x${minHeight}.`);
  }
  if (width > maxWidth || height > maxHeight) {
    throw new Error(`Image is too large (${width}x${height}). Max ${maxWidth}x${maxHeight}.`);
  }
  return { width, height };
}
