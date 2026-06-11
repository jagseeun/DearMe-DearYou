import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import PasswordField from '../components/PasswordField.jsx';
import NoticeModal from '../components/NoticeModal.jsx';

const ease = [0.22, 1, 0.36, 1];
const container = { hidden: {}, show: { transition: { staggerChildren: 0.14 } } };
const item = { hidden: { opacity: 0, y: 28 }, show: { opacity: 1, y: 0, transition: { duration: 1.05, ease } } };
const PASSWORD_MAX_LENGTH = 128;

export default function SignupPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [userid, setUserid] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [email, setEmail] = useState('');
  const [idMsg, setIdMsg] = useState({ text: '', ok: false });
  const [idChecked, setIdChecked] = useState(false);
  const [notice, setNotice] = useState(null);
  const [confirmingPasswordNote, setConfirmingPasswordNote] = useState(false);

  function closeNotice() {
    const afterClose = notice?.afterClose;
    setNotice(null);
    afterClose?.();
  }

  async function checkUsername() {
    const nextUserid = userid.trim();
    if (!nextUserid) {
      setNotice({ title: '아이디 확인', message: '아이디를 입력해주세요.' });
      return;
    }
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
    if (!nextName || !nextUserid || !password || !passwordConfirm || !nextEmail) return setNotice({ title: '회원가입 확인', message: '모든 정보를 입력해주세요.' });
    if (!idChecked) return setNotice({ title: '아이디 확인', message: '아이디 중복 확인을 해주세요.' });
    if (password.length < 6) return setNotice({ title: '비밀번호 확인', message: '비밀번호는 6자 이상으로 입력해주세요.' });
    if (password.length > PASSWORD_MAX_LENGTH) return setNotice({ title: '비밀번호 확인', message: `비밀번호는 ${PASSWORD_MAX_LENGTH}자를 넘을 수 없습니다.` });
    if (password !== passwordConfirm) return setNotice({ title: '비밀번호 확인', message: '비밀번호가 서로 일치하지 않습니다. 다시 확인해주세요.' });
    setConfirmingPasswordNote(true);
  }

  async function submitRegister() {
    setConfirmingPasswordNote(false);
    const nextName = name.trim();
    const nextUserid = userid.trim();
    const nextEmail = email.trim();
    try {
      const res = await fetch('/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nextName, userid: nextUserid, password, email: nextEmail }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setNotice({
          title: '회원가입 완료',
          message: '회원가입이 완료되었습니다.',
          afterClose: () => navigate('/login'),
        });
      } else {
        setNotice({ title: '회원가입 실패', message: data.message || '회원가입에 실패했습니다.' });
      }
    } catch {
      setNotice({ title: '연결 실패', message: '서버 연결에 실패했습니다.' });
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

      <motion.p variants={item} className="home-subtitle">오늘의 마음을 나와 친구에게 전하는 편지</motion.p>

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

        <PasswordField
          variants={item}
          placeholder="비밀번호 한 번 더 입력"
          maxLength={PASSWORD_MAX_LENGTH}
          value={passwordConfirm}
          onChange={e => setPasswordConfirm(e.target.value)}
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

      <NoticeModal
        open={Boolean(notice)}
        title={notice?.title}
        message={notice?.message}
        onClose={closeNotice}
      />
      <NoticeModal
        open={confirmingPasswordNote}
        title="비밀번호 확인"
        message="비밀번호는 로그인에 꼭 필요합니다. 잊지 않도록 안전한 곳에 기록해두셨나요?"
        cancelLabel="돌아가기"
        confirmLabel="가입하기"
        onClose={() => setConfirmingPasswordNote(false)}
        onConfirm={submitRegister}
      />
    </motion.div>
  );
}
