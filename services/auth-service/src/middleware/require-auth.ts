import { createRequireAuth } from '@lms/types';

export const requireAuth = createRequireAuth({
  unauthorizedMessage: 'Unauthorized - vui long dang nhap',
});
