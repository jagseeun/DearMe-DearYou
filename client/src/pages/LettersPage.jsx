import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
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
  if (letter.recipientName) return letter.recipientName;
  if (letter.recipientEmail) return letter.recipientEmail;
  return '';
}

export default function LettersPage() {
  const navigate = useNavigate();
  const [letters, setLetters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => {
    fetch('/get-user-info')
      .then(r => { if (r.status === 401) { navigate('/login'); return null; } return r.json(); })
      .then(d => { if (d?.name) setName(d.name); })
      .catch(() => {});

    fetch('/my-letters')
      .then(r => { if (r.status === 401) { navigate('/login'); return null; } return r.json(); })
      .then(data => {
        if (data) setLetters(data.filter(letter => letter.type !== 'call'));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [navigate]);

  const now = new Date();
  const unlockedCount = letters.filter(l => new Date(l.openDate) <= now).length;
  const lockedCount = letters.length - unlockedCount;

  function openLetter(letter) {
    navigate('/view-letter', { state: { letter, name, returnTo: '/letters' } });
  }

  async function deleteLetter(id) {
    try {
      const res = await fetch(`/delete-letter/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setLetters(prev => prev.filter(l => l.id !== id));
      } else {
        const data = await res.json();
        alert(data.message || '삭제에 실패했습니다.');
      }
    } catch {
      alert('서버 연결 오류');
    }
    setDeleteConfirm(null);
  }

  return (
    <motion.div
      className="letter-list-page pink-letter-list-page"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.3 } }}
      transition={{ duration: 0.6, ease }}
    >
      <motion.div
        className="top-title"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.2, ease }}
      >
        <span style={{ color: '#fff1e8', filter: 'drop-shadow(0 0 18px rgba(218,157,176,0.34)) drop-shadow(0 2px 8px rgba(24,13,28,0.42))' }}>Dear Me</span>
        <span style={{ color: 'rgba(241,205,213,0.62)', margin: '0 10px' }}>;</span>
        <span style={{ color: '#e0a4b0', filter: 'drop-shadow(0 0 14px rgba(160,93,122,0.32)) drop-shadow(0 2px 8px rgba(24,13,28,0.38))' }}>Dear You</span>
      </motion.div>

      <div className="letter-list-shell">
        <motion.header
          className="letter-list-header"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1, ease }}
        >
          <div>
            <div className="letter-list-kicker">MY LETTERS</div>
            <h2 className="letter-list-title">나의 편지</h2>
          </div>
          {!loading && letters.length > 0 && (
            <div className="letter-list-stats" aria-label="편지 통계">
              <div className="letter-list-stat">
                <strong>{unlockedCount}</strong>
                <span>개봉됨</span>
              </div>
              <div className="letter-list-stat-divider" />
              <div className="letter-list-stat locked">
                <strong>{lockedCount}</strong>
                <span>잠김</span>
              </div>
            </div>
          )}
        </motion.header>

        {loading ? (
          <div className="letter-empty">불러오는 중...</div>
        ) : letters.length === 0 ? (
          <motion.div
            className="letter-empty"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <strong>아직 작성한 편지가 없어요.</strong>
            <span>미래의 나에게 첫 편지를 남겨보세요.</span>
            <button type="button" className="soft-button" onClick={() => navigate('/write')}>첫 편지 쓰기</button>
          </motion.div>
        ) : (
          <div className="letter-scroll letters-scroll">
            {letters.map((letter, i) => {
              const unlocked = new Date(letter.openDate) <= now;
              const days = daysUntil(letter.openDate);
              const type = getType(letter);
              const recipient = recipientText(letter);

              return (
                <motion.article
                  key={letter.id}
                  className={`letter-card ${unlocked ? 'is-open' : 'is-locked'}`}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: i * 0.06, ease }}
                  whileHover={unlocked ? { translateY: -2, boxShadow: '0 14px 38px rgba(130,70,70,0.12)' } : {}}
                >
                  <div className="letter-card-inner">
                    <div className="letter-icon" aria-hidden="true">{unlocked ? type.icon : '🔒'}</div>

                    <div
                      className={unlocked ? 'letter-card-copy letter-card-click' : 'letter-card-copy'}
                      role={unlocked ? 'button' : undefined}
                      tabIndex={unlocked ? 0 : undefined}
                      onClick={() => unlocked && openLetter(letter)}
                      onKeyDown={e => { if (unlocked && e.key === 'Enter') openLetter(letter); }}
                    >
                      <div className="letter-card-title-line">
                        <span className="letter-card-title">{formatDate(letter.createdAt)} 작성</span>
                      </div>
                      <div className="letter-card-info-line">
                        <span
                          className="letter-badge"
                          style={{ background: type.bg, color: type.color, borderColor: type.border }}
                        >
                          {type.label}
                        </span>
                        {recipient && <span className="letter-recipient">→ {recipient}</span>}
                        <span className="letter-date-line">
                          {unlocked ? `✓ ${formatDate(letter.openDate)} 개봉` : `${formatDate(letter.openDate)} 개봉 예정`}
                        </span>
                      </div>
                    </div>

                    <div className="letter-card-actions">
                      {unlocked ? (
                        <button type="button" className="letter-open-arrow" onClick={() => openLetter(letter)} aria-label="편지 열기">▶</button>
                      ) : (
                        <>
                          <span className="letter-lock-pill">D-{days}</span>
                          <button
                            type="button"
                            className="letter-delete-button"
                            onClick={() => setDeleteConfirm(letter.id)}
                            aria-label="편지 삭제"
                          >
                            ×
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </motion.article>
              );
            })}
          </div>
        )}
      </div>

      <motion.button
        type="button"
        className="letter-back-floating"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        onClick={() => navigate('/')}
        whileHover={{ translateY: -1, boxShadow: '0 6px 24px rgba(150,80,80,0.12)' }}
      >
        ← 돌아가기
      </motion.button>

      <AnimatePresence>
        {deleteConfirm !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="modal-backdrop"
            style={{ background: 'rgba(120,70,70,0.24)' }}
          >
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.96 }}
              transition={{ duration: 0.35, ease }}
              className="modal-panel"
              style={{ background: 'rgba(255,248,246,0.94)', color: '#4c2929' }}
            >
              <div style={{ fontSize: 25, fontWeight: 300, textAlign: 'center' }}>편지를 삭제할까요?</div>
              <div style={{ color: 'rgba(110,60,60,0.62)', fontSize: 14, textAlign: 'center', lineHeight: 1.7 }}>
                아직 개봉하지 않은 편지만 삭제할 수 있어요.
              </div>
              <div className="modal-actions">
                <button type="button" className="soft-button" onClick={() => setDeleteConfirm(null)}>취소</button>
                <button
                  type="button"
                  className="soft-button"
                  onClick={() => deleteLetter(deleteConfirm)}
                  style={{ background: 'linear-gradient(135deg,#b95555,#8a3030)', color: '#fff', border: 'none' }}
                >
                  삭제
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
