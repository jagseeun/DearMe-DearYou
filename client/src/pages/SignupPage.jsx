import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

const ease = [0.22, 1, 0.36, 1];
const container = { hidden: {}, show: { transition: { staggerChildren: 0.14 } } };
const item = { hidden: { opacity: 0, y: 28 }, show: { opacity: 1, y: 0, transition: { duration: 1.05, ease } } };

export default function SignupPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [userid, setUserid] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [idMsg, setIdMsg] = useState({ text: '', ok: false });
  const [idChecked, setIdChecked] = useState(false);

  async function checkUsername() {
    if (!userid) return alert('아이디를 입력해주세요.');
    try {
      const res = await fetch('/check-username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userid }),
      });
      const data = await res.json();
      setIdMsg({ text: data.message || '', ok: Boolean(data.available) });
      setIdChecked(Boolean(data.available));
    } catch {
      setIdMsg({ text: '서버 연결에 실패했습니다.', ok: false });
      setIdChecked(false);
    }
  }

  async function handleRegister() {
    if (!name || !userid || !password) return alert('모든 정보를 입력해주세요.');
    if (!idChecked) return alert('아이디 중복 확인을 해주세요.');
    const res = await fetch('/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, userid, password, email }),
    });
    const data = await res.json();
    if (res.ok) {
      alert('회원가입이 완료되었습니다.');
      navigate('/login');
    } else {
      alert(data.message || '회원가입에 실패했습니다.');
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

      <motion.p variants={item} className="home-subtitle">미래의 나에게 편지를 남깁니다</motion.p>

      <motion.form
        className="form-container"
        variants={container}
        onSubmit={e => { e.preventDefault(); handleRegister(); }}
      >
        <motion.input
          variants={item}
          className="input-field"
          type="text"
          placeholder="이름 (최대 10자)"
          maxLength={10}
          value={name}
          onChange={e => setName(e.target.value)}
        />

        <motion.div variants={item} className="input-group">
          <input
            className="input-field"
            type="text"
            placeholder="아이디 (영어, 숫자 / 최대 20자)"
            maxLength={20}
            value={userid}
            onChange={e => {
              setUserid(e.target.value);
              setIdChecked(false);
              setIdMsg({ text: '', ok: false });
            }}
          />
          <button type="button" className="check-btn" onClick={checkUsername}>중복확인</button>
        </motion.div>

        {idMsg.text && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              paddingLeft: 20,
              fontSize: 13,
              color: idMsg.ok ? '#81c784' : '#ff8a80',
              marginTop: -10,
            }}
          >
            {idMsg.text}
          </motion.p>
        )}

        <motion.input
          variants={item}
          className="input-field"
          type="password"
          placeholder="비밀번호 (최대 20자)"
          maxLength={20}
          value={password}
          onChange={e => setPassword(e.target.value)}
        />

        <motion.input
          variants={item}
          className="input-field"
          type="email"
          placeholder="이메일 (개봉일에 편지 발송용)"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />

        <motion.button variants={item} className="submit-btn" type="submit">
          회원가입
        </motion.button>
      </motion.form>

      <motion.button variants={item} className="back-link" onClick={() => navigate('/')}>
        ← 돌아가기
      </motion.button>
    </motion.div>
  );
}
