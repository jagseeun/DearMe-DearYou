import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

const ease = [0.22, 1, 0.36, 1];
const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.25 } },
};
const item = {
  hidden: { opacity: 0, y: 40 },
  show: { opacity: 1, y: 0, transition: { duration: 1.2, ease } },
};

const questions = [
  '내년의 나에게 꼭 지키고 싶은 약속 하나는?',
  '지금의 나에게 해주고 싶은 가장 고마운 말은?',
  '지금 이 시기를 한 단어로 남긴다면?',
  '지금의 나에게 가장 필요한 문장은?',
  '미래의 나에게 해주고 싶은 말은?',
  '그동안 가장 많이 달라진 건 무엇일까?',
  '지금의 내가 응원해주고 싶은 말은?',
  '미래의 내가 과거의 나에게 남기고 싶은 말은?',
  '미래의 나는 어떻게 변하였을까?',
  '미래에 나에게 부탁하고 싶은 것은?',
];

export default function HelloPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [qIdx, setQIdx] = useState(0);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftEmail, setDraftEmail] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');

  useEffect(() => {
    fetch('/get-user-info')
      .then(r => { if (r.status === 401) { navigate('/login'); return null; } return r.json(); })
      .then(d => {
        if (!d) return;
        if (d.name) setName(d.name);
        if (d.email !== undefined) setEmail(d.email);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const t = setInterval(() => setQIdx(i => (i + 1) % questions.length), 4000);
    return () => clearInterval(t);
  }, []);

  function openProfileModal() {
    setDraftName(name || '');
    setDraftEmail(email || '');
    setProfileMsg('');
    setShowProfileModal(true);
  }

  async function handleProfileSave() {
    const nextName = draftName.trim();
    const nextEmail = draftEmail.trim();
    if (!nextName) { setProfileMsg('이름을 입력해주세요.'); return; }
    if (nextName.length > 10) { setProfileMsg('이름은 10자를 넘을 수 없습니다.'); return; }
    if (nextEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) { setProfileMsg('이메일 형식이 올바르지 않습니다.'); return; }
    setProfileSaving(true);
    setProfileMsg('');
    try {
      const res = await fetch('/update-profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nextName, email: nextEmail }),
      });
      const data = await res.json();
      if (res.ok) {
        setName(data.name || nextName);
        setEmail(data.email ?? nextEmail);
        setProfileMsg('저장되었습니다!');
        setTimeout(() => setShowProfileModal(false), 900);
      } else {
        setProfileMsg(data.message || '오류가 발생했습니다.');
      }
    } catch { setProfileMsg('서버 연결 오류'); }
    finally { setProfileSaving(false); }
  }

  return (
    <motion.div
      className="hello-shell"
      initial="hidden"
      animate="show"
      exit={{ opacity: 0, transition: { duration: 0.3 } }}
      variants={container}
    >
      {/* 상단 로고 */}
      <motion.div
        className="top-title"
        variants={{
          hidden: { opacity: 0, y: -20 },
          show: { opacity: 1, y: 0, transition: { duration: 1.4, ease } },
        }}
      >
        <span className="to">Dear Me</span>
        <span className="semicolon">;</span>
        <span className="from">Dear You</span>
      </motion.div>

      {/* 우측 상단 버튼 그룹 */}
      <motion.div
        variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { duration: 1, delay: 0.5 } } }}
        className="hello-nav"
      >
        <motion.button
          onClick={() => navigate('/letters')}
          whileHover={{ background: 'rgba(255,255,255,0.12)', color: 'rgba(255,252,223,0.9)' }}
          style={navBtnStyle}
        >
          나의 편지 ✉
        </motion.button>
        <motion.button
          onClick={openProfileModal}
          whileHover={{ background: 'rgba(255,255,255,0.12)', color: 'rgba(255,252,223,0.9)' }}
          style={navBtnStyle}
        >
          이름/이메일 변경
        </motion.button>
        <motion.button
          onClick={() => window.location.href = '/logout'}
          whileHover={{ background: 'rgba(255,80,80,0.15)', color: 'rgba(255,180,180,0.9)', borderColor: 'rgba(255,80,80,0.3)' }}
          style={navBtnStyle}
        >
          로그아웃
        </motion.button>
      </motion.div>

      {/* 본문 */}
      <div
        className="hello-content"
      >
        <motion.div
          variants={item}
          className="hello-greeting"
        >
          반가워요.{' '}
          <span style={{ color: '#E6C395' }}>{name || 'Guest'}</span>님
        </motion.div>

        {/* 질문 fade 전환 */}
        <div className="hello-question-wrap">
          <AnimatePresence mode="wait">
            <motion.div
              key={qIdx}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.65, ease }}
              className="hello-question"
            >
              {questions[qIdx]}
            </motion.div>
          </AnimatePresence>
        </div>

        <motion.div
          variants={item}
          className="hello-divider"
        />

        <motion.button
          variants={item}
          onClick={() => navigate('/write')}
          whileHover={{ translateY: -3, boxShadow: '0 8px 32px rgba(0,0,0,0.24), 0 0 20px rgba(205,154,99,0.18)' }}
          className="primary-cta"
        >
          편지 쓰기
        </motion.button>
      </div>

      {/* 이름/이메일 변경 모달 */}
      <AnimatePresence>
        {showProfileModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="modal-backdrop"
            onClick={e => { if (e.target === e.currentTarget) setShowProfileModal(false); }}
          >
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16, scale: 0.97 }}
              transition={{ duration: 0.35, ease }}
              className="modal-panel"
            >
              <div style={{ fontSize: 28, fontWeight: 400, color: '#e9dcc6' }}>이름/이메일 변경</div>
              <div style={{ color: 'rgba(255,252,223,0.4)', fontSize: 13, textAlign: 'center', lineHeight: 1.7 }}>
                여기에서 이름과 이메일을<br />편하게 바꿀 수 있어요.
              </div>
              <input
                type="text"
                placeholder="이름 (최대 10자)"
                value={draftName}
                maxLength={10}
                onChange={e => { setDraftName(e.target.value); setProfileMsg(''); }}
                onKeyDown={e => { if (e.key === 'Enter') handleProfileSave(); }}
                autoFocus
                style={modalInputStyle}
              />
              <input
                type="email"
                placeholder="이메일 주소 (선택)"
                value={draftEmail}
                onChange={e => { setDraftEmail(e.target.value); setProfileMsg(''); }}
                onKeyDown={e => { if (e.key === 'Enter') handleProfileSave(); }}
                style={modalInputStyle}
              />
              {profileMsg && (
                <div style={{ fontSize: 13, color: profileMsg === '저장되었습니다!' ? '#81c784' : 'rgba(255,130,130,0.85)', marginTop: -8 }}>
                  {profileMsg}
                </div>
              )}
              <div className="modal-actions" style={{ marginTop: 4 }}>
                <motion.button whileHover={{ background: 'rgba(255,255,255,0.12)' }}
                  onClick={() => setShowProfileModal(false)}
                  style={{ width: 150, height: 50, borderRadius: 50, fontSize: 18, fontFamily: 'inherit', cursor: 'pointer', border: '1px solid rgba(255,255,255,.2)', background: 'rgba(255,255,255,.07)', color: '#f2efe8', transition: 'all 0.25s' }}>
                  취소
                </motion.button>
                <motion.button whileHover={{ translateY: -2 }}
                  onClick={handleProfileSave} disabled={profileSaving}
                  style={{ width: 150, height: 50, borderRadius: 50, fontSize: 18, fontFamily: 'inherit', cursor: 'pointer', border: 'none', background: 'linear-gradient(135deg,#e7cfa1,#cfa874)', color: '#2b1e10', transition: 'all 0.25s', opacity: profileSaving ? 0.6 : 1 }}>
                  {profileSaving ? '저장 중...' : '저장'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

const navBtnStyle = {
  padding: '8px 16px', borderRadius: 8, fontSize: 13,
  fontFamily: 'inherit', cursor: 'pointer',
  border: '1px solid rgba(255,255,255,0.18)',
  background: 'rgba(255,255,255,0.06)',
  color: 'rgba(255,252,223,0.55)',
  backdropFilter: 'blur(8px)',
  transition: 'all 0.25s',
};

const modalInputStyle = {
  padding: '13px 14px', borderRadius: 8, width: '100%',
  border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.07)',
  color: '#fffcdf', fontSize: 16, fontFamily: 'inherit', outline: 'none',
  backdropFilter: 'blur(6px)', colorScheme: 'dark', transition: 'border-color 0.2s',
};
