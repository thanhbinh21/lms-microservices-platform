import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { ProfileSettings } from './ProfileSettings';

export default function ProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="glass-page flex min-h-screen items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      }
    >
      <ProfileSettings />
    </Suspense>
  );
}
