import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { clearLetterAuth, useAuth } from '../auth.jsx';

const ease = [0.16, 1, 0.3, 1];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};
const item = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.98, ease } },
};

export default function IndexPage() {
  const navigate = useNavigate();
  const { status } = useAuth();

  useEffect(() => {
    clearLetterAuth();
  }, []);

  function openLetterBox() {
    navigate('/letter-login', { state: { from: '/letters', forceLogin: true } });
  }

  function openLogin() {
    navigate(status === 'authenticated' ? '/hello' : '/login');
  }

  function openSignup() {
    navigate(status === 'authenticated' ? '/hello' : '/signup');
  }

  return (
    <motion.div
      className="page-center home-page"
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
        마음을 기록하고 전하는 편지
      </motion.p>

      <motion.div
        variants={item}
        className="home-actions"
      >
        <button className="glass-btn" onClick={openLogin}>로그인</button>
        <button className="glass-btn" onClick={openSignup}>회원가입</button>
        <button
          className="glass-btn"
          onClick={openLetterBox}
        >
          편지 읽기
        </button>
        {status === 'authenticated' && (
          <motion.p variants={item} className="home-session-note">
            공용 기기 보호를 위해 편지함은 다시 로그인한 뒤 열립니다.
          </motion.p>
        )}
      </motion.div>

      <motion.button
        type="button"
        className="open-mailbox-floating-button"
        aria-label="열린 편지함"
        title="열린 편지함"
        onClick={() => navigate('/open-mailbox')}
        initial={false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1, duration: 0.5, ease }}
      >
        💌
      </motion.button>
    </motion.div>
  );
}
