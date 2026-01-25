'use client';

import { useAppSelector } from '@/lib/redux/hooks';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { logoutAction } from '@/app/actions/auth';
import { useAppDispatch } from '@/lib/redux/hooks';
import { logout } from '@/lib/redux/authSlice';

export default function DashboardPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { user, isAuthenticated } = useAppSelector((state) => state.auth);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  const handleLogout = async () => {
    await logoutAction();
    dispatch(logout());
    router.push('/login');
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 via-white to-indigo-50 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-white rounded-lg shadow-lg border-0 p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-slate-800">Dashboard</h1>
              <p className="text-slate-600 mt-1">Welcome back, {user.name}!</p>
            </div>
            <Button onClick={handleLogout} variant="outline" className="border-2 border-slate-300 hover:bg-slate-50">
              Logout
            </Button>
          </div>
          
          <div className="grid gap-6">
            <Card className="border-l-4 border-l-blue-600 shadow-sm">
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-slate-500">Full Name</p>
                    <p className="text-lg font-semibold text-slate-800">{user.name}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-500">Email Address</p>
                    <p className="text-lg font-semibold text-slate-800">{user.email}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-500">Role</p>
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                      {user.role}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-500">User ID</p>
                    <p className="text-sm font-mono text-slate-600">{user.id}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
