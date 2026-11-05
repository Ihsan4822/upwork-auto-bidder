import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="space-y-8">
      {/* Safe Model Notification Banner */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-start space-x-3">
        <div className="bg-emerald-600 text-white rounded-full p-1 mt-0.5 text-xs font-bold w-5 h-5 flex items-center justify-center">
          ✓
        </div>
        <div>
          <h2 className="text-sm font-semibold text-emerald-900">Safe Model Active</h2>
          <p className="text-xs text-emerald-800 mt-0.5 leading-relaxed">
            Strict read-only MCP access. Auto-submit, auto-boost, and messaging access are completely disabled.
            All proposals are reviewed and submitted manually by human hands on Upwork.
          </p>
        </div>
      </div>

      {/* Main Status Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
          <p className="text-xs uppercase font-medium text-slate-500 tracking-wider">Jobs Found</p>
          <p className="text-2xl font-bold text-slate-900 mt-2">0</p>
          <span className="text-xs text-slate-400 mt-1 block">Awaiting MCP connection</span>
        </div>

        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
          <p className="text-xs uppercase font-medium text-slate-500 tracking-wider">Filtered Out</p>
          <p className="text-2xl font-bold text-slate-900 mt-2">0</p>
          <span className="text-xs text-slate-400 mt-1 block">Floors: $15/hr & $100 fixed</span>
        </div>

        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
          <p className="text-xs uppercase font-medium text-slate-500 tracking-wider">Drafts Ready</p>
          <p className="text-2xl font-bold text-slate-900 mt-2">0</p>
          <span className="text-xs text-slate-400 mt-1 block">Pending human review</span>
        </div>

        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
          <p className="text-xs uppercase font-medium text-slate-500 tracking-wider">Submitted Manually</p>
          <p className="text-2xl font-bold text-slate-900 mt-2">0</p>
          <span className="text-xs text-slate-400 mt-1 block">Zero Connects spent by app</span>
        </div>
      </div>

      {/* Next Action Box */}
      <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">Step 2: Connect Upwork Read-Only MCP</h3>
        <p className="text-sm text-slate-600 mt-1 leading-relaxed">
          To begin monitoring jobs and generating proposal drafts, review the permission boundaries and authorize
          the read-only connection through the official Upwork MCP server.
        </p>

        <div className="mt-5">
          <Link
            href="/settings/connection"
            className="inline-flex items-center px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-md shadow-sm transition-colors"
          >
            Review Permissions & Connect Upwork →
          </Link>
        </div>
      </div>
    </div>
  );
}
