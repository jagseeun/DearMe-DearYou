import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { fetchJson } from '../utils/api.js';

const ease = [0.22, 1, 0.36, 1];
const SUPPORT_MAX_LENGTH = 200;

export default function SupportPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [content, setContent] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [sent, setSent] = useState(false);
  const returnTo = location.state?.from || '/hello';

  useEffect(() => {
    if (!sent) return undefined;
    const timer = setTimeout(() => navigate(returnTo, { replace: true }), 3000);
    return () => clearTimeout(timer);
  }, [navigate, returnTo, sent]);

  async function submitSupport(event) {
    event.preventDefault();
    const cleanContent = content.trim();

    if (!cleanContent) {
      setMessage('남기고 싶은 마음을 적어주세요.');
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
      setSent(true);
      setContent('');
    } catch (err) {
      setMessage(err.message || '마음을 남기지 못했습니다.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <motion.main
      className="support-page"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.25 } }}
    >
      <motion.div
        className="top-title"
        initial={{ opacity: 0, y: -18 }}
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
          <strong>작은 마음 전하기</strong>
        </div>

        {sent ? (
          <motion.div
            className="support-complete"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease }}
          >
            <strong>개발자에게 마음이 전달되었어요</strong>
            <span>작성해주셔서 감사합니다.</span>
            <small>잠시 후 돌아갑니다.</small>
            <button type="button" onClick={() => navigate(returnTo, { replace: true })}>바로 돌아가기</button>
          </motion.div>
        ) : (
          <motion.form
            className="support-form"
            onSubmit={submitSupport}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease }}
          >
            <label className="support-paper">
              <textarea
                value={content}
                onChange={event => setContent(event.target.value.slice(0, SUPPORT_MAX_LENGTH))}
                placeholder="고마웠던 순간이나 남기고 싶은 말을 적어주세요"
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
        )}
      </section>
    </motion.main>
  );
}
