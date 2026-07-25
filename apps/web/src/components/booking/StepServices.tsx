'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CategoryOption } from './types';

interface StepServicesProps {
  categories: CategoryOption[];
  activeCategorySlug: string | null;
  selectedServiceIds: string[];
  onCategoryChange: (slug: string) => void;
  onToggleService: (id: string) => void;
}

export function StepServices({
  categories,
  activeCategorySlug,
  selectedServiceIds,
  onCategoryChange,
  onToggleService,
}: StepServicesProps) {
  const active =
    categories.find((c) => c.slug === activeCategorySlug) ?? categories[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {categories.map((c) => {
          const selectedInCategory = c.services.filter((s) =>
            selectedServiceIds.includes(s.id),
          ).length;
          return (
            <button
              key={c.slug}
              type="button"
              onClick={() => onCategoryChange(c.slug)}
              className={cn(
                'rounded-full border px-4 py-2 text-sm font-medium transition-colors',
                c.slug === active?.slug
                  ? 'border-volt bg-volt/15 text-volt'
                  : 'border-white/15 text-zinc-300 hover:border-volt/50 hover:text-white',
              )}
            >
              {c.name}
              {selectedInCategory > 0 && (
                <span className="ml-2 rounded-full bg-volt px-1.5 text-xs font-bold text-storm">
                  {selectedInCategory}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {active && (
        <div>
          {active.description && (
            <p className="mb-4 text-sm text-zinc-400">{active.description}</p>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            {active.services.map((s) => {
              const selected = selectedServiceIds.includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onToggleService(s.id)}
                  aria-pressed={selected}
                  className={cn(
                    'flex items-center justify-between gap-2 rounded-lg border px-4 py-3 text-left text-sm transition-all',
                    selected
                      ? 'border-volt/70 bg-volt/10 text-white shadow-volt-glow'
                      : 'border-white/10 bg-surface text-zinc-300 hover:border-white/30',
                  )}
                >
                  <span>{s.name}</span>
                  {selected && <Check className="h-4 w-4 shrink-0 text-volt" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
