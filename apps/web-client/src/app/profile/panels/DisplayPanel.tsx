'use client';

import { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Monitor, Moon, Palette, Sun, Globe, Languages, Sparkles } from 'lucide-react';

type ThemeOption = 'light' | 'dark' | 'system';
type LanguageOption = 'vi' | 'en';
type DensityOption = 'comfortable' | 'compact';

const STORAGE_KEY = 'nexedu.display-preferences';

interface Preferences {
  theme: ThemeOption;
  language: LanguageOption;
  density: DensityOption;
  reduceMotion: boolean;
}

const DEFAULT_PREFS: Preferences = {
  theme: 'system',
  language: 'vi',
  density: 'comfortable',
  reduceMotion: false,
};

function loadPrefs(): Preferences {
  if (typeof window === 'undefined') return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<Preferences>) };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function DisplayPanel() {
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFS);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setPrefs(loadPrefs());
  }, []);

  const update = <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  const themeOptions: { id: ThemeOption; label: string; icon: typeof Sun }[] = [
    { id: 'light', label: 'Sáng', icon: Sun },
    { id: 'dark', label: 'Tối', icon: Moon },
    { id: 'system', label: 'Theo hệ thống', icon: Monitor },
  ];

  const languageOptions: { id: LanguageOption; label: string; flag: string }[] = [
    { id: 'vi', label: 'Tiếng Việt', flag: 'VN' },
    { id: 'en', label: 'English', flag: 'EN' },
  ];

  const densityOptions: { id: DensityOption; label: string; description: string }[] = [
    {
      id: 'comfortable',
      label: 'Thoải mái',
      description: 'Khoảng cách rộng, dễ nhìn — khuyến nghị cho máy tính.',
    },
    {
      id: 'compact',
      label: 'Gọn gàng',
      description: 'Hiển thị nhiều nội dung hơn trong cùng một màn hình.',
    },
  ];

  return (
    <div className="space-y-6">
      <Card className="glass-panel rounded-[2rem] border-white/60 shadow-xl">
        <CardHeader className="p-8 pb-4">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Palette className="size-5" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold">Giao diện</CardTitle>
              <CardDescription className="text-sm font-medium">
                Tùy chọn màu sắc phù hợp với môi trường và sở thích của bạn.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-8 pt-2 space-y-6">
          <div className="grid gap-3 sm:grid-cols-3">
            {themeOptions.map((opt) => {
              const active = prefs.theme === opt.id;
              const Icon = opt.icon;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => update('theme', opt.id)}
                  className={`rounded-2xl border-2 p-4 text-left transition-all ${
                    active
                      ? 'border-primary bg-primary/5 shadow-md'
                      : 'border-white/60 bg-white/40 hover:border-primary/40 hover:bg-white/70'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <Icon className={`size-5 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
                    {active && <CheckCircle2 className="size-5 text-primary" />}
                  </div>
                  <p className="mt-2 font-bold">{opt.label}</p>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            Chế độ tối sẽ được áp dụng đầy đủ trong Phase 12 (hiện đang trong giai đoạn hoàn thiện).
          </p>
        </CardContent>
      </Card>

      <Card className="glass-panel rounded-2xl border-white/60">
        <CardHeader className="p-6 pb-3">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
              <Languages className="size-5" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold">Ngôn ngữ hiển thị</CardTitle>
              <CardDescription className="text-sm">
                Chọn ngôn ngữ cho giao diện và nội dung hệ thống.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 pt-2">
          <div className="grid gap-3 sm:grid-cols-2">
            {languageOptions.map((opt) => {
              const active = prefs.language === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => update('language', opt.id)}
                  className={`flex items-center gap-3 rounded-xl border-2 p-3 text-left transition-all ${
                    active
                      ? 'border-primary bg-primary/5'
                      : 'border-white/60 bg-white/40 hover:border-primary/40'
                  }`}
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                    {opt.flag}
                  </span>
                  <span className="font-bold flex-1">{opt.label}</span>
                  {active && <CheckCircle2 className="size-5 text-primary" />}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="glass-panel rounded-2xl border-white/60">
        <CardHeader className="p-6 pb-3">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center">
              <Globe className="size-5" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold">Mật độ hiển thị</CardTitle>
              <CardDescription className="text-sm">
                Điều chỉnh khoảng cách giữa các thành phần giao diện.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 pt-2">
          <div className="grid gap-3 sm:grid-cols-2">
            {densityOptions.map((opt) => {
              const active = prefs.density === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => update('density', opt.id)}
                  className={`rounded-xl border-2 p-4 text-left transition-all ${
                    active
                      ? 'border-primary bg-primary/5'
                      : 'border-white/60 bg-white/40 hover:border-primary/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="font-bold">{opt.label}</p>
                    {active && <CheckCircle2 className="size-5 text-primary" />}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{opt.description}</p>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="glass-panel rounded-2xl border-white/60">
        <CardHeader className="p-6 pb-3">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <Sparkles className="size-5" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold">Hiệu ứng chuyển động</CardTitle>
              <CardDescription className="text-sm">
                Giảm chuyển động nếu bạn nhạy cảm với animation.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 pt-2">
          <label className="flex items-center justify-between rounded-xl border border-white/60 bg-white/40 p-4 cursor-pointer hover:bg-white/70 transition-colors">
            <div>
              <p className="font-bold text-sm">Giảm chuyển động</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Tắt các hiệu ứng fade/scroll reveal khi chuyển trang.
              </p>
            </div>
            <input
              type="checkbox"
              checked={prefs.reduceMotion}
              onChange={(e) => update('reduceMotion', e.target.checked)}
              className="size-5 accent-primary"
            />
          </label>
        </CardContent>
      </Card>

      {saved && (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-xl animate-in fade-in zoom-in">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="size-4" />
            Đã lưu tùy chọn
          </span>
        </div>
      )}

      <Button
        variant="ghost"
        onClick={() => {
          setPrefs(DEFAULT_PREFS);
          if (typeof window !== 'undefined') window.localStorage.removeItem(STORAGE_KEY);
          setSaved(true);
          setTimeout(() => setSaved(false), 1800);
        }}
        className="w-full rounded-xl font-bold text-muted-foreground"
      >
        Khôi phục cài đặt mặc định
      </Button>
    </div>
  );
}
