import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { fetchJson } from '../utils/api.js';

const ease = [0.22, 1, 0.36, 1];
const SUPPORT_MAX_LENGTH = 200;

export default function SupportPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    fetch('/get-user-info')
      .then(response => (response.ok ? response.json() : null))
      .then(data => {
        if (data?.name) setName(data.name);
      })
      .catch(() => {});
  }, []);

  async function submitSupport(event) {
    event.preventDefault();
    const cleanName = name.trim();
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
        body: JSON.stringify({ name: cleanName, content: cleanContent }),
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
          <span>Dear Me ; Dear You에게</span>
          <strong>작은 응원 남기기</strong>
        </div>

        {sent ? (
          <motion.div
            className="support-complete"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease }}
          >
            <strong>마음이 도착했어요</strong>
            <span>남겨준 말은 조용히 잘 간직할게요.</span>
            <div className="support-actions">
              <button type="button" onClick={() => setSent(false)}>하나 더 쓰기</button>
              <button type="button" onClick={() => navigate('/hello')}>돌아가기</button>
            </div>
          </motion.div>
        ) : (
          <motion.form
            className="support-form"
            onSubmit={submitSupport}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease }}
          >
            <label className="support-name-field">
              <span>이름</span>
              <input
                value={name}
                onChange={event => setName(event.target.value.slice(0, 20))}
                placeholder="이름을 남겨주세요"
                maxLength={20}
              />
            </label>

            <label className="support-paper">
              <textarea
                value={content}
                onChange={event => setContent(event.target.value.slice(0, SUPPORT_MAX_LENGTH))}
                placeholder="이 공간에 남기고 싶은 마음을 적어주세요"
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
