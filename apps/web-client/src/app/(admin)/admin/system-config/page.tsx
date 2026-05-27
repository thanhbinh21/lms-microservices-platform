'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Bell, Bot, CreditCard, Loader2, Lock, Percent, RotateCcw, Save, Wallet } from 'lucide-react';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminStatCard } from '@/components/admin/AdminStatCard';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';
import {
  getAdminSystemConfigsAction,
  upsertAdminSystemConfigAction,
  type AdminSystemConfigDto,
} from '@/app/actions/admin';

type SettingType = 'number' | 'boolean' | 'text' | 'select';

interface SettingDefinition {
  key: string;
  label: string;
  description: string;
  type: SettingType;
  defaultValue: string | number | boolean;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  options?: Array<{ label: string; value: string }>;
}

interface SettingGroup {
  id: string;
  title: string;
  description: string;
  icon: ReactNode;
  settings: SettingDefinition[];
}

const SETTING_GROUPS: SettingGroup[] = [
  {
    id: 'revenue',
    title: 'Doanh thu & phí nền tảng',
    description: 'Quy định tỉ lệ chia sẻ doanh thu giữa nền tảng và giảng viên.',
    icon: <Percent className="size-5" />,
    settings: [
      {
        key: 'platform_fee_pct',
        label: 'Phí nền tảng (%)',
        description: 'Phần trăm nền tảng giữ lại trên mỗi đơn thanh toán thành công.',
        type: 'number',
        defaultValue: 30,
        min: 0,
        max: 100,
        step: 1,
        unit: '%',
      },
      {
        key: 'instructor_revenue_pct',
        label: 'Tỉ lệ giảng viên nhận (%)',
        description: 'Phần trăm doanh thu ghi nhận cho giảng viên sau khi trừ phí nền tảng.',
        type: 'number',
        defaultValue: 70,
        min: 0,
        max: 100,
        step: 1,
        unit: '%',
      },
    ],
  },
  {
    id: 'payout',
    title: 'Rút tiền / payout',
    description: 'Điều kiện và SLA xử lý yêu cầu rút tiền của giảng viên.',
    icon: <Wallet className="size-5" />,
    settings: [
      {
        key: 'payout_min_amount_vnd',
        label: 'Số tiền rút tối thiểu',
        description: 'Yêu cầu rút tiền thấp hơn ngưỡng này sẽ không được tạo.',
        type: 'number',
        defaultValue: 200000,
        min: 0,
        max: 50000000,
        step: 10000,
        unit: 'VND',
      },
      {
        key: 'payout_processing_days',
        label: 'Thời gian xử lý payout',
        description: 'Số ngày làm việc dự kiến để admin hoàn tất chi trả.',
        type: 'number',
        defaultValue: 3,
        min: 1,
        max: 30,
        step: 1,
        unit: 'ngày',
      },
      {
        key: 'payout_auto_approve_enabled',
        label: 'Tự động duyệt payout',
        description: 'Chỉ bật khi đã có kiểm soát chống gian lận và hạn mức rõ ràng.',
        type: 'boolean',
        defaultValue: false,
      },
    ],
  },
  {
    id: 'payment',
    title: 'Thanh toán',
    description: 'Cấu hình provider thanh toán và thời hạn đơn chờ thanh toán.',
    icon: <CreditCard className="size-5" />,
    settings: [
      {
        key: 'payment_provider',
        label: 'Cổng thanh toán mặc định',
        description: 'Provider được dùng khi học viên tạo đơn thanh toán.',
        type: 'select',
        defaultValue: 'VNPAY',
        options: [{ label: 'VNPay', value: 'VNPAY' }],
      },
      {
        key: 'vnpay_enabled',
        label: 'Bật VNPay',
        description: 'Tắt khi cần tạm dừng tạo URL thanh toán mới qua VNPay.',
        type: 'boolean',
        defaultValue: true,
      },
      {
        key: 'order_pending_minutes',
        label: 'Thời hạn đơn chờ thanh toán',
        description: 'Sau thời gian này, đơn PENDING sẽ cần tạo URL thanh toán mới.',
        type: 'number',
        defaultValue: 15,
        min: 1,
        max: 1440,
        step: 1,
        unit: 'phút',
      },
    ],
  },
  {
    id: 'notification',
    title: 'Thông báo',
    description: 'Kiểm soát gửi email và cảnh báo vận hành cho admin.',
    icon: <Bell className="size-5" />,
    settings: [
      {
        key: 'email_notifications_enabled',
        label: 'Gửi email hệ thống',
        description: 'Cho phép notification-service gửi email giao dịch và vận hành.',
        type: 'boolean',
        defaultValue: true,
      },
      {
        key: 'admin_alert_email',
        label: 'Email nhận cảnh báo admin',
        description: 'Địa chỉ nhận cảnh báo sự kiện lỗi, payout và thanh toán bất thường.',
        type: 'text',
        defaultValue: 'admin@nexedu.vn',
      },
    ],
  },
  {
    id: 'ai',
    title: 'AI',
    description: 'Giới hạn tính năng AI để tránh vượt quota và chi phí.',
    icon: <Bot className="size-5" />,
    settings: [
      {
        key: 'ai_features_enabled',
        label: 'Bật tính năng AI',
        description: 'Cho phép học viên dùng AI chat và quiz trong trang học.',
        type: 'boolean',
        defaultValue: true,
      },
      {
        key: 'ai_monthly_quota_per_user',
        label: 'Quota AI mỗi người dùng / tháng',
        description: 'Số lượt gọi AI tối đa cho mỗi người dùng trong một tháng.',
        type: 'number',
        defaultValue: 300,
        min: 0,
        max: 10000,
        step: 10,
        unit: 'lượt',
      },
    ],
  },
  {
    id: 'security',
    title: 'Bảo mật',
    description: 'Các ngưỡng bảo vệ tài khoản và phiên đăng nhập.',
    icon: <Lock className="size-5" />,
    settings: [
      {
        key: 'max_login_attempts',
        label: 'Số lần đăng nhập sai tối đa',
        description: 'Tài khoản có thể bị tạm khóa sau số lần đăng nhập sai liên tiếp.',
        type: 'number',
        defaultValue: 5,
        min: 1,
        max: 20,
        step: 1,
        unit: 'lần',
      },
      {
        key: 'session_max_age_days',
        label: 'Thời hạn phiên đăng nhập',
        description: 'Số ngày refresh token còn hiệu lực trước khi phải đăng nhập lại.',
        type: 'number',
        defaultValue: 7,
        min: 1,
        max: 30,
        step: 1,
        unit: 'ngày',
      },
      {
        key: 'admin_ip_allowlist',
        label: 'Danh sách IP admin',
        description: 'Tùy chọn. Nhập nhiều IP, phân tách bằng dấu phẩy. Để trống nếu chưa áp dụng.',
        type: 'text',
        defaultValue: '',
      },
    ],
  },
];

const DEFINITIONS = SETTING_GROUPS.flatMap((group) => group.settings);

function normalizeValue(value: unknown, definition: SettingDefinition) {
  if (value === undefined || value === null) return String(definition.defaultValue);
  if (definition.type === 'boolean') return String(Boolean(value));
  if (definition.type === 'number') return String(Number(value));
  return String(value);
}

function parseValue(value: string, definition: SettingDefinition): string | number | boolean {
  if (definition.type === 'boolean') return value === 'true';
  if (definition.type === 'number') return Number(value);
  return value.trim();
}

function validateValue(value: string, definition: SettingDefinition) {
  if (definition.type === 'number') {
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue)) return 'Giá trị phải là số hợp lệ.';
    if (definition.min !== undefined && numberValue < definition.min) return `Giá trị tối thiểu là ${definition.min}.`;
    if (definition.max !== undefined && numberValue > definition.max) return `Giá trị tối đa là ${definition.max}.`;
  }

  if (definition.key === 'admin_alert_email' && value.trim()) {
    const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
    if (!validEmail) return 'Email nhận cảnh báo không hợp lệ.';
  }

  if (definition.type === 'select' && definition.options && !definition.options.some((option) => option.value === value)) {
    return 'Giá trị không nằm trong danh sách cho phép.';
  }

  return '';
}

export default function AdminSystemConfigPage() {
  const [configs, setConfigs] = useState<AdminSystemConfigDto[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    definition: SettingDefinition | null;
    nextValue: string;
  }>({ isOpen: false, definition: null, nextValue: '' });

  async function loadConfigs() {
    setLoading(true);
    setError('');
    const result = await getAdminSystemConfigsAction();
    if (!result.success || !result.data) {
      setError(result.message || 'Không thể tải cấu hình hệ thống.');
      setLoading(false);
      return;
    }

    const configMap = new Map(result.data.map((item) => [item.key, item]));
    const nextValues = Object.fromEntries(
      DEFINITIONS.map((definition) => [
        definition.key,
        normalizeValue(configMap.get(definition.key)?.value, definition),
      ]),
    );
    setConfigs(result.data);
    setValues(nextValues);
    setLoading(false);
  }

  useEffect(() => {
    void loadConfigs();
  }, []);

  const configMap = useMemo(() => new Map(configs.map((item) => [item.key, item])), [configs]);
  const configuredCount = DEFINITIONS.filter((definition) => configMap.has(definition.key)).length;
  const changedCount = DEFINITIONS.filter((definition) => values[definition.key] !== normalizeValue(configMap.get(definition.key)?.value, definition)).length;
  const platformFee = values.platform_fee_pct ?? '30';
  const payoutMin = Number(values.payout_min_amount_vnd ?? 200000);

  function openSaveConfirm(definition: SettingDefinition) {
    const nextValue = values[definition.key] ?? normalizeValue(undefined, definition);
    const validationError = validateValue(nextValue, definition);
    if (validationError) {
      toast('error', 'Giá trị chưa hợp lệ', validationError);
      return;
    }
    setConfirmDialog({ isOpen: true, definition, nextValue });
  }

  async function saveSetting() {
    if (!confirmDialog.definition) return;
    const definition = confirmDialog.definition;
    const nextValue = confirmDialog.nextValue;
    setSavingKey(definition.key);

    const result = await upsertAdminSystemConfigAction({
      key: definition.key,
      value: parseValue(nextValue, definition),
      description: definition.description,
    });

    setSavingKey(null);
    if (!result.success) {
      toast('error', 'Không thể lưu cấu hình', result.message || 'Vui lòng thử lại.');
      return;
    }

    toast('success', 'Đã lưu cấu hình', 'Thay đổi đã được ghi vào audit log.');
    setConfirmDialog({ isOpen: false, definition: null, nextValue: '' });
    await loadConfigs();
  }

  function resetToDefault(definition: SettingDefinition) {
    setValues((current) => ({ ...current, [definition.key]: String(definition.defaultValue) }));
  }

  return (
    <div className="workspace-page space-y-6">
      <AdminPageHeader
        title="Cấu hình hệ thống"
        description="Quản lý các tham số vận hành quan trọng bằng trường nhập có validation rõ ràng. Mọi thay đổi được ghi audit log."
        actions={
          <Button variant="outline" className="gap-2" onClick={() => void loadConfigs()} disabled={loading}>
            <RotateCcw className="size-4" />
            Tải lại
          </Button>
        }
      />

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard label="Setting có định nghĩa" value={DEFINITIONS.length} hint="Được nhóm theo nghiệp vụ" />
        <AdminStatCard label="Đã cấu hình trong DB" value={loading ? '...' : configuredCount} hint="Còn lại dùng giá trị mặc định" />
        <AdminStatCard label="Phí nền tảng" value={loading ? '...' : `${platformFee}%`} hint="platform_fee_pct" tone="success" />
        <AdminStatCard label="Số tiền rút tối thiểu" value={loading ? '...' : payoutMin.toLocaleString('vi-VN')} hint="VND" />
      </div>

      {changedCount > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-800">
          Có {changedCount} cấu hình đã chỉnh trên màn hình nhưng chưa lưu.
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((item) => (
            <div key={item} className="h-40 animate-pulse rounded-xl bg-white/50" />
          ))}
        </div>
      ) : (
        SETTING_GROUPS.map((group) => (
          <Card key={group.id} className="glass-panel rounded-xl border-white/60">
            <CardHeader>
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  {group.icon}
                </div>
                <div>
                  <CardTitle className="text-lg">{group.title}</CardTitle>
                  <CardDescription>{group.description}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {group.settings.map((definition) => {
                const currentValue = values[definition.key] ?? normalizeValue(undefined, definition);
                const persistedValue = normalizeValue(configMap.get(definition.key)?.value, definition);
                const dirty = currentValue !== persistedValue;
                const validationError = validateValue(currentValue, definition);
                const saving = savingKey === definition.key;

                return (
                  <div key={definition.key} className="rounded-xl border border-white/60 bg-white/45 p-4">
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(220px,320px)_auto] lg:items-start">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold">{definition.label}</h3>
                          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-bold uppercase text-zinc-600">
                            {definition.type}
                          </span>
                          {definition.unit && (
                            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase text-primary">
                              {definition.unit}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{definition.description}</p>
                        <p className="mt-2 font-mono text-xs text-muted-foreground">
                          Key: {definition.key} · Mặc định: {String(definition.defaultValue)}
                        </p>
                      </div>

                      <div className="space-y-2">
                        {definition.type === 'boolean' ? (
                          <label className="flex h-10 items-center gap-3 rounded-md border border-input bg-background px-3 text-sm">
                            <input
                              type="checkbox"
                              checked={currentValue === 'true'}
                              onChange={(event) =>
                                setValues((current) => ({ ...current, [definition.key]: String(event.target.checked) }))
                              }
                            />
                            {currentValue === 'true' ? 'Đang bật' : 'Đang tắt'}
                          </label>
                        ) : definition.type === 'select' ? (
                          <select
                            value={currentValue}
                            onChange={(event) =>
                              setValues((current) => ({ ...current, [definition.key]: event.target.value }))
                            }
                            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                          >
                            {(definition.options ?? []).map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <Input
                            type={definition.type === 'number' ? 'number' : 'text'}
                            min={definition.min}
                            max={definition.max}
                            step={definition.step}
                            value={currentValue}
                            onChange={(event) =>
                              setValues((current) => ({ ...current, [definition.key]: event.target.value }))
                            }
                          />
                        )}
                        {validationError && <p className="text-xs font-medium text-red-600">{validationError}</p>}
                      </div>

                      <div className="flex gap-2 lg:justify-end">
                        <Button variant="outline" size="sm" onClick={() => resetToDefault(definition)} disabled={saving}>
                          Mặc định
                        </Button>
                        <Button
                          size="sm"
                          className="gap-2"
                          disabled={!dirty || Boolean(validationError) || saving}
                          onClick={() => openSaveConfirm(definition)}
                        >
                          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                          Lưu
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))
      )}

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => {
          if (!savingKey) setConfirmDialog({ isOpen: false, definition: null, nextValue: '' });
        }}
        onConfirm={saveSetting}
        title="Lưu cấu hình hệ thống"
        message={
          confirmDialog.definition
            ? `Bạn có chắc muốn lưu "${confirmDialog.definition.label}"? Thay đổi này có thể ảnh hưởng trực tiếp đến vận hành và sẽ được ghi audit log.`
            : ''
        }
        confirmLabel="Lưu cấu hình"
        loadingLabel="Đang lưu..."
        loading={Boolean(savingKey)}
      />
    </div>
  );
}
