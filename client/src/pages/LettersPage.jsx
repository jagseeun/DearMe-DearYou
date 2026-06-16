import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDate, daysUntil } from '../utils/dates.js';
import NoticeModal from '../components/NoticeModal.jsx';
import { listItemMotion, modalBackdropMotion, modalPanelMotion, motionEase, pageMotion, panelMotion } from '../utils/motion.js';
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
  if (letter.recipientName) return letter.recipientName;
  if (letter.recipientEmail) return letter.recipientEmail;
  return '';
}

function senderText(letter) {
  return letter.senderName || '누군가';
}

function receivedDateText(letter, unlocked) {
  const date = letter.arrivedAt || letter.sentAt || letter.openDate;
  return unlocked ? `✓ ${formatDate(date)} 도착` : `${formatDate(letter.openDate)} 도착 예정`;
}

function LetterTypeIcon({ type, locked }) {
  if (locked) {
    return (
      <svg className="letter-icon-svg" viewBox="0 0 24 24" aria-hidden="true">
        <rect x="6" y="10" width="12" height="10" rx="2.4" />
        <path d="M8.5 10V7.7a3.5 3.5 0 0 1 7 0V10" />
        <path d="M12 14v2.4" />
      </svg>
    );
  }

  if (type === 'draw') {
    return (
      <svg className="letter-icon-svg" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4.5 16.8c3.5.7 5.8-.1 7-2.5" />
        <path d="M11.4 14.4 18.8 7a2 2 0 0 0-2.8-2.8l-7.4 7.4" />
        <path d="M8.6 11.6 11.4 14.4" />
        <path d="M5.4 18.8c1.7.1 3.2-.3 4.5-1.1" />
      </svg>
    );
  }

  if (type === 'video') {
    return (
      <svg className="letter-icon-svg" viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4" y="6" width="13" height="12" rx="2.5" />
        <path d="m17 10 3.4-2v8L17 14" />
        <path d="m9.5 9.5 4 2.5-4 2.5z" />
      </svg>
    );
  }

  return (
    <svg className="letter-icon-svg" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="6.5" width="16" height="11" rx="2.5" />
      <path d="m5 8 7 5 7-5" />
      <path d="M8 15h8" />
    </svg>
  );
}

export default function LettersPage() {
  const navigate = useNavigate();
  const [letters, setLetters] = useState([]);
  const [receivedLetters, setReceivedLetters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [activeBox, setActiveBox] = useState('mine');
  const [notice, setNotice] = useState(null);
  const [logoutConfirm, setLogoutConfirm] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadLetters() {
      setLoading(true);
      try {
        const userRes = await fetch('/get-user-info');
        if (userRes.status === 401) {
          navigate('/letter-login', { replace: true, state: { from: '/letters' } });
          return;
        }
        const userData = await userRes.json();
        if (cancelled) return;
        setName(userData?.name || '');
        setUserEmail(userData?.email || '');

        const [myRes, receivedRes] = await Promise.all([
          fetch('/my-letters'),
          fetch('/received-letters'),
        ]);
        if (myRes.status === 401 || receivedRes.status === 401) {
          navigate('/letter-login', { replace: true, state: { from: '/letters' } });
          return;
        }

        const myData = await myRes.json().catch(() => []);
        const receivedData = await receivedRes.json().catch(() => []);
        if (cancelled) return;
        const nextLetters = Array.isArray(myData) ? myData.filter(letter => letter.type !== 'call') : [];
        const nextReceivedLetters = Array.isArray(receivedData) ? receivedData.filter(letter => letter.type !== 'call') : [];
        setLetters(nextLetters);
        setReceivedLetters(nextReceivedLetters);
      } catch {
        if (!cancelled) {
          setLetters([]);
          setReceivedLetters([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadLetters();
    return () => { cancelled = true; };
  }, [navigate]);

  const now = new Date();
  const isReceivedBox = activeBox === 'received';
  const activeLetters = isReceivedBox ? receivedLetters : letters;
  const unlockedCount = activeLetters.filter(l => new Date(l.openDate) <= now).length;
  const lockedCount = activeLetters.length - unlockedCount;
  const favoriteCount = letters.filter(l => l.favorite).length;
  const visibleLetters = !isReceivedBox && favoriteOnly ? letters.filter(l => l.favorite) : activeLetters;

  function switchMailbox(nextBox) {
    if (nextBox === activeBox) return;
    setActiveBox(nextBox);
    if (nextBox === 'received') setFavoriteOnly(false);
  }

  function openLetter(letter) {
    navigate('/view-letter', { state: { letter, name, returnTo: '/letters' } });
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

  function goHome() {
    navigate('/hello');
  }

  function logoutLetters() {
    confirmLogoutLetters();
  }

  function confirmLogoutLetters() {
    clearLetterAuth();
    window.location.assign('/logout');
  }

  async function toggleFavorite(letter, event) {
    event.stopPropagation();
    const nextFavorite = !letter.favorite;
    setLetters(prev => prev.map(item => item.id === letter.id ? { ...item, favorite: nextFavorite } : item));
    try {
      const res = await fetch(`/letters/${letter.id}/favorite`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ favorite: nextFavorite }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || '즐겨찾기를 변경하지 못했습니다.');
    } catch (err) {
      setLetters(prev => prev.map(item => item.id === letter.id ? { ...item, favorite: letter.favorite } : item));
      setNotice({ title: '변경 실패', message: err.message || '즐겨찾기를 변경하지 못했습니다.' });
    }
  }

  async function deleteLetter(id) {
    try {
      const res = await fetch(`/delete-letter/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setLetters(prev => prev.filter(l => l.id !== id));
      } else {
        const data = await res.json();
        setNotice({ title: '삭제 실패', message: data.message || '삭제에 실패했습니다.' });
      }
    } catch {
      setNotice({ title: '연결 실패', message: '서버 연결 오류' });
    }
    setDeleteConfirm(null);
  }

  return (
    <motion.div
      className="letter-list-page pink-letter-list-page letters-main-page"
      {...pageMotion}
    >
      <motion.div
        className="top-title"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.96, ease }}
      >
        <span className="to">Dear Me</span>
        <span className="semicolon">;</span>
        <span className="from">Dear You</span>
      </motion.div>

      <div className="letter-list-shell letters-main-shell">
        <motion.header
          className="letter-list-header"
          {...panelMotion}
        >
          <div>
            <div className="letter-list-kicker">{isReceivedBox ? 'RECEIVED' : 'MY LETTERS'}</div>
            <h2 className="letter-list-title">{isReceivedBox ? '받은 편지' : '나의 편지'}</h2>
          </div>
          {!loading && activeLetters.length > 0 && (
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

        {!loading && (
          <motion.div className="letter-mailbox-tabs" aria-label="편지함 전환" {...panelMotion}>
            <button type="button" className={!isReceivedBox ? 'active' : ''} onClick={() => switchMailbox('mine')}>
              나의 편지 <span>{letters.length}</span>
            </button>
            <button type="button" className={isReceivedBox ? 'active' : ''} onClick={() => switchMailbox('received')}>
              받은 편지 <span>{receivedLetters.length}</span>
            </button>
          </motion.div>
        )}

        {!loading && !isReceivedBox && letters.length > 0 && (
          <motion.div className="letter-list-controls" {...panelMotion}>
            <div className="letter-list-filters" aria-label="편지 필터">
              <button type="button" className={!favoriteOnly ? 'active' : ''} onClick={() => setFavoriteOnly(false)}>전체</button>
              <button type="button" className={favoriteOnly ? 'active' : ''} onClick={() => setFavoriteOnly(true)}>즐겨찾기 {favoriteCount}</button>
            </div>
          </motion.div>
        )}

        {loading ? (
          <div className="letter-empty">불러오는 중...</div>
        ) : activeLetters.length === 0 ? (
          <motion.div
            className="letter-empty"
            {...panelMotion}
          >
            {isReceivedBox ? (
              <>
                <strong>{userEmail ? '아직 받은 편지가 없습니다.' : '받은 편지를 확인할 이메일이 없습니다.'}</strong>
                <span>{userEmail ? '도착한 편지는 이곳에 모입니다.' : '계정 이메일과 일치하는 편지만 표시됩니다.'}</span>
              </>
            ) : (
              <>
                <strong>아직 작성한 편지가 없습니다.</strong>
                <span>미래의 나에게 첫 편지를 남겨 보세요.</span>
                <button type="button" className="soft-button" onClick={() => navigate('/write', { state: { emailTheme: 'pink' } })}>첫 편지 쓰기</button>
              </>
            )}
          </motion.div>
        ) : !isReceivedBox && visibleLetters.length === 0 ? (
          <motion.div
            className="letter-empty"
            {...panelMotion}
          >
            <strong>즐겨찾기한 편지가 아직 없습니다</strong>
            <span>별을 눌러 다시 보고 싶은 편지를 모아둘 수 있습니다.</span>
            <button type="button" className="soft-button" onClick={() => setFavoriteOnly(false)}>전체 보기</button>
          </motion.div>
        ) : (
          <div className="letter-scroll letters-scroll">
            {visibleLetters.map((letter, i) => {
              const unlocked = new Date(letter.openDate) <= now;
              const days = daysUntil(letter.openDate);
              const type = getType(letter);
              const recipient = recipientText(letter);
              const sender = senderText(letter);
              const cardTitle = isReceivedBox ? `보낸 사람 ${sender}` : `${formatDate(letter.createdAt)} 작성`;
              const dateText = isReceivedBox
                ? receivedDateText(letter, unlocked)
                : unlocked ? `✓ ${formatDate(letter.openDate)} 개봉` : `${formatDate(letter.openDate)} 개봉 예정`;

              return (
                <motion.article
                  key={letter.id}
                  className={`letter-card ${unlocked ? 'is-open' : 'is-locked'} ${isReceivedBox ? 'is-received' : ''}`.trim()}
                  role={unlocked ? 'button' : undefined}
                  tabIndex={unlocked ? 0 : undefined}
                  onClick={event => handleCardClick(letter, unlocked, event)}
                  onKeyDown={event => handleCardKeyDown(letter, unlocked, event)}
                  {...listItemMotion(i)}
                  whileHover={unlocked ? { boxShadow: '0 14px 38px rgba(130,70,70,0.12)' } : {}}
                >
                  <div className="letter-card-inner">
                    <div className="letter-icon" aria-hidden="true">
                      <LetterTypeIcon type={letter.type} locked={!unlocked} />
                    </div>

                    <div
                      className={unlocked ? 'letter-card-copy letter-card-click' : 'letter-card-copy'}
                    >
                      <div className="letter-card-title-line">
                        <span className="letter-card-title">{cardTitle}</span>
                      </div>
                      <div className="letter-card-info-line">
                        <span
                          className="letter-badge"
                          style={{ background: type.bg, color: type.color, borderColor: type.border }}
                        >
                          {type.label}
                        </span>
                        {!isReceivedBox && recipient && <span className="letter-recipient">→ {recipient}</span>}
                        <span className="letter-date-line">
                          {dateText}
                        </span>
                      </div>
                    </div>

                    <div className="letter-card-actions">
                      {isReceivedBox ? (
                        unlocked ? (
                          <button
                            type="button"
                            className="letter-open-arrow"
                            onClick={event => { event.stopPropagation(); openLetter(letter); }}
                            aria-label="편지 열기"
                          >
                            ▶
                          </button>
                        ) : (
                          <span className="letter-lock-pill">D-{days}</span>
                        )
                      ) : (
                        <>
                          <button
                            type="button"
                            className={`letter-favorite-button ${letter.favorite ? 'active' : ''}`}
                            onClick={event => toggleFavorite(letter, event)}
                            aria-label={letter.favorite ? '즐겨찾기 해제' : '즐겨찾기'}
                          >
                            ★
                          </button>
                          {unlocked ? (
                            <button
                              type="button"
                              className="letter-open-arrow"
                              onClick={event => { event.stopPropagation(); openLetter(letter); }}
                              aria-label="편지 열기"
                            >
                              ▶
                            </button>
                          ) : (
                            <>
                              <span className="letter-lock-pill">D-{days}</span>
                              <button
                                type="button"
                                className="letter-delete-button"
                                onClick={event => { event.stopPropagation(); setDeleteConfirm(letter.id); }}
                                aria-label="편지 삭제"
                              >
                                ×
                              </button>
                            </>
                          )}
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

      {!logoutConfirm && deleteConfirm === null && !notice && typeof document !== 'undefined' && createPortal((
      <motion.div
        className="letters-main-exit-actions"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.52, delay: 0.48, ease }}
      >
        <motion.button
          type="button"
          className="letter-back-floating pink-letter-exit letters-main-exit"
          onClick={goHome}
          whileHover={{ boxShadow: '0 6px 24px rgba(150,80,80,0.12)' }}
        >
          홈으로
        </motion.button>
        <motion.button
          type="button"
          className="letter-back-floating pink-letter-exit letters-main-exit letters-main-logout"
          onClick={logoutLetters}
          whileHover={{ boxShadow: '0 6px 24px rgba(150,80,80,0.12)' }}
        >
          로그아웃
        </motion.button>
      </motion.div>
      ), document.body)}

      <AnimatePresence>
        {deleteConfirm !== null && (
          <motion.div
            className="modal-backdrop letter-delete-modal-backdrop"
            {...modalBackdropMotion}
          >
            <motion.div
              className="modal-panel letter-delete-modal"
              {...modalPanelMotion}
            >
              <div className="letter-delete-modal-title">편지를 삭제할까요?</div>
              <div className="letter-delete-modal-message">
                아직 개봉하지 않은 편지만 삭제할 수 있습니다.
              </div>
              <div className="modal-actions letter-delete-modal-actions">
                <button type="button" className="letter-delete-modal-button" onClick={() => setDeleteConfirm(null)}>취소</button>
                <button
                  type="button"
                  className="letter-delete-modal-button danger"
                  onClick={() => deleteLetter(deleteConfirm)}
                >
                  삭제
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <NoticeModal
        open={logoutConfirm}
        title="로그아웃할까요?"
        message="확인을 누르면 현재 계정에서 로그아웃됩니다."
        cancelLabel="취소"
        confirmLabel="로그아웃"
        onClose={() => setLogoutConfirm(false)}
        onConfirm={confirmLogoutLetters}
        variant="pink"
      />
      <NoticeModal
        open={Boolean(notice)}
        title={notice?.title}
        message={notice?.message}
        onClose={() => setNotice(null)}
        variant="pink"
      />
    </motion.div>
  );
}
