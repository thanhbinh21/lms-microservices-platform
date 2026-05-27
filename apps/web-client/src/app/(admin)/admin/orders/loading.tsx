import { Loader2 } from 'lucide-react';

export default function LoadingAdminOrders() {
  return (
    <div className="workspace-page flex items-center justify-center py-24 text-muted-foreground">
      <Loader2 className="mr-2 size-6 animate-spin" />
      Đang tải đơn hàng…
    </div>
  );
}
