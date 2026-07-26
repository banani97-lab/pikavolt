# Pikavolt LLC — Owner-Provided Content (source of truth)

This file is the canonical copy provided by the business owner. All seed data
(`packages/db/supabase/seed.sql`) and marketing copy derive from it. Do not invent
services that are not listed here.

## Business

- Legal name: Pikavolt LLC
- Trade: Electrical contractor — residential, commercial, agricultural/farm
- Region: Central Ohio
- Key differentiator to highlight: **24/7 emergency service**
- Service call fee: $150 (50% due at booking, 50% on completion)

## Taglines

- Powering Ohio with Quality You Can Trust. (primary)
- Where Quality Meets Reliability.
- Safe. Reliable. Professional.
- Powering Homes, Farms & Businesses.
- Your Trusted Electrical Contractor.

## Value props

- Honest Pricing
- High-Quality Workmanship
- Code-Compliant Installations
- Fast Response Times
- Free Estimates
- Residential • Commercial • Agricultural

## About copy

At Pikavolt LLC, we believe every electrical project deserves quality craftsmanship
and attention to detail. Whether it's a residential service upgrade, commercial
installation, farm electrical work, or troubleshooting, our goal is to deliver safe,
dependable, and code-compliant electrical solutions.

We take pride in honest communication, reliable scheduling, and treating every
property as if it were our own.

At Pikavolt LLC, we provide professional electrical installations, upgrades, repairs,
and service throughout Central Ohio. We focus on quality workmanship, safety, and
dependable service.

## Service area

Proudly serving Central Ohio including: Dublin, Powell, Marysville, Delaware,
Hilliard, Plain City, Richwood, Columbus, Union County, Delaware County, and
surrounding areas.

## Industries we serve

Homeowners, Builders, General Contractors, Property Managers, Apartment Complexes,
Horse Farms, Agricultural Facilities, Retail Stores, Restaurants, Offices,
Warehouses, Churches, Industrial Facilities.

## Service categories & line items (7 categories — seed exactly these)

### 1. Residential Electric Service (`residential`)

Electrical Service Upgrades; Panel Replacement & Upgrades; New Home Wiring; Home
Additions; Whole Home Rewiring; Electrical Remodeling; Troubleshooting & Repairs;
Breaker Replacement; Circuit Installation; Dedicated Circuits; GFCI & AFCI
Protection; Outlet Installation & Replacement; USB Outlets; Smart Switches &
Dimmers; Light Fixture Installation; Chandelier Installation; Recessed Lighting;
LED Lighting Upgrades; Ceiling Fan Installation; Bathroom Exhaust Fans; Smoke &
Carbon Monoxide Detectors; Whole-Home Surge Protection; Hot Tub & Spa Wiring; Pool
Equipment Wiring; EV Charger Installation; Generator Installation; Transfer Switch
Installation; Appliance Wiring; Dryer & Range Circuits; Well Pump Wiring; Septic
System Wiring; Garage & Workshop Wiring; Outdoor Lighting; Landscape Lighting;
Security Lighting; Flood Lights; Motion Sensor Lighting; Electrical Inspections

### 2. Commercial Service (`commercial`)

New Commercial Construction; Tenant Build-Outs; Office Wiring; Retail Electrical;
Restaurant Electrical; Commercial Panel Installation; Commercial Service Upgrades;
Three-Phase Power; Dedicated Equipment Circuits; LED Lighting Retrofits; Parking
Lot Lighting; Pole Lighting; Exit & Emergency Lighting; Occupancy Sensors; Time
Clocks; Lighting Controls; Electrical Maintenance; Troubleshooting; Equipment
Connections; Commercial Generator Installation

### 3. Agricultural & Farm Electrical (`agricultural`)

Barn Wiring; Horse Barn Electrical; Pole Barn Electrical; Livestock Facility
Wiring; Arena Lighting; Stable Lighting; Well Pumps; Grain Bin Electrical; Farm
Equipment Power; Feed Building Wiring; Fence Charger Circuits; Outdoor
Receptacles; Security Lighting; Generator Connections; New Farm Services;
Underground Farm Power Distribution

### 4. Repair & Maintenance (`repair-maintenance`)

Emergency Electrical Repairs; Troubleshooting; Breaker Problems; Flickering
Lights; Power Loss Diagnosis; Outlet Repairs; Switch Repairs; Code Corrections;
Insurance Repairs; Storm Damage Repairs; Preventative Maintenance

### 5. Specialty Services (`specialty`)

EV Charging Stations; Standby Generators; Whole-House Surge Protection; Smart
Home Wiring; Camera System Power; Doorbell Wiring; Landscape Lighting; Accent
Lighting; Holiday Lighting Power; Sign Power; Data & Low-Voltage Conduit;
Equipment Disconnects

### 6. Underground & Site Work (`underground-site-work`)

Electrical Trenching; Underground Power Installation; Conduit Installation; PVC &
HDPE Conduit Systems; Underground Feeders; Secondary Electrical Services;
Meter-to-Building Feeds; Garage Feeds; Barn Feeds; Detached Building Power;
Transformer Connections; Site Lighting Circuits; Pull Box Installation; Handhole
Installation; Backfilling & Site Restoration

### 7. Service & Utility Work (`service-utility-work`)

Meter Socket Replacement; Meter Bank Replacement; CT Cabinet Installation;
Utility Coordination; Overhead Service Installation; Underground Service
Installation; Temporary Power; Disconnect Installation; Main Breaker Replacement;
Service Mast Replacement; Weather Head Replacement; Service Entrance Cable
Replacement

## Product decisions (confirmed with owner's rep)

- Booking deposit: 50% of the $150 service call fee ($75) via Stripe at booking.
- Final 50% + job total: auto-charged to saved card **with consent checkbox at
  booking**; pay-link fallback.
- Cancellation: full deposit refund ≥24h before slot; otherwise deposit kept.
- Emergency: click-to-call only (no online emergency booking).
- Notifications at launch: push + email (Resend). SMS (Twilio) post-launch.
- Live tracking: owner taps "On My Way" in the mobile app; customer sees live map.
- Logo: full-color mascot supplied (see docs/brand.md for description + palette).
  Awaiting the raster file at `apps/web/public/mascot.png`; geometric bolt SVG
  remains the compact glyph for nav/footer.
- Owner phone number: `(614) 401-0766` (owner's 24/7 line).
