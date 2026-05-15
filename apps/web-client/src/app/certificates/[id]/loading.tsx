import { Loader2 } from 'lucide-react';

export default function CertificateDetailLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="size-10 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Đang tải chứng chỉ...</p>
      </div>
    </div>
  );
}
