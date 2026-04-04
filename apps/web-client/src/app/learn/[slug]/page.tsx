import { notFound, redirect } from 'next/navigation';
import { getPublicCourseDetailAction } from '@/app/actions/instructor';
import { getCourseProgressAction } from '@/app/actions/student';
import { LearnClientUI } from './learn-client-ui';

interface LearnPageProps {
  params: Promise<{ slug: string }>;
}

export default async function LearnPage({ params }: LearnPageProps) {
  const { slug } = await params;
  
  // 1. Fetch course detail
  const cRes = await getPublicCourseDetailAction(slug);
  if (!cRes.success || !cRes.data) {
    notFound();
  }
  const course = cRes.data;

  // 2. Fetch Progress & Enrollment
  const pRes = await getCourseProgressAction(course.id);
  if (!pRes.success || pRes.code !== 200) {
    // Neu chua dang ky (hoac chua dang nhap), day ve trang chi tiet
    redirect(`/courses/${slug}`);
  }

  const progressList = pRes.data || [];

  return (
    <div className="flex h-screen w-full flex-col bg-slate-50 text-slate-900">
      <LearnClientUI course={course} initialProgress={progressList} />
    </div>
  );
}
