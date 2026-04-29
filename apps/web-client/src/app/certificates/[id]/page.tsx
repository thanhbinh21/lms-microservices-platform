'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Award, Loader2, ArrowLeft, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppSelector } from '@/lib/redux/hooks';
import { getCertificateByIdAction, type CertificateDetail } from '@/app/actions/learning';

function printCertificate() {
  window.print();
}

export default function CertificatePreviewPage() {
  const params = useParams();
  const certificateNumber = params.id as string;
  const user = useAppSelector((state) => state.auth.user);

  const [cert, setCert] = useState<CertificateDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await getCertificateByIdAction(certificateNumber);
      if (res.success && res.data) {
        setCert(res.data);
      }
      setLoading(false);
    })();
  }, [certificateNumber]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="size-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!cert) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-4">
        <p className="text-lg font-semibold text-slate-700">Chung chi khong ton tai</p>
        <Link href="/dashboard/certificates">
          <Button variant="outline">Quay lai</Button>
        </Link>
      </div>
    );
  }

  const completedDate = new Date(cert.completedAt).toLocaleDateString('vi-VN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const issuedDate = new Date(cert.issuedAt).toLocaleDateString('vi-VN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-amber-50 py-8 px-4">
      {/* Controls */}
      <div className="mx-auto mb-6 flex max-w-3xl items-center justify-between gap-3 print:hidden">
        <Link href="/dashboard/certificates">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="size-4" />
            Quay lai
          </Button>
        </Link>
        <div className="flex gap-2">
          <Button variant="outline" onClick={printCertificate} className="gap-2">
            <Printer className="size-4" />
            In chung chi
          </Button>
        </div>
      </div>

      {/* Certificate */}
      <div className="mx-auto max-w-3xl">
        <div
          id="certificate-print-area"
          className="relative overflow-hidden rounded-2xl border-4 border-amber-300 bg-white shadow-2xl print:shadow-none print:rounded-none print:border-0"
          style={{ aspectRatio: '1.414', minHeight: '500px' }}
        >
          {/* Decorative corner */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute left-0 top-0 h-20 w-20 border-l-4 border-t-4 border-amber-300 rounded-tl-2xl" />
            <div className="absolute right-0 top-0 h-20 w-20 border-r-4 border-t-4 border-amber-300 rounded-tr-2xl" />
            <div className="absolute bottom-0 left-0 h-20 w-20 border-b-4 border-l-4 border-amber-300 rounded-bl-2xl" />
            <div className="absolute bottom-0 right-0 h-20 w-20 border-b-4 border-r-4 border-amber-300 rounded-br-2xl" />
          </div>

          <div className="flex h-full flex-col items-center justify-center px-8 py-6 text-center">
            {/* Icon */}
            <div className="mb-3 flex size-16 items-center justify-center rounded-full bg-amber-100 text-amber-600 print:size-20">
              <Award className="size-9 print:size-12" />
            </div>

            <p className="mb-1 text-xs font-bold uppercase tracking-[0.3em] text-amber-600 print:text-sm">
              NexEdu Learning Platform
            </p>
            <h1 className="mb-4 text-2xl font-bold tracking-wide text-slate-800 print:text-4xl">
              CERTIFICATE OF COMPLETION
            </h1>

            <p className="mb-6 max-w-lg text-sm leading-relaxed text-slate-600 print:text-base">
              This is to certify that
            </p>

            <p className="mb-2 text-2xl font-bold italic text-slate-800 print:text-3xl">
              {user?.name || 'Hoc vien'}
            </p>

            <p className="mb-6 max-w-lg text-sm leading-relaxed text-slate-600 print:text-base">
              has successfully completed the course
            </p>

            <p className="mb-4 text-xl font-bold text-slate-800 print:text-2xl">
              {cert.course.title}
            </p>

            {cert.template && (
              <p className="mb-6 text-xs italic text-slate-500">
                using the &ldquo;{cert.template.name}&rdquo; template
              </p>
            )}

            <div className="mt-auto flex w-full max-w-lg items-end justify-between gap-4 pt-4">
              <div className="text-center">
                <div className="mb-1 h-px w-32 bg-slate-400" />
                <p className="text-xs text-slate-500 print:text-sm">
                  {completedDate}
                </p>
                <p className="text-[10px] text-slate-400 print:text-xs">Date of Completion</p>
              </div>

              <div className="text-center">
                <div className="mb-1 flex size-10 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600 print:size-14">
                  <Award className="size-5 print:size-7" />
                </div>
              </div>

              <div className="text-center">
                <div className="mb-1 h-px w-32 bg-slate-400" />
                <p className="text-xs text-slate-500 print:text-sm">
                  Issued: {issuedDate}
                </p>
              </div>
            </div>

            <p className="mt-4 text-[10px] font-mono text-slate-400 print:text-xs">
              Certificate ID: {cert.certificateNumber}
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          #certificate-print-area,
          #certificate-print-area * { visibility: visible; }
          #certificate-print-area { position: fixed; top: 0; left: 0; width: 100%; border: none; border-radius: 0; }
          @page { margin: 0; size: A4 landscape; }
        }
      `}</style>
    </div>
  );
}
