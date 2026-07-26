import type { Metadata } from 'next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { InvoiceForm } from './InvoiceForm';

export const metadata: Metadata = { title: 'Create Invoice — Pikavolt Admin' };

export default function AdminInvoicesPage() {
  return (
    <div>
      <h1 className="mb-1 font-display text-2xl uppercase tracking-wide text-white sm:text-3xl">
        Create <span className="text-volt">Invoice</span>
      </h1>
      <p className="mb-6 max-w-2xl text-sm text-zinc-400">
        Send a custom invoice for a large job — collect an upfront amount now and the balance when
        the work is done. The customer pays by a secure link (card or bank transfer); no account
        required.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>New invoice</CardTitle>
        </CardHeader>
        <CardContent>
          <InvoiceForm />
        </CardContent>
      </Card>
    </div>
  );
}
