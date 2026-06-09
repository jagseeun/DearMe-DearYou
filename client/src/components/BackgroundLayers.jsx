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
