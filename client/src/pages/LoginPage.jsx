import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import PasswordField from '../components/PasswordField.jsx';

const ease = [0.22, 1, 0.36, 1];
const container = { hidden: {}, show: { transition: { staggerChildren: 0.16 } } };
const item = { hidden: { opacity: 0, y: 28 }, show: { opacity: 1, y: 0, transition: { duration: 1.05, ease } } };
const PASSWORD_MAX_LENGTH = 128;

export default function LoginPage() {
  const navigate = useNavigate();
  const [userid, setUserid] = useState('');
  const [password, setPassword] = useState('');

  async function handleLogin() {
    const nextUserid = userid.trim();
    if (!nextUserid || !password) return alert('아이디와 비밀번호를 입력해주세요.');
    try {
      const res = await fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userid: nextUserid, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) navigate('/hello');
      else alert(data.message || '로그인에 실패했습니다.');
    } catch {
      alert('서버 연결에 실패했습니다. 잠시 후 다시 시도해주세요.');
    }
  }

  return (
    <motion.div
      className="page-center"
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

      <motion.p variants={item} className="home-subtitle">나와 너에게 남기는 편지</motion.p>

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
    </motion.div>
  );
}
