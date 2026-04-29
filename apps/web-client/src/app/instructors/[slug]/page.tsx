import { SharedNavbar } from '@/components/shared/shared-navbar';
import { SharedFooter } from '@/components/shared/shared-footer';
import { getInstructorBySlugAction } from '@/app/actions/instructor';
import { UserCircle, BookOpen, Star, Users, Globe, Youtube, Facebook, Twitter, Linkedin, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export default async function InstructorProfilePublicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const result = await getInstructorBySlugAction(slug);
  
  if (!result.success || !result.data) {
    notFound();
  }

  const { profile, courseCount, averageRating, courses } = result.data;
  
  const socialIcons: Record<string, React.ReactNode> = {
    website: <Globe className="size-4" />,
    youtube: <Youtube className="size-4" />,
    facebook: <Facebook className="size-4" />,
    twitter: <Twitter className="size-4" />,
    linkedin: <Linkedin className="size-4" />
  };

  const socialLabels: Record<string, string> = {
    website: 'Website',
    youtube: 'YouTube',
    facebook: 'Facebook',
    twitter: 'Twitter',
    linkedin: 'LinkedIn'
  };

  return (
    <div className="glass-page min-h-screen text-foreground pb-24 relative overflow-hidden">
      <div className="absolute top-0 right-[-10%] w-[50%] h-[50%] rounded-full bg-primary/5 blur-[150px] pointer-events-none" />

      <SharedNavbar />

      <main className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8 relative z-10 space-y-12">
        {/* Profile Banner / Header */}
        <div className="rounded-3xl border border-white/60 bg-white/60 p-8 md:p-12 backdrop-blur-md shadow-sm">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
            <div className="relative size-32 md:size-40 shrink-0 overflow-hidden rounded-full border-4 border-white shadow-md bg-slate-50">
              {profile.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatar} alt={profile.displayName} className="size-full object-cover" />
              ) : (
                <UserCircle className="size-full text-slate-300" />
              )}
            </div>
            
            <div className="flex-1 text-center md:text-left space-y-4">
              <div>
                <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{profile.displayName}</h1>
                <p className="text-lg text-primary font-medium mt-2">{profile.headline || 'Giảng viên tại NexEdu'}</p>
              </div>
              
              <div className="flex flex-wrap justify-center md:justify-start gap-6 pt-2">
                <div className="flex items-center gap-2">
                  <div className="flex size-10 items-center justify-center rounded-full bg-blue-100/50 text-blue-600">
                    <BookOpen className="size-5" />
                  </div>
                  <div>
                    <p className="text-xl font-bold leading-none">{courseCount}</p>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mt-1">Khóa học</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <div className="flex size-10 items-center justify-center rounded-full bg-amber-100/50 text-amber-600">
                    <Star className="size-5" />
                  </div>
                  <div>
                    <p className="text-xl font-bold leading-none">{averageRating.toFixed(1)}</p>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mt-1">Đánh giá</p>
                  </div>
                </div>
              </div>
              
              {/* Social Links */}
              {profile.socialLinks && Object.values(profile.socialLinks).some(link => link) && (
                <div className="flex flex-wrap gap-2 justify-center md:justify-start pt-2">
                  {Object.entries(profile.socialLinks).map(([key, url]) => {
                    if (!url) return null;
                    return (
                      <a 
                        key={key} 
                        href={url as string} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 hover:text-primary"
                      >
                        {socialIcons[key]} {socialLabels[key]}
                      </a>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bio Section */}
        {profile.bio && (
          <div className="space-y-4 px-2">
            <h2 className="text-2xl font-bold">Giới thiệu</h2>
            <div className="prose prose-slate max-w-none text-muted-foreground whitespace-pre-wrap">
              {profile.bio}
            </div>
          </div>
        )}

        {/* Courses Section */}
        {courses.length > 0 && (
          <div className="space-y-6 px-2 pt-8 border-t border-slate-200/50">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Khóa học nổi bật</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {courses.map((course) => (
                <Link key={course.id} href={`/courses/${course.slug}`}>
                  <div className="group h-full overflow-hidden rounded-3xl border border-white/60 bg-white/50 transition-all hover:-translate-y-1 hover:shadow-lg hover:border-primary/20 flex flex-col">
                    <div className="relative aspect-video w-full bg-slate-100 overflow-hidden">
                      {course.thumbnail ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={course.thumbnail} alt={course.title} className="size-full object-cover transition-transform duration-500 group-hover:scale-105" />
                      ) : (
                        <div className="flex size-full items-center justify-center bg-primary/5 text-primary/40">
                          <BookOpen className="size-12" />
                        </div>
                      )}
                      <div className="absolute right-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-md">
                        {course.level === 'BEGINNER' ? 'Cơ bản' : course.level === 'INTERMEDIATE' ? 'Trung cấp' : 'Nâng cao'}
                      </div>
                    </div>
                    
                    <div className="p-5 flex flex-col flex-1">
                      <h3 className="text-lg font-bold line-clamp-2 group-hover:text-primary transition-colors">{course.title}</h3>
                      
                      <div className="mt-auto pt-4 flex items-center justify-between">
                        <span className="text-lg font-extrabold text-primary">
                          {course.price > 0 ? `${course.price.toLocaleString('vi-VN')} đ` : 'Miễn phí'}
                        </span>
                        
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-500">
                          <Star className="size-3.5 fill-current" />
                          <span>{course.averageRating.toFixed(1)}</span>
                          <span className="text-muted-foreground font-normal">({course.ratingCount})</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            
            {courseCount > 6 && (
              <div className="flex justify-center pt-6">
                <Link 
                  href={`/courses?instructor=${profile.id}`} 
                  className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline"
                >
                  Xem tất cả {courseCount} khóa học
                  <ExternalLink className="size-4" />
                </Link>
              </div>
            )}
          </div>
        )}
      </main>

      <SharedFooter />
    </div>
  );
}
