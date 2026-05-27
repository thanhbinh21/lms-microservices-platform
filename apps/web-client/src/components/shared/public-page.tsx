import type { ReactNode } from 'react';
import { AlertCircle, Loader2, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { SharedNavbar } from './shared-navbar';
import { SharedFooter } from './shared-footer';
import { cn } from '@/lib/utils';

interface PublicPageShellProps {
  children: ReactNode;
  withFooter?: boolean;
  className?: string;
  mainClassName?: string;
}

export function PublicPageShell({
  children,
  withFooter = true,
  className,
  mainClassName,
}: PublicPageShellProps) {
  return (
    <div className={cn('glass-page min-h-screen overflow-hidden text-foreground', className)}>
      <SharedNavbar />
      <main className={cn('relative z-10 mx-auto w-full max-w-7xl px-4 py-8 md:px-8', mainClassName)}>
        {children}
      </main>
      {withFooter ? <SharedFooter /> : null}
    </div>
  );
}

interface PublicPageHeaderProps {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  centered?: boolean;
  className?: string;
}

export function PublicPageHeader({
  eyebrow,
  title,
  description,
  actions,
  centered = false,
  className,
}: PublicPageHeaderProps) {
  return (
    <header
      className={cn(
        'space-y-4 py-6',
        centered ? 'mx-auto max-w-3xl text-center' : 'max-w-4xl',
        className,
      )}
    >
      {eyebrow ? (
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">{eyebrow}</p>
      ) : null}
      <div className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight md:text-5xl">{title}</h1>
        {description ? (
          <p className={cn('text-sm font-medium leading-relaxed text-muted-foreground md:text-base', centered && 'mx-auto max-w-2xl')}>
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className={cn('flex flex-wrap gap-3', centered && 'justify-center')}>{actions}</div> : null}
    </header>
  );
}

interface PublicStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  variant?: 'empty' | 'error' | 'loading';
  className?: string;
}

export function PublicState({
  icon: Icon,
  title,
  description,
  action,
  variant = 'empty',
  className,
}: PublicStateProps) {
  const StateIcon = Icon ?? (variant === 'loading' ? Loader2 : AlertCircle);

  return (
    <Card className={cn('glass-panel border-dashed border-white/70', className)}>
      <CardContent className="flex min-h-48 flex-col items-center justify-center gap-3 p-8 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <StateIcon className={cn('size-6', variant === 'loading' && 'animate-spin')} />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-bold">{title}</h2>
          {description ? <p className="max-w-md text-sm font-medium text-muted-foreground">{description}</p> : null}
        </div>
        {action ? <div className="pt-2">{action}</div> : null}
      </CardContent>
    </Card>
  );
}

export function RetryButton({ onClick, label = 'Thử lại' }: { onClick: () => void; label?: string }) {
  return (
    <Button type="button" variant="outline" className="rounded-xl border-primary/30 bg-white/70 font-semibold" onClick={onClick}>
      {label}
    </Button>
  );
}
