import type { FormEvent, ReactNode } from 'react';

type Props = {
  onSubmit: () => void | Promise<void>;
  disabled?: boolean;
  children: ReactNode;
  className?: string;
};

export function ModalForm({ onSubmit, disabled = false, children, className }: Props) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (disabled) return;
    void onSubmit();
  };

  return (
    <form
      className={className ? `trello-modal-form ${className}` : 'trello-modal-form'}
      onSubmit={handleSubmit}
    >
      {children}
    </form>
  );
}
