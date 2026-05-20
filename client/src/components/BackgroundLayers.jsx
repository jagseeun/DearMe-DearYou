import { useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import Stars from './Stars.jsx';
import PinkStars from './PinkStars.jsx';

const PINK_ROUTES = ['/letters', '/view-letter', '/pink-letters', '/letter-login'];
const ease = [0.22, 1, 0.36, 1];

const DARK_GRADIENT = `linear-gradient(to bottom,
  #111214 0%, #181823 18%, #202b2b 38%, #3d3a48 58%,
  #6f5f55 78%, #c4a374 100%)`;

const PINK_GRADIENT = `
  radial-gradient(circle at 18% 16%, rgba(210, 143, 166, 0.24) 0%, rgba(210, 143, 166, 0) 31%),
  radial-gradient(circle at 82% 24%, rgba(128, 86, 134, 0.28) 0%, rgba(128, 86, 134, 0) 34%),
  radial-gradient(circle at 52% 84%, rgba(182, 101, 116, 0.2) 0%, rgba(182, 101, 116, 0) 40%),
  linear-gradient(180deg, #1d1424 0%, #35223a 34%, #5b344e 66%, #8e5862 100%)`;

const layerStyle = {
  position: 'fixed',
  inset: 0,
  zIndex: 0,
  pointerEvents: 'none',
};

export default function BackgroundLayers() {
  const location = useLocation();
  const isPink = PINK_ROUTES.some(route => location.pathname.startsWith(route));

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
    </>
  );
}
