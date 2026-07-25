/** DTOs passed from server pages into the booking client components. */

export interface ServiceOption {
  id: string;
  name: string;
}

export interface CategoryOption {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  services: ServiceOption[];
}

export interface AddressOption {
  id: string;
  label: string | null;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  zip: string;
  property_type: string;
  is_default: boolean;
}

export interface BookingConfig {
  serviceCallFeeCents: number;
  depositPercent: number;
  bookingHorizonDays: number;
  cancellationWindowHours: number;
}

export interface SlotChoice {
  startsAt: string;
  endsAt: string;
}

export function formatAddress(a: AddressOption): string {
  return [a.line1, a.line2, `${a.city}, ${a.state} ${a.zip}`].filter(Boolean).join(', ');
}
