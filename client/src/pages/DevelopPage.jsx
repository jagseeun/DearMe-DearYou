import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { fetchJson } from '../utils/api.js';

const ease = [0.22, 1, 0.36, 1];

function formatDate(value) {
  return new Date(value).toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function DevelopPage() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function loadMessages() {
    setLoading(true);
    setMessage('');
    try {
      setMessages(await fetchJson('/developer/support-messages'));
    } catch (err) {
      setMessage(err.message || '도착한 마음을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    async function checkDeveloper() {
      try {
        const response = await fetch('/get-user-info');
        if (response.status === 401) {
          navigate('/login', { replace: true });
          return;
        }
        const user = await response.json();
        if (!user.isDeveloper) {
          navigate('/', { replace: true });
          return;
        }
        await loadMessages();
      } catch {
        setMessage('서버 연결을 확인해주세요.');
      } finally {
        setChecking(false);
      }
    }
    checkDeveloper();
  }, []);

  return (
    <motion.main
      className="develop-page"
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

      <button type="button" className="back-link develop-back" onClick={() => navigate('/hello')}>
        ← 돌아가기
      </button>

      <section className="develop-panel">
        <div className="develop-header">
          <div>
            <span>jagseeun1</span>
            <strong>도착한 응원</strong>
          </div>
          <button type="button" onClick={loadMessages} disabled={loading || checking}>
            {loading ? '불러오는 중...' : '새로고침'}
          </button>
        </div>

        {message && <div className="develop-message">{message}</div>}

        {checking ? (
          <div className="develop-empty">확인 중...</div>
        ) : messages.length === 0 ? (
          <div className="develop-empty">아직 도착한 응원이 없어요.</div>
        ) : (
          <div className="develop-list">
            {messages.map(item => (
              <article key={item.id} className="develop-card">
                <div className="develop-card-top">
                  <strong>{item.name || item.userid || '익명'}</strong>
                  <span>{formatDate(item.createdAt)}</span>
                </div>
                <p>{item.content}</p>
                {(item.userid || item.email) && (
                  <small>
                    {item.userid || ''}
                    {item.userid && item.email ? ' · ' : ''}
                    {item.email || ''}
                  </small>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </motion.main>
  );
}
