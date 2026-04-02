'use client';

import { useEffect, useRef } from 'react';
import { restoreSessionAction } from '@/app/actions/auth';
import { useAppDispatch, useAppSelector, useAppStore } from '@/lib/redux/hooks';
import { logout, setLoading, setUser } from '@/lib/redux/authSlice';

export default function AuthSessionBootstrap() {
  const dispatch = useAppDispatch();
  const store = useAppStore();
  const { isAuthenticated } = useAppSelector((state) => state.auth);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current || isAuthenticated) {
      dispatch(setLoading(false));
      return;
    }

    initializedRef.current = true;

    const restoreSession = async () => {
      dispatch(setLoading(true));
      const result = await restoreSessionAction();

      if (result.success && result.user && result.accessToken) {
        dispatch(
          setUser({
            user: result.user,
            accessToken: result.accessToken,
          }),
        );
        return;
      }

      // Neu nguoi dung da dang nhap trong luc restore (race login vs restore), khong xoa session.
      if (store.getState().auth.isAuthenticated) {
        dispatch(setLoading(false));
        return;
      }

      dispatch(logout());
    };

    restoreSession();
  }, [dispatch, isAuthenticated, store]);

  return null;
}