import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import PinkStars from '../components/PinkStars.jsx';

const ease = [0.22, 1, 0.36, 1];
const container = { hidden: {}, show: { transition: { staggerChildren: 0.16 } } };
const item = { hidden: { opacity: 0, y: 28 }, show: { opacity: 1, y: 0, transition: { duration: 1.05, ease } } };

export default function PinkLoginPage() {
  const navigate = useNavigate();
  const [userid, setUserid] = useState('');
  const [password, setPassword] = useState('');

  async function handleLogin() {
    if (!userid || !password) return alert('아이디와 비밀번호를 입력해주세요.');
    try {
      const res = await fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userid, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) navigate('/pink-letters');
      else alert(data.message || '로그인에 실패했습니다.');
    } catch {
      alert('서버 연결에 실패했습니다. 잠시 후 다시 시도해주세요.');
    }
  }

  return (
    <div className="pink-login-page">
      <PinkStars />

      <motion.div
        initial="hidden"
        animate="show"
        exit={{ opacity: 0, transition: { duration: 0.3 } }}
        variants={container}
        style={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 30,
          padding: '80px 20px 36px',
        }}
      >
        <motion.h1 variants={item} style={{ position: 'relative', zIndex: 2, fontSize: 'clamp(42px, 8vw, 80px)', fontWeight: 300, textAlign: 'center', lineHeight: 1.08, margin: 0, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'baseline' }}>
          <span style={{ color: '#fff1e8', filter: 'drop-shadow(0 0 18px rgba(218,157,176,0.34)) drop-shadow(0 2px 8px rgba(24,13,28,0.42))' }}>Dear Me</span>
          <span style={{ color: 'rgba(241,205,213,0.62)', margin: '0 15px' }}>;</span>
          <span style={{ color: '#e0a4b0', filter: 'drop-shadow(0 0 14px rgba(160,93,122,0.32)) drop-shadow(0 2px 8px rgba(24,13,28,0.38))' }}>Dear You</span>
        </motion.h1>

        <motion.form
          variants={container}
          onSubmit={e => { e.preventDefault(); handleLogin(); }}
          style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', gap: 14, width: '100%', maxWidth: 440 }}
        >
          <motion.input
            variants={item}
            type="text"
            placeholder="아이디를 입력하세요"
            maxLength={20}
            value={userid}
            onChange={e => setUserid(e.target.value)}
            style={inputStyle}
          />
          <motion.input
            variants={item}
            type="password"
            placeholder="비밀번호를 입력하세요"
            maxLength={20}
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            style={inputStyle}
          />
          <motion.button variants={item} type="submit" style={btnStyle}>
            편지 읽기
          </motion.button>
        </motion.form>

        <motion.button
          variants={item}
          onClick={() => navigate('/')}
          style={{
            position: 'fixed',
            bottom: 28,
            left: 32,
            zIndex: 2,
            padding: '10px 22px',
            borderRadius: 8,
            fontSize: 15,
            fontFamily: 'inherit',
            cursor: 'pointer',
            border: '1px solid rgba(102,43,44,0.25)',
            background: 'rgba(41,25,43,0.46)',
            color: 'rgba(255,239,232,0.88)',
            backdropFilter: 'blur(18px)',
            transition: 'all 0.25s',
          }}
          whileHover={{ background: 'rgba(91,52,78,0.56)', color: 'rgba(255,245,240,0.98)' }}
        >
          ← 돌아가기
        </motion.button>
      </motion.div>
    </div>
  );
}

const inputStyle = {
  padding: '18px 36px',
  fontSize: 18,
  fontFamily: 'inherit',
  background: 'rgba(36,23,39,0.52)',
  border: '1px solid rgba(232,190,202,0.26)',
  borderRadius: 8,
  color: '#fff1e8',
  textAlign: 'center',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
  transition: 'all 0.3s',
  backdropFilter: 'blur(22px) saturate(0.88)',
  boxShadow: '0 0 24px rgba(218,157,176,0.12), 0 16px 34px rgba(21,12,25,0.24), inset 0 1px 0 rgba(255,255,255,0.14)',
};

const btnStyle = {
  padding: '18px 0',
  fontSize: 20,
  fontFamily: 'inherit',
  background: 'linear-gradient(135deg, rgba(138,74,104,0.82), rgba(72,42,76,0.82)), rgba(232,190,202,0.1)',
  border: '1px solid rgba(244,211,218,0.38)',
  borderRadius: 8,
  color: '#fff1e8',
  cursor: 'pointer',
  marginTop: 8,
  width: '100%',
  transition: 'all 0.3s',
  backdropFilter: 'blur(30px) saturate(0.82)',
  boxShadow: '0 0 28px rgba(218,157,176,0.2), 0 18px 38px rgba(21,12,25,0.32), inset 0 1px 0 rgba(255,255,255,0.18)',
  textShadow: '0 1px 7px rgba(24,13,28,0.42)',
};
