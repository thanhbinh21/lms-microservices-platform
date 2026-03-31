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

## Cập nhật sau task glassmorphism-heavy - 2026-03-31

### Background
- Nền tổng: **đậm hơn rõ rệt** — dùng multi-layer radial gradient với opacity cao hơn (0.40–0.55) thay vì 0.15–0.25.
- Orb blur: tăng kích thước (600–650px) và opacity (0.28–0.32), `filter: blur(70–80px)`.
- Grid overlay: tăng opacity đường kẻ lên `rgba(50,100,220,0.10)` (từ 0.06).
- Base gradient: shift sang tông xanh đậm hơn — dùng `#b8d4f8 → #d6e8ff → #e8f2ff → #c8dcf8`.

### Glass surface (cập nhật `glass-panel`)
- Background: `rgba(200,224,255,0.42)` — tăng từ `bg-card/62` lên tông xanh có sắc rõ hơn.
- Backdrop-filter: `blur(28px) saturate(220%)` — tăng từ blur(16px).
- Border: `1px solid rgba(255,255,255,0.72)` — giữ border trắng cao để tạo viền kính.
- Box-shadow: `0 10px 48px rgba(29,78,216,0.22), 0 2px 8px rgba(0,0,0,0.08), inset 0 1.5px 0 rgba(255,255,255,1)`.
- Shine overlay: pseudo `::before` height 48%, `rgba(255,255,255,0.28→0)` gradient.

### Typography (đậm hơn)
- Heading màu: `#071a45` (navy đậm) thay vì `--foreground` nhạt.
- Body text màu: `#2d4a80` — đủ tương phản trên nền xanh.
- Muted text: `#4a6090`.
- Font-weight heading: 800 cho display title, 700 cho card title.

### Button
- Primary: `background: linear-gradient(135deg, #1338b0, #2563eb)`, `box-shadow: 0 6px 28px rgba(19,56,176,0.55)`.
- Ghost/outline: `background: rgba(255,255,255,0.55)`, `border: 1px solid rgba(255,255,255,0.9)`.

### Navbar
- Background: `rgba(180,210,255,0.35)` + `backdrop-filter: blur(20px) saturate(200%)`.
- Border-bottom: `1px solid rgba(255,255,255,0.55)`.

### Floating elements (micro-cards)
- Dùng animation `floaty`: `translateY(0) → translateY(-10px)`, duration 3.2s ease-in-out infinite alternate.
- Avatar: border `2.5px solid rgba(255,255,255,0.95)` để nổi bật trên nền kính.