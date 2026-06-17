import { useEffect, useLayoutEffect, useRef } from 'react';
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
const LOGO_HOME_HIT_SELECTOR = '.logo-home-hit';
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
    const isHome = location.pathname === '/';
    const markLogos = () => {
      document.querySelectorAll(LOGO_HOME_SELECTOR).forEach(logo => {
        logo.classList.toggle('logo-home-link', !isHome);
        logo.removeAttribute('role');
        logo.removeAttribute('tabindex');
        logo.removeAttribute('aria-label');
        logo.querySelectorAll('span').forEach(part => {
          if (isHome) {
            part.classList.remove('logo-home-hit');
            part.removeAttribute('role');
            part.removeAttribute('tabindex');
            part.removeAttribute('aria-label');
            return;
          }
          part.classList.add('logo-home-hit');
          part.setAttribute('role', 'button');
          part.setAttribute('tabindex', '0');
          part.setAttribute('aria-label', '홈으로 이동');
        });
      });
    };

    markLogos();
    const frame = requestAnimationFrame(markLogos);
    return () => cancelAnimationFrame(frame);
  }, [location.pathname]);

  useEffect(() => {
    const findLogo = target => {
      if (!(target instanceof Element)) return null;
      const hit = target.closest(LOGO_HOME_HIT_SELECTOR);
      return hit?.closest(LOGO_HOME_SELECTOR) || null;
    };

    const handleClick = event => {
      if (!findLogo(event.target)) return;
      if (location.pathname === '/') return;
      event.preventDefault();
      navigate('/');
    };

    const handleKeyDown = event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      if (!findLogo(event.target)) return;
      if (location.pathname === '/') return;
      event.preventDefault();
      navigate('/');
    };

    document.addEventListener('click', handleClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [location.pathname, navigate]);

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
  const lastActionRef = useRef({ element: null, at: 0 });
  const lastSubmitAtRef = useRef(0);

  function isDuplicateAction(element, interval = 1400) {
    const now = performance.now();
    const last = lastActionRef.current;
    if (last.element === element && now - last.at < interval) return true;
    lastActionRef.current = { element, at: now };
    return false;
  }

  useEffect(() => {
    lastActionRef.current = { element: null, at: 0 };
    lastSubmitAtRef.current = 0;
    return undefined;
  }, [location.pathname, location.search]);

  useEffect(() => {
    const handleClick = event => {
      const action = event.target instanceof Element ? event.target.closest(ACTION_CLICK_SELECTOR) : null;
      if (!action) return;
      if (isDuplicateAction(action)) stopInteraction(event);
    };

    const handleSubmit = event => {
      const now = performance.now();
      if (now - lastSubmitAtRef.current < 2200) {
        stopInteraction(event);
        return;
      }
      lastSubmitAtRef.current = now;
    };

    const handleKeyDown = event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const action = event.target instanceof Element ? event.target.closest(ACTION_CLICK_SELECTOR) : null;
      if (!action) return;
      if (isDuplicateAction(action)) stopInteraction(event);
    };

    document.addEventListener('click', handleClick, true);
    document.addEventListener('submit', handleSubmit, true);
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('click', handleClick, true);
      document.removeEventListener('submit', handleSubmit, true);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, []);

  return null;
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
