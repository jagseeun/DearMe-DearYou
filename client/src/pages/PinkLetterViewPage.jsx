import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { formatDate, daysUntil } from '../utils/dates.js';

const ease = [0.22, 1, 0.36, 1];

const typeStyles = {
  text: { label: '텍스트', icon: '✉', bg: 'rgba(110,45,45,0.08)', color: '#7a3535', border: 'rgba(110,45,45,0.18)' },
  video: { label: '영상', icon: '▶', bg: 'rgba(55,80,170,0.08)', color: '#4a5f9a', border: 'rgba(55,80,170,0.16)' },
  draw: { label: '그림', icon: '🎨', bg: 'rgba(170,85,25,0.08)', color: '#9a5729', border: 'rgba(170,85,25,0.16)' },
};

function getType(letter) {
  return typeStyles[letter.type] || typeStyles.text;
}

function recipientText(letter) {
  if (letter.recipientName) return `${letter.recipientName}에게`;
  if (letter.recipientEmail) return `${letter.recipientEmail}에게`;
  return '나에게';
}

function PinkLetterLogo({ className = '' }) {
  return (
    <div className={`letter-list-logo ${className}`.trim()}>
      <span style={{ color: '#fff1e8', filter: 'drop-shadow(0 0 18px rgba(218,157,176,0.34)) drop-shadow(0 2px 8px rgba(24,13,28,0.42))' }}>Dear Me</span>
      <span style={{ color: 'rgba(241,205,213,0.62)', margin: '0 10px' }}>;</span>
      <span style={{ color: '#e0a4b0', filter: 'drop-shadow(0 0 14px rgba(160,93,122,0.32)) drop-shadow(0 2px 8px rgba(24,13,28,0.38))' }}>Dear You</span>
    </div>
  );
}

export default function PinkLetterViewPage() {
  const navigate = useNavigate();
  const [letters, setLetters] = useState([]);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendMsg, setSendMsg] = useState('');

  async function triggerSend() {
    setSending(true);
    setSendMsg('');
    try {
      const res = await fetch('/trigger-send', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || '발송 실패');
      setSendMsg(data.sent ? '이메일 발송 완료' : '발송할 편지가 없습니다');
      setTimeout(() => setSendMsg(''), 3000);
    } catch (err) {
      setSendMsg(err.message || '발송 실패');
    } finally {
      setSending(false);
    }
  }

  useEffect(() => {
    fetch('/get-user-info')
      .then(r => r.json())
      .then(d => { if (d.name) setName(d.name); })
      .catch(() => {});

    fetch('/my-letters')
      .then(r => { if (r.status === 401) { navigate('/letter-login'); return null; } return r.json(); })
      .then(data => {
        if (data) setLetters(data.filter(letter => letter.type !== 'call'));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [navigate]);

  const now = new Date();

  return (
    <motion.div
      className="letter-list-page pink-letter-list-page"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.3 } }}
      transition={{ duration: 0.6, ease }}
    >
      <PinkLetterLogo className="pink-letter-fixed-logo" />

      <div className="letter-list-shell compact">
        {loading ? (
          <div className="letter-empty">불러오는 중...</div>
        ) : letters.length === 0 ? (
          <div className="letter-empty">
            <strong>아직 개봉할 편지가 없어요.</strong>
            <span>개봉일이 지나면 이곳에서 읽을 수 있어요.</span>
          </div>
        ) : (
          <>
          <motion.div
            className="letter-list-action-row"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <button type="button" className="soft-button pink-send-button" onClick={triggerSend} disabled={sending}>
              {sending ? '발송 중...' : '이메일 지금 받기'}
            </button>
            {sendMsg && <span style={{ fontSize: 13, color: 'rgba(255,232,226,0.82)' }}>{sendMsg}</span>}
          </motion.div>

          <div className="letter-scroll letters-scroll">
            {letters.map((letter, i) => {
              const unlocked = new Date(letter.openDate) <= now;
              const type = getType(letter);
              const recipient = recipientText(letter);

              return (
                <motion.article
                  key={letter.id}
                  className={`letter-card ${unlocked ? 'is-open' : 'is-locked'}`}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: Math.min(i, 8) * 0.035, ease }}
                  whileHover={unlocked ? { translateY: -2, boxShadow: '0 14px 38px rgba(130,70,70,0.12)' } : {}}
                >
                  <div className="letter-card-inner">
                    <div className="letter-icon" aria-hidden="true">{unlocked ? type.icon : '🔒'}</div>

                    <div
                      className={unlocked ? 'letter-card-copy letter-card-click' : 'letter-card-copy'}
                      role={unlocked ? 'button' : undefined}
                      tabIndex={unlocked ? 0 : undefined}
                      onClick={() => unlocked && navigate('/view-letter', { state: { letter, name, returnTo: '/pink-letters' } })}
                      onKeyDown={e => {
                        if (unlocked && e.key === 'Enter') {
                          navigate('/view-letter', { state: { letter, name, returnTo: '/pink-letters' } });
                        }
                      }}
                    >
                      <div className="letter-card-title-line">
                        <span className="letter-card-title">
                          {unlocked ? `${formatDate(letter.openDate)} 개봉` : `${formatDate(letter.openDate)} 개봉 예정`}
                        </span>
                      </div>
                      <div className="letter-card-info-line">
                        <span
                          className="letter-badge"
                          style={{ background: type.bg, color: type.color, borderColor: type.border }}
                        >
                          {type.label}
                        </span>
                        <span className="letter-recipient">{recipient}</span>
                      </div>
                    </div>

                    <div className="letter-card-actions">
                      {unlocked ? (
                        <button
                          type="button"
                          className="letter-open-arrow"
                          onClick={() => navigate('/view-letter', { state: { letter, name, returnTo: '/pink-letters' } })}
                          aria-label="편지 열기"
                        >
                          ▶
                        </button>
                      ) : (
                        <span className="letter-lock-pill">D-{daysUntil(letter.openDate)}</span>
                      )}
                    </div>
                  </div>
                </motion.article>
              );
            })}
          </div>
          </>
        )}
      </div>

      {!loading && (
        <motion.button
          type="button"
          className="letter-back-floating pink-letter-exit"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          onClick={() => navigate('/')}
        >
          ← 나가기
        </motion.button>
      )}
    </motion.div>
  );
}
