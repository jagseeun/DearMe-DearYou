import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import Stars from './Stars.jsx';
import PinkStars from './PinkStars.jsx';

export const PINK_ROUTES = ['/letters', '/view-letter', '/pink-letters', '/letter-login'];
const ease = [0.22, 1, 0.36, 1];

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
};

export default function BackgroundLayers() {
  const location = useLocation();
  const isPink = PINK_ROUTES.some(route => location.pathname.startsWith(route));
  const hasDreamCursor = !location.pathname.startsWith('/admin');

  useEffect(() => {
    document.body.classList.remove('dream-cursor-active');
    document.body.classList.toggle('pink-cursor-active', hasDreamCursor && isPink);
    document.body.classList.toggle('dark-cursor-active', hasDreamCursor && !isPink);

    if (!hasDreamCursor) {
      return () => {
        document.body.classList.remove('dream-cursor-active', 'dream-cursor-drawing', 'pink-cursor-active', 'dark-cursor-active');
      };
    }

    const moveGlow = event => {
      document.documentElement.style.setProperty('--dream-cursor-x', `${event.clientX}px`);
      document.documentElement.style.setProperty('--dream-cursor-y', `${event.clientY}px`);
      document.body.classList.add('dream-cursor-active');
      document.body.classList.toggle(
        'dream-cursor-drawing',
        Boolean(event.target?.closest?.('.draw-canvas, .open-draw-canvas'))
      );
    };

    window.addEventListener('pointermove', moveGlow, { passive: true });
    return () => {
      window.removeEventListener('pointermove', moveGlow);
      document.body.classList.remove('dream-cursor-active', 'dream-cursor-drawing', 'pink-cursor-active', 'dark-cursor-active');
    };
  }, [hasDreamCursor, isPink]);

  return (
    <>
      <motion.div
        animate={{ opacity: isPink ? 0 : 1 }}
        transition={{ duration: 1.6, ease }}
        style={{ ...layerStyle, background: DARK_GRADIENT }}
      />
      <motion.div
        animate={{ opacity: isPink ? 1 : 0 }}
        transition={{ duration: 1.6, ease }}
        style={{ ...layerStyle, background: PINK_GRADIENT }}
      />
      <motion.div
        animate={{ opacity: isPink ? 0 : 1 }}
        transition={{ duration: 1.2, ease }}
        style={layerStyle}
      >
        <Stars />
      </motion.div>
      <motion.div
        animate={{ opacity: isPink ? 1 : 0 }}
        transition={{ duration: 1.2, ease }}
        style={layerStyle}
      >
        <PinkStars />
      </motion.div>
      <motion.div
        className={`dream-cursor-glow ${isPink ? 'dream-cursor-glow-pink' : 'dream-cursor-glow-dark'}`}
        animate={{ opacity: hasDreamCursor ? 1 : 0 }}
        transition={{ duration: 0.5, ease }}
        style={layerStyle}
      />
      <motion.div
        className={`dream-cursor-heart ${isPink ? 'dream-cursor-heart-pink' : 'dream-cursor-heart-dark'}`}
        animate={{ opacity: hasDreamCursor ? 1 : 0 }}
        transition={{ duration: 0.35, ease }}
      >
        <span className="cursor-heart cursor-heart-main" />
        <span className="cursor-heart cursor-heart-small" />
      </motion.div>
    </>
  );
}
