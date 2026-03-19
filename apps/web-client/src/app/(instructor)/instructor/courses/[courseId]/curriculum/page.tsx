'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ArrowLeft, GripVertical, Plus, Settings, Video, AlignLeft, Edit3, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { getCourseCurriculumAction, updateCurriculumOrderAction } from '@/app/actions/instructor';

interface LessonView {
  id: string;
  title: string;
  type: 'video' | 'text';
}

interface ChapterView {
  id: string;
  title: string;
  lessons: LessonView[];
}

export default function CurriculumEditorPage() {
  const router = useRouter();
  const params = useParams();
  const [chapters, setChapters] = useState<ChapterView[]>([]);
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setMounted(true); // Prevent SSR mismatch with DragDropContext
    const fetchCurriculum = async () => {
      const courseId = String(params.courseId);
      const result = await getCourseCurriculumAction(courseId);
      if (result.success && result.data) {
        const mapped: ChapterView[] = result.data.chapters.map((chapter) => ({
          id: chapter.id,
          title: chapter.title,
          lessons: chapter.lessons.map((lesson) => ({
            id: lesson.id,
            title: lesson.title,
            type: lesson.videoUrl ? 'video' : 'text',
          })),
        }));
        setChapters(mapped);
      }
      setLoading(false);
    };

    fetchCurriculum();
  }, []);

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    
    // Only handling chapter reorder for now
    if (result.type === 'chapter') {
      const items = Array.from(chapters);
      const [reorderedItem] = items.splice(result.source.index, 1);
      items.splice(result.destination.index, 0, reorderedItem);
      setChapters(items);
      const courseId = String(params.courseId);
      updateCurriculumOrderAction(courseId, items.map((item) => item.id));
    }
  };

  const addChapter = () => {
    setChapters([...chapters, { id: `ch_new_${Date.now()}`, title: 'Chương mới', lessons: [] }]);
  };

  if (!mounted) return null;
  if (loading) return <div className="p-8 text-muted-foreground">Đang tải giáo trình từ API...</div>;

  return (
    <div className="p-8">
      <Link href={`/instructor/courses/${params.courseId}`} className="flex items-center text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors mb-6 w-fit">
        <ArrowLeft className="w-4 h-4 mr-2" /> Quay lại cài đặt
      </Link>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Soạn giáo trình</h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">Kéo thả để sắp xếp chương và bài học theo logic của bạn.</p>
        </div>
        <Button className="rounded-xl shadow-md font-bold px-6" onClick={addChapter}>
          <Plus className="mr-2 h-5 w-5" /> Thêm phần mới
        </Button>
      </div>

      <div className="max-w-4xl">
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="chapters" type="chapter">
            {(provided) => (
              <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-6">
                
                {chapters.map((chapter, index) => (
                  <Draggable key={chapter.id} draggableId={chapter.id} index={index}>
                    {(provided, snapshot) => (
                      <Card
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={`rounded-3xl border-white/60 bg-white/70 backdrop-blur-xl shadow-sm transition-all ${snapshot.isDragging ? 'shadow-2xl shadow-primary/20 scale-[1.02] ring-2 ring-primary' : ''}`}
                      >
                        {/* Chapter Header */}
                        <div className="flex items-center justify-between p-4 border-b border-border/50 bg-slate-50/50 rounded-t-3xl">
                           <div className="flex items-center gap-3">
                              <div {...provided.dragHandleProps} className="p-2 hover:bg-slate-200 rounded-md cursor-grab active:cursor-grabbing">
                                <GripVertical className="size-5 text-slate-400" />
                              </div>
                              <span className="font-bold text-lg">{chapter.title}</span>
                           </div>
                           <div className="flex items-center gap-2">
                              <Button variant="ghost" size="sm" className="font-semibold text-primary hover:bg-primary/10">
                                <Edit3 className="size-4 mr-1.5" /> Sửa
                              </Button>
                              <Button variant="ghost" size="sm" className="font-semibold text-destructive hover:bg-destructive/10 px-2">
                                <Trash2 className="size-4" />
                              </Button>
                           </div>
                        </div>
                        
                        {/* Lessons List inside Chapter */}
                        <div className="p-4 space-y-3 bg-white/50">
                           {chapter.lessons.length === 0 ? (
                             <p className="text-sm font-medium text-slate-400 text-center py-4">Chưa có bài học nào trong phần này.</p>
                           ) : (
                             chapter.lessons.map((lesson, lsIdx) => (
                               <div key={lesson.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white shadow-sm hover:border-primary/40 transition-colors group">
                                  <div className="flex items-center gap-3">
                                     <GripVertical className="size-4 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab" />
                                     <div className="p-1.5 rounded-md bg-slate-100 text-slate-500">
                                        {lesson.type === 'video' ? <Video className="size-4" /> : <AlignLeft className="size-4" />}
                                     </div>
                                     <span className="font-bold text-sm text-slate-700">{lesson.title}</span>
                                  </div>
                                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-primary"><Edit3 className="size-4" /></Button>
                                  </div>
                               </div>
                             ))
                           )}

                           <div className="pt-2">
                              <Button variant="outline" size="sm" className="rounded-lg w-full border-dashed border-2 py-5 font-bold text-slate-500 hover:text-primary hover:border-primary/50 hover:bg-primary/5">
                                <Plus className="size-4 mr-2" /> Thêm Bài Học
                              </Button>
                           </div>
                        </div>
                      </Card>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      </div>
    </div>
  );
}
