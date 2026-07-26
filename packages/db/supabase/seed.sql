-- Pikavolt LLC — seed data
-- Source of truth: docs/owner-content.md

-- ---------------------------------------------------------------------------
-- business_hours (0 = Sunday .. 6 = Saturday)
-- ---------------------------------------------------------------------------
insert into public.business_hours (day_of_week, opens_at, closes_at, is_open) values
  (0, null,    null,    false), -- Sunday
  (1, '08:00', '17:00', true),  -- Monday
  (2, '08:00', '17:00', true),  -- Tuesday
  (3, '08:00', '17:00', true),  -- Wednesday
  (4, '08:00', '17:00', true),  -- Thursday
  (5, '08:00', '17:00', true),  -- Friday
  (6, null,    null,    false); -- Saturday

-- ---------------------------------------------------------------------------
-- app_settings
-- ---------------------------------------------------------------------------
insert into public.app_settings (key, value) values
  ('slot_duration_minutes',    '120'),
  ('buffer_minutes',           '30'),
  ('service_call_fee_cents',   '15000'),
  ('deposit_percent',          '50'),
  ('cancellation_window_hours','24'),
  ('booking_horizon_days',     '30'),
  ('emergency_phone',          '"+16144010766"');

-- ---------------------------------------------------------------------------
-- service_categories (exactly the 7 from owner-content.md)
-- ---------------------------------------------------------------------------
insert into public.service_categories (slug, name, description, icon, sort_order) values
  ('residential',           'Residential Electric Service',   'Complete home electrical work, from panel upgrades and rewiring to lighting, EV chargers, and generators.', 'home',         1),
  ('commercial',            'Commercial Service',             'Electrical construction, build-outs, lighting, and maintenance for offices, retail, restaurants, and other commercial spaces.', 'building-2',   2),
  ('agricultural',          'Agricultural & Farm Electrical', 'Purpose-built electrical service for barns, livestock facilities, arenas, grain systems, and farm power distribution.', 'tractor',      3),
  ('repair-maintenance',    'Repair & Maintenance',           'Fast diagnosis and repair of electrical problems, from emergency calls and storm damage to preventative maintenance.', 'wrench',       4),
  ('specialty',             'Specialty Services',             'Specialized installations including EV charging, standby generators, smart home wiring, and low-voltage systems.', 'zap',          5),
  ('underground-site-work', 'Underground & Site Work',        'Trenching, underground power, conduit systems, and site electrical infrastructure with full restoration.', 'shovel',       6),
  ('service-utility-work',  'Service & Utility Work',         'Meter, service entrance, and utility-coordination work, from meter sockets to overhead and underground services.', 'utility-pole', 7);

-- ---------------------------------------------------------------------------
-- services (every line item from owner-content.md, verbatim, in list order)
-- ---------------------------------------------------------------------------
insert into public.services (category_id, name, sort_order)
select c.id, s.name, s.ord::int
from public.service_categories c
join lateral unnest(array[
  'Electrical Service Upgrades',
  'Panel Replacement & Upgrades',
  'New Home Wiring',
  'Home Additions',
  'Whole Home Rewiring',
  'Electrical Remodeling',
  'Troubleshooting & Repairs',
  'Breaker Replacement',
  'Circuit Installation',
  'Dedicated Circuits',
  'GFCI & AFCI Protection',
  'Outlet Installation & Replacement',
  'USB Outlets',
  'Smart Switches & Dimmers',
  'Light Fixture Installation',
  'Chandelier Installation',
  'Recessed Lighting',
  'LED Lighting Upgrades',
  'Ceiling Fan Installation',
  'Bathroom Exhaust Fans',
  'Smoke & Carbon Monoxide Detectors',
  'Whole-Home Surge Protection',
  'Hot Tub & Spa Wiring',
  'Pool Equipment Wiring',
  'EV Charger Installation',
  'Generator Installation',
  'Transfer Switch Installation',
  'Appliance Wiring',
  'Dryer & Range Circuits',
  'Well Pump Wiring',
  'Septic System Wiring',
  'Garage & Workshop Wiring',
  'Outdoor Lighting',
  'Landscape Lighting',
  'Security Lighting',
  'Flood Lights',
  'Motion Sensor Lighting',
  'Electrical Inspections'
]) with ordinality as s(name, ord) on true
where c.slug = 'residential';

insert into public.services (category_id, name, sort_order)
select c.id, s.name, s.ord::int
from public.service_categories c
join lateral unnest(array[
  'New Commercial Construction',
  'Tenant Build-Outs',
  'Office Wiring',
  'Retail Electrical',
  'Restaurant Electrical',
  'Commercial Panel Installation',
  'Commercial Service Upgrades',
  'Three-Phase Power',
  'Dedicated Equipment Circuits',
  'LED Lighting Retrofits',
  'Parking Lot Lighting',
  'Pole Lighting',
  'Exit & Emergency Lighting',
  'Occupancy Sensors',
  'Time Clocks',
  'Lighting Controls',
  'Electrical Maintenance',
  'Troubleshooting',
  'Equipment Connections',
  'Commercial Generator Installation'
]) with ordinality as s(name, ord) on true
where c.slug = 'commercial';

insert into public.services (category_id, name, sort_order)
select c.id, s.name, s.ord::int
from public.service_categories c
join lateral unnest(array[
  'Barn Wiring',
  'Horse Barn Electrical',
  'Pole Barn Electrical',
  'Livestock Facility Wiring',
  'Arena Lighting',
  'Stable Lighting',
  'Well Pumps',
  'Grain Bin Electrical',
  'Farm Equipment Power',
  'Feed Building Wiring',
  'Fence Charger Circuits',
  'Outdoor Receptacles',
  'Security Lighting',
  'Generator Connections',
  'New Farm Services',
  'Underground Farm Power Distribution'
]) with ordinality as s(name, ord) on true
where c.slug = 'agricultural';

insert into public.services (category_id, name, sort_order)
select c.id, s.name, s.ord::int
from public.service_categories c
join lateral unnest(array[
  'Emergency Electrical Repairs',
  'Troubleshooting',
  'Breaker Problems',
  'Flickering Lights',
  'Power Loss Diagnosis',
  'Outlet Repairs',
  'Switch Repairs',
  'Code Corrections',
  'Insurance Repairs',
  'Storm Damage Repairs',
  'Preventative Maintenance'
]) with ordinality as s(name, ord) on true
where c.slug = 'repair-maintenance';

insert into public.services (category_id, name, sort_order)
select c.id, s.name, s.ord::int
from public.service_categories c
join lateral unnest(array[
  'EV Charging Stations',
  'Standby Generators',
  'Whole-House Surge Protection',
  'Smart Home Wiring',
  'Camera System Power',
  'Doorbell Wiring',
  'Landscape Lighting',
  'Accent Lighting',
  'Holiday Lighting Power',
  'Sign Power',
  'Data & Low-Voltage Conduit',
  'Equipment Disconnects'
]) with ordinality as s(name, ord) on true
where c.slug = 'specialty';

insert into public.services (category_id, name, sort_order)
select c.id, s.name, s.ord::int
from public.service_categories c
join lateral unnest(array[
  'Electrical Trenching',
  'Underground Power Installation',
  'Conduit Installation',
  'PVC & HDPE Conduit Systems',
  'Underground Feeders',
  'Secondary Electrical Services',
  'Meter-to-Building Feeds',
  'Garage Feeds',
  'Barn Feeds',
  'Detached Building Power',
  'Transformer Connections',
  'Site Lighting Circuits',
  'Pull Box Installation',
  'Handhole Installation',
  'Backfilling & Site Restoration'
]) with ordinality as s(name, ord) on true
where c.slug = 'underground-site-work';

insert into public.services (category_id, name, sort_order)
select c.id, s.name, s.ord::int
from public.service_categories c
join lateral unnest(array[
  'Meter Socket Replacement',
  'Meter Bank Replacement',
  'CT Cabinet Installation',
  'Utility Coordination',
  'Overhead Service Installation',
  'Underground Service Installation',
  'Temporary Power',
  'Disconnect Installation',
  'Main Breaker Replacement',
  'Service Mast Replacement',
  'Weather Head Replacement',
  'Service Entrance Cable Replacement'
]) with ordinality as s(name, ord) on true
where c.slug = 'service-utility-work';

-- ---------------------------------------------------------------------------
-- Sample content for admin testing (both inactive)
-- ---------------------------------------------------------------------------
insert into public.site_banners (headline, body, cta_text, cta_url, theme, is_active) values
  ('Storm season is here — is your home ready?',
   'Whole-home surge protection and standby generators keep the lights on when the grid goes down. Free estimates.',
   'Book a free estimate',
   '/book',
   'storm',
   false);

insert into public.sweepstakes (title, description, prize, rules_url, is_active) values
  ('Pikavolt Home Safety Giveaway',
   'Enter for a chance to win a free whole-home electrical safety inspection plus a whole-home surge protector, installed.',
   'Whole-home electrical safety inspection + installed surge protector',
   '/sweepstakes/rules',
   false);
