'use client';

import { useState } from 'react';
import { UserCircle } from 'lucide-react';

interface InstructorAvatarProps {
  src?: string | null;
  alt: string;
  className?: string;
  fallbackClassName?: string;
}

export function InstructorAvatar({
  src,
  alt,
  className = 'size-full object-cover',
  fallbackClassName = 'size-full text-primary/30',
}: InstructorAvatarProps) {
  const [error, setError] = useState(false);

  // Nếu không có nguồn ảnh hoặc tải ảnh bị lỗi, hiển thị icon fallback ngay lập tức
  if (!src || error) {
    return <UserCircle className={fallbackClassName} />;
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setError(true)}
    />
  );
}
