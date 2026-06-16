import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import PasswordField from '../components/PasswordField.jsx';
import NoticeModal from '../components/NoticeModal.jsx';
import { useAuth } from '../auth.jsx';
import { motionEase, pageMotion } from '../utils/motion.js';

const ease = motionEase;
const PASSWORD_MAX_LENGTH = 128;

export default function MyPage() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [nextPassword, setNextPassword] = useState('');
  const [nextPasswordConfirm, setNextPasswordConfirm] = useState('');
  const [notice, setNotice] = useState(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      try {
        const response = await fetch('/get-user-info', { cache: 'no-store' });
        if (response.status === 401) {
          navigate('/login', { replace: true });
          return;
        }
        const data = await response.json();
        if (cancelled) return;
        setName(data?.name || '');
        setEmail(data?.email || '');
      } catch {
        if (!cancelled) {
          setNotice({ title: '불러오지 못했습니다', message: '편지 계정 정보를 불러오지 못했습니다.' });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  async function saveProfile(event) {
    event.preventDefault();
    const nextName = name.trim();
    const nextEmail = email.trim().toLowerCase();

    if (!nextName) {
      setNotice({ title: '이름을 확인해 주세요', message: '이름을 입력해 주세요.' });
      return;
    }
    if (nextName.length > 10) {
      setNotice({ title: '이름을 확인해 주세요', message: '이름은 10자를 넘을 수 없습니다.' });
      return;
    }
    if (!nextEmail) {
      setNotice({ title: '이메일을 확인해 주세요', message: '이메일을 입력해 주세요.' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
      setNotice({ title: '이메일을 확인해 주세요', message: '이메일 형식이 올바르지 않습니다.' });
      return;
    }

    setProfileSaving(true);
    try {
      const response = await fetch('/update-profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nextName, email: nextEmail }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || '프로필을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.');
      setName(data.name || nextName);
      setEmail(data.email ?? nextEmail);
      await refresh();
      setNotice({ title: '프로필을 저장했습니다', message: '편지함에서 사용할 이름과 편지 받을 이메일을 정리했습니다.' });
    } catch (error) {
      setNotice({ title: '저장하지 못했습니다', message: error.message || '프로필을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.' });
    } finally {
      setProfileSaving(false);
    }
  }

  async function changePassword(event) {
    event.preventDefault();

    if (!currentPassword || !nextPassword || !nextPasswordConfirm) {
      setNotice({ title: '비밀번호를 확인해 주세요', message: '현재 비밀번호와 새 비밀번호를 모두 입력해 주세요.' });
      return;
    }
    if (nextPassword.length < 6) {
      setNotice({ title: '비밀번호를 확인해 주세요', message: '새 비밀번호는 6자 이상으로 입력해 주세요.' });
      return;
    }
    if (nextPassword.length > PASSWORD_MAX_LENGTH) {
      setNotice({ title: '비밀번호를 확인해 주세요', message: `새 비밀번호는 ${PASSWORD_MAX_LENGTH}자를 넘을 수 없습니다.` });
      return;
    }
    if (nextPassword !== nextPasswordConfirm) {
      setNotice({ title: '비밀번호를 확인해 주세요', message: '새 비밀번호가 서로 일치하지 않습니다.' });
      return;
    }
    if (currentPassword === nextPassword) {
      setNotice({ title: '비밀번호를 확인해 주세요', message: '새 비밀번호는 현재 비밀번호와 다르게 입력해 주세요.' });
      return;
    }

    setPasswordSaving(true);
    try {
      const response = await fetch('/change-password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, nextPassword, nextPasswordConfirm }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || '비밀번호를 변경하지 못했습니다. 잠시 후 다시 시도해 주세요.');
      setCurrentPassword('');
      setNextPassword('');
      setNextPasswordConfirm('');
      setNotice({ title: '비밀번호를 변경했습니다', message: '비밀번호가 변경되었습니다.' });
    } catch (error) {
      setNotice({ title: '변경하지 못했습니다', message: error.message || '비밀번호를 변경하지 못했습니다. 잠시 후 다시 시도해 주세요.' });
    } finally {
      setPasswordSaving(false);
    }
  }

  function confirmLogout() {
    window.location.href = '/logout';
  }

  function goBack() {
    if (window.history.state?.idx > 0) {
      navigate(-1);
      return;
    }
    navigate('/hello');
  }

  return (
    <motion.main
      className="mypage-page"
      {...pageMotion}
    >
      <motion.div
        className="top-title"
        initial={false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease }}
      >
        <span className="to">Dear Me</span>
        <span className="semicolon">;</span>
        <span className="from">Dear You</span>
      </motion.div>

      <div className="mypage-top-actions">
        <button type="button" onClick={() => navigate('/letters')}>내 편지함</button>
        <button type="button" onClick={goBack}>돌아가기</button>
        <button type="button" className="mypage-logout-button" onClick={() => setShowLogoutModal(true)}>로그아웃</button>
      </div>

      <section className="mypage-shell">
        <motion.header
          className="mypage-header"
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease }}
        >
          <span>MY PAGE</span>
          <h1>내 편지 계정</h1>
          <p>{loading ? '편지 계정 정보를 불러오는 중입니다.' : `${name || '사용자'}님의 편지 계정을 정리하실 수 있습니다.`}</p>
        </motion.header>

        <div className="mypage-grid">
          <motion.form
            className="mypage-panel"
            onSubmit={saveProfile}
            initial={false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.08, ease }}
          >
            <div className="mypage-panel-heading">
              <span>PROFILE</span>
              <h2>이름과 편지 받을 이메일</h2>
            </div>
            <label>
              <span>이름</span>
              <input
                type="text"
                value={name}
                maxLength={10}
                onChange={event => setName(event.target.value)}
                placeholder="이름"
                disabled={loading || profileSaving}
              />
            </label>
            <label>
              <span>이메일</span>
              <input
                type="email"
                value={email}
                onChange={event => setEmail(event.target.value)}
                placeholder="이메일"
                required
                disabled={loading || profileSaving}
              />
            </label>
            <button type="submit" disabled={loading || profileSaving}>
              {profileSaving ? '저장하고 있습니다...' : '프로필 저장하기'}
            </button>
          </motion.form>

          <motion.form
            className="mypage-panel"
            onSubmit={changePassword}
            initial={false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.14, ease }}
          >
            <div className="mypage-panel-heading">
              <span>SECURITY</span>
              <h2>비밀번호 변경</h2>
            </div>
            <label>
              <span>현재 비밀번호</span>
              <PasswordField
                wrapperClassName="password-field mypage-password-field"
                className="mypage-password-input"
                value={currentPassword}
                maxLength={PASSWORD_MAX_LENGTH}
                onChange={event => setCurrentPassword(event.target.value)}
                placeholder="현재 비밀번호"
                disabled={passwordSaving}
              />
            </label>
            <label>
              <span>새 비밀번호</span>
              <PasswordField
                wrapperClassName="password-field mypage-password-field"
                className="mypage-password-input"
                value={nextPassword}
                maxLength={PASSWORD_MAX_LENGTH}
                onChange={event => setNextPassword(event.target.value)}
                placeholder="새 비밀번호"
                disabled={passwordSaving}
              />
            </label>
            <label>
              <span>새 비밀번호를 확인해 주세요</span>
              <PasswordField
                wrapperClassName="password-field mypage-password-field"
                className="mypage-password-input"
                value={nextPasswordConfirm}
                maxLength={PASSWORD_MAX_LENGTH}
                onChange={event => setNextPasswordConfirm(event.target.value)}
                placeholder="새 비밀번호를 확인해 주세요"
                disabled={passwordSaving}
              />
            </label>
            <button type="submit" disabled={passwordSaving}>
              {passwordSaving ? '변경하고 있습니다...' : '비밀번호 변경'}
            </button>
          </motion.form>
        </div>

        <button
          type="button"
          className="mypage-support-link"
          onClick={() => navigate('/support', { state: { from: '/mypage' } })}
        >
          프로젝트에 응원 메시지 남기기
        </button>
      </section>

      <NoticeModal
        open={Boolean(notice)}
        title={notice?.title}
        message={notice?.message}
        onClose={() => setNotice(null)}
        variant="brown"
      />
      <NoticeModal
        open={showLogoutModal}
        title="로그아웃하시겠습니까?"
        message="지금 계정에서 나가도 남겨 두신 편지는 그대로 보관됩니다."
        cancelLabel="머무르기"
        confirmLabel="로그아웃"
        onClose={() => setShowLogoutModal(false)}
        onConfirm={confirmLogout}
        variant="logout"
      />
    </motion.main>
  );
}
