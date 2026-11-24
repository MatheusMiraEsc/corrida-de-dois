/**
 * Janela modal declarativa: aparece quando é renderizada, some quando não é.
 * Fecha com Esc ou clicando no fundo (como o modal de regras original).
 */
import { useEffect, type ReactNode } from "react";

interface Props {
  title: string;
  onClose?: () => void;
  children: ReactNode;
  className?: string;
}

export function Modal({ title, onClose, children, className }: Props) {
  useEffect(() => {
    if (!onClose) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={(event) => event.target === event.currentTarget && onClose?.()}>
      <section className={`modal ${className ?? ""}`} role="dialog" aria-modal="true" aria-label={title}>
        {onClose && (
          <button type="button" className="modal__close" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        )}
        {children}
      </section>
    </div>
  );
}
