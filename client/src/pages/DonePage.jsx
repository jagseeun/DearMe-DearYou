import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDate, daysUntil } from '../utils/dates.js';

const ease = [0.22, 1, 0.36, 1];

export default function DonePage() {
  const navigate = useNavigate();
  const { openDate, name, recipientName, recipientEmail, sentNow, delivery } = useLocation().state || {};
  const [phase, setPhase] = useState(sentNow ? 'envelope' : 'seal');
  const [supportEmail, setSupportEmail] = useState('');

  useEffect(() => {
    if (!openDate) navigate('/login', { replace: true });
  }, [openDate, navigate]);

  useEffect(() => {
    if (phase !== 'envelope') return undefined;
    const timer = setTimeout(() => navigate('/hello', { replace: true }), 6200);
    return () => clearTimeout(timer);
  }, [phase, navigate]);

  useEffect(() => {
    fetch('/support-info')
      .then(r => r.json())
      .then(data => setSupportEmail(data.developerEmail || ''))
      .catch(() => {});
  }, []);

  if (!openDate) return null;

  const d = sentNow ? 0 : Math.max(0, daysUntil(openDate));
  const senderName = name || '나';
  const recipientDisplayName = recipientName || recipientEmail || senderName;
  const deliveryFailed = Boolean(sentNow && delivery && delivery.sent === 0);
  const deliveryAccepted = Boolean(sentNow && delivery && delivery.sent > 0);
  const deliveryTitle = deliveryFailed
    ? '이메일 발송 실패'
    : deliveryAccepted
      ? '이메일 발송 요청 접수'
      : '오늘의 편지 저장 완료';
  const deliveryText = deliveryFailed
    ? (delivery?.message || '편지는 저장됐지만 이메일 발송은 실패했습니다. 관리자에서 다시 발송해주세요.')
    : deliveryAccepted
      ? '발송 요청이 접수됐어요. 받은편지함에 없으면 스팸함도 확인해주세요.'
      : '편지가 저장됐어요.';
  const dChars = ['D', '-', ...String(d).split('')];
  const openDateLabel = new Date(openDate).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  return (
    <motion.div
      className="done-page"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.3 } }}
    >
      <motion.div
        className="top-title"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.1, ease }}
      >
        <span className="to">Dear Me</span>
        <span className="semicolon">;</span>
        <span className="from">Dear You</span>
      </motion.div>

      <AnimatePresence mode="wait">
        {phase === 'seal' ? (
          <motion.div
            key="seal"
            className="done-center"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.55, ease }}
          >
            <motion.div
              className="done-card"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.85, delay: 0.12, ease }}
            >
              <div className="done-seal" aria-label="편지 예약 완료 도장">
                <div className="done-seal-ring" />
                <div className="done-seal-text">
                  <strong>{openDateLabel}</strong>
                  <span>개봉 예정</span>
                </div>
              </div>

              <div className="done-message">
                <strong>편지가 봉인되었어요</strong>
                <span>약속한 날에 다시 열어볼 수 있어요.</span>
              </div>
            </motion.div>

            <motion.button
              className="done-button"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.35, ease }}
              onClick={() => setPhase('envelope')}
              whileHover={{ translateY: -2 }}
            >
              확인
            </motion.button>
          </motion.div>
        ) : (
          <motion.div
            key="envelope"
            className="done-envelope"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="done-envelope-stage">
              <motion.div
                className="done-envelope-info done-from"
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8, delay: 0.1, ease }}
              >
                <div className="done-envelope-label">보내는 사람</div>
                <div className="done-envelope-value">
                  <span>{formatDate(new Date())}의</span>
                  <span>{senderName}</span>
                </div>
              </motion.div>

              <div className="done-envelope-divider" />

              <motion.div
                className="done-envelope-info done-to"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8, delay: 0.2, ease }}
              >
                <div className="done-envelope-label">받는 사람</div>
                <div className="done-envelope-value">
                  <span>{formatDate(openDate)}의</span>
                  <span>{recipientDisplayName}에게</span>
                </div>
              </motion.div>

              <motion.div
                className="done-day-sidebar"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8, delay: 0.3, ease }}
              >
                {dChars.map((ch, i) => (
                  <div key={`${ch}-${i}`}>{ch}</div>
                ))}
              </motion.div>

              <div className="done-mobile-day">D-{d}</div>

              {sentNow && (
                <motion.div
                  className={`done-delivery-status ${deliveryFailed ? 'is-failed' : 'is-accepted'}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, delay: 0.45, ease }}
                >
                  <strong>{deliveryTitle}</strong>
                  <span>{deliveryText}</span>
                </motion.div>
              )}

              {supportEmail && (
                <motion.a
                  className="done-support-link"
                  href={`mailto:${supportEmail}?subject=${encodeURIComponent('Dear Me ; Dear You 응원 메시지')}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, delay: 0.65, ease }}
                >
                  개발자에게 응원 보내기
                </motion.a>
              )}

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
