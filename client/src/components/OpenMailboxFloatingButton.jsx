import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function OpenMailboxFloatingButton({ delay = 0.55 }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [locked, setLocked] = useState(false);
  const lockedRef = useRef(false);

  useEffect(() => {
    lockedRef.current = false;
    setLocked(false);
  }, [location.pathname, location.search]);

  function openMailbox() {
    if (lockedRef.current || location.pathname === '/open-mailbox') return;
    lockedRef.current = true;
    setLocked(true);
    navigate('/open-mailbox');
  }

  return (
    <motion.button
      type="button"
      className="open-mailbox-floating-button"
      aria-label="열린 편지함"
      title="열린 편지함"
      onClick={openMailbox}
      disabled={locked || location.pathname === '/open-mailbox'}
      data-route-action="open-mailbox"
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
    >
      <span className="open-mailbox-floating-icon" aria-hidden="true">
        {String.fromCodePoint(0x1f48c)}
      </span>
      <span className="open-mailbox-floating-label">열린 편지함</span>
    </motion.button>
  );
}
