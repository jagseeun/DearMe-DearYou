import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { fetchJson } from '../utils/api.js';
import NoticeModal from '../components/NoticeModal.jsx';
import { motionEase, pageMotion } from '../utils/motion.js';

const ease = motionEase;
const SUPPORT_MAX_LENGTH = 200;

export default function SupportPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [content, setContent] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);
  const returnTo = location.state?.from || '/';

  function closeNotice() {
    const afterClose = notice?.afterClose;
    setNotice(null);
    afterClose?.();
  }

  async function submitSupport(event) {
    event.preventDefault();
    const cleanContent = content.trim();

    if (!cleanContent) {
      setMessage('전하고 싶은 내용을 입력해 주세요.');
      return;
    }
    if (cleanContent.length > SUPPORT_MAX_LENGTH) {
      setMessage(`${SUPPORT_MAX_LENGTH}자 안으로 적어주세요.`);
      return;
    }

    setSaving(true);
    setMessage('');
    try {
      await fetchJson('/support-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: cleanContent }),
      });
      setContent('');
      setNotice({
        title: '전송 완료',
        message: '개발자에게 응원 메시지가 전달되었습니다.',
        afterClose: () => navigate(returnTo, { replace: true }),
      });
    } catch (err) {
      setNotice({ title: '전송 실패', message: err.message || '마음을 남기지 못했습니다.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <motion.main
      className="support-page"
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

      <button type="button" className="back-link support-back" onClick={() => navigate(-1)}>
        ← 돌아가기
      </button>

      <section className="support-compose">
        <div className="support-heading">
          <span>Dear Me ; Dear You를 만든 사람에게</span>
          <strong>응원 메시지 전하기</strong>
        </div>

        <motion.form
          className="support-form"
          onSubmit={submitSupport}
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease }}
        >
          <label className="support-paper">
            <textarea
              value={content}
              onChange={event => setContent(event.target.value.slice(0, SUPPORT_MAX_LENGTH))}
              placeholder="전하고 싶은 응원이나 감사의 말을 기록해 주세요"
              maxLength={SUPPORT_MAX_LENGTH}
            />
          </label>

          <div className="support-bottom-row">
            <span className={content.length >= SUPPORT_MAX_LENGTH ? 'is-limit' : ''}>
              {content.length}/{SUPPORT_MAX_LENGTH}
            </span>
            {message && <em>{message}</em>}
          </div>

          <button type="submit" className="support-submit" disabled={saving}>
            {saving ? '보내는 중...' : '보내기'}
          </button>
        </motion.form>
      </section>
      <NoticeModal
        open={Boolean(notice)}
        title={notice?.title}
        message={notice?.message}
        onClose={closeNotice}
        variant="brown"
      />
    </motion.main>
  );
}
