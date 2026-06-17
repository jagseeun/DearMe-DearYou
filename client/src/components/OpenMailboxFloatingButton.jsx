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
      aria-label="Open mailbox"
      title="Open mailbox"
      onClick={openMailbox}
      disabled={locked || location.pathname === '/open-mailbox'}
      data-route-action="open-mailbox"
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
    >
      {String.fromCodePoint(0x1f48c)}
    </motion.button>
  );
}
