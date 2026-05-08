'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  getAdminSystemConfigsAction,
  upsertAdminSystemConfigAction,
  type AdminSystemConfigDto,
} from '@/app/actions/admin';

export default function AdminSystemConfigPage() {
  const [configs, setConfigs] = useState<AdminSystemConfigDto[]>([]);
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const [description, setDescription] = useState('');
  const [message, setMessage] = useState('');

  async function loadConfigs() {
    const res = await getAdminSystemConfigsAction();
    if (res.success && res.data) setConfigs(res.data);
  }

  useEffect(() => {
    void loadConfigs();
  }, []);

  async function handleSave() {
    let parsed: unknown = value;
    try {
      parsed = JSON.parse(value);
    } catch {
      parsed = value;
    }
    const res = await upsertAdminSystemConfigAction({ key, value: parsed, description });
    setMessage(res.success ? 'Da luu cau hinh.' : res.message);
    if (res.success) {
      setKey('');
      setValue('');
      setDescription('');
      await loadConfigs();
    }
  }

  return (
    <div className="p-6 md:p-8 space-y-6">
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>System Config</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="Config key" value={key} onChange={(e) => setKey(e.target.value)} />
          <Input placeholder='Value (json or plain text)' value={value} onChange={(e) => setValue(e.target.value)} />
          <Input placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
          <Button onClick={handleSave} disabled={!key || !value}>Save config</Button>
          {message && <p className="text-xs text-muted-foreground">{message}</p>}
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>Current Configs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {configs.map((item) => (
            <div key={item.id} className="rounded-xl border p-3">
              <p className="font-semibold text-sm">{item.key}</p>
              <p className="text-xs text-muted-foreground">{item.description || 'No description'}</p>
              <pre className="mt-2 text-xs overflow-auto rounded bg-slate-50 p-2">
                {JSON.stringify(item.value, null, 2)}
              </pre>
            </div>
          ))}
          {configs.length === 0 && <p className="text-sm text-muted-foreground">Chua co config.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
