import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { fetchJson } from '../utils/api.js';
import { listItemMotion, motionEase, pageMotion } from '../utils/motion.js';

const ease = motionEase;

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
      const data = await fetchJson('/developer/support-messages');
      setMessages(Array.isArray(data) ? data : []);
    } catch (err) {
      setMessage(err.message || '도착한 응원을 불러오지 못했습니다.');
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
        setMessage('서버와 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.');
      } finally {
        setChecking(false);
      }
    }
    checkDeveloper();
  }, []);

  return (
    <motion.main
      className="develop-page"
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
          <div className="develop-empty">도착한 응원을 확인하고 있습니다...</div>
        ) : messages.length === 0 ? (
          <div className="develop-empty">아직 도착한 응원이 없습니다.</div>
        ) : (
          <div className="develop-list">
            {messages.map((item, index) => (
              <motion.article key={item.id} className="develop-card" {...listItemMotion(index)}>
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
              </motion.article>
            ))}
          </div>
        )}
      </section>
    </motion.main>
  );
}
