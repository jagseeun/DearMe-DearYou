import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import BackgroundLayers from './components/BackgroundLayers.jsx';
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
