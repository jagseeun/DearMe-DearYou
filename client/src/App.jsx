import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import BackgroundLayers, { PINK_ROUTES } from './components/BackgroundLayers.jsx';
import { AuthProvider, ProtectedRoute } from './auth.jsx';
import IndexPage from './pages/IndexPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import SignupPage from './pages/SignupPage.jsx';
import HelloPage from './pages/HelloPage.jsx';
import WritePage from './pages/WritePage.jsx';
import DonePage from './pages/DonePage.jsx';
import LettersPage from './pages/LettersPage.jsx';
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
        <Route path="/open-mailbox" element={<OpenMailboxPage />} />
        <Route path="/letter-login" element={<Navigate to="/login" replace />} />
        <Route path="/hello" element={<ProtectedRoute><HelloPage /></ProtectedRoute>} />
        <Route path="/write" element={<ProtectedRoute><WritePage /></ProtectedRoute>} />
        <Route path="/done" element={<ProtectedRoute><DonePage /></ProtectedRoute>} />
        <Route path="/letters" element={<ProtectedRoute><LettersPage /></ProtectedRoute>} />
        <Route path="/pink-letters" element={<ProtectedRoute><PinkLetterViewPage /></ProtectedRoute>} />
        <Route path="/view-letter" element={<ProtectedRoute><LetterViewPage /></ProtectedRoute>} />
        <Route path="/support" element={<ProtectedRoute><SupportPage /></ProtectedRoute>} />
        <Route path="/develop" element={<ProtectedRoute requireDeveloper><DevelopPage /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute requireAdmin><AdminPage /></ProtectedRoute>} />
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
      <AuthProvider>
        <FaviconSwitcher />
        <BackgroundLayers />
        <AnimatedRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
