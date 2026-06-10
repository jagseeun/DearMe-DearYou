import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import BackgroundLayers, { PINK_ROUTES } from './components/BackgroundLayers.jsx';
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
import OpenMailboxPage from './pages/OpenMailboxPage.jsx';
import SupportPage from './pages/SupportPage.jsx';
import DevelopPage from './pages/DevelopPage.jsx';

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
        <Route path="/open-mailbox" element={<OpenMailboxPage />} />
        <Route path="/support" element={<SupportPage />} />
        <Route path="/develop" element={<DevelopPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  );
}

function FaviconSwitcher() {
  const location = useLocation();

  useEffect(() => {
    const isPink = PINK_ROUTES.some(route => location.pathname.startsWith(route));
    const href = isPink ? '/pink.png' : '/blue.png';
    let favicon = document.querySelector('#app-favicon') || document.querySelector('link[rel="icon"]');

    if (!favicon) {
      favicon = document.createElement('link');
      favicon.id = 'app-favicon';
      favicon.rel = 'icon';
      document.head.appendChild(favicon);
    }

    favicon.type = 'image/png';
    favicon.href = href;
  }, [location.pathname]);

  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <FaviconSwitcher />
      <BackgroundLayers />
      <AnimatedRoutes />
    </BrowserRouter>
  );
}
