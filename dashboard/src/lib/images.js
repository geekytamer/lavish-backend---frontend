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

function ratioLabel(aspect) {
  if (Math.abs(aspect - 1) < 0.02) return '1:1 (square)';
  if (Math.abs(aspect - 16 / 9) < 0.02) return '16:9 (wide)';
  if (Math.abs(aspect - 9 / 16) < 0.02) return '9:16 (portrait)';
  if (Math.abs(aspect - 3) < 0.02) return '3:1 (ultra-wide)';
  if (Math.abs(aspect - 3 / 4) < 0.02) return '3:4 (portrait)';
  if (Math.abs(aspect - 4 / 5) < 0.02) return '4:5 (portrait)';
  return `${aspect.toFixed(2)}:1`;
}

// Per-purpose upload specifications. `hint` is shown to the admin in the UI so
// they know the requirement up front; the same object is passed to validateImage
// so what we tell them and what we enforce never drift apart.
export const IMAGE_SPECS = {
  logo: {
    label: 'Logo',
    aspect: 1,
    aspectTolerance: 0.1,
    maxMB: 5,
    minWidth: 400,
    minHeight: 400,
    maxWidth: 3000,
    maxHeight: 3000,
    hint: 'Square (1:1), e.g. 800×800. JPG/PNG/WebP, up to 5MB.',
  },
  cover: {
    label: 'Header image',
    aspect: 3, // 3:1 ultra-wide
    aspectTolerance: 0.12,
    maxMB: 5,
    minWidth: 1200,
    minHeight: 360,
    maxWidth: 4500,
    maxHeight: 1600,
    hint: 'Ultra-wide 3:1, e.g. 1500×500. JPG/PNG/WebP, up to 5MB.',
  },
  banner: {
    label: 'Ad banner',
    aspect: 16 / 9,
    aspectTolerance: 0.12,
    maxMB: 5,
    minWidth: 1200,
    minHeight: 600,
    maxWidth: 4000,
    maxHeight: 2400,
    hint: 'Wide 16:9, e.g. 1600×900. JPG/PNG/WebP, up to 5MB.',
  },
  category: {
    label: 'Category image',
    aspect: 3 / 4,
    aspectTolerance: 0.15,
    maxMB: 5,
    minWidth: 600,
    minHeight: 800,
    maxWidth: 3000,
    maxHeight: 4000,
    hint: 'Portrait 3:4, e.g. 900×1200. JPG/PNG/WebP, up to 5MB.',
  },
  product: {
    label: 'Product image',
    aspect: 9 / 16, // Reel-style vertical, matches the app's tall product cards
    aspectTolerance: 0.12,
    maxMB: 5,
    minWidth: 600,
    minHeight: 1000,
    maxWidth: 2400,
    maxHeight: 4200,
    hint: 'Portrait 9:16 (like an Instagram Reel), e.g. 1080×1920. JPG/PNG/WebP, up to 5MB.',
  },
};

export async function validateImage(file, options = {}) {
  const {
    maxMB = 5,
    minWidth = 600,
    minHeight = 600,
    maxWidth = 5000,
    maxHeight = 5000,
    aspect = null,
    aspectTolerance = 0.1,
    label = 'Image',
  } = options;

  if (!file) throw new Error('No file selected');

  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowed.includes(file.type)) {
    throw new Error('Only JPG, PNG, or WebP images are allowed');
  }

  const sizeMB = file.size / (1024 * 1024);
  if (sizeMB > maxMB) throw new Error(`${label} is too large (${sizeMB.toFixed(2)}MB). Max ${maxMB}MB.`);

  const { width, height } = await getImageSize(file);
  if (width < minWidth || height < minHeight) {
    throw new Error(`${label} is too small (${width}×${height}). Minimum ${minWidth}×${minHeight}.`);
  }
  if (width > maxWidth || height > maxHeight) {
    throw new Error(`${label} is too large (${width}×${height}). Maximum ${maxWidth}×${maxHeight}.`);
  }

  if (aspect) {
    const ratio = width / height;
    const diff = Math.abs(ratio - aspect) / aspect;
    if (diff > aspectTolerance) {
      throw new Error(
        `${label} must be roughly ${ratioLabel(aspect)}. You uploaded ${width}×${height} (${ratio.toFixed(2)}:1).`,
      );
    }
  }

  return { width, height };
}
