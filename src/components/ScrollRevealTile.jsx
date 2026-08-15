import { useEffect, useRef, useState } from "react";

// Fades a grid tile in the first time it scrolls into view, rather than
// having the whole grid appear at once -- shared by the Index images grid
// and the Fragments grid (both style tiles via .image-tile in index.css).
// One-shot per tile: once visible, the observer disconnects, so it won't
// re-fade on scrolling back up.
export default function ScrollRevealTile({ className = "", onClick, children }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.05 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <button
      type="button"
      ref={ref}
      className={`${className}${visible ? " is-visible" : ""}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
