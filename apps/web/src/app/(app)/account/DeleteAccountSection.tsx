'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { createClient } from '@/lib/supabase/client';

/**
 * Danger-zone account deletion (App Store 5.1.1(v) / Play policy). Two-step:
 * the destructive button is gated behind typing DELETE, then POSTs to
 * /api/account/delete, signs out, and returns to the home page.
 */
export function DeleteAccountSection() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canDelete = confirm.trim().toUpperCase() === 'DELETE';

  async function handleDelete() {
    if (!canDelete) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/account/delete', { method: 'POST' });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? 'Could not delete your account. Please try again.');
        setLoading(false);
        return;
      }
      // Clear any local session, then leave the authenticated area.
      await createClient().auth.signOut().catch(() => {});
      router.push('/?deleted=1');
      router.refresh();
    } catch {
      setError('Could not delete your account. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div className="mt-10 rounded-xl border border-emergency/40 bg-emergency/5 p-6">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-emergency" />
        <div className="flex-1">
          <h2 className="font-semibold text-white">Delete account</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Permanently deletes your Pikavolt account, profile, saved addresses, appointment
            history, and chat messages. This cannot be undone.
          </p>

          {!open ? (
            <Button
              variant="ghost"
              className="mt-4 border border-emergency/50 text-emergency hover:bg-emergency/10"
              onClick={() => setOpen(true)}
            >
              Delete my account
            </Button>
          ) : (
            <div className="mt-4 space-y-3">
              <label htmlFor="delete-confirm" className="block text-sm text-zinc-300">
                Type <span className="font-semibold text-white">DELETE</span> to confirm.
              </label>
              <Input
                id="delete-confirm"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="DELETE"
                autoComplete="off"
                className="max-w-xs"
              />
              {error && <p className="text-sm text-emergency">{error}</p>}
              <div className="flex gap-3">
                <Button
                  className="border border-emergency/60 bg-emergency/10 text-emergency hover:bg-emergency/20"
                  variant="ghost"
                  onClick={handleDelete}
                  disabled={!canDelete || loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Deleting…
                    </>
                  ) : (
                    'Permanently delete'
                  )}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setOpen(false);
                    setConfirm('');
                    setError(null);
                  }}
                  disabled={loading}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
