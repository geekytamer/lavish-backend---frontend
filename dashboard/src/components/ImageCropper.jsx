import { useCallback, useState } from 'react';
import Cropper from 'react-easy-crop';
import { getCroppedFile } from '../lib/images.js';
import { Modal } from './Modal.jsx';

/**
 * Reusable image cropper. Returns:
 *   cropFile(file, { aspect, cropShape, label }) -> Promise<File>  (rejects on cancel)
 *   cropperModal  -> render this in your component tree
 *
 * The crop is constrained to `aspect`; `cropShape` 'round' shows a circular mask
 * (for logos/avatars). The resolved File already matches the target aspect, so
 * no separate aspect validation is needed afterwards.
 */
export function useImageCropper() {
  const [job, setJob] = useState(null); // { src, aspect, cropShape, label, fileName, resolve, reject }
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [areaPixels, setAreaPixels] = useState(null);
  const [busy, setBusy] = useState(false);

  const cropFile = useCallback(
    (file, { aspect = 1, cropShape = 'rect', label = 'Image' } = {}) =>
      new Promise((resolve, reject) => {
        if (!file || !file.type?.startsWith('image/')) {
          reject(new Error('Only image files are allowed'));
          return;
        }
        setCrop({ x: 0, y: 0 });
        setZoom(1);
        setAreaPixels(null);
        setJob({ src: URL.createObjectURL(file), aspect, cropShape, label, fileName: file.name || 'image.jpg', resolve, reject });
      }),
    [],
  );

  const finish = (result, error) => {
    if (job) {
      URL.revokeObjectURL(job.src);
      if (error) job.reject(error);
      else job.resolve(result);
    }
    setJob(null);
    setBusy(false);
  };

  const confirm = async () => {
    if (!job || !areaPixels) return;
    setBusy(true);
    try {
      const cropped = await getCroppedFile(job.src, areaPixels, job.fileName);
      finish(cropped);
    } catch (e) {
      finish(null, e);
    }
  };

  const cropperModal = job ? (
    <Modal
      open
      title={`Crop ${job.label.toLowerCase()}`}
      onClose={() => finish(null, new Error('cancelled'))}
      footer={
        <>
          <button className="btn ghost" onClick={() => finish(null, new Error('cancelled'))}>
            Cancel
          </button>
          <button className="btn primary" onClick={confirm} disabled={busy || !areaPixels}>
            {busy ? 'Cropping…' : 'Use image'}
          </button>
        </>
      }
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: 320,
          background: '#0f172a',
          borderRadius: 12,
          overflow: 'hidden',
        }}
      >
        <Cropper
          image={job.src}
          crop={crop}
          zoom={zoom}
          aspect={job.aspect}
          cropShape={job.cropShape}
          showGrid={job.cropShape !== 'round'}
          restrictPosition
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={(_area, pixels) => setAreaPixels(pixels)}
        />
      </div>
      <label className="label" style={{ marginTop: 12 }}>
        Zoom
        <input
          type="range"
          min={1}
          max={4}
          step={0.01}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
        />
      </label>
      <p className="muted xs">Drag to reposition · scroll or use the slider to zoom.</p>
    </Modal>
  ) : null;

  return { cropFile, cropperModal };
}
