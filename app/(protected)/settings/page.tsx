import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import LoginHistory from '@/components/settings/LoginHistory'
import DemoAccess from '@/components/settings/DemoAccess'
import AgeSetting from '@/components/settings/AgeSetting'

export default async function SettingsPage() {
  const session = await getServerSession(authOptions)
  const isAdmin =
    !session?.isDemo && session?.user?.email === process.env.ADMIN_EMAIL

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Settings</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Account and security settings</p>
      </div>

      {/* Account section */}
      <section className="bg-white rounded-2xl border border-zinc-200 divide-y divide-zinc-100">
        <div className="px-5 py-4">
          <h2 className="text-sm font-semibold text-zinc-900 uppercase tracking-wide text-xs">Account</h2>
        </div>
        <div className="px-5 py-4 flex items-center justify-between">
          <span className="text-sm text-zinc-500">Email</span>
          <span className="text-sm text-zinc-900 font-medium">{session?.user?.email ?? '—'}</span>
        </div>
        <div className="px-5 py-4 flex items-center justify-between">
          <span className="text-sm text-zinc-500">Role</span>
          <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 font-medium">
            {session?.isDemo ? 'Demo' : 'Admin'}
          </span>
        </div>
      </section>

      {/* Training section — age drives the MAF band on run heart rate charts */}
      {isAdmin && (
        <section className="bg-white rounded-2xl border border-zinc-200 divide-y divide-zinc-100">
          <div className="px-5 py-4">
            <h2 className="text-sm font-semibold text-zinc-900 uppercase tracking-wide text-xs">Training</h2>
          </div>
          <div className="px-5 py-5">
            <AgeSetting />
          </div>
        </section>
      )}

      {/* Security section — login history contains the admin's IPs/locations */}
      {isAdmin && (
        <section className="bg-white rounded-2xl border border-zinc-200 divide-y divide-zinc-100">
          <div className="px-5 py-4">
            <h2 className="text-sm font-semibold text-zinc-900 uppercase tracking-wide text-xs">Security</h2>
          </div>
          <div className="px-5 py-5">
            <LoginHistory />
          </div>
        </section>
      )}

      {/* Demo access — admin only */}
      {isAdmin && (
        <section className="bg-white rounded-2xl border border-zinc-200 divide-y divide-zinc-100">
          <div className="px-5 py-4">
            <h2 className="text-sm font-semibold text-zinc-900 uppercase tracking-wide text-xs">Demo Access</h2>
          </div>
          <div className="px-5 py-5">
            <DemoAccess />
          </div>
        </section>
      )}
    </div>
  )
}
