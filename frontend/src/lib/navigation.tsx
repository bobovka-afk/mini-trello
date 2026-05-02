import type { AnchorHTMLAttributes, MouseEvent } from 'react';

export function navigate(to: string) {
  window.history.pushState({}, '', to);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

const ABSOLUTE_HTTP = /^https?:\/\//i;

export function hrefForSpaRoute(to: string): string {
  if (ABSOLUTE_HTTP.test(to)) return to;
  const path = to.startsWith('/') ? to : `/${to}`;
  return `${window.location.origin}${path}`;
}

export function openSpaInNewTab(to: string) {
  window.open(hrefForSpaRoute(to), '_blank', 'noopener,noreferrer');
}

export type SpaLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  to: string;
  disabled?: boolean;
};

export function SpaLink({ to, className, onClick, children, disabled, ...rest }: SpaLinkProps) {
  if (disabled) {
    return (
      <span className={className} aria-disabled="true" {...rest}>
        {children}
      </span>
    );
  }

  function handleClick(e: MouseEvent<HTMLAnchorElement>) {
    if (e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(to);
    onClick?.(e);
  }

  return (
    <a href={to} className={className} onClick={handleClick} {...rest}>
      {children}
    </a>
  );
}

/** Клик по строке/плитке: обычный — SPA, Ctrl/Cmd/Middle — новая вкладка */
export function handleSpaTileClick(
  e: MouseEvent<HTMLElement>,
  to: string,
): void {
  if (e.button !== 0) return;
  if (e.metaKey || e.ctrlKey || e.shiftKey) {
    e.preventDefault();
    openSpaInNewTab(to);
    return;
  }
  e.preventDefault();
  navigate(to);
}

export function handleSpaTileAuxClick(
  e: MouseEvent<HTMLElement>,
  to: string,
): void {
  if (e.button === 1) {
    e.preventDefault();
    openSpaInNewTab(to);
  }
}
