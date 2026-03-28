type Props = {
  open: boolean;
  message: string;
  onClose: () => void;
  title?: string;
};

export function AlertModal({ open, message, onClose, title }: Props) {
  if (!open) return null;
  return (
    <div
      className="trello-modal-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="trello-modal trello-modal-narrow"
        role="alertdialog"
        aria-modal
        aria-labelledby={title ? 'alert-modal-title' : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        {title ? (
          <div className="trello-modal-head">
            <h2 className="trello-modal-title" id="alert-modal-title">
              {title}
            </h2>
            <button
              type="button"
              className="trello-modal-close"
              onClick={onClose}
              aria-label="Закрыть"
            >
              ×
            </button>
          </div>
        ) : null}
        <div className="trello-modal-body">
          <p className="trello-confirm-text" style={{ margin: 0 }}>
            {message}
          </p>
        </div>
        <div className="trello-modal-foot trello-modal-foot-center">
          <button
            type="button"
            className="trello-btn trello-btn-primary"
            onClick={onClose}
          >
            Ок
          </button>
        </div>
      </div>
    </div>
  );
}
