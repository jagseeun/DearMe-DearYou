import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDate, daysUntil } from '../utils/dates.js';
import { motionEase, pageMotion } from '../utils/motion.js';

const ease = motionEase;

export default function DonePage() {
  const navigate = useNavigate();
  const { openDate, name, recipientName, recipientEmail, sentNow, delivery } = useLocation().state || {};
  const [phase, setPhase] = useState(sentNow ? 'envelope' : 'seal');
  const [isLeaving, setIsLeaving] = useState(false);
  const deliveryFailed = Boolean(sentNow && delivery && delivery.sent === 0);
  const deliveryAccepted = Boolean(sentNow && delivery && delivery.sent > 0);
  const deliveryNotice = useMemo(() => {
    if (!sentNow) return null;
    if (deliveryFailed) {
      return {
        kind: 'failed',
        title: '편지는 저장했지만 이메일은 보내지 못했습니다',
        message: delivery?.message || '관리자 화면에서 다시 보낼 수 있습니다.',
      };
    }
    if (deliveryAccepted) {
      return {
        kind: 'success',
        title: '편지를 이메일로 보냈습니다',
        message: '메일함을 확인해 주세요.',
      };
    }
    return {
      kind: 'success',
      title: '편지를 소중히 보관했습니다',
      message: '남겨 주신 마음을 조용히 보관했습니다.',
    };
  }, [delivery?.message, deliveryAccepted, deliveryFailed, sentNow]);

  useEffect(() => {
    if (!openDate) navigate('/hello', { replace: true });
  }, [openDate, navigate]);

  useEffect(() => {
    if (phase !== 'envelope') return undefined;
    const fadeTimer = setTimeout(() => {
      setIsLeaving(true);
    }, 5600);
    const timer = setTimeout(() => {
      navigate('/hello', {
        replace: true,
        state: deliveryNotice ? { deliveryNotice } : undefined,
      });
    }, 6200);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(timer);
    };
  }, [deliveryNotice, phase, navigate]);

  if (!openDate) return null;

  const d = sentNow ? 0 : Math.max(0, daysUntil(openDate));
  const senderName = name || '나';
  const recipientDisplayName = recipientName || recipientEmail || senderName;
  const dChars = ['D', '-', ...String(d).split('')];
  const openDateLabel = new Date(openDate).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  return (
    <motion.div
      className={`done-page ${isLeaving ? 'is-leaving' : ''}`}
      {...pageMotion}
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
                  <span>열람 예정</span>
                </div>
              </div>

              <div className="done-message">
                <strong>편지를 봉인했습니다</strong>
                <span>약속한 날에 다시 열람하실 수 있습니다.</span>
              </div>
            </motion.div>

            <motion.div
              className="done-actions"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.35, ease }}
            >
              <button
                type="button"
                className="done-button"
                onClick={() => setPhase('envelope')}
              >
                확인
              </button>
              <button
                type="button"
                className="done-open-mailbox-button"
                onClick={() => navigate('/open-mailbox')}
              >
                열린 편지함 보기
              </button>
            </motion.div>
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
                <div className="done-envelope-label">남긴 사람</div>
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
                <div className="done-envelope-label">받을 사람</div>
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
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
