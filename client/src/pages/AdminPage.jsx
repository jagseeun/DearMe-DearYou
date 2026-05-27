import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import PasswordField from '../components/PasswordField.jsx';
import { fetchJson } from '../utils/api.js';

const ease = [0.22, 1, 0.36, 1];
const PASSWORD_MAX_LENGTH = 128;
const TEACHER_TITLE_MAX_LENGTH = 120;
const TEACHER_CONTENT_MAX_LENGTH = 10000;

const panelStyle = {
  width: '100%',
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
  minHeight: 42,
  padding: '0 18px',
  borderRadius: 8,
  border: '1px solid rgba(232,194,138,0.38)',
  background: 'linear-gradient(135deg, rgba(232,194,138,0.22), rgba(255,255,255,0.08))',
  color: '#ffe8c4',
  fontSize: 14,
  fontFamily: 'inherit',
  cursor: 'pointer',
  transition: 'all 0.2s ease',
};

const dangerButtonStyle = {
  ...buttonStyle,
  borderColor: 'rgba(255,120,120,0.36)',
  background: 'rgba(120,40,40,0.28)',
  color: '#ffd0d0',
};

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
}

function toDateInputValue(value) {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

export default function AdminPage() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [redirecting, setRedirecting] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [teacherLetters, setTeacherLetters] = useState([]);
  const [users, setUsers] = useState([]);
  const [letters, setLetters] = useState([]);
  const [form, setForm] = useState({ teacherName: '', title: '', content: '' });
  const [dateDrafts, setDateDrafts] = useState({});
  const [passwordDrafts, setPasswordDrafts] = useState({});
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [resending, setResending] = useState(false);
  const [busyId, setBusyId] = useState(null);
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
        await loadAll();
      } catch {
        setMessage('서버 연결을 확인해주세요.');
      } finally {
        setChecking(false);
      }
    }
    checkAdmin();
  }, []);

  async function loadAll() {
    const results = await Promise.allSettled([loadTeacherLetters(), loadUsers(), loadAdminLetters()]);
    const failed = results.find(result => result.status === 'rejected');
    if (failed) {
      setMessage(failed.reason?.message || '일부 관리자 데이터를 불러오지 못했습니다.');
    }
  }

  async function loadTeacherLetters() {
    setTeacherLetters(await fetchJson('/teacher-letters'));
  }

  async function loadUsers() {
    setUsers(await fetchJson('/admin/users'));
  }

  async function loadAdminLetters() {
    const nextLetters = await fetchJson('/admin/letters');
    setLetters(nextLetters);
    setDateDrafts(Object.fromEntries(nextLetters.map(letter => [letter.id, toDateInputValue(letter.openDate)])));
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
      await fetchJson('/teacher-letters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      setForm({ teacherName: '', title: '', content: '' });
      setMessage('선생님 편지를 저장했습니다.');
      await loadTeacherLetters();
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
      const data = await fetchJson('/teacher-letters/random-send', { method: 'POST' });
      setSendResult(data);
      setMessage('랜덤 발송을 실행했습니다.');
      await loadTeacherLetters();
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
      const data = await fetchJson('/teacher-letters/resend-all', { method: 'POST' });
      setSendResult(data);
      setMessage('기존 대상에게 선생님 편지를 다시 보냈습니다.');
      await loadTeacherLetters();
    } catch (err) {
      setMessage(err.message || '재발송 실패');
    } finally {
      setResending(false);
    }
  }

  async function deleteUser(user) {
    if (!window.confirm(`${user.name}(${user.userid}) 계정과 이 계정의 편지를 삭제할까요?`)) return;

    setBusyId(`user-${user.id}`);
    setMessage('');
    try {
      const data = await fetchJson(`/admin/users/${user.id}`, { method: 'DELETE' });
      setMessage(data.message || '사용자를 삭제했습니다.');
      await loadAll();
    } catch (err) {
      setMessage(err.message || '사용자 삭제 실패');
    } finally {
      setBusyId(null);
    }
  }

  async function updateUserPassword(user) {
    const nextPassword = passwordDrafts[user.id] || '';
    if (!nextPassword) {
      setMessage('새 비밀번호를 입력해주세요.');
      return;
    }
    if (nextPassword.length < 6) {
      setMessage('비밀번호는 6자 이상으로 입력해주세요.');
      return;
    }
    if (nextPassword.length > PASSWORD_MAX_LENGTH) {
      setMessage(`비밀번호는 ${PASSWORD_MAX_LENGTH}자를 넘을 수 없습니다.`);
      return;
    }
    if (!window.confirm(`${user.name}(${user.userid}) 계정의 비밀번호를 변경할까요?`)) return;

    setBusyId(`password-${user.id}`);
    setMessage('');
    try {
      const data = await fetchJson(`/admin/users/${user.id}/password`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nextPassword }),
      });
      setPasswordDrafts(prev => ({ ...prev, [user.id]: '' }));
      setMessage(data.message || '비밀번호를 변경했습니다.');
    } catch (err) {
      setMessage(err.message || '비밀번호 변경 실패');
    } finally {
      setBusyId(null);
    }
  }

  async function updateLetterDate(letter) {
    const draft = dateDrafts[letter.id];
    if (!draft) {
      setMessage('수정할 날짜를 입력해주세요.');
      return;
    }

    setBusyId(`letter-${letter.id}`);
    setMessage('');
    try {
      const data = await fetchJson(`/admin/letters/${letter.id}/open-date`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ openDate: new Date(draft).toISOString() }),
      });
      setMessage(data.message || '편지 날짜를 수정했습니다.');
      await loadAdminLetters();
    } catch (err) {
      setMessage(err.message || '편지 날짜 수정 실패');
    } finally {
      setBusyId(null);
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
      <div style={{ maxWidth: 1080, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ color: 'rgba(255,252,223,0.45)', fontSize: 12, letterSpacing: 4, marginBottom: 8 }}>ADMIN</div>
            <h1 style={{ margin: 0, fontSize: 34, fontWeight: 300 }}>관리자 콘솔</h1>
          </div>
          <button style={{ ...buttonStyle, background: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.18)' }} onClick={() => navigate('/')}>나가기</button>
        </div>

        {message && (
          <div style={{ ...panelStyle, padding: 14, color: 'rgba(255,252,223,0.82)' }}>{message}</div>
        )}

        <section style={{ ...panelStyle, padding: 24, display: 'grid', gap: 14 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 300 }}>선생님 편지 작성</h2>
            <p style={{ margin: '8px 0 0', color: 'rgba(255,252,223,0.48)', fontSize: 13 }}>작성 후 랜덤 발송 또는 기존 대상 재발송을 실행할 수 있습니다.</p>
          </div>

          <form onSubmit={createLetter} style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
              <input
                style={inputStyle}
                value={form.teacherName}
                onChange={e => setForm(prev => ({ ...prev, teacherName: e.target.value }))}
                placeholder="선생님 이름"
                maxLength={10}
              />
              <input
                style={inputStyle}
                value={form.title}
                onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="제목"
                maxLength={TEACHER_TITLE_MAX_LENGTH}
              />
            </div>
            <textarea
              style={{ ...inputStyle, minHeight: 170, resize: 'vertical', lineHeight: 1.7 }}
              value={form.content}
              onChange={e => setForm(prev => ({ ...prev, content: e.target.value }))}
              placeholder="선생님 편지 내용"
              maxLength={TEACHER_CONTENT_MAX_LENGTH}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
              <button style={buttonStyle} disabled={saving}>{saving ? '저장 중...' : '편지 저장'}</button>
              <button type="button" style={buttonStyle} onClick={resendAll} disabled={resending || sending}>
                {resending ? '재발송 중...' : '기존 대상 재발송'}
              </button>
              <button type="button" style={buttonStyle} onClick={sendRandom} disabled={sending || resending || teacherLetters.length === 0}>
                {sending ? '발송 중...' : '랜덤 발송 실행'}
              </button>
            </div>
          </form>
        </section>

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

        <section style={{ ...panelStyle, overflow: 'hidden' }}>
          <div style={{ padding: '18px 22px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <span>등록된 선생님 편지</span>
            <span style={{ color: 'rgba(255,252,223,0.48)' }}>{teacherLetters.length}개</span>
          </div>
          {teacherLetters.length === 0 ? (
            <div style={{ padding: 28, color: 'rgba(255,252,223,0.45)' }}>아직 등록된 편지가 없습니다.</div>
          ) : (
            <div style={{ display: 'grid' }}>
              {teacherLetters.map(letter => (
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
        </section>

        <section style={{ ...panelStyle, overflow: 'hidden' }}>
          <div style={{ padding: '18px 22px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <span>사용자 계정 관리</span>
            <span style={{ color: 'rgba(255,252,223,0.48)' }}>{users.length}명</span>
          </div>
          {users.map(user => (
            <div key={user.id} style={{ padding: 18, borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(210px, 260px) auto auto', gap: 12, alignItems: 'center' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'baseline' }}>
                  <strong style={{ fontWeight: 500 }}>{user.name}</strong>
                  <span style={{ color: 'rgba(255,252,223,0.56)' }}>@{user.userid}</span>
                  {user.isCurrentUser && <span style={{ color: '#ffe8c4', fontSize: 12 }}>현재 계정</span>}
                </div>
                <div style={{ marginTop: 7, color: 'rgba(255,252,223,0.48)', fontSize: 13 }}>
                  {user.email || '이메일 없음'} · 편지 {user._count?.letters || 0} · 선생님 편지 작성 {user._count?.teacherLetters || 0} · 마지막 로그인 {formatDate(user.lastLoginAt)}
                </div>
              </div>
              <PasswordField
                wrapperClassName="password-field password-field-admin"
                className="admin-password-input"
                inputStyle={{ ...inputStyle, paddingRight: 52 }}
                placeholder="새 비밀번호"
                maxLength={PASSWORD_MAX_LENGTH}
                value={passwordDrafts[user.id] || ''}
                onChange={e => setPasswordDrafts(prev => ({ ...prev, [user.id]: e.target.value }))}
              />
              <button
                style={buttonStyle}
                disabled={busyId === `password-${user.id}`}
                onClick={() => updateUserPassword(user)}
              >
                {busyId === `password-${user.id}` ? '변경 중...' : '비번 변경'}
              </button>
              <button
                style={dangerButtonStyle}
                disabled={user.isCurrentUser || busyId === `user-${user.id}`}
                onClick={() => deleteUser(user)}
              >
                {busyId === `user-${user.id}` ? '삭제 중...' : '계정 삭제'}
              </button>
            </div>
          ))}
        </section>

        <section style={{ ...panelStyle, overflow: 'hidden' }}>
          <div style={{ padding: '18px 22px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <span>편지 날짜 수정</span>
            <span style={{ color: 'rgba(255,252,223,0.48)' }}>{letters.length}개</span>
          </div>
          {letters.length === 0 ? (
            <div style={{ padding: 28, color: 'rgba(255,252,223,0.45)' }}>작성된 편지가 없습니다.</div>
          ) : (
            letters.map(letter => (
              <div key={letter.id} style={{ padding: 18, borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(220px, 280px) auto', gap: 12, alignItems: 'center' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'baseline' }}>
                    <strong style={{ fontWeight: 500 }}>{letter.author?.name || '알 수 없음'}</strong>
                    <span style={{ color: 'rgba(255,252,223,0.56)' }}>@{letter.author?.userid}</span>
                    <span style={{ color: '#ffe8c4', fontSize: 12 }}>{letter.type}</span>
                  </div>
                  <div style={{ marginTop: 7, color: 'rgba(255,252,223,0.48)', fontSize: 13 }}>
                    받는 사람 {letter.recipientName || '미지정'} · 현재 개봉일 {formatDate(letter.openDate)} · 발송 {letter.sentAt ? formatDate(letter.sentAt) : '대기'}
                  </div>
                </div>
                <input
                  style={inputStyle}
                  type="datetime-local"
                  value={dateDrafts[letter.id] || ''}
                  onChange={e => setDateDrafts(prev => ({ ...prev, [letter.id]: e.target.value }))}
                />
                <button
                  style={buttonStyle}
                  disabled={busyId === `letter-${letter.id}`}
                  onClick={() => updateLetterDate(letter)}
                >
                  {busyId === `letter-${letter.id}` ? '수정 중...' : '날짜 저장'}
                </button>
              </div>
            ))
          )}
        </section>
      </div>
    </motion.div>
  );
}
