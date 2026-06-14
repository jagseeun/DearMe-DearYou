import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import PasswordField from '../components/PasswordField.jsx';
import NoticeModal from '../components/NoticeModal.jsx';
import { useAuth } from '../auth.jsx';

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
  const isLetterMode = letterMode || location.pathname === '/letter-login';
  const returnTo = typeof location.state?.from === 'string'
    ? location.state.from
    : isLetterMode ? '/letters' : '/hello';

  useEffect(() => {
    if (status === 'authenticated' && isLetterMode) {
      navigate(returnTo, { replace: true });
    }
  }, [status, isLetterMode, navigate, returnTo]);

  async function handleLogin() {
    const nextUserid = userid.trim();
    if (!nextUserid || !password) {
      setNotice({ title: '로그인 확인', message: '아이디와 비밀번호를 입력해 주세요.' });
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
        await refresh();
        navigate(returnTo, { replace: true });
      }
      else setNotice({ title: '로그인 실패', message: data.message || '로그인에 실패했습니다.' });
    } catch {
      setNotice({ title: '연결 실패', message: '서버 연결에 실패했습니다. 잠시 후 다시 시도해 주세요.' });
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
        {isLetterMode ? '도착한 편지를 확인하는 공간입니다' : '소중한 마음을 기록하고 전하는 편지'}
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
          placeholder="아이디를 입력하세요"
          maxLength={20}
          value={userid}
          onChange={e => setUserid(e.target.value)}
        />
        <PasswordField
          variants={item}
          wrapperClassName={isLetterMode ? 'password-field password-field-pink' : 'password-field'}
          className={isLetterMode ? 'input-field pink-password-input' : 'input-field'}
          placeholder="비밀번호를 입력하세요"
          maxLength={PASSWORD_MAX_LENGTH}
          value={password}
          onChange={e => setPassword(e.target.value)}
        />
        <motion.button variants={item} className="submit-btn" type="submit">
          로그인
        </motion.button>
      </motion.form>

      <motion.button variants={item} className="back-link" onClick={() => navigate('/')}>
        ← 돌아가기
      </motion.button>

      <motion.button
        type="button"
        className="open-mailbox-floating-button"
        aria-label="열린 편지함"
        title="열린 편지함"
        onClick={() => navigate('/open-mailbox')}
        initial={false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9, duration: 0.45, ease }}
      >
        💌
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
