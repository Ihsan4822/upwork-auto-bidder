import type { Metadata } from 'next';
import './globals.css';
import HeaderAuth from '../components/HeaderAuth';
import HeaderNav from '../components/HeaderNav';

export const metadata: Metadata = {
  title: 'Upwork Auto Bidder - Assistant',
  description:
    'Internal job finder, scorer and proposal draft assistant for Amazon design services.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 overflow-x-clip">
        <header className="border-b border-slate-200 bg-white sticky top-0 z-10 shadow-sm relative">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
              <span className="bg-emerald-600 text-white font-bold px-2 py-0.5 sm:px-2.5 sm:py-1 rounded text-xs sm:text-sm tracking-wide shrink-0">
                UAB
              </span>
              <div className="min-w-0">
                <h1 className="text-sm sm:text-base font-semibold text-slate-900 leading-tight truncate">
                  Upwork Assistant
                </h1>
                <p className="text-[10px] sm:text-xs text-slate-500 truncate hidden lg:block">Internal MVP . Human-Submit Only</p>
              </div>
            </div>

            <div className="flex items-center space-x-2 sm:space-x-4 min-w-0">
              <HeaderNav />
              <HeaderAuth />
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
