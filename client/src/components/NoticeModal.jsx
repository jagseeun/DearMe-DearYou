import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { buttonMotion, modalBackdropMotion, modalPanelMotion } from '../utils/motion.js';

const NOTICE_MODAL_OPEN_EVENT = 'dearme:notice-modal-open';

export default function NoticeModal({
  open,
  title = '안내드립니다',
  message = '',
  confirmLabel = '확인했습니다',
  cancelLabel = '',
  onClose,
  onConfirm,
  variant = 'default',
  replaceOnOpen = true,
}) {
  const modalId = useRef(`notice-${Math.random().toString(36).slice(2)}`);
  const [isActive, setIsActive] = useState(false);
  const modalKey = useMemo(
    () => [title, message, confirmLabel, cancelLabel, variant].join('|'),
    [title, message, confirmLabel, cancelLabel, variant],
  );

  useEffect(() => {
    if (!open) {
      setIsActive(false);
      return undefined;
    }

    if (!replaceOnOpen) {
      setIsActive(true);
      return undefined;
    }

    function showOnlyNewestNotice(event) {
      setIsActive(event.detail?.id === modalId.current);
    }

    window.addEventListener(NOTICE_MODAL_OPEN_EVENT, showOnlyNewestNotice);
    setIsActive(true);
    window.dispatchEvent(new CustomEvent(NOTICE_MODAL_OPEN_EVENT, {
      detail: { id: modalId.current },
    }));

    return () => {
      window.removeEventListener(NOTICE_MODAL_OPEN_EVENT, showOnlyNewestNotice);
    };
  }, [open, replaceOnOpen, modalKey]);

  function close() {
    onClose?.();
  }

  function confirm() {
    if (onConfirm) onConfirm();
    else close();
  }

  const modal = (
    <AnimatePresence mode="wait">
      {open && isActive && (
        <motion.div
          key={modalKey}
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

  if (typeof document === 'undefined') return modal;
  return createPortal(modal, document.body);
}
