import React from 'react';

type CardProps = React.PropsWithChildren<{
  title?: string;
  action?: React.ReactNode;
  className?: string;
}>;

export function Card({ title, action, children, className }: CardProps) {
  return (
    <section className={`card rounded-lg border border-gray-200 bg-white shadow-sm ${className ?? ''}`}>
      {(title || action) && (
        <header className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          {title && <h3 className="text-sm font-semibold text-gray-900">{title}</h3>}
          {action}
        </header>
      )}
      <div className="px-4 py-4">{children}</div>
    </section>
  );
}
