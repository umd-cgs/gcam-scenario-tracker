import * as Dialog from "@radix-ui/react-dialog";
import { useRef } from "react";
import { AlertCircle, LoaderCircle, X } from "lucide-react";

export function Loading({ label = "Loading your workspace…" }) {
  return (
    <div className="state-panel" role="status">
      <LoaderCircle className="spin" size={28} />
      <h3>{label}</h3>
      <p>This can take a moment while data is loaded.</p>
    </div>
  );
}
export function ErrorState({ message, onRetry }) {
  return (
    <div className="error-banner" role="alert">
      <AlertCircle size={20} />
      <div>
        <strong>Something needs attention</strong>
        <p>{message}</p>
      </div>
      {onRetry && (
        <button className="button secondary" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
  busy = false,
  wide = false,
  dismissOnOutside = false,
}) {
  const opener = useRef(document.activeElement);
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content
          className={`modal ${wide ? "wide" : ""}`}
          aria-describedby={undefined}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            opener.current?.focus();
          }}
          onEscapeKeyDown={(event) => {
            if (busy) event.preventDefault();
          }}
          onPointerDownOutside={(event) => {
            if (busy || !dismissOnOutside) event.preventDefault();
          }}
        >
          <div className="modal-heading">
            <Dialog.Title>{title}</Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                className="icon-button"
                aria-label="Close dialog"
                disabled={busy}
              >
                <X size={20} />
              </button>
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
