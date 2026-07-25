'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { AddressForm } from '@/components/booking/AddressForm';
import { formatAddress, type AddressOption } from '@/components/booking/types';
import { deleteAddress, setDefaultAddress } from './actions';

export function AddressesManager({ addresses }: { addresses: AddressOption[] }) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const refresh = () => {
    setAdding(false);
    setEditingId(null);
    router.refresh();
  };

  const remove = (id: string) => {
    setError(null);
    startTransition(async () => {
      const result = await deleteAddress(id);
      if (result.ok) router.refresh();
      else setError(result.error);
    });
  };

  const makeDefault = (id: string) => {
    setError(null);
    startTransition(async () => {
      const result = await setDefaultAddress(id);
      if (result.ok) router.refresh();
      else setError(result.error);
    });
  };

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-emergency">{error}</p>}

      {addresses.length === 0 && !adding && (
        <p className="rounded-xl border border-dashed border-white/15 p-8 text-center text-sm text-zinc-500">
          No addresses yet — add the first place we should service.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {addresses.map((a) =>
          editingId === a.id ? (
            <div key={a.id} className="rounded-xl border border-volt/40 bg-surface p-5 sm:col-span-2">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-300">
                Edit address
              </h3>
              <AddressForm
                address={a}
                onSaved={refresh}
                onCancel={() => setEditingId(null)}
              />
            </div>
          ) : (
            <div key={a.id} className="rounded-xl border border-white/10 bg-surface p-5">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-volt" />
                <span className="font-semibold text-white">{a.label || a.line1}</span>
                {a.is_default && <Badge variant="volt">Default</Badge>}
              </div>
              <p className="mt-1 text-sm text-zinc-400">{formatAddress(a)}</p>
              <p className="mt-1 text-xs capitalize text-zinc-500">{a.property_type}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="ghost" size="sm" onClick={() => setEditingId(a.id)}>
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
                {!a.is_default && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => makeDefault(a.id)}
                    disabled={pending}
                  >
                    <Star className="h-3.5 w-3.5" /> Make default
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="hover:border-emergency/60 hover:text-emergency"
                  onClick={() => remove(a.id)}
                  disabled={pending}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </Button>
              </div>
            </div>
          ),
        )}
      </div>

      {adding ? (
        <div className="rounded-xl border border-white/10 bg-surface p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-300">
            New address
          </h3>
          <AddressForm onSaved={refresh} onCancel={() => setAdding(false)} />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex items-center gap-2 rounded-lg border border-dashed border-white/20 px-4 py-3 text-sm text-zinc-300 transition-colors hover:border-volt/50 hover:text-volt"
        >
          <Plus className="h-4 w-4" /> Add an address
        </button>
      )}
    </div>
  );
}
