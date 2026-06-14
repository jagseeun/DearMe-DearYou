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
const ACTION_CLICK_SELECTOR = [
  'button',
  'a[href]',
  '[role="button"]',
  '[role="link"]',
  'input[type="button"]',
  'input[type="submit"]',
  'input[type="reset"]',
  '.letter-card.is-open',
  '.open-letter-card:not(.placeholder)',
].join(',');

function isActionTarget(target) {
  return target instanceof Element && Boolean(target.closest(ACTION_CLICK_SELECTOR));
}

function stopInteraction(event) {
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation?.();
}

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
  const lockedUntilRef = useRef(0);
  const submitGraceUntilRef = useRef(0);
  const timerRef = useRef(null);
  const [blocking, setBlocking] = useState(false);

  function lockFor(duration) {
    const until = performance.now() + duration;
    lockedUntilRef.current = Math.max(lockedUntilRef.current, until);
    setBlocking(true);

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const remaining = lockedUntilRef.current - performance.now();
      if (remaining > 8) {
        lockFor(remaining);
        return;
      }
      setBlocking(false);
    }, duration);
  }

  function isLocked() {
    return performance.now() < lockedUntilRef.current;
  }

  useEffect(() => {
    if (firstRenderRef.current) {
      firstRenderRef.current = false;
      return undefined;
    }

    lockFor(980);
    return undefined;
  }, [location.pathname, location.search]);

  useEffect(() => {
    const handleClick = event => {
      if (!isActionTarget(event.target)) return;
      if (isLocked()) {
        stopInteraction(event);
        return;
      }
      if (event.target instanceof Element && event.target.closest('button[type="submit"], input[type="submit"]')) {
        submitGraceUntilRef.current = performance.now() + 120;
      }
      lockFor(820);
    };

    const handleSubmit = event => {
      if (performance.now() < submitGraceUntilRef.current) {
        submitGraceUntilRef.current = 0;
        lockFor(1200);
        return;
      }
      if (isLocked()) {
        stopInteraction(event);
        return;
      }
      lockFor(1200);
    };

    const handleKeyDown = event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      if (!isActionTarget(event.target)) return;
      if (isLocked()) {
        stopInteraction(event);
        return;
      }
      lockFor(820);
    };

    document.addEventListener('click', handleClick, true);
    document.addEventListener('submit', handleSubmit, true);
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('click', handleClick, true);
      document.removeEventListener('submit', handleSubmit, true);
      document.removeEventListener('keydown', handleKeyDown, true);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

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
