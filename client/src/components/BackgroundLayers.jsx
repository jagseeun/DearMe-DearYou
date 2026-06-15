import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import Stars from './Stars.jsx';
import PinkStars from './PinkStars.jsx';

export const PINK_ROUTES = ['/letter-login', '/letters', '/view-letter', '/pink-letters'];

const DARK_GRADIENT = `
  radial-gradient(circle at 18% 18%, rgba(211, 169, 116, 0.16) 0%, rgba(211, 169, 116, 0) 30%),
  radial-gradient(circle at 78% 28%, rgba(126, 148, 176, 0.14) 0%, rgba(126, 148, 176, 0) 36%),
  radial-gradient(circle at 54% 92%, rgba(196, 163, 116, 0.18) 0%, rgba(196, 163, 116, 0) 42%),
  linear-gradient(to bottom, #101114 0%, #171820 22%, #20292a 42%, #3a3647 64%, #7b655f 84%, #c4a374 100%)`;

const PINK_GRADIENT = `
  radial-gradient(circle at 18% 16%, rgba(226, 158, 186, 0.24) 0%, rgba(226, 158, 186, 0) 31%),
  radial-gradient(circle at 82% 24%, rgba(156, 112, 166, 0.22) 0%, rgba(156, 112, 166, 0) 34%),
  radial-gradient(circle at 50% 84%, rgba(202, 120, 136, 0.18) 0%, rgba(202, 120, 136, 0) 42%),
  linear-gradient(180deg, #201629 0%, #3c2946 42%, #74465f 72%, #a76c76 100%)`;

const layerStyle = {
  position: 'fixed',
  inset: 0,
  zIndex: 0,
  pointerEvents: 'none',
  transition: 'opacity 980ms cubic-bezier(0.22, 1, 0.36, 1)',
  willChange: 'opacity',
};

export default function BackgroundLayers() {
  const location = useLocation();
  const isPink = PINK_ROUTES.some(route => location.pathname.startsWith(route));
  const emphasizePinkStars = ['/letters', '/view-letter', '/pink-letters'].some(route => location.pathname.startsWith(route));
  const hasDreamCursor = !location.pathname.startsWith('/admin');
  const cursorGlowRef = useRef(null);
  const cursorHeartRef = useRef(null);

  useEffect(() => {
    document.body.classList.remove('dream-cursor-active');
    document.body.classList.toggle('pink-cursor-active', hasDreamCursor && isPink);
    document.body.classList.toggle('dark-cursor-active', hasDreamCursor && !isPink);

    if (!hasDreamCursor) {
      return () => {
        document.body.classList.remove('dream-cursor-active', 'dream-cursor-drawing', 'pink-cursor-active', 'dark-cursor-active');
      };
    }

    let frame = 0;
    let latestPointer = null;
    let active = false;
    let drawing = false;
    let lastX = -9999;
    let lastY = -9999;

    const applyGlow = () => {
      frame = 0;
      if (!latestPointer) return;
      const x = latestPointer.clientX;
      const y = latestPointer.clientY;
      const moved = Math.abs(x - lastX) > 0.75 || Math.abs(y - lastY) > 0.75;

      if (moved) {
        lastX = x;
        lastY = y;
        if (cursorGlowRef.current) {
          cursorGlowRef.current.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
        }
        if (cursorHeartRef.current) {
          cursorHeartRef.current.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-38%, -42%)`;
        }
      }

      if (!active) {
        active = true;
        document.body.classList.add('dream-cursor-active');
      }

      const nextDrawing = Boolean(latestPointer.target?.closest?.('.draw-canvas, .open-draw-canvas'));
      if (nextDrawing !== drawing) {
        drawing = nextDrawing;
        document.body.classList.toggle('dream-cursor-drawing', drawing);
      }
    };

    const moveGlow = event => {
      latestPointer = { clientX: event.clientX, clientY: event.clientY, target: event.target };
      if (!frame) frame = requestAnimationFrame(applyGlow);
    };

    window.addEventListener('pointermove', moveGlow, { passive: true });
    return () => {
      window.removeEventListener('pointermove', moveGlow);
      if (frame) cancelAnimationFrame(frame);
      document.body.classList.remove('dream-cursor-active', 'dream-cursor-drawing', 'pink-cursor-active', 'dark-cursor-active');
    };
  }, [hasDreamCursor, isPink]);

  return (
    <>
      <div
        style={{ ...layerStyle, background: DARK_GRADIENT, opacity: isPink ? 0 : 1 }}
      />
      <div
        style={{ ...layerStyle, background: PINK_GRADIENT, opacity: isPink ? 1 : 0 }}
      />
      <div
        style={{ ...layerStyle, opacity: isPink ? 0 : 1 }}
      >
        {!isPink && <Stars />}
      </div>
      <div
        style={{ ...layerStyle, opacity: isPink ? 1 : 0 }}
      >
        {isPink && <PinkStars emphasized={emphasizePinkStars} />}
      </div>
      <div
        ref={cursorGlowRef}
        className={`dream-cursor-glow ${isPink ? 'dream-cursor-glow-pink' : 'dream-cursor-glow-dark'}`}
        style={{ opacity: hasDreamCursor ? 1 : 0, transition: 'opacity 420ms cubic-bezier(0.22, 1, 0.36, 1)' }}
      />
      <div
        ref={cursorHeartRef}
        className={`dream-cursor-heart ${isPink ? 'dream-cursor-heart-pink' : 'dream-cursor-heart-dark'}`}
        style={{ opacity: hasDreamCursor ? 1 : 0, transition: 'opacity 320ms cubic-bezier(0.22, 1, 0.36, 1)' }}
      >
        <svg className="cursor-heart cursor-heart-main" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 21.2 10.55 19.9C5.4 15.25 2 12.18 2 8.4 2 5.32 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.08A5.9 5.9 0 0 1 16.5 3C19.58 3 22 5.32 22 8.4c0 3.78-3.4 6.85-8.55 11.5L12 21.2Z" />
        </svg>
        <svg className="cursor-heart cursor-heart-small" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 21.2 10.55 19.9C5.4 15.25 2 12.18 2 8.4 2 5.32 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.08A5.9 5.9 0 0 1 16.5 3C19.58 3 22 5.32 22 8.4c0 3.78-3.4 6.85-8.55 11.5L12 21.2Z" />
        </svg>
      </div>
    </>
  );
}
