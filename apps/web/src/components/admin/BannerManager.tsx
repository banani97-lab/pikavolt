'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Megaphone, Pencil, Trash2, Zap } from 'lucide-react';
import {
  createBanner,
  updateBanner,
  toggleBanner,
  deleteBanner,
  type BannerInput,
} from '@/app/admin/banners/actions';
import { cn } from '@/lib/utils';

export interface BannerRow {
  id: string;
  headline: string;
  body: string | null;
  cta_text: string | null;
  cta_url: string | null;
  theme: string;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  /** Pre-formatted window label from the server. */
  windowLabel: string;
}

type Msg = { kind: 'error' | 'info'; text: string } | null;

const THEME_STYLES: Record<BannerInput['theme'], string> = {
  volt: 'bg-volt text-storm',
  storm: 'border border-white/15 bg-surface text-white',
  emergency: 'bg-emergency text-white',
};

/** Live preview styled like the marketing announcement strip. */
function BannerPreview({
  headline,
  body,
  ctaText,
  theme,
}: {
  headline: string;
  body: string;
  ctaText: string;
  theme: BannerInput['theme'];
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-center gap-2 rounded-lg px-4 py-2 text-center text-sm font-semibold',
        THEME_STYLES[theme],
      )}
    >
      <Zap
        className={cn('h-3.5 w-3.5', theme === 'volt' ? 'text-storm' : 'fill-volt text-volt')}
        aria-hidden="true"
      />
      <span>{headline || 'Your headline here'}</span>
      {body && <span className="font-normal opacity-90">— {body}</span>}
      {ctaText && (
        <span
          className={cn(
            'rounded-full px-3 py-0.5 text-xs font-bold',
            theme === 'volt' ? 'bg-storm text-volt' : 'bg-volt text-storm',
          )}
        >
          {ctaText}
        </span>
      )}
    </div>
  );
}

function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function BannerForm({ editing }: { editing: BannerRow | null }) {
  const router = useRouter();
  const [headline, setHeadline] = useState(editing?.headline ?? '');
  const [body, setBody] = useState(editing?.body ?? '');
  const [ctaText, setCtaText] = useState(editing?.cta_text ?? '');
  const [ctaUrl, setCtaUrl] = useState(editing?.cta_url ?? '');
  const [theme, setTheme] = useState<BannerInput['theme']>(
    (editing?.theme as BannerInput['theme']) ?? 'volt',
  );
  const [startsAt, setStartsAt] = useState(toLocalInput(editing?.starts_at ?? null));
  const [endsAt, setEndsAt] = useState(toLocalInput(editing?.ends_at ?? null));
  const [isActive, setIsActive] = useState(editing?.is_active ?? true);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<Msg>(null);

  const submit = () => {
    setMessage(null);
    const input: BannerInput = {
      headline,
      body,
      ctaText,
      ctaUrl,
      theme,
      startsAt,
      endsAt,
      isActive,
    };
    startTransition(async () => {
      const result = editing ? await updateBanner(editing.id, input) : await createBanner(input);
      if (!result.ok) {
        setMessage({ kind: 'error', text: result.error ?? 'Save failed.' });
        return;
      }
      setMessage({ kind: 'info', text: editing ? 'Banner updated.' : 'Banner created.' });
      if (!editing) {
        setHeadline('');
        setBody('');
        setCtaText('');
        setCtaUrl('');
      }
      router.push('/admin/banners');
      router.refresh();
    });
  };

  return (
    <div className="rounded-xl border border-white/10 bg-surface p-5">
      <h2 className="mb-4 flex items-center gap-2 font-display text-lg uppercase tracking-wide text-white">
        <Megaphone className="h-4 w-4 text-volt" />
        {editing ? `Edit banner` : 'New banner'}
      </h2>

      <div className="mb-4">
        <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-zinc-500">
          Live preview
        </span>
        <BannerPreview headline={headline} body={body} ctaText={ctaText} theme={theme} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="b-headline" className="mb-1.5 block text-sm font-medium text-zinc-300">
            Headline
          </label>
          <input
            id="b-headline"
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            placeholder="Storm season special — free surge protection quote"
            className="h-10 w-full rounded-lg border border-white/15 bg-storm px-3 text-sm text-white placeholder:text-zinc-600"
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="b-body" className="mb-1.5 block text-sm font-medium text-zinc-300">
            Body (optional)
          </label>
          <input
            id="b-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Book before the end of the month."
            className="h-10 w-full rounded-lg border border-white/15 bg-storm px-3 text-sm text-white placeholder:text-zinc-600"
          />
        </div>
        <div>
          <label htmlFor="b-cta" className="mb-1.5 block text-sm font-medium text-zinc-300">
            CTA text
          </label>
          <input
            id="b-cta"
            value={ctaText}
            onChange={(e) => setCtaText(e.target.value)}
            placeholder="Book now"
            className="h-10 w-full rounded-lg border border-white/15 bg-storm px-3 text-sm text-white placeholder:text-zinc-600"
          />
        </div>
        <div>
          <label htmlFor="b-cta-url" className="mb-1.5 block text-sm font-medium text-zinc-300">
            CTA link
          </label>
          <input
            id="b-cta-url"
            value={ctaUrl}
            onChange={(e) => setCtaUrl(e.target.value)}
            placeholder="/book"
            className="h-10 w-full rounded-lg border border-white/15 bg-storm px-3 text-sm text-white placeholder:text-zinc-600"
          />
        </div>
        <div>
          <span className="mb-1.5 block text-sm font-medium text-zinc-300">Theme</span>
          <div className="flex gap-2">
            {(['volt', 'storm', 'emergency'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTheme(t)}
                className={cn(
                  'h-10 flex-1 rounded-lg border text-sm font-semibold capitalize transition-colors',
                  theme === t
                    ? 'border-volt bg-volt/15 text-volt'
                    : 'border-white/15 text-zinc-400 hover:text-white',
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-end pb-2">
          <label className="flex items-center gap-2 text-sm font-medium text-zinc-300">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 accent-volt"
            />
            Active
          </label>
        </div>
        <div>
          <label htmlFor="b-starts" className="mb-1.5 block text-sm font-medium text-zinc-300">
            Window start (optional)
          </label>
          <input
            id="b-starts"
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            className="h-10 w-full rounded-lg border border-white/15 bg-storm px-3 text-sm text-white [color-scheme:dark]"
          />
        </div>
        <div>
          <label htmlFor="b-ends" className="mb-1.5 block text-sm font-medium text-zinc-300">
            Window end (optional)
          </label>
          <input
            id="b-ends"
            type="datetime-local"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            className="h-10 w-full rounded-lg border border-white/15 bg-storm px-3 text-sm text-white [color-scheme:dark]"
          />
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={submit}
          disabled={pending || !headline.trim()}
          className="inline-flex items-center gap-2 rounded-lg bg-volt px-4 py-2 text-sm font-semibold text-storm hover:brightness-105 disabled:pointer-events-none disabled:opacity-50"
        >
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          {editing ? 'Save changes' : 'Create banner'}
        </button>
        {editing && (
          <button
            onClick={() => {
              router.push('/admin/banners');
              router.refresh();
            }}
            className="rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-zinc-300 hover:text-white"
          >
            Cancel edit
          </button>
        )}
        {message && (
          <span
            className={cn(
              'text-sm',
              message.kind === 'error' ? 'text-emergency' : 'text-emerald-400',
            )}
          >
            {message.text}
          </span>
        )}
      </div>
    </div>
  );
}

export function BannerList({ banners }: { banners: BannerRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const doToggle = (id: string, active: boolean) => {
    setError(null);
    startTransition(async () => {
      const result = await toggleBanner(id, active);
      if (!result.ok) setError(result.error ?? 'Toggle failed.');
      router.refresh();
    });
  };

  const doDelete = (id: string) => {
    if (!window.confirm('Delete this banner permanently?')) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteBanner(id);
      if (!result.ok) setError(result.error ?? 'Delete failed.');
      router.refresh();
    });
  };

  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-lg border border-emergency/40 bg-emergency/10 px-3 py-2 text-sm text-emergency">
          {error}
        </p>
      )}
      {banners.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/15 bg-surface/50 p-8 text-center text-sm text-zinc-500">
          No banners yet.
        </div>
      ) : (
        banners.map((b) => (
          <div key={b.id} className="rounded-xl border border-white/10 bg-surface p-4">
            <BannerPreview
              headline={b.headline}
              body={b.body ?? ''}
              ctaText={b.cta_text ?? ''}
              theme={(b.theme as BannerInput['theme']) ?? 'volt'}
            />
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
              <span
                className={cn(
                  'rounded-full border px-2 py-0.5 font-semibold',
                  b.is_active
                    ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300'
                    : 'border-white/15 bg-white/5 text-zinc-500',
                )}
              >
                {b.is_active ? 'Active' : 'Inactive'}
              </span>
              <span className="capitalize">theme: {b.theme}</span>
              <span>{b.windowLabel}</span>
              <span className="flex-1" />
              <button
                onClick={() => doToggle(b.id, !b.is_active)}
                disabled={pending}
                className="rounded-lg border border-white/15 px-3 py-1.5 font-semibold text-zinc-300 hover:border-volt/50 hover:text-volt disabled:opacity-50"
              >
                {b.is_active ? 'Deactivate' : 'Activate'}
              </button>
              <button
                onClick={() => {
                  router.push(`/admin/banners?edit=${b.id}`);
                }}
                className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-3 py-1.5 font-semibold text-zinc-300 hover:border-volt/50 hover:text-volt"
              >
                <Pencil className="h-3 w-3" /> Edit
              </button>
              <button
                onClick={() => doDelete(b.id)}
                disabled={pending}
                className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-3 py-1.5 font-semibold text-zinc-400 hover:border-emergency/50 hover:text-emergency disabled:opacity-50"
              >
                <Trash2 className="h-3 w-3" /> Delete
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
