import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

const ease = [0.22, 1, 0.36, 1];

const panelStyle = {
  width: '100%',
  maxWidth: 960,
  background: 'rgba(18,18,22,0.58)',
  border: '1px solid rgba(244,220,184,0.16)',
  borderRadius: 8,
  backdropFilter: 'blur(22px)',
  boxShadow: '0 18px 46px rgba(0,0,0,0.24)',
};

const inputStyle = {
  width: '100%',
  padding: '13px 14px',
  borderRadius: 8,
  border: '1px solid rgba(244,220,184,0.16)',
  background: 'rgba(255,255,255,0.075)',
  color: '#fff3df',
  fontSize: 14,
  fontFamily: 'inherit',
  outline: 'none',
};

const buttonStyle = {
  height: 42,
  padding: '0 22px',
  borderRadius: 8,
  border: '1px solid rgba(232,194,138,0.38)',
  background: 'linear-gradient(135deg, rgba(232,194,138,0.22), rgba(255,255,255,0.08))',
  color: '#ffe8c4',
  fontSize: 14,
  fontFamily: 'inherit',
  cursor: 'pointer',
  transition: 'all 0.2s ease',
};

export default function AdminPage() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [redirecting, setRedirecting] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [letters, setLetters] = useState([]);
  const [form, setForm] = useState({ teacherName: '', title: '', content: '' });
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [resending, setResending] = useState(false);
  const [sendResult, setSendResult] = useState(null);

  useEffect(() => {
    async function checkAdmin() {
      try {
        const res = await fetch('/get-user-info');
        if (res.status === 401) {
          setRedirecting(true);
          navigate('/login', { replace: true });
          return;
        }
        const user = await res.json();
        if (!user.isAdmin) {
          setRedirecting(true);
          navigate('/', { replace: true });
          return;
        }
        setAuthorized(true);
        await loadLetters();
      } catch {
        setMessage('서버 연결을 확인해주세요.');
      } finally {
        setChecking(false);
      }
    }
    checkAdmin();
  }, []);

  async function loadLetters() {
    const res = await fetch('/teacher-letters');
    if (res.status === 403) {
      setAuthorized(false);
      return;
    }
    if (!res.ok) throw new Error('list failed');
    setLetters(await res.json());
  }

  async function createLetter(e) {
    e.preventDefault();
    if (!form.content.trim()) {
      setMessage('편지 내용을 입력해주세요.');
      return;
    }

    setSaving(true);
    setMessage('');
    try {
      const res = await fetch('/teacher-letters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || '저장 실패');
      setForm({ teacherName: '', title: '', content: '' });
      setMessage('선생님 편지를 저장했습니다.');
      await loadLetters();
    } catch (err) {
      setMessage(err.message || '저장 실패');
    } finally {
      setSaving(false);
    }
  }

  async function sendRandom() {
    if (!window.confirm('아직 받지 않은 로그인 사용자에게 선생님 편지를 1개씩 랜덤 발송할까요?')) return;

    setSending(true);
    setMessage('');
    setSendResult(null);
    try {
      const res = await fetch('/teacher-letters/random-send', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || '발송 실패');
      setSendResult(data);
      setMessage('랜덤 발송을 실행했습니다.');
      await loadLetters();
    } catch (err) {
      setMessage(err.message || '발송 실패');
    } finally {
      setSending(false);
    }
  }

  async function resendAll() {
    if (!window.confirm('이미 선생님 편지를 받은 기존 대상에게 다시 이메일을 보낼까요?')) return;

    setResending(true);
    setMessage('');
    setSendResult(null);
    try {
      const res = await fetch('/teacher-letters/resend-all', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || '재발송 실패');
      setSendResult(data);
      setMessage('기존 대상에게 선생님 편지를 다시 보냈습니다.');
      await loadLetters();
    } catch (err) {
      setMessage(err.message || '재발송 실패');
    } finally {
      setResending(false);
    }
  }

  if (checking || redirecting) {
    return <div style={{ position: 'relative', zIndex: 1, padding: 48, color: '#fffcdf' }}>확인 중...</div>;
  }

  if (!authorized) {
    return (
      <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ ...panelStyle, maxWidth: 420, padding: 32, textAlign: 'center', color: '#fffcdf' }}>
          <div style={{ fontSize: 24, marginBottom: 12 }}>관리자만 접근할 수 있습니다.</div>
          <button style={buttonStyle} onClick={() => navigate('/')}>처음으로</button>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      style={{ position: 'relative', zIndex: 1, minHeight: '100vh', padding: '92px 24px 48px', color: '#fffcdf' }}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5, ease }}
    >
      <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
          <div>
            <div style={{ color: 'rgba(255,252,223,0.45)', fontSize: 12, letterSpacing: 4, marginBottom: 8 }}>ADMIN</div>
            <h1 style={{ margin: 0, fontSize: 34, fontWeight: 300 }}>선생님 편지 관리</h1>
          </div>
          <button style={{ ...buttonStyle, background: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.18)' }} onClick={() => navigate('/')}>나가기</button>
        </div>

        <form onSubmit={createLetter} style={{ ...panelStyle, padding: 24, display: 'grid', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <input
              style={inputStyle}
              value={form.teacherName}
              onChange={e => setForm(prev => ({ ...prev, teacherName: e.target.value }))}
              placeholder="선생님 이름"
            />
            <input
              style={inputStyle}
              value={form.title}
              onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
              placeholder="제목"
            />
          </div>
          <textarea
            style={{ ...inputStyle, minHeight: 180, resize: 'vertical', lineHeight: 1.7 }}
            value={form.content}
            onChange={e => setForm(prev => ({ ...prev, content: e.target.value }))}
            placeholder="선생님 편지 내용"
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <span style={{ color: 'rgba(255,252,223,0.48)', fontSize: 13 }}>{message}</span>
            <button style={buttonStyle} disabled={saving}>{saving ? '저장 중...' : '편지 저장'}</button>
          </div>
        </form>

        <div style={{ ...panelStyle, padding: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 18 }}>
          <div>
            <div style={{ fontSize: 18, marginBottom: 6 }}>랜덤 발송</div>
            <div style={{ color: 'rgba(255,252,223,0.48)', fontSize: 13 }}>
              아직 받지 않은 로그인 사용자에게만 1개씩 배정됩니다.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button style={buttonStyle} onClick={resendAll} disabled={resending || sending}>
              {resending ? '재발송 중...' : '기존 대상 재발송'}
            </button>
            <button style={buttonStyle} onClick={sendRandom} disabled={sending || resending || letters.length === 0}>
              {sending ? '발송 중...' : '랜덤 발송 실행'}
            </button>
          </div>
        </div>

        {sendResult && (
          <div style={{ ...panelStyle, padding: 18, display: 'flex', gap: 18, flexWrap: 'wrap', color: 'rgba(255,252,223,0.82)' }}>
            {sendResult.created !== undefined && <span>신규 배정 {sendResult.created}</span>}
            {sendResult.retried !== undefined && <span>재시도 {sendResult.retried}</span>}
            {sendResult.resent !== undefined && <span>재발송 대상 {sendResult.resent}</span>}
            <span>발송 성공 {sendResult.sent}</span>
            <span>실패 {sendResult.failed}</span>
            <span>이메일 없음 {sendResult.skippedNoEmail}</span>
          </div>
        )}

        <div style={{ ...panelStyle, overflow: 'hidden' }}>
          <div style={{ padding: '18px 22px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between' }}>
            <span>등록된 선생님 편지</span>
            <span style={{ color: 'rgba(255,252,223,0.48)' }}>{letters.length}개</span>
          </div>
          {letters.length === 0 ? (
            <div style={{ padding: 28, color: 'rgba(255,252,223,0.45)' }}>아직 등록된 편지가 없습니다.</div>
          ) : (
            <div style={{ display: 'grid' }}>
              {letters.map(letter => (
                <div key={letter.id} style={{ padding: 22, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 8 }}>
                    <strong style={{ fontWeight: 500 }}>{letter.title || '제목 없음'}</strong>
                    <span style={{ color: 'rgba(255,252,223,0.45)', fontSize: 13 }}>배정 {letter._count?.deliveries || 0}</span>
                  </div>
                  <div style={{ color: 'rgba(255,252,223,0.58)', fontSize: 13, marginBottom: 10 }}>{letter.teacherName}</div>
                  <div style={{ color: 'rgba(255,252,223,0.72)', whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{letter.content}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
