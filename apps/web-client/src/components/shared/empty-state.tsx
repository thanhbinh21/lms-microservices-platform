import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LucideIcon } from 'lucide-react';
import Link from 'next/link';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
}

export function EmptyState({ icon: Icon, title, description, actionLabel, actionHref }: EmptyStateProps) {
  return (
    <Card className="glass-panel border-dashed border-2 py-12 flex flex-col items-center justify-center text-center">
      <Icon className="size-16 text-muted-foreground/30 mb-4" />
      <h3 className="text-xl font-bold mb-2">{title}</h3>
      <p className="text-muted-foreground text-sm font-medium max-w-sm mb-6">{description}</p>
      {actionLabel && actionHref && (
        <Link href={actionHref}>
          <Button className="px-8 font-bold shadow-md rounded-full">{actionLabel}</Button>
        </Link>
      )}
    </Card>
  );
}
