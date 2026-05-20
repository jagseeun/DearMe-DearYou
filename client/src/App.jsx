import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Stars from './components/Stars.jsx';
import PinkStars from './components/PinkStars.jsx';
import IndexPage from './pages/IndexPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import SignupPage from './pages/SignupPage.jsx';
import HelloPage from './pages/HelloPage.jsx';
import WritePage from './pages/WritePage.jsx';
import DonePage from './pages/DonePage.jsx';
import LettersPage from './pages/LettersPage.jsx';
import PinkLoginPage from './pages/PinkLoginPage.jsx';
import PinkLetterViewPage from './pages/PinkLetterViewPage.jsx';
import LetterViewPage from './pages/LetterViewPage.jsx';
import AdminPage from './pages/AdminPage.jsx';

const PINK_ROUTES = ['/letters', '/view-letter', '/pink-letters', '/letter-login'];

const DARK_GRADIENT = `linear-gradient(to bottom,
  #111214 0%, #181823 18%, #202b2b 38%, #3d3a48 58%,
  #6f5f55 78%, #c4a374 100%)`;

const PINK_GRADIENT = `
  radial-gradient(circle at 18% 16%, rgba(210, 143, 166, 0.24) 0%, rgba(210, 143, 166, 0) 31%),
  radial-gradient(circle at 82% 24%, rgba(128, 86, 134, 0.28) 0%, rgba(128, 86, 134, 0) 34%),
  radial-gradient(circle at 52% 84%, rgba(182, 101, 116, 0.2) 0%, rgba(182, 101, 116, 0) 40%),
  linear-gradient(180deg, #1d1424 0%, #35223a 34%, #5b344e 66%, #8e5862 100%)`;

// 두 배경 레이어를 겹쳐서 opacity 교차 페이드
function BackgroundLayers() {
  const location = useLocation();
  const isPink = PINK_ROUTES.some(r => location.pathname.startsWith(r));
  const ease = [0.22, 1, 0.36, 1];

  return (
    <>
      {/* 다크 레이어 */}
      <motion.div
        animate={{ opacity: isPink ? 0 : 1 }}
        transition={{ duration: 1.6, ease }}
        style={{
          position: 'fixed', inset: 0, zIndex: 0,
          background: DARK_GRADIENT,
          pointerEvents: 'none',
        }}
      />
      {/* 핑크 레이어 */}
      <motion.div
        animate={{ opacity: isPink ? 1 : 0 }}
        transition={{ duration: 1.6, ease }}
        style={{
          position: 'fixed', inset: 0, zIndex: 0,
          background: PINK_GRADIENT,
          pointerEvents: 'none',
        }}
      />
      {/* 별: 다크 */}
      <motion.div
        animate={{ opacity: isPink ? 0 : 1 }}
        transition={{ duration: 1.2, ease }}
        style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}
      >
        <Stars />
      </motion.div>
      {/* 별: 핑크 */}
      <motion.div
        animate={{ opacity: isPink ? 1 : 0 }}
        transition={{ duration: 1.2, ease }}
        style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}
      >
        <PinkStars />
      </motion.div>
    </>
  );
}

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="sync">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<IndexPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/hello" element={<HelloPage />} />
        <Route path="/write" element={<WritePage />} />
        <Route path="/done" element={<DonePage />} />
        <Route path="/letters" element={<LettersPage />} />
        <Route path="/letter-login" element={<PinkLoginPage />} />
        <Route path="/pink-letters" element={<PinkLetterViewPage />} />
        <Route path="/view-letter" element={<LetterViewPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <BackgroundLayers />
      <AnimatedRoutes />
    </BrowserRouter>
  );
}
