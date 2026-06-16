import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import PasswordField from '../components/PasswordField.jsx';
import NoticeModal from '../components/NoticeModal.jsx';
import { clearLetterAuth, rememberLetterAuth, useAuth } from '../auth.jsx';

const ease = [0.16, 1, 0.3, 1];
const container = { hidden: {}, show: { transition: { staggerChildren: 0.055 } } };
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.92, ease } } };
const PASSWORD_MAX_LENGTH = 128;

export default function LoginPage({ letterMode = false }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { refresh, status } = useAuth();
  const [userid, setUserid] = useState('');
  const [password, setPassword] = useState('');
  const [notice, setNotice] = useState(null);
  const [preparingForcedLogin, setPreparingForcedLogin] = useState(false);
  const isLetterMode = letterMode || location.pathname === '/letter-login';
  const forceLogin = Boolean(location.state?.forceLogin);
  const returnTo = typeof location.state?.from === 'string'
    ? location.state.from
    : isLetterMode ? '/letters' : '/hello';

  useEffect(() => {
    if (status !== 'authenticated') return;
    if (isLetterMode) {
      if (!forceLogin) navigate(returnTo, { replace: true });
      return;
    }
    navigate('/hello', { replace: true });
  }, [status, isLetterMode, forceLogin, navigate, returnTo]);

  useEffect(() => {
    if (!isLetterMode || !forceLogin) return;
    let cancelled = false;
    setPreparingForcedLogin(true);
    clearLetterAuth();
    fetch('/logout', { cache: 'no-store' })
      .catch(() => {})
      .finally(async () => {
        if (cancelled) return;
        await refresh();
        if (!cancelled) setPreparingForcedLogin(false);
      });
    return () => { cancelled = true; };
  }, [isLetterMode, forceLogin, refresh]);

  async function handleLogin() {
    if (preparingForcedLogin) return;
    const nextUserid = userid.trim();
    if (!nextUserid || !password) {
      setNotice({
        title: isLetterMode ? '편지함 로그인' : '로그인 확인',
        message: '아이디와 비밀번호를 입력해 주세요.',
      });
      return;
    }
    try {
      const res = await fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userid: nextUserid, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const currentUser = await refresh();
        if (isLetterMode) rememberLetterAuth(currentUser);
        navigate(returnTo, { replace: true });
      }
      else setNotice({
        title: isLetterMode ? '편지함에 들어가지 못했습니다' : '로그인 실패',
        message: data.message || '아이디와 비밀번호를 다시 확인해 주세요.',
      });
    } catch {
      setNotice({ title: '연결을 확인해 주세요', message: '서버와 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.' });
    }
  }

  return (
    <motion.div
      className={`page-center ${isLetterMode ? 'pink-login-page letter-login-page' : 'auth-page'}`}
      initial="hidden"
      animate="show"
      exit={{ opacity: 0, transition: { duration: 0.3 } }}
      variants={container}
    >
      <motion.h1 className="main-title" variants={item}>
        <span className="to">Dear Me</span>
        <span className="semicolon">;</span>
        <span className="from">Dear You</span>
      </motion.h1>

      <motion.p variants={item} className="home-subtitle">
        {isLetterMode ? '도착한 편지를 다시 확인하는 로그인입니다' : '마음을 기록하고, 약속한 날에 다시 전하는 편지'}
      </motion.p>

      <motion.form
        className="form-container"
        variants={container}
        onSubmit={e => { e.preventDefault(); handleLogin(); }}
      >
        <motion.input
          variants={item}
          className="input-field"
          type="text"
          placeholder="아이디를 입력해 주세요"
          maxLength={20}
          value={userid}
          onChange={e => setUserid(e.target.value)}
        />
        <PasswordField
          variants={item}
          wrapperClassName={isLetterMode ? 'password-field password-field-pink' : 'password-field'}
          className={isLetterMode ? 'input-field pink-password-input' : 'input-field'}
          placeholder="비밀번호를 입력해 주세요"
          maxLength={PASSWORD_MAX_LENGTH}
          value={password}
          onChange={e => setPassword(e.target.value)}
        />
        <motion.button variants={item} className="submit-btn" type="submit" disabled={preparingForcedLogin}>
          {preparingForcedLogin ? '준비 중...' : isLetterMode ? '편지함 로그인' : '로그인'}
        </motion.button>
      </motion.form>

      <motion.button variants={item} className="back-link" onClick={() => navigate('/')}>
        ← 처음으로
      </motion.button>

      <NoticeModal
        open={Boolean(notice)}
        title={notice?.title}
        message={notice?.message}
        onClose={() => setNotice(null)}
      />
    </motion.div>
  );
}
