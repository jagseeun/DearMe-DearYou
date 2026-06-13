import { AnimatePresence, motion } from 'framer-motion';
import { buttonMotion, modalBackdropMotion, modalPanelMotion } from '../utils/motion.js';

export default function NoticeModal({
  open,
  title = '알림',
  message = '',
  confirmLabel = '확인',
  cancelLabel = '',
  onClose,
  onConfirm,
  variant = 'default',
}) {
  function close() {
    onClose?.();
  }

  function confirm() {
    if (onConfirm) onConfirm();
    else close();
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="notice-modal-backdrop"
          {...modalBackdropMotion}
          onClick={close}
        >
          <motion.section
            className={`notice-modal-panel ${variant}`}
            {...modalPanelMotion}
            onClick={event => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="notice-modal-title"
          >
            <div className="notice-modal-mark" aria-hidden="true" />
            <h2 id="notice-modal-title">{title}</h2>
            {message && <p>{message}</p>}
            <div className="notice-modal-actions">
              {cancelLabel && (
                <motion.button type="button" className="ghost" onClick={close} {...buttonMotion}>
                  {cancelLabel}
                </motion.button>
              )}
              <motion.button type="button" onClick={confirm} {...buttonMotion}>
                {confirmLabel}
              </motion.button>
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
