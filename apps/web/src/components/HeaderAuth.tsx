'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export default function HeaderAuth() {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let isMounted = true;
    fetch('/api/auth/me')
      .then((res) => {
        if (res.ok) return res.json();
        return null;
      })
      .then((data) => {
        if (isMounted && data?.email) {
          setUserEmail(data.email);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [pathname]);

  async function handleLogout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      setUserEmail(null);
      router.push('/login');
      router.refresh();
    }
  }

  if (!userEmail) {
    if (pathname === '/login') return null;
    return (
      <a
        href="/login"
        className="text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-300 px-2.5 py-1 rounded"
      >
        Sign in
      </a>
    );
  }

  return (
    <div className="flex items-center space-x-3 text-xs">
      <span className="text-slate-600 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-md font-mono">
        {userEmail}
      </span>
      <button
        type="button"
        onClick={handleLogout}
        className="text-red-600 hover:text-red-700 font-medium transition-colors"
      >
        Sign out
      </button>
    </div>
  );
}
