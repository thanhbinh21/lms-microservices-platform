'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { UserCircle, Sparkles, Upload, Loader2, Save } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import {
  getMyInstructorProfileAction,
  updateMyInstructorProfileAction,
  requestMediaUploadAction,
  confirmMediaUploadAction,
  type InstructorProfileDto
} from '@/app/actions/instructor';

export default function InstructorProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<InstructorProfileDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  const [displayName, setDisplayName] = useState('');
  const [headline, setHeadline] = useState('');
  const [bio, setBio] = useState('');
  const [slug, setSlug] = useState('');
  const [avatar, setAvatar] = useState('');
  const [socialLinks, setSocialLinks] = useState({
    website: '',
    facebook: '',
    youtube: '',
    twitter: '',
    linkedin: ''
  });
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function load() {
      const res = await getMyInstructorProfileAction();
      if (res.success && res.data) {
        setProfile(res.data);
        setDisplayName(res.data.displayName);
        setHeadline(res.data.headline || '');
        setBio(res.data.bio || '');
        setSlug(res.data.slug || '');
        setAvatar(res.data.avatar || '');
        setSocialLinks({
          website: res.data.socialLinks?.website || '',
          facebook: res.data.socialLinks?.facebook || '',
          youtube: res.data.socialLinks?.youtube || '',
          twitter: res.data.socialLinks?.twitter || '',
          linkedin: res.data.socialLinks?.linkedin || ''
        });
      }
      setLoading(false);
    }
    load();
  }, []);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Vui lÃ²ng chá»n file áº£nh há»£p lá»‡ (jpg, png).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('KÃ­ch thÆ°á»›c áº£nh tá»‘i Ä‘a lÃ  5MB.');
      return;
    }

    try {
      setUploading(true);
      setError('');
      
      const res = await requestMediaUploadAction({
        filename: file.name,
        mimeType: file.type,
        size: file.size,
        type: 'IMAGE',
      });

      if (!res.success || !res.data) {
        throw new Error(res.message || 'KhÃ´ng thá»ƒ láº¥y URL upload');
      }

      const { presignedUrl, mediaId } = res.data;

      let uploadRes;
      if (res.data.uploadMethod === 'POST_FORM' && res.data.uploadFields) {
         const formData = new FormData();
         Object.entries(res.data.uploadFields).forEach(([k, v]) => formData.append(k, v));
         formData.append('file', file);
         uploadRes = await fetch(presignedUrl, { method: 'POST', body: formData });
      } else {
         uploadRes = await fetch(presignedUrl, {
            method: 'PUT',
            headers: { 'Content-Type': file.type },
            body: file,
         });
      }

      if (!uploadRes.ok) {
        throw new Error('Upload áº£nh tháº¥t báº¡i');
      }

      const confirmRes = await confirmMediaUploadAction(mediaId);
      if (confirmRes.success && confirmRes.data?.url) {
        setAvatar(confirmRes.data.url);
        toast('success', 'Upload ảnh đại diện thành công');
      } else {
        throw new Error('KhÃ´ng thá»ƒ xÃ¡c nháº­n upload');
      }
      
    } catch (err: any) {
      setError(err.message || 'CÃ³ lá»—i xáº£y ra khi upload áº£nh.');
      toast('error', 'Upload ảnh đại diện thất bại', err?.message || 'Vui lòng thử lại.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');
      setSuccess('');
      
      const res = await updateMyInstructorProfileAction({
        displayName,
        headline,
        bio,
        slug,
        avatar,
        socialLinks
      });
      
      if (!res.success) {
        setError(res.message || 'CÃ³ lá»—i xáº£y ra khi lÆ°u thÃ´ng tin.');
        toast('error', 'Lưu thông tin kênh thất bại', res.message || 'Vui lòng thử lại.');
        return;
      }
      
      setSuccess('ÄÃ£ lÆ°u thÃ´ng tin kÃªnh thÃ nh cÃ´ng.');
      toast('success', 'Đã lưu thông tin kênh');
      if (res.data) {
        setSlug(res.data.slug);
      }
      
      setTimeout(() => setSuccess(''), 3000);
      
    } catch (err: any) {
      setError(err.message || 'CÃ³ lá»—i xáº£y ra.');
      toast('error', 'Lưu thông tin kênh thất bại', err?.message || 'Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="workspace-page">
      {/* Page header */}
      <div className="workspace-page-header">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary">
          <Sparkles className="size-3.5" />
          NexEdu Studio
        </div>
        <h1 className="workspace-page-title">KÃªnh cá»§a tÃ´i</h1>
        <p className="workspace-page-description">
          Cáº¥u hÃ¬nh há»“ sÆ¡ vÃ  hiá»ƒn thá»‹ cÃ´ng khai cá»§a giáº£ng viÃªn.
        </p>
      </div>

      <div className="mx-auto max-w-3xl space-y-6 pb-20">
        
        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}
        
        {success && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            {success}
          </div>
        )}

        {/* Basic Info */}
        <Card className="rounded-2xl border-white/60 bg-white/50 backdrop-blur-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <UserCircle className="size-4 text-primary" />
              <CardTitle className="text-sm font-bold">ThÃ´ng tin cÆ¡ báº£n</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            
            {/* Avatar upload */}
            <div className="flex items-center gap-6">
              <div className="relative size-24 shrink-0 overflow-hidden rounded-full border border-slate-200 bg-slate-100">
                {avatar ? (
                   // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatar} alt="Avatar" className="size-full object-cover" />
                ) : (
                  <UserCircle className="size-full text-slate-300" />
                )}
                {uploading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <Loader2 className="size-6 animate-spin text-white" />
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <p className="text-sm font-bold text-slate-700">áº¢nh Ä‘áº¡i diá»‡n</p>
                <p className="text-xs text-muted-foreground">Khuyáº¿n nghá»‹ áº£nh vuÃ´ng, tá»‘i thiá»ƒu 256x256px.</p>
                <input 
                  type="file" 
                  accept="image/png, image/jpeg, image/webp" 
                  className="hidden" 
                  ref={fileInputRef}
                  onChange={handleAvatarUpload}
                />
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  className="mt-2 text-xs font-semibold"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  <Upload className="mr-2 size-3.5" />
                  Táº£i áº£nh lÃªn
                </Button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground">TÃªn hiá»ƒn thá»‹ <span className="text-destructive">*</span></label>
                <Input 
                  placeholder="Nháº­p tÃªn hiá»ƒn thá»‹" 
                  value={displayName} 
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground">ÄÆ°á»ng dáº«n kÃªnh (Slug)</label>
                <Input 
                  placeholder="VD: nguyen-van-a (Ä‘á»ƒ trá»‘ng sáº½ tá»± táº¡o)" 
                  value={slug} 
                  onChange={(e) => setSlug(e.target.value)}
                  className="rounded-xl"
                />
                <p className="text-[10px] text-muted-foreground">Link: /instructors/{slug || '...'}</p>
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground">Headline (Giá»›i thiá»‡u ngáº¯n gá»n)</label>
              <Input 
                placeholder="VD: ChuyÃªn gia phÃ¡t triá»ƒn pháº§n má»m | Giáº£ng viÃªn láº­p trÃ¬nh" 
                value={headline} 
                onChange={(e) => setHeadline(e.target.value)}
                className="rounded-xl"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground">Tiá»ƒu sá»­ (Bio)</label>
              <textarea 
                className="min-h-32 w-full rounded-xl border border-input bg-white p-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" 
                placeholder="MÃ´ táº£ chi tiáº¿t vá» kinh nghiá»‡m, ká»¹ nÄƒng vÃ  báº£n thÃ¢n..." 
                value={bio}
                onChange={(e) => setBio(e.target.value)}
              />
            </div>

          </CardContent>
        </Card>

        {/* Social Links */}
        <Card className="rounded-2xl border-white/60 bg-white/50 backdrop-blur-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              <CardTitle className="text-sm font-bold">Máº¡ng xÃ£ há»™i</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground">Website / Portfolio</label>
                <Input 
                  placeholder="https://" 
                  value={socialLinks.website} 
                  onChange={(e) => setSocialLinks({...socialLinks, website: e.target.value})}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground">Facebook</label>
                <Input 
                  placeholder="https://facebook.com/..." 
                  value={socialLinks.facebook} 
                  onChange={(e) => setSocialLinks({...socialLinks, facebook: e.target.value})}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground">YouTube</label>
                <Input 
                  placeholder="https://youtube.com/..." 
                  value={socialLinks.youtube} 
                  onChange={(e) => setSocialLinks({...socialLinks, youtube: e.target.value})}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground">LinkedIn</label>
                <Input 
                  placeholder="https://linkedin.com/in/..." 
                  value={socialLinks.linkedin} 
                  onChange={(e) => setSocialLinks({...socialLinks, linkedin: e.target.value})}
                  className="rounded-xl"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4">
          <Button variant="outline" className="rounded-xl font-bold" onClick={() => router.back()}>
            Há»§y
          </Button>
          <Button className="rounded-xl font-bold" onClick={handleSave} disabled={saving || !displayName}>
            {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
            LÆ°u thay Ä‘á»•i
          </Button>
        </div>

      </div>
    </div>
  );
}


