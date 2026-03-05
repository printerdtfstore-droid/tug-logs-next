import Link from 'next/link';
import { signIn } from './actions';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="min-h-dvh flex items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md rounded-2xl border bg-white p-6 shadow-sm">
        <div className="mb-6">
          <div className="text-xs font-semibold tracking-widest text-emerald-700">
            TUG LOGS
          </div>
          <h1 className="mt-2 text-xl font-bold">Sign in</h1>
          <p className="mt-1 text-sm text-slate-600">
            Use your crew/admin account.
          </p>
        </div>

        {error ? (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        <form action={signIn} className="space-y-3">
          <label className="block">
            <span className="text-sm font-medium">Email</span>
            <input
              name="email"
              type="email"
              required
              className="mt-1 w-full rounded-xl border px-3 py-2"
              placeholder="you@company.com"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium">Password</span>
            <input
              name="password"
              type="password"
              required
              className="mt-1 w-full rounded-xl border px-3 py-2"
            />
          </label>

          <button className="w-full rounded-xl bg-emerald-700 px-4 py-2.5 font-semibold text-white">
            Sign in
          </button>
        </form>

        <p className="mt-4 text-xs text-slate-500">
          Need a user created? Create it in Supabase Auth (for now).
        </p>

        <div className="mt-6 text-xs text-slate-500">
          <Link className="underline" href="/tasks">
            Go to tasks
          </Link>
        </div>
      </div>
    </div>
  );
}
