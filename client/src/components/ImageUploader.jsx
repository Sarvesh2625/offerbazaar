import { useState, useRef } from 'react';
import { Upload, X, Loader2 } from 'lucide-react';

/**
 * Cloudinary image uploader component
 * @param {Object} props
 * @param {string[]} props.images - Array of Cloudinary URLs
 * @param {function} props.onChange - Callback with updated array of URLs
 * @param {number} [props.max=3] - Maximum allowed images
 * @param {string} [props.label='Images']
 */
export default function ImageUploader({
  images = [],
  onChange,
  max = 3,
  label = 'Images',
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    if (images.length + files.length > max) {
      setUploadError(
        `You can only upload up to ${max} ${label.toLowerCase()}.`
      );
      return;
    }

    setUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      files.forEach((file) => {
        formData.append('images', file);
      });

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Image upload failed');
      }

      const updated = [...images, ...(data.urls || [])];
      onChange(updated);
    } catch (err) {
      setUploadError(err.message || 'Failed to upload images');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemove = (indexToRemove) => {
    const updated = images.filter((_, idx) => idx !== indexToRemove);
    onChange(updated);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs">
        <label className="font-semibold text-slate-300">
          {label} ({images.length}/{max})
        </label>
        {uploadError && <span className="text-rose-400">{uploadError}</span>}
      </div>

      {/* Preview Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {images.map((url, idx) => (
          <div
            key={idx}
            className="relative group rounded-xl overflow-hidden border border-slate-800 bg-slate-950 aspect-video flex items-center justify-center shadow-md"
          >
            <img
              src={url}
              alt={`${label} ${idx + 1}`}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
            />
            <button
              type="button"
              onClick={() => handleRemove(idx)}
              className="absolute top-1.5 right-1.5 p-1 rounded-full bg-slate-950/80 text-slate-300 hover:text-white hover:bg-rose-600 transition-colors shadow-sm cursor-pointer"
              title="Remove image"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}

        {/* Upload Trigger Button */}
        {images.length < max && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="rounded-xl border-2 border-dashed border-slate-800 hover:border-indigo-500/50 bg-slate-950/40 hover:bg-slate-900/40 aspect-video flex flex-col items-center justify-center gap-1.5 text-slate-400 hover:text-indigo-300 transition-all cursor-pointer disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
            ) : (
              <Upload className="w-5 h-5" />
            )}
            <span className="text-[11px] font-medium">
              {uploading ? 'Uploading...' : 'Upload Image'}
            </span>
          </button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}
