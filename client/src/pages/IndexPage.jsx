import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../auth.jsx';

const ease = [0.22, 1, 0.36, 1];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.2 } },
};
const item = {
  hidden: { opacity: 0, y: 40 },
  show: { opacity: 1, y: 0, transition: { duration: 1.2, ease } },
};

export default function IndexPage() {
  const navigate = useNavigate();
  const { status } = useAuth();

  function openLetterBox() {
    if (status === 'authenticated') {
      navigate('/letters');
      return;
    }
    navigate('/letter-login', { state: { from: '/letters' } });
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
        <button className="glass-btn" onClick={() => navigate('/login')}>로그인</button>
        <button className="glass-btn" onClick={() => navigate('/signup')}>회원가입</button>
        <button
          className="glass-btn"
          onClick={openLetterBox}
          style={{ borderColor: 'rgba(246,177,177,0.4)', color: 'rgba(255,220,210,0.85)' }}
        >
          편지 읽기
        </button>
      </motion.div>

      <motion.button
        type="button"
        className="open-mailbox-floating-button"
        aria-label="열린 편지함"
        title="열린 편지함"
        onClick={() => navigate('/open-mailbox')}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1, duration: 0.5, ease }}
      >
        💌
      </motion.button>
    </motion.div>
  );
}
