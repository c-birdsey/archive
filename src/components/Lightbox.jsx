import { useEffect } from "react";

// Fullscreen viewer for an entry's own images. `index` is the open image's
// position in `images`, or null when closed.
export default function Lightbox({ images, index, onClose, onNavigate }) {
  const open = index != null;

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight" && images.length > 1) {
        onNavigate((index + 1) % images.length);
      } else if (e.key === "ArrowLeft" && images.length > 1) {
        onNavigate((index - 1 + images.length) % images.length);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, index, images.length, onClose, onNavigate]);

  if (!open) return null;

  return (
    <div className="lightbox" onClick={onClose}>
      <button type="button" className="lightbox-close" onClick={onClose} aria-label="Close">
        &times;
      </button>

      {images.length > 1 && (
        <>
          <button
            type="button"
            className="lightbox-arrow lightbox-prev"
            onClick={(e) => {
              e.stopPropagation();
              onNavigate((index - 1 + images.length) % images.length);
            }}
            aria-label="Previous image"
          >
            &larr;
          </button>
          <button
            type="button"
            className="lightbox-arrow lightbox-next"
            onClick={(e) => {
              e.stopPropagation();
              onNavigate((index + 1) % images.length);
            }}
            aria-label="Next image"
          >
            &rarr;
          </button>
        </>
      )}

      <img src={images[index].url} alt="" />
    </div>
  );
}
