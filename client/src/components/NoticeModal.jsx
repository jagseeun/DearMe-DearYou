import { AnimatePresence, motion } from 'framer-motion';

const ease = [0.22, 1, 0.36, 1];

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
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={close}
        >
          <motion.section
            className={`notice-modal-panel ${variant}`}
            initial={{ opacity: 0, y: 22, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.96 }}
            transition={{ duration: 0.28, ease }}
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
                <button type="button" className="ghost" onClick={close}>
                  {cancelLabel}
                </button>
              )}
              <button type="button" onClick={confirm}>
                {confirmLabel}
              </button>
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
