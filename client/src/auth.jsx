import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

const AuthContext = createContext(null);
const LETTER_AUTH_STORAGE_KEY = 'dearme.letterAuthUser';
let rememberedLetterAuthUser = '';

export function clearLetterAuth() {
  rememberedLetterAuthUser = '';
  try {
    sessionStorage.removeItem(LETTER_AUTH_STORAGE_KEY);
  } catch {
    // Ignore storage errors in restricted browser contexts.
  }
}

export function rememberLetterAuth(user) {
  const userid = user?.userid || '';
  rememberedLetterAuthUser = userid;
  try {
    if (userid) sessionStorage.setItem(LETTER_AUTH_STORAGE_KEY, userid);
  } catch {
    // Ignore storage errors in restricted browser contexts.
  }
}

function hasRememberedLetterAuth(user) {
  if (user?.userid && rememberedLetterAuthUser === user.userid) return true;
  try {
    return Boolean(user?.userid) && sessionStorage.getItem(LETTER_AUTH_STORAGE_KEY) === user.userid;
  } catch {
    return false;
  }
}

const loadingFrameStyle = {
  position: 'fixed',
  inset: 0,
  zIndex: 20,
  display: 'grid',
  placeItems: 'center',
  minHeight: '100dvh',
  pointerEvents: 'none',
};

const loadingMarkBaseStyle = {
  padding: '12px 20px',
  borderRadius: 999,
  fontSize: 'clamp(18px, 4.8vw, 28px)',
  fontWeight: 300,
  letterSpacing: 0,
  lineHeight: 1,
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
};

function AuthLoading({ pink = false }) {
  const markStyle = pink
    ? {
        ...loadingMarkBaseStyle,
        color: 'rgba(255, 228, 236, 0.86)',
        border: '1px solid rgba(255, 216, 230, 0.18)',
        background: 'rgba(42, 26, 45, 0.2)',
        boxShadow: '0 18px 52px rgba(46, 25, 52, 0.18)',
      }
    : {
        ...loadingMarkBaseStyle,
        color: 'rgba(255, 240, 214, 0.84)',
        border: '1px solid rgba(255, 240, 214, 0.16)',
        background: 'rgba(16, 17, 20, 0.2)',
        boxShadow: '0 18px 52px rgba(0, 0, 0, 0.16)',
      };

  return (
    <div
      className={`auth-route-loading ${pink ? 'auth-route-loading-pink' : 'auth-route-loading-dark'}`}
      aria-live="polite"
      style={loadingFrameStyle}
    >
      <span className="auth-route-loading-mark" aria-hidden="true" style={markStyle}>Dear Me ; Dear You</span>
    </div>
  );
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('checking');

  const refresh = useCallback(async () => {
    setStatus('checking');
    try {
      const res = await fetch('/get-user-info', { cache: 'no-store' });
      if (res.status === 401) {
        clearLetterAuth();
        setUser(null);
        setStatus('guest');
        return null;
      }
      if (!res.ok) throw new Error('auth check failed');
      const data = await res.json();
      setUser(data);
      setStatus('authenticated');
      return data;
    } catch {
      clearLetterAuth();
      setUser(null);
      setStatus('guest');
      return null;
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    function handlePageShow() {
      refresh();
    }

    window.addEventListener('pageshow', handlePageShow);
    return () => window.removeEventListener('pageshow', handlePageShow);
  }, [refresh]);

  const value = useMemo(() => ({ user, status, refresh }), [user, status, refresh]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}

export function ProtectedRoute({ children, requireAdmin = false, requireDeveloper = false }) {
  const { status, user } = useAuth();
  const location = useLocation();
  const letterPath = ['/letters', '/pink-letters', '/view-letter'].some(path => location.pathname.startsWith(path));
  const from = `${location.pathname}${location.search}`;

  if (status === 'checking') return <AuthLoading pink={letterPath} />;
  if (status !== 'authenticated') {
    return <Navigate to={letterPath ? '/letter-login' : '/login'} replace state={{ from }} />;
  }
  if (letterPath && !hasRememberedLetterAuth(user)) {
    return <Navigate to="/letter-login" replace state={{ from, forceLogin: true }} />;
  }
  if (requireAdmin && !user?.isAdmin) return <Navigate to="/" replace />;
  if (requireDeveloper && !user?.isDeveloper) return <Navigate to="/" replace />;

  return children;
}
