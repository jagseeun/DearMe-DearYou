import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import BackgroundLayers, { PINK_ROUTES } from './components/BackgroundLayers.jsx';
import { AuthProvider, ProtectedRoute } from './auth.jsx';
import IndexPage from './pages/IndexPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import SignupPage from './pages/SignupPage.jsx';
import HelloPage from './pages/HelloPage.jsx';
import MyPage from './pages/MyPage.jsx';
import WritePage from './pages/WritePage.jsx';
import DonePage from './pages/DonePage.jsx';
import LettersPage from './pages/LettersPage.jsx';
import PinkLetterViewPage from './pages/PinkLetterViewPage.jsx';
import LetterViewPage from './pages/LetterViewPage.jsx';
import AdminPage from './pages/AdminPage.jsx';
import OpenMailboxPage from './pages/OpenMailboxPage.jsx';
import SupportPage from './pages/SupportPage.jsx';
import DevelopPage from './pages/DevelopPage.jsx';

const LOGO_HOME_SELECTOR = '.top-title, .main-title';

function AnimatedRoutes() {
  return (
    <Routes>
      <Route path="/" element={<IndexPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/open-mailbox" element={<OpenMailboxPage />} />
      <Route path="/letter-login" element={<LoginPage letterMode />} />
      <Route path="/hello" element={<ProtectedRoute><HelloPage /></ProtectedRoute>} />
      <Route path="/mypage" element={<ProtectedRoute><MyPage /></ProtectedRoute>} />
      <Route path="/write" element={<ProtectedRoute><WritePage /></ProtectedRoute>} />
      <Route path="/done" element={<ProtectedRoute><DonePage /></ProtectedRoute>} />
      <Route path="/letters" element={<ProtectedRoute><LettersPage /></ProtectedRoute>} />
      <Route path="/pink-letters" element={<ProtectedRoute><PinkLetterViewPage /></ProtectedRoute>} />
      <Route path="/view-letter" element={<ProtectedRoute><LetterViewPage /></ProtectedRoute>} />
      <Route path="/support" element={<SupportPage />} />
      <Route path="/develop" element={<ProtectedRoute requireDeveloper><DevelopPage /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute requireAdmin><AdminPage /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function LogoHomeNavigator() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const markLogos = () => {
      document.querySelectorAll(LOGO_HOME_SELECTOR).forEach(logo => {
        logo.classList.add('logo-home-link');
        logo.setAttribute('role', 'button');
        logo.setAttribute('tabindex', '0');
        logo.setAttribute('aria-label', '홈으로 이동');
      });
    };

    markLogos();
    const frame = requestAnimationFrame(markLogos);
    return () => cancelAnimationFrame(frame);
  }, [location.pathname]);

  useEffect(() => {
    const findLogo = target => target instanceof Element ? target.closest(LOGO_HOME_SELECTOR) : null;

    const handleClick = event => {
      if (!findLogo(event.target)) return;
      event.preventDefault();
      navigate('/hello');
    };

    const handleKeyDown = event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      if (!findLogo(event.target)) return;
      event.preventDefault();
      navigate('/hello');
    };

    document.addEventListener('click', handleClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [navigate]);

  return null;
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

function MotionReadyMarker() {
  useLayoutEffect(() => {
    document.documentElement.classList.add('motion-ready');
    return () => document.documentElement.classList.remove('motion-ready');
  }, []);

  return null;
}

function RouteClickGuard() {
  const location = useLocation();
  const firstRenderRef = useRef(true);
  const [blocking, setBlocking] = useState(false);

  useEffect(() => {
    if (firstRenderRef.current) {
      firstRenderRef.current = false;
      return undefined;
    }

    setBlocking(true);
    const timer = setTimeout(() => setBlocking(false), 620);
    return () => clearTimeout(timer);
  }, [location.pathname, location.search]);

  if (!blocking) return null;
  return <div className="route-click-guard" aria-hidden="true" />;
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <MotionReadyMarker />
        <RouteClickGuard />
        <FaviconSwitcher />
        <LogoHomeNavigator />
        <BackgroundLayers />
        <AnimatedRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
