import { motion } from 'motion/react';
import { useEffect, useRef } from 'react';

interface Props {
  title: string;
  message?: React.ReactNode;
  icon?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Boîte de confirmation aux couleurs du jeu, en remplacement de window.confirm. */
export function ConfirmDialog({
  title,
  message,
  icon = '🚂',
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  busy,
  onConfirm,
  onCancel,
}: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // focus sur « Annuler » : une validation accidentelle au clavier ne supprime rien
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <motion.div
      className="dialog-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onCancel}
    >
      <motion.div
        className="dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        aria-describedby={message ? 'dialog-message' : undefined}
        initial={{ scale: 0.85, y: 20, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 420, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dialog__icon" aria-hidden>
          {icon}
        </div>
        <h2 id="dialog-title" className="dialog__title">
          {title}
        </h2>
        {message && (
          <p id="dialog-message" className="dialog__message">
            {message}
          </p>
        )}
        <div className="dialog__actions">
          <button ref={cancelRef} type="button" className="btn" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
          <button type="button" className="btn btn--primary" onClick={onConfirm} disabled={busy}>
            {confirmLabel}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
