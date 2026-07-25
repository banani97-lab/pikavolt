import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import {
  PromotionCreateForm,
  DeactivatePromotionButton,
} from '@/components/admin/PromotionsManager';
import { fmtDate, fmtUSD } from '@/components/admin/format';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Promotions' };
export const dynamic = 'force-dynamic';

interface PromoRow {
  id: string;
  code: string;
  percent_off: number | null;
  amount_off_cents: number | null;
  active: boolean;
  stripe_promotion_code_id: string | null;
  created_at: string;
}

function stripeConfigured(): boolean {
  const key = process.env.STRIPE_SECRET_KEY;
  return Boolean(key && key.startsWith('sk_') && !key.toUpperCase().includes('PLACEHOLDER'));
}

export default async function AdminPromotionsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('promotions')
    .select('id, code, percent_off, amount_off_cents, active, stripe_promotion_code_id, created_at')
    .order('created_at', { ascending: false });

  const promos = (data ?? []) as PromoRow[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl uppercase tracking-wide text-white sm:text-3xl">
          Promotions
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Promo codes are created in Stripe and cached here for the booking flow.
        </p>
      </div>

      {!stripeConfigured() && (
        <div className="rounded-lg border border-orange-400/40 bg-orange-400/10 px-4 py-3 text-sm text-orange-300">
          Stripe not configured yet — promo creation is disabled until a real
          STRIPE_SECRET_KEY is added to the environment.
        </div>
      )}

      <PromotionCreateForm />

      <div className="overflow-x-auto rounded-xl border border-white/10 bg-surface">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead>
            <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-zinc-500">
              <th className="px-4 py-3 font-medium">Code</th>
              <th className="px-4 py-3 font-medium">Discount</th>
              <th className="px-4 py-3 font-medium">Created</th>
              <th className="px-4 py-3 font-medium">Stripe</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {promos.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-zinc-500">
                  No promotions yet.
                </td>
              </tr>
            ) : (
              promos.map((p) => (
                <tr key={p.id} className="transition-colors hover:bg-white/[0.03]">
                  <td className="px-4 py-3 font-mono font-semibold text-white">{p.code}</td>
                  <td className="px-4 py-3 text-volt">
                    {p.percent_off !== null
                      ? `${p.percent_off}% off`
                      : `${fmtUSD(p.amount_off_cents)} off`}
                  </td>
                  <td className="px-4 py-3 text-zinc-400">{fmtDate(p.created_at)}</td>
                  <td className="px-4 py-3 text-xs text-zinc-500">
                    {p.stripe_promotion_code_id ?? 'not linked'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'rounded-full border px-2 py-0.5 text-xs font-semibold',
                        p.active
                          ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300'
                          : 'border-white/15 bg-white/5 text-zinc-500',
                      )}
                    >
                      {p.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {p.active ? (
                      <DeactivatePromotionButton id={p.id} />
                    ) : (
                      <span className="block text-right text-xs text-zinc-600">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
