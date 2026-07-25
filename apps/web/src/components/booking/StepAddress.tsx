'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import { AddressForm } from './AddressForm';
import { formatAddress, type AddressOption } from './types';

interface StepAddressProps {
  addresses: AddressOption[];
  selectedAddressId: string | null;
  onSelect: (id: string) => void;
}

export function StepAddress({ addresses, selectedAddressId, onSelect }: StepAddressProps) {
  const [adding, setAdding] = useState(addresses.length === 0);
  const router = useRouter();

  return (
    <div className="space-y-4">
      {addresses.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {addresses.map((a) => {
            const selected = a.id === selectedAddressId;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => onSelect(a.id)}
                aria-pressed={selected}
                className={cn(
                  'rounded-xl border p-4 text-left transition-all',
                  selected
                    ? 'border-volt/70 bg-volt/10 shadow-volt-glow'
                    : 'border-white/10 bg-surface hover:border-white/30',
                )}
              >
                <div className="flex items-center gap-2">
                  <MapPin className={cn('h-4 w-4', selected ? 'text-volt' : 'text-zinc-500')} />
                  <span className="font-semibold text-white">
                    {a.label || a.line1}
                  </span>
                  {a.is_default && <Badge variant="volt">Default</Badge>}
                </div>
                <p className="mt-1 text-sm text-zinc-400">{formatAddress(a)}</p>
                <p className="mt-1 text-xs capitalize text-zinc-500">{a.property_type}</p>
              </button>
            );
          })}
        </div>
      )}

      {adding ? (
        <div className="rounded-xl border border-white/10 bg-surface p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-300">
            New service address
          </h3>
          <AddressForm
            onSaved={(id) => {
              setAdding(false);
              onSelect(id);
              router.refresh();
            }}
            onCancel={addresses.length > 0 ? () => setAdding(false) : undefined}
            submitLabel="Save & use this address"
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex items-center gap-2 rounded-lg border border-dashed border-white/20 px-4 py-3 text-sm text-zinc-300 transition-colors hover:border-volt/50 hover:text-volt"
        >
          <Plus className="h-4 w-4" /> Add a new address
        </button>
      )}
    </div>
  );
}
