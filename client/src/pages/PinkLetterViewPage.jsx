import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { formatDate, daysUntil } from '../utils/dates.js';
import NoticeModal from '../components/NoticeModal.jsx';
import { listItemMotion, motionEase, pageMotion, panelMotion } from '../utils/motion.js';
import { clearLetterAuth } from '../auth.jsx';

const ease = motionEase;

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
  const [logoutConfirm, setLogoutConfirm] = useState(false);

  async function triggerSend() {
    setSending(true);
    setSendMsg('');
    try {
      const res = await fetch('/trigger-send', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || '발송하지 못했습니다');
      setSendMsg(data.sent ? '이메일 발송을 요청했습니다.' : '보낼 편지가 없습니다.');
      setTimeout(() => setSendMsg(''), 3000);
    } catch (err) {
      setSendMsg(err.message || '발송하지 못했습니다');
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

  function openLetter(letter) {
    navigate('/view-letter', { state: { letter, name, returnTo: '/pink-letters' } });
  }

  function goHome() {
    navigate('/hello');
  }

  function logoutLetters() {
    setLogoutConfirm(true);
  }

  function confirmLogoutLetters() {
    clearLetterAuth();
    window.location.assign('/logout');
  }

  function handleCardClick(letter, unlocked, event) {
    if (!unlocked || event.target.closest('button')) return;
    openLetter(letter);
  }

  function handleCardKeyDown(letter, unlocked, event) {
    if (!unlocked || event.target.closest('button')) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    openLetter(letter);
  }

  return (
    <motion.div
      className="letter-list-page pink-letter-list-page"
      {...pageMotion}
    >
      <PinkLetterLogo className="pink-letter-fixed-logo" />

      <div className="letter-list-shell compact">
        {loading ? (
          <div className="letter-empty">불러오는 중...</div>
        ) : letters.length === 0 ? (
          <div className="letter-empty">
            <strong>아직 열람할 편지가 없습니다.</strong>
            <span>약속한 날짜가 지나면 이곳에서 천천히 읽으실 수 있습니다.</span>
          </div>
        ) : (
          <>
          <motion.div
            className="letter-list-action-row"
            {...panelMotion}
          >
            <button type="button" className="soft-button pink-send-button" onClick={triggerSend} disabled={sending}>
              {sending ? '발송 중...' : '메일 받기'}
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
                  role={unlocked ? 'button' : undefined}
                  tabIndex={unlocked ? 0 : undefined}
                  onClick={event => handleCardClick(letter, unlocked, event)}
                  onKeyDown={event => handleCardKeyDown(letter, unlocked, event)}
                  {...listItemMotion(i)}
                  whileHover={unlocked ? { boxShadow: '0 14px 38px rgba(130,70,70,0.12)' } : {}}
                >
                  <div className="letter-card-inner">
                    <div className="letter-icon" aria-hidden="true">{unlocked ? type.icon : '🔒'}</div>

                    <div
                      className={unlocked ? 'letter-card-copy letter-card-click' : 'letter-card-copy'}
                    >
                      <div className="letter-card-title-line">
                        <span className="letter-card-title">
                          {unlocked ? `${formatDate(letter.openDate)}부터 열람 가능` : `${formatDate(letter.openDate)}부터 열람 가능 예정`}
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
                          onClick={event => { event.stopPropagation(); openLetter(letter); }}
                          aria-label="편지 열람하기"
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

      {!loading && !logoutConfirm && (
        <motion.button
          type="button"
          className="open-mailbox-floating-button"
          aria-label="열린 편지함으로 가기"
          title="열린 편지함으로 가기"
          onClick={() => navigate('/open-mailbox')}
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55, duration: 0.45, ease }}
        >
          💌
        </motion.button>
      )}

      {!loading && (
        <motion.div
          className="letters-main-exit-actions pink-letter-exit-actions"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.52, delay: 0.48, ease }}
        >
          <motion.button
            type="button"
            className="letter-back-floating pink-letter-exit"
            onClick={goHome}
          >
            홈으로
          </motion.button>
          <motion.button
            type="button"
            className="letter-back-floating pink-letter-exit letters-main-logout"
            onClick={logoutLetters}
          >
            로그아웃
          </motion.button>
        </motion.div>
      )}
      <NoticeModal
        open={logoutConfirm}
        title="로그아웃하시겠습니까?"
        message="지금 계정에서 나가도 남겨 두신 편지는 그대로 보관됩니다."
        cancelLabel="취소"
        confirmLabel="로그아웃"
        onClose={() => setLogoutConfirm(false)}
        onConfirm={confirmLogoutLetters}
        variant="logout"
      />
    </motion.div>
  );
}
