# LMS Design Tokens

> Cập nhật lần cuối: [ngày]
> Source of truth cho toàn bộ giá trị visual trong dự án.

## Colors
- Primary: `hsl(var(--primary))` — màu chính của thương hiệu
- Primary foreground: `hsl(var(--primary-foreground))`
- Muted: `hsl(var(--muted))` — background nhẹ cho card, badge
- Destructive: `hsl(var(--destructive))` — lỗi, xóa

## Spacing scale (tuân theo Tailwind defaults)
- Section gap: `gap-8` (32px)
- Card inner padding: `p-6` (24px)  
- Item gap trong list: `gap-4` (16px)
- Form field gap: `gap-2` (8px)

## Border radius
- Card: `rounded-xl` (12px)
- Button: `rounded-md` (6px)
- Badge: `rounded-full`
- Input: `rounded-md`

## Typography
- Page title: `text-2xl font-semibold`
- Section heading: `text-xl font-medium`
- Card title: `text-base font-medium`
- Body: `text-sm text-muted-foreground`
- Caption: `text-xs text-muted-foreground`

## Shadow
- Card: `shadow-sm`
- Dropdown: `shadow-md`
- Modal: `shadow-xl`

## UI States pattern
- Loading: dùng `<Skeleton>` của Shadcn, height match với element thật
- Empty: icon + heading + mô tả ngắn + CTA button
- Error: `<Alert variant="destructive">` của Shadcn + retry button

## Cập nhật sau task landing-page-nexedu - 2026-03-19
- Không có thay đổi token.

## Cập nhật sau task glassmorphism-tuning - 2026-03-19
- Thêm pattern surface: `glass-panel` = `bg-card/62 + backdrop-blur + border mờ + shadow mềm`.
- Giữ palette theo 3 tông chủ đạo: trắng, xanh dương, đen thông qua `--background`, `--primary`, `--foreground`.

## Cập nhật sau task glassmorphism-white-theme - 2026-03-19
- Typography chính: dùng Be Vietnam Pro cho toàn bộ giao diện web-client.
- Nền chủ đạo: trắng làm base, giữ lớp gradient xanh trắng rất nhẹ để tạo chiều sâu.
- Hạn chế dùng màu đen đậm: ưu tiên text `--foreground` sáng hơn và bóng/viền theo tông xanh.