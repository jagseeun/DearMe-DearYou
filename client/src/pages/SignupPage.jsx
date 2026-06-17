import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import PasswordField from '../components/PasswordField.jsx';
import NoticeModal from '../components/NoticeModal.jsx';
import { useAuth } from '../auth.jsx';
import { ALLOWED_EMAIL_MESSAGE, isAllowedEmail } from '../utils/email.js';

const ease = [0.16, 1, 0.3, 1];
const container = { hidden: {}, show: { transition: { staggerChildren: 0.055 } } };
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.92, ease } } };
const NAME_MAX_LENGTH = 10;
const USERID_MAX_LENGTH = 20;
const PASSWORD_MAX_LENGTH = 128;

export default function SignupPage() {
  const navigate = useNavigate();
  const { status, refresh } = useAuth();
  const [name, setName] = useState('');
  const [userid, setUserid] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [email, setEmail] = useState('');
  const [idMsg, setIdMsg] = useState({ text: '', ok: false });
  const [idChecked, setIdChecked] = useState(false);
  const [notice, setNotice] = useState(null);
  const [confirmingPasswordNote, setConfirmingPasswordNote] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  useEffect(() => {
    if (status === 'authenticated') navigate('/hello', { replace: true });
  }, [status, navigate]);

  function closeNotice() {
    const afterClose = notice?.afterClose;
    setNotice(null);
    afterClose?.();
  }

  function getMissingSignupMessage() {
    if (!name.trim()) return '이름을 입력해 주세요.';
    if (!userid.trim()) return '아이디를 입력해 주세요.';
    if (!password) return '비밀번호를 입력해 주세요.';
    if (!passwordConfirm) return '비밀번호를 한 번 더 입력해 주세요.';
    if (!email.trim()) return '편지를 받을 이메일을 입력해 주세요.';
    return '';
  }

  async function checkUsername() {
    const nextUserid = userid.trim();
    if (!nextUserid) {
      setNotice({ title: '아이디 확인', message: '아이디를 입력해 주세요.' });
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
      setIdMsg({ text: '서버와 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.', ok: false });
      setIdChecked(false);
    }
  }

  async function checkEmailAvailability(nextEmail) {
    const res = await fetch('/check-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: nextEmail }),
    });
    return res.json().catch(() => ({ available: false, message: '이메일을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.' }));
  }

  async function handleRegister() {
    if (submittingRef.current || submitting) return;
    const nextName = name.trim();
    const nextUserid = userid.trim();
    const nextEmail = email.trim();
    const missingMessage = getMissingSignupMessage();
    if (missingMessage) return setNotice({ title: '아직 적지 않은 칸이 있습니다', message: missingMessage });
    if (!isAllowedEmail(nextEmail)) return setNotice({ title: '이메일 확인', message: ALLOWED_EMAIL_MESSAGE });
    if (!idChecked) return setNotice({ title: '아이디 확인', message: idMsg.text && !idMsg.ok ? idMsg.text : '아이디 중복 확인을 진행해 주세요.' });
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const emailResult = await checkEmailAvailability(nextEmail);
      if (!emailResult.available) {
        setNotice({ title: '이메일 확인', message: emailResult.message || '이미 가입된 이메일입니다.' });
        return;
      }
    } catch {
      setNotice({ title: '이메일 확인', message: '이메일을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.' });
      return;
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
    if (password.length < 6) return setNotice({ title: '비밀번호를 한 번 더 입력해 주세요', message: '비밀번호는 6자 이상으로 입력해 주세요.' });
    if (password.length > PASSWORD_MAX_LENGTH) return setNotice({ title: '비밀번호를 한 번 더 입력해 주세요', message: `비밀번호는 ${PASSWORD_MAX_LENGTH}자를 넘을 수 없습니다.` });
    if (password !== passwordConfirm) return setNotice({ title: '비밀번호를 한 번 더 입력해 주세요', message: '비밀번호가 서로 일치하지 않습니다. 다시 확인해 주세요.' });
    setConfirmingPasswordNote(true);
  }

  async function submitRegister() {
    if (submittingRef.current || submitting) return;
    setConfirmingPasswordNote(false);
    const nextName = name.trim();
    const nextUserid = userid.trim();
    const nextEmail = email.trim();
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const res = await fetch('/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nextName, userid: nextUserid, password, email: nextEmail }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        await refresh();
        navigate('/hello', { replace: true });
      } else {
        setNotice({ title: '가입하지 못했습니다', message: data.message || '가입 정보를 다시 확인해 주세요.' });
      }
    } catch {
      setNotice({ title: '연결을 확인해 주세요', message: '서버와 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.' });
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <motion.div
      className="page-center signup-page"
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

      <motion.p variants={item} className="home-subtitle">마음을 기록하고, 약속한 날에 다시 전하는 편지</motion.p>

      <motion.form
        className="form-container"
        variants={container}
        noValidate
        onSubmit={e => { e.preventDefault(); handleRegister(); }}
      >
        <motion.div variants={item} className="field-with-hint">
          <input
            className="input-field"
            type="text"
            placeholder="이름을 입력해 주세요 (최대 10자)"
            maxLength={NAME_MAX_LENGTH}
            value={name}
            onChange={e => setName(e.target.value)}
          />
          <span className={`field-limit-hint ${name.length >= NAME_MAX_LENGTH * 0.8 ? 'is-near-limit' : ''} ${name.length >= NAME_MAX_LENGTH ? 'is-limit' : ''}`}>
            이름 {name.length}/{NAME_MAX_LENGTH}
          </span>
        </motion.div>

        <motion.div variants={item} className="field-with-hint">
          <div className="input-group">
            <input
              className="input-field"
              type="text"
              placeholder="아이디를 입력해 주세요 (영어, 숫자 / 최대 20자)"
              maxLength={USERID_MAX_LENGTH}
              value={userid}
              onChange={e => {
                setUserid(e.target.value);
                setIdChecked(false);
                setIdMsg({ text: '', ok: false });
              }}
            />
            <button type="button" className="check-btn" onClick={checkUsername}>중복 확인</button>
          </div>
          <span className={`field-limit-hint ${userid.length >= USERID_MAX_LENGTH * 0.8 ? 'is-near-limit' : ''} ${userid.length >= USERID_MAX_LENGTH ? 'is-limit' : ''}`}>
            아이디 {userid.length}/{USERID_MAX_LENGTH}
          </span>
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
          placeholder="비밀번호를 입력해 주세요 (6자 이상)"
          maxLength={PASSWORD_MAX_LENGTH}
          value={password}
          onChange={e => setPassword(e.target.value)}
        />

        <PasswordField
          variants={item}
          placeholder="비밀번호를 한 번 더 입력해 주세요"
          maxLength={PASSWORD_MAX_LENGTH}
          value={passwordConfirm}
          onChange={e => setPasswordConfirm(e.target.value)}
        />

        <motion.input
          variants={item}
          className="input-field"
          type="email"
          placeholder="편지를 받을 이메일"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />

        <motion.button variants={item} className="submit-btn" type="submit" disabled={submitting}>
          {submitting ? '가입 중...' : '가입하기'}
        </motion.button>
      </motion.form>

      <motion.button variants={item} className="back-link" onClick={() => navigate('/')}>
        ← 처음으로
      </motion.button>

      <NoticeModal
        open={Boolean(notice)}
        title={notice?.title}
        message={notice?.message}
        onClose={closeNotice}
      />
      <NoticeModal
        open={confirmingPasswordNote}
        title="비밀번호를 확인해 주세요"
        message="비밀번호는 편지함을 다시 열 때 꼭 필요합니다. 잊지 않도록 안전한 곳에 기억해 두셨나요?"
        cancelLabel="다시 확인하기"
        confirmLabel="가입하기"
        onClose={() => setConfirmingPasswordNote(false)}
        onConfirm={submitRegister}
      />
    </motion.div>
  );
}
