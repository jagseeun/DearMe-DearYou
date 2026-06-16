import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDate, daysSince } from '../utils/dates.js';
import { clearLetterAuth } from '../auth.jsx';
import NoticeModal from '../components/NoticeModal.jsx';

const ease = [0.22, 1, 0.36, 1];
const TYPEWRITER_MIN_DURATION = 1400;
const TYPEWRITER_MAX_DURATION = 7200;
const TYPEWRITER_START_DELAY = 520;

function TypewriterText({ text = '', motionProps = {}, style }) {
  const fullText = String(text || '');
  const [visibleText, setVisibleText] = useState('');
  const [complete, setComplete] = useState(!fullText);
  const frameRef = useRef(0);
  const timeoutRef = useRef(0);
  const skippedRef = useRef(false);

  function stopAnimation() {
    window.clearTimeout(timeoutRef.current);
    if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
    frameRef.current = 0;
    timeoutRef.current = 0;
  }

  useEffect(() => {
    const characters = Array.from(fullText);
    stopAnimation();
    skippedRef.current = false;

    if (!characters.length) {
      setVisibleText('');
      setComplete(true);
      return undefined;
    }

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      setVisibleText(fullText);
      setComplete(true);
      return undefined;
    }

    setVisibleText('');
    setComplete(false);

    const duration = Math.min(
      Math.max(characters.length * 28, TYPEWRITER_MIN_DURATION),
      TYPEWRITER_MAX_DURATION,
    );

    timeoutRef.current = window.setTimeout(() => {
      const startedAt = performance.now();

      const tick = now => {
        if (skippedRef.current) return;

        const progress = Math.min((now - startedAt) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 2);
        const count = Math.min(characters.length, Math.max(1, Math.floor(eased * characters.length)));
        setVisibleText(characters.slice(0, count).join(''));

        if (progress < 1) {
          frameRef.current = window.requestAnimationFrame(tick);
          return;
        }

        setVisibleText(fullText);
        setComplete(true);
      };

      frameRef.current = window.requestAnimationFrame(tick);
    }, TYPEWRITER_START_DELAY);

    return () => {
      skippedRef.current = true;
      stopAnimation();
    };
  }, [fullText]);

  function revealAll() {
    if (complete) return;
    skippedRef.current = true;
    stopAnimation();
    setVisibleText(fullText);
    setComplete(true);
  }

  return (
    <motion.p
      className={`letter-content-text letter-paper-text-motion ${complete ? 'is-typed' : 'is-typing'}`}
      {...motionProps}
      style={style}
      onClick={revealAll}
      aria-label={fullText}
    >
      {visibleText}
      {!complete && <span className="letter-type-cursor" aria-hidden="true">|</span>}
    </motion.p>
  );
}

export default function LetterViewPage() {
  const navigate = useNavigate();
  const { letter, name, returnTo } = useLocation().state || {};
  const [phase, setPhase] = useState('envelope');
  const [logoutConfirm, setLogoutConfirm] = useState(false);

  useEffect(() => {
    if (!letter) {
      navigate(returnTo || '/letters', { replace: true });
      return;
    }
    if (letter.locked || letter.type === 'call') {
      navigate(returnTo || '/letters', { replace: true });
    }
  }, [letter, navigate, returnTo]);

  if (!letter || letter.locked || letter.type === 'call') {
    return (
      <div className="auth-route-loading auth-route-loading-pink" aria-live="polite">
        <span className="auth-route-loading-mark" aria-hidden="true">Dear Me ; Dear You</span>
      </div>
    );
  }

  const isPink = letter.emailTheme === 'pink' || returnTo === '/pink-letters' || returnTo === '/letters';
  const d = daysSince(letter.openDate);
  const dChars = ['D', '+', ...String(d).split('')];
  const senderName = letter.senderName || name || '나';
  const recipientName = letter.recipientName || (letter.mailbox === 'received' ? name : '') || name || '나';

  // 핑크 테마 색상 시스템
  const textMain        = isPink ? '#ffe0e8'                  : '#ffe2ef';
  const textSub         = isPink ? 'rgba(255,221,230,0.78)'   : 'rgba(255,207,228,0.72)';
  const textHint        = isPink ? 'rgba(246,195,211,0.68)'   : 'rgba(245,188,220,0.66)';
  const textBtn         = isPink ? '#fff0f5'                  : '#ffe2ef';
  const btnBg           = isPink ? 'linear-gradient(135deg, rgba(255,235,242,0.16), rgba(154,76,120,0.22)), rgba(43,27,48,0.58)' : 'linear-gradient(135deg, rgba(146,74,126,0.84), rgba(86,50,104,0.8)), rgba(232,190,216,0.1)';
  const btnBorder       = isPink ? '1px solid rgba(255,222,232,0.36)'        : '1px solid rgba(244,190,218,0.34)';
  const backColor       = isPink ? 'rgba(255,235,242,0.9)'    : 'rgba(255,236,246,0.88)';
  const backBg          = isPink ? 'linear-gradient(135deg, rgba(255,235,242,0.12), rgba(132,65,108,0.18)), rgba(43,27,48,0.56)' : 'linear-gradient(135deg, rgba(94,54,106,0.62), rgba(62,39,78,0.58)), rgba(232,190,216,0.09)';
  const backBorder      = isPink ? '1px solid rgba(255,222,232,0.28)'         : '1px solid rgba(232,190,216,0.26)';
  const dividerBg       = isPink ? 'rgba(255,214,226,0.24)'    : 'rgba(232,190,216,0.2)';
  const sidebarBg       = isPink ? 'linear-gradient(to bottom, rgba(255,235,242,0.1), rgba(242,183,200,0.1)), rgba(43,27,48,0.48)' : 'linear-gradient(to bottom, rgba(170,95,142,0.28), rgba(48,28,64,0.76))';
  const sidebarBorder   = isPink ? '1px solid rgba(255,222,232,0.22)'        : '1px solid rgba(232,190,216,0.2)';
  const letterBoxBg     = isPink ? 'linear-gradient(135deg, rgba(255,235,242,0.11), rgba(242,183,200,0.08) 56%, rgba(139,72,116,0.06)), rgba(43,27,48,0.52)' : 'linear-gradient(135deg, rgba(255,220,232,0.09), rgba(156,108,174,0.08)), rgba(40,23,52,0.48)';
  const letterBoxBorder = isPink ? '1px solid rgba(255,222,232,0.24)'        : '1px solid rgba(232,190,216,0.25)';

  const paperMotion = isPink
    ? {
        initial: {
          opacity: 0,
          y: 74,
          scale: 0.86,
          rotateX: 16,
          filter: 'blur(2.2px)',
          clipPath: 'inset(48% 10% 48% 10% round 20px)',
        },
        animate: {
          opacity: 1,
          y: 0,
          scale: 1,
          rotateX: 0,
          filter: 'blur(0px)',
          clipPath: 'inset(0% 0% 0% 0% round 24px)',
        },
        transition: { duration: 1.35, delay: 0.04, ease: [0.18, 0.86, 0.2, 1] },
      }
    : {
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.8, ease },
      };

  const paperTextMotion = isPink
    ? {
        initial: { opacity: 0, y: 12, filter: 'blur(0.8px)' },
        animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
        transition: { duration: 0.72, delay: 0.62, ease },
      }
    : {};

  const btnStyle = {
    padding: '14px 56px', borderRadius: 50,
    border: btnBorder, background: btnBg,
    color: textBtn, fontSize: 17, fontFamily: 'inherit', cursor: 'pointer',
    boxShadow: isPink ? '0 0 24px rgba(255,214,226,0.14), 0 16px 38px rgba(21,12,25,0.32), inset 0 1px 0 rgba(255,255,255,0.18)' : '0 0 26px rgba(218,157,196,0.17), 0 16px 38px rgba(21,12,30,0.28), inset 0 1px 0 rgba(255,255,255,0.14)',
    backdropFilter: 'blur(24px)', whiteSpace: 'nowrap',
    transition: 'all 0.3s cubic-bezier(0.22,1,0.36,1)',
    letterSpacing: 0,
    textShadow: isPink ? '0 1px 7px rgba(24,13,28,0.42)' : '0 1px 7px rgba(24,13,34,0.4)',
  };

  function finishAndLogout() {
    setLogoutConfirm(true);
  }

  function confirmFinishAndLogout() {
    clearLetterAuth();
    window.location.assign('/logout');
  }

  const backBtnStyle = {
    position: 'absolute', top: 28, left: 36, zIndex: 10,
    padding: '8px 20px', borderRadius: 50, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer',
    border: backBorder, background: backBg, color: backColor,
    backdropFilter: 'blur(18px)', transition: 'all 0.25s',
    boxShadow: isPink ? '0 0 20px rgba(255,214,226,0.12), 0 12px 28px rgba(21,12,25,0.24)' : '0 0 20px rgba(218,157,196,0.12), 0 12px 28px rgba(21,12,30,0.24)',
    textShadow: isPink ? '0 1px 7px rgba(24,13,28,0.38)' : '0 1px 7px rgba(24,13,34,0.36)',
  };

  return (
    <motion.div
      className={`letter-view-root letter-view-${letter.type} letter-view-phase-${phase} ${isPink ? 'pink-letter-view' : ''}`.trim()}
      style={{
        position: 'fixed', inset: 0, zIndex: 10, width: '100%', height: '100vh',
        background: isPink ? 'linear-gradient(180deg, rgba(255,235,242,0.014), rgba(242,183,200,0.026))' : undefined,
      }}
      initial={{ opacity: 0, y: isPink ? 10 : 0, scale: isPink ? 0.996 : 1 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: isPink ? 0.72 : 0.3, ease }}
      exit={{ opacity: 0, transition: { duration: 0.3 } }}
    >
      <AnimatePresence mode="sync" initial={false}>

        {/* ── 봉투 화면 ── */}
        {phase === 'envelope' && (
          <motion.div key="envelope" style={{ position: 'absolute', inset: 0 }}
            initial={{ opacity: 0, y: isPink ? 10 : 0, scale: isPink ? 0.992 : 1 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: isPink ? 4 : 0, scale: isPink ? 0.996 : 1 }}
            transition={{ duration: isPink ? 0.72 : 0.5, ease }}>

            <motion.div className="top-title"
              initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1.2, ease }}>
              {isPink ? (<>
                <span className="to">Dear Me</span>
                <span className="semicolon">;</span>
                <span className="from">Dear You</span>
              </>) : (<>
                <span className="to">Dear Me</span>
                <span className="semicolon">;</span>
                <span className="from">Dear You</span>
              </>)}
            </motion.div>

            <motion.button
              className="letter-view-back"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
              onClick={() => navigate(returnTo || -1)}
              style={backBtnStyle}
            >
              ← 목록
            </motion.button>

            <motion.div
              className="letter-envelope-stage"
              initial={isPink ? {
                opacity: 0,
                y: 14,
                scale: 0.992,
              } : undefined}
              animate={isPink ? {
                opacity: 1,
                y: 0,
                scale: 1,
              } : undefined}
              transition={isPink ? { duration: 0.72, ease } : undefined}
            >
              <motion.div
                className="letter-envelope-info letter-from"
                initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8, delay: isPink ? 0.42 : 0.15, ease }}>
                <div className="letter-envelope-label" style={{ color: textHint }}>남긴 날</div>
                <div className="letter-envelope-value">
                  <span>{formatDate(letter.createdAt)}</span>
                  <small className="letter-envelope-person">남긴 사람 {senderName}</small>
                </div>
              </motion.div>

              <div className="letter-envelope-divider" style={{ background: dividerBg }} />

              <motion.div
                className="letter-envelope-info letter-to"
                initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8, delay: isPink ? 0.54 : 0.22, ease }}>
                <div className="letter-envelope-label" style={{ color: textHint }}>열린 날</div>
                <div className="letter-envelope-value">
                  <span>{formatDate(letter.openDate)}</span>
                  <small className="letter-envelope-person">받을 사람 {recipientName}</small>
                </div>
              </motion.div>

              {/* D+0 사이드바 */}
              <motion.div
                className="letter-day-sidebar"
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8, delay: isPink ? 0.66 : 0.3, ease }}
                style={{
                  position: 'absolute', right: 0, top: 0, width: 96, height: '100%',
                  background: sidebarBg,
                  borderTopLeftRadius: 36, borderBottomLeftRadius: 36,
                  backdropFilter: 'blur(20px)',
                  border: sidebarBorder, borderRight: 'none',
                  display: 'flex', flexDirection: 'column',
                  justifyContent: 'center', alignItems: 'center', gap: 12,
                }}>
                {dChars.map((ch, i) => (
                  <div key={i} style={{ fontSize: 27, fontWeight: 300, color: textSub, lineHeight: 1.1 }}>{ch}</div>
                ))}
              </motion.div>

              <div className="letter-mobile-day">D+{d}</div>

              <motion.button
                className="letter-view-button letter-open-button"
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.95, delay: isPink ? 0.82 : 0.42, ease }}
                onClick={() => setPhase('content')}
                whileHover={{ scale: 1.018 }}
                style={{ ...btnStyle, position: 'absolute', bottom: 40, left: '50%', translate: '-50% 0', transformOrigin: 'center center' }}>
                {letter.type === 'video' ? '영상 편지 열람하기' : letter.type === 'draw' ? '그림 편지 열람하기' : '편지 열람하기'}
              </motion.button>
            </motion.div>
          </motion.div>
        )}

        {/* ── 일반: 내용 화면 ── */}
        {phase === 'content' && (
          <motion.div key="content" style={{ position: 'absolute', inset: 0 }}
            initial={{ opacity: 0, y: isPink ? 10 : 0, scale: isPink ? 0.992 : 1 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: isPink ? -6 : 0, scale: isPink ? 0.996 : 1 }}
            transition={{ duration: isPink ? 0.72 : 0.5, ease }}>

            <motion.div className="top-title"
              initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1.2, ease }}>
              {isPink ? (<>
                <span className="to">Dear Me</span>
                <span className="semicolon">;</span>
                <span className="from">Dear You</span>
              </>) : (<>
                <span className="to">Dear Me</span>
                <span className="semicolon">;</span>
                <span className="from">Dear You</span>
              </>)}
            </motion.div>

            <motion.button
              className="letter-view-back"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
              onClick={() => setPhase('envelope')}
              style={backBtnStyle}
            >
              ← 봉투로
            </motion.button>

            <div className="letter-content-viewport">
              <motion.div
                className={`letter-content-wrap ${letter.type === 'draw' ? 'letter-content-wrap-draw' : letter.type === 'video' ? 'letter-content-wrap-video' : ''}`.trim()}
                initial={{ opacity: isPink ? 1 : 0, y: isPink ? 0 : 20, scale: 1 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: isPink ? 0.4 : 0.8, ease }}
                style={{ width: '100%', maxWidth: letter.type === 'video' ? 1480 : letter.type === 'draw' ? 1680 : 1120 }}>

                {letter.type === 'draw' ? (
                  <motion.div
                    className="letter-draw-frame letter-paper-motion"
                    {...paperMotion}
                    style={{
                      border: letterBoxBorder,
                      background: isPink
                        ? 'linear-gradient(180deg, rgba(255,255,255,0.99), rgba(255,248,252,0.98))'
                        : 'linear-gradient(180deg, rgba(255,255,255,0.99), rgba(255,250,253,0.98))',
                    }}
                  >
                    <img className="letter-draw-image" src={letter.imageUrl} alt="그림 편지" />
                  </motion.div>
                ) : letter.type === 'text' ? (
                  <motion.div className="letters-scroll letter-content-box letter-paper-motion" {...paperMotion} style={{
                    width: '100%', minHeight: 360, maxHeight: '66vh',
                    background: letterBoxBg,
                    border: letterBoxBorder,
                    borderRadius: 24, backdropFilter: 'blur(16px)',
                    padding: '52px 64px', overflowY: 'auto',
                    boxShadow: isPink ? '0 0 28px rgba(255,214,226,0.11), 0 18px 44px rgba(21,12,25,0.26)' : '0 4px 40px rgba(0,0,0,0.1)',
                  }}>
                    <TypewriterText
                      text={letter.content}
                      motionProps={paperTextMotion}
                      style={{ color: textMain, fontSize: 24, fontWeight: 300, lineHeight: 2.15, whiteSpace: 'pre-wrap', margin: 0, letterSpacing: 0.4 }}
                    />

                    {/* 첨부 이미지 */}
                    {letter.imageUrl && (
                      <div style={{ marginTop: 24 }}>
                        <img
                          src={letter.imageUrl}
                          style={{ maxWidth: '100%', borderRadius: 12, border: `1px solid ${isPink ? 'rgba(102,43,44,0.2)' : 'rgba(255,255,255,0.15)'}` }}
                        />
                      </div>
                    )}

                    {/* 서명 */}
                    {letter.signatureData && (
                      <div style={{ marginTop: 20, textAlign: 'right', paddingTop: 16, borderTop: `1px solid ${isPink ? 'rgba(102,43,44,0.1)' : 'rgba(255,255,255,0.1)'}` }}>
                        <img src={letter.signatureData} style={{ maxHeight: 70, opacity: 0.85 }} />
                      </div>
                    )}
                  </motion.div>
                ) : (
                  <div className="letter-video-frame" style={{ width: '100%', borderRadius: 20, overflow: 'hidden', boxShadow: '0 16px 44px rgba(0,0,0,0.24)', background: '#080808' }}>
                    <video src={letter.videoUrl} controls playsInline style={{ width: '100%', height: 'min(76vh, 800px)', minHeight: 'min(480px, 62vh)', objectFit: 'contain', display: 'block', background: '#080808' }} />
                  </div>
                )}
              </motion.div>

              <motion.button
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.35, ease }}
                onClick={() => setPhase('done')}
                whileHover={{ scale: 1.018 }}
                className="letter-view-button"
                style={btnStyle}>
                확인했습니다
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* ── 완료 화면 ── */}
        {phase === 'done' && (
          <motion.div key="done" style={{ position: 'absolute', inset: 0 }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}>

            <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 40 }}>
              <motion.div
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.9, ease }}
                style={{ fontSize: 28, fontWeight: 300, color: textMain }}>
                이 마음을 다 읽으셨습니다
              </motion.div>

              <motion.div
                className="letter-done-actions"
                initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.18, ease }}
                style={{ display: 'flex', gap: 18 }}>
                <motion.button
                  whileHover={{ scale: 1.018 }}
                  onClick={() => navigate(returnTo || '/letters')}
                  style={{ ...btnStyle, background: backBg, border: backBorder, color: backColor }}>
                  편지함으로 돌아가기
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.018 }}
                  onClick={() => navigate('/write', { state: { emailTheme: isPink ? 'pink' : 'dark' } })}
                  style={{ ...btnStyle, background: backBg, border: backBorder, color: backColor }}>
                  편지 남기기
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.018 }}
                  onClick={finishAndLogout}
                  style={btnStyle}>
                  로그아웃
                </motion.button>
              </motion.div>
            </div>
          </motion.div>
        )}

      </AnimatePresence>
      <NoticeModal
        open={logoutConfirm}
        title="로그아웃하시겠습니까?"
        message="지금 계정에서 나가도 남겨 두신 편지는 그대로 보관됩니다."
        cancelLabel="머무르기"
        confirmLabel="로그아웃"
        onClose={() => setLogoutConfirm(false)}
        onConfirm={confirmFinishAndLogout}
        variant="logout"
      />
    </motion.div>
  );
}
