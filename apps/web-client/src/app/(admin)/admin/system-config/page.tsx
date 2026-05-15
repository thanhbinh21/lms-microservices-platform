'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusMessage } from '@/components/ui/status-message';
import {
  getAdminSystemConfigsAction,
  upsertAdminSystemConfigAction,
  type AdminSystemConfigDto,
} from '@/app/actions/admin';

export default function AdminSystemConfigPage() {
  const [configs, setConfigs] = useState<AdminSystemConfigDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const [description, setDescription] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  async function loadConfigs() {
    setLoading(true);
    const res = await getAdminSystemConfigsAction();
    if (res.success && res.data) setConfigs(res.data);
    setLoading(false);
  }

  useEffect(() => {
    void loadConfigs();
  }, []);

  async function handleSave() {
    if (!key.trim() || !value.trim()) return;
    setSaving(true);
    setMessage(null);
    let parsed: unknown = value;
    try {
      parsed = JSON.parse(value);
    } catch {
      parsed = value;
    }
    const res = await upsertAdminSystemConfigAction({ key: key.trim(), value: parsed, description: description.trim() });
    setSaving(false);
    if (res.success) {
      setMessage({ type: 'success', text: 'ÄÃ£ lÆ°u cáº¥u hÃ¬nh.' });
      setKey('');
      setValue('');
      setDescription('');
      await loadConfigs();
    } else {
      setMessage({ type: 'error', text: res.message || 'KhÃ´ng thá»ƒ lÆ°u cáº¥u hÃ¬nh.' });
    }
  }

  return (
    <div className="workspace-page space-y-6">
      <div className="mb-2">
        <h1 className="workspace-page-title">Cáº¥u hÃ¬nh há»‡ thá»‘ng</h1>
        <p className="workspace-page-description">
          Quáº£n lÃ½ cáº¥u hÃ¬nh toÃ n há»‡ thá»‘ng. Má»i thay Ä‘á»•i Ä‘Æ°á»£c ghi audit log.
        </p>
      </div>

      <Card className="rounded-2xl border-white/60 bg-white/50 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="text-base">ThÃªm / cáº­p nháº­t cáº¥u hÃ¬nh</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="KhÃ³a cáº¥u hÃ¬nh (VD: platform_fee_pct)" value={key} onChange={(e) => setKey(e.target.value)} />
          <Input placeholder="GiÃ¡ trá»‹ (JSON hoáº·c text thuáº§n)" value={value} onChange={(e) => setValue(e.target.value)} />
          <Input placeholder="MÃ´ táº£ (tÃ¹y chá»n)" value={description} onChange={(e) => setDescription(e.target.value)} />
          <div className="flex items-center gap-3">
            <Button onClick={handleSave} disabled={saving || !key.trim() || !value.trim()} className="rounded-xl font-bold shadow-md">
              {saving ? 'Äang lÆ°u...' : 'LÆ°u cáº¥u hÃ¬nh'}
            </Button>
            {message && <StatusMessage type={message.type} message={message.text} />}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-white/60 bg-white/50 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="text-base">Cáº¥u hÃ¬nh hiá»‡n táº¡i</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 animate-pulse rounded-xl bg-zinc-100" />
              ))}
            </div>
          ) : configs.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">ChÆ°a cÃ³ cáº¥u hÃ¬nh nÃ o.</p>
          ) : (
            configs.map((item) => (
              <div key={item.id} className="rounded-xl border border-zinc-200 bg-white/70 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-sm font-mono">{item.key}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.description || 'KhÃ´ng cÃ³ mÃ´ táº£'}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-zinc-600">
                    {typeof item.value === 'object' ? 'JSON' : 'TEXT'}
                  </span>
                </div>
                <pre className="mt-3 max-h-32 overflow-auto rounded-lg bg-zinc-950 p-3 text-xs text-zinc-100">
                  {JSON.stringify(item.value, null, 2)}
                </pre>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}


