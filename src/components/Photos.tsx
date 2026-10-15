import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ImagePlus, X } from "lucide-react";
import type { BookingPhoto } from "../types";
import { api } from "../api/client";

const MAX_PHOTOS = 6;

/** Loads short-lived links for private photos; previews only, until tapped. */
function usePhotoUrls(paths: string[]) {
  const key = paths.join("|");
  const [urls, setUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!paths.length) return;
    let alive = true;
    api
      .photoUrls(paths)
      .then((u) => alive && setUrls(u))
      .catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return urls;
}

/* ---------- form: add / remove ---------- */

interface PhotoPickerProps {
  existing: BookingPhoto[];
  added: File[];
  onAdd: (files: File[]) => void;
  onRemoveExisting: (photo: BookingPhoto) => void;
  onRemoveAdded: (index: number) => void;
}

export function PhotoPicker({ existing, added, onAdd, onRemoveExisting, onRemoveAdded }: PhotoPickerProps) {
  const input = useRef<HTMLInputElement>(null);
  const urls = usePhotoUrls(existing.map((p) => p.thumbPath));
  const previews = useMemo(() => added.map((f) => URL.createObjectURL(f)), [added]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);
  const room = MAX_PHOTOS - existing.length - added.length;

  return (
    <div className="photo-grid">
      {existing.map((p) => (
        <div key={p.id} className="photo-tile">
          {urls[p.thumbPath] ? <img src={urls[p.thumbPath]} alt="" /> : <span className="photo-loading" />}
          <button type="button" className="photo-remove" onClick={() => onRemoveExisting(p)} aria-label="Remove photo">
            <X size={14} strokeWidth={2.4} />
          </button>
        </div>
      ))}
      {previews.map((src, i) => (
        <div key={src} className="photo-tile is-new">
          <img src={src} alt="" />
          <button type="button" className="photo-remove" onClick={() => onRemoveAdded(i)} aria-label="Remove photo">
            <X size={14} strokeWidth={2.4} />
          </button>
        </div>
      ))}
      {room > 0 && (
        <button type="button" className="photo-add" onClick={() => input.current?.click()}>
          <ImagePlus size={22} strokeWidth={1.6} />
          <span>Add</span>
        </button>
      )}
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith("image/")).slice(0, room);
          if (files.length) onAdd(files);
          e.target.value = "";
        }}
      />
    </div>
  );
}

/* ---------- booking card: small previews, tap to view ---------- */

export function PhotoStrip({ photos }: { photos: BookingPhoto[] }) {
  const urls = usePhotoUrls(photos.map((p) => p.thumbPath));
  const [open, setOpen] = useState<number | null>(null);
  if (!photos.length) return null;
  return (
    <>
      <div className="photo-strip" onClick={(e) => e.stopPropagation()}>
        {photos.map((p, i) => (
          <button key={p.id} className="photo-thumb" onClick={() => setOpen(i)} aria-label={`Open photo ${i + 1}`}>
            {urls[p.thumbPath] ? <img src={urls[p.thumbPath]} alt="" loading="lazy" /> : <span className="photo-loading" />}
          </button>
        ))}
      </div>
      {open !== null && <PhotoViewer photos={photos} start={open} onClose={() => setOpen(null)} />}
    </>
  );
}

function PhotoViewer({ photos, start, onClose }: { photos: BookingPhoto[]; start: number; onClose: () => void }) {
  const [index, setIndex] = useState(start);
  const urls = usePhotoUrls(photos.map((p) => p.path));
  const current = photos[index];
  const touch = useRef<number | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setIndex((i) => Math.min(i + 1, photos.length - 1));
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(i - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [photos.length, onClose]);

  return createPortal(
    <div
      className="photo-viewer"
      role="dialog"
      aria-label="Reference photo"
      onClick={onClose}
      onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touch.current === null) return;
        const dx = e.changedTouches[0].clientX - touch.current;
        touch.current = null;
        if (Math.abs(dx) > 50) setIndex((i) => Math.max(0, Math.min(photos.length - 1, i + (dx < 0 ? 1 : -1))));
      }}
    >
      {urls[current.path] ? (
        <img key={current.id} src={urls[current.path]} alt="" onClick={(e) => e.stopPropagation()} />
      ) : (
        <span className="photo-loading big" />
      )}
      <button className="photo-viewer-close" onClick={onClose} aria-label="Close">
        <X size={22} strokeWidth={2} />
      </button>
      {photos.length > 1 && (
        <p className="photo-viewer-count">
          {index + 1} of {photos.length}
        </p>
      )}
    </div>,
    document.body
  );
}
