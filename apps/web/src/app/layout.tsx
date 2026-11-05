import type { Metadata } from 'next';
import './globals.css';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Upwork Auto Bidder — Assistant',
  description: 'Internal job finder, scorer and proposal draft assistant for Amazon design services.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900">
        <header className="border-b border-slate-200 bg-white sticky top-0 z-10 shadow-sm">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className="bg-emerald-600 text-white font-bold px-2.5 py-1 rounded text-sm tracking-wide">
                UAB
              </span>
              <div>
                <h1 className="text-base font-semibold text-slate-900 leading-tight">
                  Upwork Proposal Assistant
                </h1>
                <p className="text-xs text-slate-500">Internal MVP · Human-Submit Only</p>
              </div>
            </div>

            <nav className="flex items-center space-x-6 text-sm font-medium">
              <Link href="/" className="text-slate-600 hover:text-slate-900 transition-colors">
                Dashboard
              </Link>
              <Link href="/queue" className="text-slate-600 hover:text-slate-900 transition-colors">
                Review Queue
              </Link>
              <Link
                href="/settings/connection"
                className="text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-md hover:bg-emerald-100 transition-colors"
              >
                Upwork Connection
              </Link>
            </nav>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
