import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import PasswordField from '../components/PasswordField.jsx';
import { fetchJson } from '../utils/api.js';
import { ALLOWED_EMAIL_MESSAGE, isAllowedEmail } from '../utils/email.js';
import { modalBackdropMotion, modalPanelMotion, motionEase, pageMotion } from '../utils/motion.js';

const ease = motionEase;
const PASSWORD_MAX_LENGTH = 128;
const TEACHER_TITLE_MAX_LENGTH = 120;
const TEACHER_CONTENT_MAX_LENGTH = 10000;
const emptyTeacherForm = { teacherName: '', title: '', content: '' };

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

function getLetterSendStatus(letter) {
  if (letter.sentAt) return { key: 'sent', label: `\uC644\uB8CC ${formatDate(letter.sentAt)}`, color: '#8fd19e' };
  if (new Date(letter.openDate) <= new Date()) return { key: 'due', label: '\uBC1C\uC1A1 \uB300\uAE30', color: '#ffd38a' };
  return { key: 'scheduled', label: '\uC608\uC57D', color: 'rgba(255,252,223,0.48)' };
}

function getLetterDeliveryEmail(letter) {
  return letter.deliveryEmail || letter.recipientEmail || letter.author?.email || '';
}

async function fetchJsonWithTimeout(url, options = {}, timeoutMs = 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchJson(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('요청 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export default function AdminPage() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [redirecting, setRedirecting] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [teacherLetters, setTeacherLetters] = useState([]);
  const [publicLetters, setPublicLetters] = useState([]);
  const [selectedPublicLetter, setSelectedPublicLetter] = useState(null);
  const [selectedPublicLetterIds, setSelectedPublicLetterIds] = useState([]);
  const [users, setUsers] = useState([]);
  const [letters, setLetters] = useState([]);
  const [selectedLetterIds, setSelectedLetterIds] = useState([]);
  const [form, setForm] = useState(emptyTeacherForm);
  const [editingTeacherId, setEditingTeacherId] = useState(null);
  const [dateDrafts, setDateDrafts] = useState({});
  const [deliveryEmailDrafts, setDeliveryEmailDrafts] = useState({});
  const [passwordDrafts, setPasswordDrafts] = useState({});
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [resending, setResending] = useState(false);
  const [teacherTestSendingId, setTeacherTestSendingId] = useState(null);
  const [letterSending, setLetterSending] = useState(false);
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
        setMessage('서버와의 연결을 확인해 주세요.');
      } finally {
        setChecking(false);
      }
    }
    checkAdmin();
  }, []);

  async function loadAll() {
    const results = await Promise.allSettled([loadTeacherLetters(), loadPublicLetters(), loadUsers(), loadAdminLetters()]);
    const failed = results.find(result => result.status === 'rejected');
    if (failed) {
      setMessage(failed.reason?.message || '일부 관리자 데이터를 불러오지 못했습니다.');
    }
  }

  async function loadTeacherLetters() {
    setTeacherLetters(await fetchJson('/teacher-letters'));
  }

  async function loadPublicLetters() {
    const nextLetters = await fetchJson('/admin/public-letters');
    const nextIds = new Set(nextLetters.map(letter => letter.id));
    setPublicLetters(nextLetters);
    setSelectedPublicLetterIds(prev => prev.filter(id => nextIds.has(id)));
  }

  async function loadUsers() {
    setUsers(await fetchJson('/admin/users'));
  }

  async function loadAdminLetters() {
    const nextLetters = await fetchJson('/admin/letters');
    const nextIds = new Set(nextLetters.map(letter => letter.id));
    setLetters(nextLetters);
    setSelectedLetterIds(prev => prev.filter(id => nextIds.has(id)));
    setDateDrafts(Object.fromEntries(nextLetters.map(letter => [letter.id, toDateInputValue(letter.openDate)])));
    setDeliveryEmailDrafts(Object.fromEntries(nextLetters.map(letter => [letter.id, getLetterDeliveryEmail(letter)])));
  }

  async function saveTeacherLetter(e) {
    e.preventDefault();
    if (!form.content.trim()) {
      setMessage('선생님 편지 내용을 입력해 주세요.');
      return;
    }

    setSaving(true);
    setMessage('');
    try {
      await fetchJson(editingTeacherId ? `/teacher-letters/${editingTeacherId}` : '/teacher-letters', {
        method: editingTeacherId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      setForm(emptyTeacherForm);
      setMessage(editingTeacherId ? '선생님 편지를 수정했습니다.' : '선생님 편지를 저장했습니다.');
      setEditingTeacherId(null);
      await loadTeacherLetters();
    } catch (err) {
      setMessage(err.message || (editingTeacherId ? '수정하지 못했습니다' : '저장하지 못했습니다'));
    } finally {
      setSaving(false);
    }
  }

  function startEditTeacherLetter(letter) {
    setEditingTeacherId(letter.id);
    setForm({
      teacherName: letter.teacherName || '',
      title: letter.title || '',
      content: letter.content || '',
    });
    setMessage('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelTeacherEdit() {
    setEditingTeacherId(null);
    setForm(emptyTeacherForm);
    setMessage('');
  }

  async function sendRandom() {
    if (!window.confirm('아직 받지 않은 로그인 사용자에게 선생님 편지를 1개씩 랜덤 발송하시겠습니까?')) return;

    setSending(true);
    setMessage('');
    setSendResult(null);
    try {
      const data = await fetchJson('/teacher-letters/random-send', { method: 'POST' });
      setSendResult(data);
      setMessage('랜덤 발송을 실행했습니다.');
      await loadTeacherLetters();
    } catch (err) {
      setMessage(err.message || '발송하지 못했습니다');
    } finally {
      setSending(false);
    }
  }

  async function resendAll() {
    if (!window.confirm('이미 선생님 편지를 받은 대상에게 이메일을 다시 보내시겠습니까?')) return;

    setResending(true);
    setMessage('');
    setSendResult(null);
    try {
      const data = await fetchJson('/teacher-letters/resend-all', { method: 'POST' });
      setSendResult(data);
      setMessage('기존 대상에게 선생님 편지를 다시 보냈습니다.');
      await loadTeacherLetters();
    } catch (err) {
      setMessage(err.message || '재발송하지 못했습니다');
    } finally {
      setResending(false);
    }
  }

  async function sendTeacherTest(letter) {
    if (!window.confirm(`이 편지를 s2468@e-mirim.hs.kr로 테스트 발송하시겠습니까?`)) return;

    setTeacherTestSendingId(letter.id);
    setMessage('');
    try {
      const data = await fetchJsonWithTimeout(`/teacher-letters/${letter.id}/test-send`, { method: 'POST' }, 30000);
      setMessage(data.message || '테스트 이메일을 보냈습니다.');
    } catch (err) {
      setMessage(err.message || '테스트 이메일 발송하지 못했습니다');
    } finally {
      setTeacherTestSendingId(null);
    }
  }

  async function togglePublicLetterVisible(letter) {
    setBusyId(`public-letter-${letter.id}`);
    setMessage('');
    try {
      const updatedLetter = await fetchJson(`/admin/public-letters/${letter.id}/visible`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visible: !letter.visible }),
      });
      setSelectedPublicLetter(prev => (prev?.id === updatedLetter.id ? updatedLetter : prev));
      setMessage(!letter.visible ? '열린 편지를 다시 공개했습니다.' : '열린 편지를 숨겼습니다.');
      await loadPublicLetters();
    } catch (err) {
      setMessage(err.message || '열린 편지 상태를 바꾸지 못했습니다');
    } finally {
      setBusyId(null);
    }
  }

  async function deletePublicLetter(letter) {
    if (!window.confirm(`${letter.nickname}님의 열린 편지를 삭제하시겠습니까?`)) return;
    setBusyId(`delete-public-letter-${letter.id}`);
    setMessage('');
    try {
      await fetchJson(`/admin/public-letters/${letter.id}`, { method: 'DELETE' });
      setSelectedPublicLetter(prev => (prev?.id === letter.id ? null : prev));
      setSelectedPublicLetterIds(prev => prev.filter(id => id !== letter.id));
      setMessage('열린 편지를 삭제했습니다.');
      await loadPublicLetters();
    } catch (err) {
      setMessage(err.message || '열린 편지를 삭제하지 못했습니다');
    } finally {
      setBusyId(null);
    }
  }

  function togglePublicLetterSelection(id) {
    setSelectedPublicLetterIds(prev => (prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]));
  }

  function toggleAllPublicLetters() {
    setSelectedPublicLetterIds(prev => (prev.length === publicLetters.length ? [] : publicLetters.map(letter => letter.id)));
  }

  async function deleteSelectedPublicLetters() {
    const ids = selectedPublicLetterIds;
    if (ids.length === 0) {
      setMessage('삭제할 열린 편지를 선택해 주세요.');
      return;
    }
    if (!window.confirm(`선택한 열린 편지 ${ids.length}개를 삭제하시겠습니까?`)) return;

    setBusyId('delete-public-letters');
    setMessage('');
    try {
      const data = await fetchJson('/admin/public-letters', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      setSelectedPublicLetter(prev => (prev && ids.includes(prev.id) ? null : prev));
      setSelectedPublicLetterIds([]);
      setMessage(data.message || '선택한 열린 편지를 삭제했습니다.');
      await loadPublicLetters();
    } catch (err) {
      setMessage(err.message || '선택한 열린 편지를 삭제하지 못했습니다');
    } finally {
      setBusyId(null);
    }
  }

  function toggleLetterSelection(id) {
    setSelectedLetterIds(prev => (prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]));
  }

  function toggleAllLetters() {
    setSelectedLetterIds(prev => (prev.length === letters.length ? [] : letters.map(letter => letter.id)));
  }

  async function deleteSelectedLetters() {
    const ids = selectedLetterIds;
    if (ids.length === 0) {
      setMessage('삭제할 편지를 선택해 주세요.');
      return;
    }
    if (!window.confirm(`선택한 편지 ${ids.length}개를 삭제하시겠습니까?`)) return;

    setBusyId('delete-letters');
    setMessage('');
    try {
      const data = await fetchJson('/admin/letters', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      setSelectedLetterIds([]);
      setMessage(data.message || '선택한 편지를 삭제했습니다.');
      await loadAdminLetters();
    } catch (err) {
      setMessage(err.message || '선택한 편지를 삭제하지 못했습니다');
    } finally {
      setBusyId(null);
    }
  }

  async function deleteUser(user) {
    if (!window.confirm(`${user.name}(${user.userid}) 계정과 이 계정의 편지를 삭제하시겠습니까?`)) return;

    setBusyId(`user-${user.id}`);
    setMessage('');
    try {
      const data = await fetchJson(`/admin/users/${user.id}`, { method: 'DELETE' });
      setMessage(data.message || '사용자 계정을 삭제했습니다.');
      await loadAll();
    } catch (err) {
      setMessage(err.message || '사용자 계정을 삭제하지 못했습니다');
    } finally {
      setBusyId(null);
    }
  }

  async function updateUserPassword(user) {
    const nextPassword = passwordDrafts[user.id] || '';
    if (!nextPassword) {
      setMessage('새 비밀번호를 입력해 주세요.');
      return;
    }
    if (nextPassword.length < 6) {
      setMessage('비밀번호는 6자 이상으로 입력해 주세요.');
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
      setMessage(err.message || '비밀번호를 변경하지 못했습니다');
    } finally {
      setBusyId(null);
    }
  }

  async function updateLetterDate(letter) {
    const draft = dateDrafts[letter.id];
    if (!draft) {
      setMessage('수정할 열람일을 입력해 주세요.');
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
      setMessage(err.message || '편지 날짜 수정하지 못했습니다');
    } finally {
      setBusyId(null);
    }
  }

  async function updateLetterDeliveryEmail(letter) {
    const deliveryEmail = (deliveryEmailDrafts[letter.id] || '').trim();
    if (deliveryEmail && !isAllowedEmail(deliveryEmail)) {
      setMessage(ALLOWED_EMAIL_MESSAGE);
      return;
    }

    setBusyId(`email-letter-${letter.id}`);
    setMessage('');
    try {
      const data = await fetchJson(`/admin/letters/${letter.id}/delivery-email`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deliveryEmail }),
      });
      setMessage(data.message || '발송 이메일을 저장했습니다.');
      await loadAdminLetters();
    } catch (err) {
      setMessage(err.message || '발송 이메일을 저장하지 못했습니다');
    } finally {
      setBusyId(null);
    }
  }

  async function sendDueAdminLetters() {
    if (!window.confirm('열람일이 지난 미발송 편지를 지금 발송하시겠습니까?')) return;

    setLetterSending(true);
    setMessage('');
    setSendResult(null);
    try {
      const data = await fetchJsonWithTimeout('/admin/letters/send-due', { method: 'POST' }, 90000);
      setSendResult(data);
      setMessage(data.message || `편지 발송 요청을 실행했습니다. 발송 ${data.sent}, 미발송 ${data.failed}`);
      await loadAdminLetters();
    } catch (err) {
      setMessage(err.message || '편지를 발송하지 못했습니다');
    } finally {
      setLetterSending(false);
    }
  }

  async function sendAdminLetter(letter) {
    if (!window.confirm(`${letter.author?.name || '\uC0AC\uC6A9\uC790'}\uB2D8\uC758 \uD3B8\uC9C0\uB97C \uC9C0\uAE08 \uBC1C\uC1A1\uD560\uAE4C\uC694?`)) return;
    setBusyId(`send-letter-${letter.id}`);
    setMessage('');
    setSendResult(null);
    try {
      const data = await fetchJsonWithTimeout(`/admin/letters/${letter.id}/send`, { method: 'POST' }, 45000);
      setSendResult(data);
      setMessage(data.message || '편지 발송 요청이 접수되었습니다.');
      await loadAdminLetters();
    } catch (err) {
      setMessage(err.message || '편지 발송하지 못했습니다');
    } finally {
      setBusyId(null);
    }
  }

  if (checking || redirecting) {
    return <div style={{ position: 'relative', zIndex: 1, padding: 48, color: '#fffcdf' }}>권한을 확인하고 있습니다...</div>;
  }

  if (!authorized) {
    return (
      <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ ...panelStyle, maxWidth: 420, padding: 32, textAlign: 'center', color: '#fffcdf' }}>
          <div style={{ fontSize: 24, marginBottom: 12 }}>관리자만 접근하실 수 있습니다.</div>
          <button style={buttonStyle} onClick={() => navigate('/')}>처음으로</button>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      className="admin-page"
      style={{ position: 'relative', zIndex: 1, minHeight: '100vh', padding: '92px 24px 48px', color: '#fffcdf' }}
      {...pageMotion}
    >
      <div style={{ maxWidth: 1080, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ color: 'rgba(255,252,223,0.45)', fontSize: 12, letterSpacing: 4, marginBottom: 8 }}>ADMIN</div>
            <h1 style={{ margin: 0, fontSize: 34, fontWeight: 300 }}>관리자 편지 콘솔</h1>
          </div>
          <button style={{ ...buttonStyle, background: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.18)' }} onClick={() => navigate('/')}>처음으로</button>
        </div>

        {message && (
          <div style={{ ...panelStyle, padding: 14, color: 'rgba(255,252,223,0.82)' }}>{message}</div>
        )}

        <section style={{ ...panelStyle, padding: 24, display: 'grid', gap: 14 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 300 }}>{editingTeacherId ? '선생님 편지 수정' : '선생님 편지 작성'}</h2>
            <p style={{ margin: '8px 0 0', color: 'rgba(255,252,223,0.48)', fontSize: 13 }}>작성 후 랜덤 발송 또는 기존 대상 재발송을 실행하실 수 있습니다.</p>
          </div>

          <form onSubmit={saveTeacherLetter} style={{ display: 'grid', gap: 12 }}>
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
              {editingTeacherId && (
                <button type="button" style={buttonStyle} onClick={cancelTeacherEdit} disabled={saving}>
                  수정 취소
                </button>
              )}
              <button style={buttonStyle} disabled={saving}>
                {editingTeacherId ? (saving ? '수정 중...' : '수정 저장') : (saving ? '저장 중...' : '편지 저장')}
              </button>
              <button type="button" style={buttonStyle} onClick={resendAll} disabled={resending || sending}>
                {resending ? '재발송 중...' : '기존 대상 재발송'}
              </button>
              <button type="button" style={buttonStyle} onClick={sendRandom} disabled={sending || resending || teacherLetters.length === 0}>
                {sending ? '발송 중...' : '랜덤 발송'}
              </button>
            </div>
          </form>
        </section>

        {sendResult && (
          <div style={{ ...panelStyle, padding: 18, display: 'flex', gap: 18, flexWrap: 'wrap', color: 'rgba(255,252,223,0.82)' }}>
            {sendResult.checked !== undefined && <span>대상 {sendResult.checked}</span>}
            {sendResult.created !== undefined && <span>신규 배정 {sendResult.created}</span>}
            {sendResult.retried !== undefined && <span>재시도 {sendResult.retried}</span>}
            {sendResult.resent !== undefined && <span>재발송 대상 {sendResult.resent}</span>}
            <span>발송 성공 {sendResult.sent}</span>
            <span>발송하지 못함 {sendResult.failed}</span>
            <span>이메일 미등록 {sendResult.skippedNoEmail}</span>
          </div>
        )}

        <section style={{ ...panelStyle, overflow: 'hidden' }}>
          <div style={{ padding: '18px 22px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <span>열린 편지함 관리</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <span style={{ color: 'rgba(255,252,223,0.48)' }}>{publicLetters.length}개</span>
              <button
                type="button"
                style={{ ...buttonStyle, minHeight: 34, padding: '0 12px', fontSize: 12 }}
                disabled={publicLetters.length === 0 || busyId === 'delete-public-letters'}
                onClick={toggleAllPublicLetters}
              >
                {selectedPublicLetterIds.length === publicLetters.length && publicLetters.length > 0 ? '선택 해제' : '전체 선택'}
              </button>
              <button
                type="button"
                style={{ ...dangerButtonStyle, minHeight: 34, padding: '0 12px', fontSize: 12 }}
                disabled={selectedPublicLetterIds.length === 0 || busyId === 'delete-public-letters'}
                onClick={deleteSelectedPublicLetters}
              >
                {busyId === 'delete-public-letters' ? '삭제 중...' : `선택 삭제${selectedPublicLetterIds.length ? ` (${selectedPublicLetterIds.length})` : ''}`}
              </button>
            </div>
          </div>
          {publicLetters.length === 0 ? (
            <div style={{ padding: 28, color: 'rgba(255,252,223,0.45)' }}>아직 열린 편지가 없습니다.</div>
          ) : (
            <div style={{ display: 'grid' }}>
              {publicLetters.map(letter => (
                <div key={letter.id} style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr) auto', gap: 10, alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    aria-label={`열린 편지 ${letter.id} 선택`}
                    checked={selectedPublicLetterIds.includes(letter.id)}
                    onChange={() => togglePublicLetterSelection(letter.id)}
                    style={{ width: 18, height: 18, accentColor: '#e8c28a' }}
                  />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 7 }}>
                      <strong style={{ fontWeight: 500 }}>{letter.nickname}</strong>
                      <span style={{ color: '#ffe8c4', fontSize: 12 }}>열린 편지 ID {letter.id}</span>
                      <span style={{ color: 'rgba(255,252,223,0.45)', fontSize: 12 }}>{letter.type === 'draw' ? '그림' : letter.type === 'photo' ? '사진' : '텍스트'}</span>
                      <span style={{ color: letter.visible ? '#8fd19e' : '#ff9b9b', fontSize: 12 }}>{letter.visible ? '공개' : '숨기기'}</span>
                      <span style={{ color: 'rgba(255,252,223,0.38)', fontSize: 12 }}>{formatDate(letter.createdAt)}</span>
                    </div>
                    {letter.imageUrl && (
                      <img src={letter.imageUrl} alt="" style={{ display: 'none', width: 72, height: 54, objectFit: 'cover', borderRadius: 6, border: '1px solid rgba(255,255,255,0.12)', marginBottom: 8 }} />
                    )}
                    <div style={{ display: 'none', color: 'rgba(255,252,223,0.72)', whiteSpace: 'pre-wrap', lineHeight: 1.55, overflowWrap: 'anywhere' }}>
                      {letter.content || (letter.type === 'draw' ? '그림 편지' : '사진 편지')}
                    </div>
                  </div>
                  <button
                    type="button"
                    style={buttonStyle}
                    onClick={() => setSelectedPublicLetter(letter)}
                  >
                    자세히 보기
                  </button>
                  <button
                    type="button"
                    style={{ ...buttonStyle, display: 'none' }}
                    disabled={busyId === `public-letter-${letter.id}` || busyId === `delete-public-letter-${letter.id}`}
                    onClick={() => togglePublicLetterVisible(letter)}
                  >
                    {letter.visible ? '숨기기' : '다시 공개'}
                  </button>
                  <button
                    type="button"
                    style={{ ...dangerButtonStyle, display: 'none' }}
                    disabled={busyId === `public-letter-${letter.id}` || busyId === `delete-public-letter-${letter.id}`}
                    onClick={() => deletePublicLetter(letter)}
                  >
                    삭제
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section style={{ ...panelStyle, overflow: 'hidden' }}>
          <div style={{ padding: '18px 22px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <span>등록된 선생님 편지</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <span style={{ color: 'rgba(255,252,223,0.48)' }}>{teacherLetters.length}개</span>
              <span style={{ color: 'rgba(255,252,223,0.58)', fontSize: 12 }}>수정만 가능</span>
            </div>
          </div>
          {teacherLetters.length === 0 ? (
            <div style={{ padding: 28, color: 'rgba(255,252,223,0.45)' }}>아직 등록된 편지가 없습니다.</div>
          ) : (
            <div style={{ display: 'grid' }}>
              {teacherLetters.map(letter => (
                <div key={letter.id} style={{ padding: 22, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 8 }}>
                    <strong style={{ fontWeight: 500 }}>{letter.title || '제목 없음'}</strong>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      <span style={{ color: 'rgba(255,252,223,0.45)', fontSize: 13 }}>배정 {letter._count?.deliveries || 0}</span>
                      <button
                        type="button"
                        style={{ ...buttonStyle, minHeight: 34, padding: '0 12px', fontSize: 12 }}
                        onClick={() => sendTeacherTest(letter)}
                        disabled={teacherTestSendingId === letter.id}
                      >
                        {teacherTestSendingId === letter.id ? '발송 중...' : '테스트 발송'}
                      </button>
                      <button
                        type="button"
                        style={{ ...buttonStyle, minHeight: 34, padding: '0 12px', fontSize: 12 }}
                        onClick={() => startEditTeacherLetter(letter)}
                        disabled={(saving && editingTeacherId === letter.id) || teacherTestSendingId === letter.id}
                      >
                        수정
                      </button>
                    </div>
                  </div>
                  <div style={{ color: 'rgba(255,252,223,0.58)', fontSize: 13, marginBottom: 10 }}>{letter.teacherName}</div>
                  <div style={{ color: 'rgba(255,252,223,0.72)', whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{letter.content}</div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section style={{ ...panelStyle, overflow: 'hidden' }}>
          <div style={{ padding: '18px 22px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
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
                  {user.email || '이메일 미등록'} · 편지 {user._count?.letters || 0} · 선생님 편지 작성 {user._count?.teacherLetters || 0} · 마지막 로그인 {formatDate(user.lastLoginAt)}
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
                {busyId === `password-${user.id}` ? '변경 중...' : '비밀번호 변경'}
              </button>
              <button
                style={dangerButtonStyle}
                disabled={user.isCurrentUser || busyId === `user-${user.id}`}
                onClick={() => deleteUser(user)}
              >
                {busyId === `user-${user.id}` ? '삭제하고 있습니다...' : '계정 삭제'}
              </button>
            </div>
          ))}
        </section>

        <section style={{ ...panelStyle, overflow: 'hidden' }}>
          <div style={{ padding: '18px 22px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <span>편지 날짜/발송 관리</span>
            <span style={{ color: 'rgba(255,252,223,0.48)' }}>{letters.length}개</span>
          </div>
          <div style={{ padding: '12px 22px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <button
                type="button"
                style={{ ...buttonStyle, minHeight: 34, padding: '0 12px', fontSize: 12 }}
                disabled={letters.length === 0 || busyId === 'delete-letters'}
                onClick={toggleAllLetters}
              >
                {selectedLetterIds.length === letters.length && letters.length > 0 ? '선택 해제' : '전체 선택'}
              </button>
              <button
                type="button"
                style={{ ...dangerButtonStyle, minHeight: 34, padding: '0 12px', fontSize: 12 }}
                disabled={selectedLetterIds.length === 0 || busyId === 'delete-letters'}
                onClick={deleteSelectedLetters}
              >
                {busyId === 'delete-letters' ? '삭제 중...' : `선택 삭제${selectedLetterIds.length ? ` (${selectedLetterIds.length})` : ''}`}
              </button>
            </div>
            <button type="button" style={buttonStyle} onClick={sendDueAdminLetters} disabled={letterSending}>
              {letterSending ? '발송 중...' : '열람일 지난 편지 발송'}
            </button>
          </div>
          {letters.length === 0 ? (
            <div style={{ padding: 28, color: 'rgba(255,252,223,0.45)' }}>작성된 편지가 없습니다.</div>
          ) : (
            letters.map(letter => {
              const status = getLetterSendStatus(letter);
              const canSend = status.key === 'due' || status.key === 'scheduled';
              const sendingThisLetter = busyId === `send-letter-${letter.id}`;
              const savingThisEmail = busyId === `email-letter-${letter.id}`;
              const deliveryEmail = getLetterDeliveryEmail(letter);
              return (
              <div key={letter.id} style={{ padding: 18, borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr) minmax(220px, 280px) auto auto', gap: 12, alignItems: 'center' }}>
                <input
                  type="checkbox"
                  aria-label={`편지 ${letter.id} 선택`}
                  checked={selectedLetterIds.includes(letter.id)}
                  onChange={() => toggleLetterSelection(letter.id)}
                  style={{ width: 18, height: 18, accentColor: '#e8c28a' }}
                />
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'baseline' }}>
                    <strong style={{ fontWeight: 500 }}>{letter.author?.name || '알 수 없음'}</strong>
                    <span style={{ color: 'rgba(255,252,223,0.56)' }}>@{letter.author?.userid}</span>
                    <span style={{ color: '#ffe8c4', fontSize: 12 }}>편지 ID {letter.id}</span>
                    <span style={{ color: 'rgba(255,252,223,0.45)', fontSize: 12 }}>작성자 ID {letter.author?.id || '-'}</span>
                    <span style={{ color: '#ffe8c4', fontSize: 12 }}>{letter.type}</span>
                    <span style={{ color: status.color, fontSize: 12 }}>{status.label}</span>
                  </div>
                  <div style={{ marginTop: 7, color: 'rgba(255,252,223,0.48)', fontSize: 13 }}>
                    받을 사람 {letter.recipientName || letter.recipientEmail || '미지정'} · 열람일 {formatDate(letter.openDate)} · <span style={{ color: status.color }}>발송 {status.label}</span>
                  </div>
                  <div style={{ marginTop: 7, color: 'rgba(255,252,223,0.48)', fontSize: 13, overflowWrap: 'anywhere' }}>
                    발송 이메일 {deliveryEmail || '-'} · 실제 발송 {letter.sentToEmail || '-'} · 테마 {letter.emailTheme === 'pink' ? '핑크' : '다크'}
                  </div>
                  <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'minmax(170px, 1fr) auto', gap: 8, maxWidth: 460 }}>
                    <input
                      style={{ ...inputStyle, minHeight: 42, padding: '10px 12px' }}
                      type="email"
                      aria-label="발송 이메일"
                      value={deliveryEmailDrafts[letter.id] || ''}
                      placeholder={deliveryEmail || '발송 이메일'}
                      onChange={e => setDeliveryEmailDrafts(prev => ({ ...prev, [letter.id]: e.target.value }))}
                    />
                    <button
                      type="button"
                      style={{ ...buttonStyle, whiteSpace: 'nowrap' }}
                      disabled={savingThisEmail || sendingThisLetter}
                      onClick={() => updateLetterDeliveryEmail(letter)}
                    >
                      {savingThisEmail ? '저장 중...' : '이메일 저장'}
                    </button>
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
                  disabled={busyId === `letter-${letter.id}` || sendingThisLetter || savingThisEmail}
                  onClick={() => updateLetterDate(letter)}
                >
                  {busyId === `letter-${letter.id}` ? '수정 중...' : '날짜 저장'}
                </button>
                <button
                  style={{ ...buttonStyle, opacity: canSend ? 1 : 0.45 }}
                  disabled={!canSend || sendingThisLetter || busyId === `letter-${letter.id}` || savingThisEmail}
                  onClick={() => sendAdminLetter(letter)}
                >
                  {sendingThisLetter ? '발송 중...' : (status.key === 'scheduled' ? '바로 발송' : status.label)}
                </button>
              </div>
              );
            })
          )}
        </section>
      </div>

      <AnimatePresence>
        {selectedPublicLetter && (
          <motion.div
            className="modal-backdrop"
            style={{ zIndex: 120, padding: 18 }}
            onClick={() => setSelectedPublicLetter(null)}
            {...modalBackdropMotion}
          >
            <motion.section
              className="modal-panel"
              style={{
                width: 'min(560px, calc(100vw - 36px))',
                maxHeight: 'calc(100dvh - 36px)',
                overflow: 'auto',
                padding: 24,
                background: 'rgba(22,22,27,0.96)',
                color: '#fff3df',
              }}
              onClick={event => event.stopPropagation()}
              {...modalPanelMotion}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'flex-start', marginBottom: 18 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 7 }}>
                    <strong style={{ fontWeight: 500, fontSize: 18 }}>{selectedPublicLetter.nickname}</strong>
                    <span style={{ color: selectedPublicLetter.visible ? '#8fd19e' : '#ff9b9b', fontSize: 12 }}>
                      {selectedPublicLetter.visible ? '공개' : '숨기기'}
                    </span>
                    <span style={{ color: 'rgba(255,252,223,0.45)', fontSize: 12 }}>
                      {selectedPublicLetter.type === 'draw' ? '그림' : selectedPublicLetter.type === 'photo' ? '사진' : '텍스트'}
                    </span>
                    <span style={{ color: '#ffe8c4', fontSize: 12 }}>열린 편지 ID {selectedPublicLetter.id}</span>
                  </div>
                  <div style={{ color: 'rgba(255,252,223,0.46)', fontSize: 13 }}>
                    {formatDate(selectedPublicLetter.createdAt)}
                  </div>
                </div>
                <button type="button" style={buttonStyle} onClick={() => setSelectedPublicLetter(null)}>
                  닫기
                </button>
              </div>

              {selectedPublicLetter.imageUrl && (
                <img
                  src={selectedPublicLetter.imageUrl}
                  alt=""
                  style={{
                    width: '100%',
                    maxHeight: 420,
                    objectFit: 'contain',
                    borderRadius: 8,
                    border: '1px solid rgba(255,255,255,0.12)',
                    background: 'rgba(255,255,255,0.04)',
                    marginBottom: 18,
                  }}
                />
              )}

              <div style={{
                minHeight: 92,
                padding: 16,
                borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.045)',
                color: 'rgba(255,252,223,0.82)',
                whiteSpace: 'pre-wrap',
                lineHeight: 1.65,
                overflowWrap: 'anywhere',
              }}>
                {selectedPublicLetter.content || (selectedPublicLetter.type === 'draw' ? '그림 편지' : '사진 편지')}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap', marginTop: 18 }}>
                <button
                  type="button"
                  style={buttonStyle}
                  disabled={busyId === `public-letter-${selectedPublicLetter.id}` || busyId === `delete-public-letter-${selectedPublicLetter.id}`}
                  onClick={() => togglePublicLetterVisible(selectedPublicLetter)}
                >
                  {selectedPublicLetter.visible ? '숨기기' : '다시 공개'}
                </button>
                <button
                  type="button"
                  style={dangerButtonStyle}
                  disabled={busyId === `public-letter-${selectedPublicLetter.id}` || busyId === `delete-public-letter-${selectedPublicLetter.id}`}
                  onClick={() => deletePublicLetter(selectedPublicLetter)}
                >
                  삭제
                </button>
              </div>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
