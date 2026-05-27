import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import PasswordField from '../components/PasswordField.jsx';

const ease = [0.22, 1, 0.36, 1];
const container = { hidden: {}, show: { transition: { staggerChildren: 0.14 } } };
const item = { hidden: { opacity: 0, y: 28 }, show: { opacity: 1, y: 0, transition: { duration: 1.05, ease } } };
const PASSWORD_MAX_LENGTH = 128;

export default function SignupPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [userid, setUserid] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [idMsg, setIdMsg] = useState({ text: '', ok: false });
  const [idChecked, setIdChecked] = useState(false);

  async function checkUsername() {
    const nextUserid = userid.trim();
    if (!nextUserid) return alert('아이디를 입력해주세요.');
    try {
      const res = await fetch('/check-username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userid: nextUserid }),
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
    const nextName = name.trim();
    const nextUserid = userid.trim();
    const nextEmail = email.trim();
    if (!nextName || !nextUserid || !password || !nextEmail) return alert('모든 정보를 입력해주세요.');
    if (!idChecked) return alert('아이디 중복 확인을 해주세요.');
    if (password.length < 6) return alert('비밀번호는 6자 이상으로 입력해주세요.');
    if (password.length > PASSWORD_MAX_LENGTH) return alert(`비밀번호는 ${PASSWORD_MAX_LENGTH}자를 넘을 수 없습니다.`);
    try {
      const res = await fetch('/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nextName, userid: nextUserid, password, email: nextEmail }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        alert('회원가입이 완료되었습니다.');
        navigate('/login');
      } else {
        alert(data.message || '회원가입에 실패했습니다.');
      }
    } catch {
      alert('서버 연결에 실패했습니다.');
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

        <PasswordField
          variants={item}
          placeholder="비밀번호 (6자 이상)"
          maxLength={PASSWORD_MAX_LENGTH}
          value={password}
          onChange={e => setPassword(e.target.value)}
        />

        <motion.input
          variants={item}
          className="input-field"
          type="email"
          placeholder="이메일"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
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
