import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

const AuthContext = createContext(null);

function AuthLoading() {
  return <div className="auth-route-loading" aria-live="polite" />;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('checking');

  const refresh = useCallback(async () => {
    setStatus('checking');
    try {
      const res = await fetch('/get-user-info', { cache: 'no-store' });
      if (res.status === 401) {
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
      setUser(null);
      setStatus('guest');
      return null;
    }
  }, []);

  useEffect(() => {
    refresh();
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

  if (status === 'checking') return <AuthLoading />;
  if (status !== 'authenticated') {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }
  if (requireAdmin && !user?.isAdmin) return <Navigate to="/" replace />;
  if (requireDeveloper && !user?.isDeveloper) return <Navigate to="/" replace />;

  return children;
}
