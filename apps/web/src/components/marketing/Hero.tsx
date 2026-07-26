'use client';

import { useLayoutEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import gsap from 'gsap';
import { motion, useReducedMotion } from 'framer-motion';
import { CalendarCheck, PhoneCall, Zap, Clock, Tractor, HandCoins } from 'lucide-react';

/**
 * Cinematic homepage hero — the GSAP set-piece (GSAP lives ONLY here; the rest
 * of the site animates with framer-motion scroll reveals).
 *
 * Sequence: lightning bolts draw/strike across the teal-storm sky
 * (stroke-dash), the headline "powers on" with a flicker reveal, sub + CTAs
 * rise in, and the mascot springs up (framer-motion) then idles on a subtle
 * CSS float. Every element is visible by default so SSR/no-JS renders fully;
 * prefers-reduced-motion skips the timeline entirely and settles static.
 */

const BOLTS: string[] = [
  // jagged strikes across a 1440x720 sky
  'M180 -20 L150 150 L215 165 L120 380 L170 392 L95 610',
  'M540 -30 L565 120 L505 140 L595 330',
  'M1230 -20 L1195 170 L1265 180 L1160 430 L1225 445 L1120 700',
  'M950 -30 L975 130 L920 150 L1000 320',
  'M1390 60 L1355 200 L1415 215 L1330 420',
];

const heroChips = [
  { icon: Clock, label: '24/7 Emergency Service' },
  { icon: HandCoins, label: 'Free Estimates' },
  { icon: Tractor, label: 'Residential • Commercial • Agricultural' },
];

export function Hero() {
  const scope = useRef<HTMLElement>(null);
  const reducedMotion = useReducedMotion();

  useLayoutEffect(() => {
    const CONTENT = ['.hero-kicker', '.hero-headline', '.hero-sub', '.hero-ctas', '.hero-chips'];
    let safety: number | undefined;

    const ctx = gsap.context(() => {
      const bolts = gsap.utils.toArray<SVGPathElement>('.hero-bolt');
      const glows = gsap.utils.toArray<SVGPathElement>('.hero-bolt-glow');
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      // Force the content to its natural, fully-visible resting state. Used both
      // on timeline completion and as a safety net.
      const reveal = () =>
        gsap.set(CONTENT, { opacity: 1, y: 0, clearProps: 'opacity,transform' });

      // Skip the reveal timeline entirely when motion is reduced OR the tab is
      // backgrounded. GSAP's ticker is rAF-driven and throttled in hidden tabs,
      // so a `.set(opacity:0)` there would stick while the reveal tweens never
      // advance — leaving the hero invisible. In both cases content stays
      // visible by default (no hiding), and the sky settles to its ambient state.
      if (reduced || document.hidden) {
        gsap.set([bolts, glows], { opacity: 0.14 });
        return;
      }

      bolts.concat(glows).forEach((p) => {
        const len = p.getTotalLength();
        gsap.set(p, { strokeDasharray: len, strokeDashoffset: len, opacity: 1 });
      });

      const tl = gsap.timeline({ defaults: { ease: 'power2.out' }, onComplete: reveal });

      // Belt-and-suspenders: even if the ticker stalls mid-timeline (tab
      // backgrounded after load, refresh race), reveal the content after the
      // timeline's nominal duration. setTimeout fires regardless of rAF.
      safety = window.setTimeout(reveal, 2800);

      // Hide targets synchronously (pre-paint) so there's no flash.
      tl.set('.hero-kicker', { opacity: 0, y: 14 })
        .set('.hero-headline', { opacity: 0 })
        .set(['.hero-sub', '.hero-ctas', '.hero-chips'], { opacity: 0, y: 24 });

      // 1. Lightning draws + strikes.
      tl.to([bolts, glows], {
        strokeDashoffset: 0,
        duration: 0.55,
        stagger: 0.09,
        ease: 'power3.in',
      })
        // 2. Headline powers on with a flicker (like a light catching).
        .to(
          '.hero-headline',
          {
            keyframes: { opacity: [0, 1, 0.25, 1, 0.45, 1], ease: 'none' },
            duration: 0.55,
          },
          '-=0.25',
        )
        .to('.hero-kicker', { opacity: 1, y: 0, duration: 0.4 }, '<0.1')
        // 3. Sky settles: bolts dim to an ambient crackle.
        .to(glows, { opacity: 0.1, duration: 0.9, ease: 'power1.inOut' }, '-=0.2')
        .to(bolts, { opacity: 0.16, duration: 0.9, ease: 'power1.inOut' }, '<')
        // 4. Supporting copy + CTAs rise in.
        .to('.hero-sub', { opacity: 1, y: 0, duration: 0.5 }, '-=0.8')
        .to('.hero-ctas', { opacity: 1, y: 0, duration: 0.5 }, '-=0.35')
        .to('.hero-chips', { opacity: 1, y: 0, duration: 0.5 }, '-=0.35');

      // Occasional ambient re-strike on one bolt.
      const restrike = bolts[2] ?? bolts[0];
      if (!restrike) return;
      gsap.to(restrike, {
        opacity: 0.7,
        duration: 0.09,
        repeat: -1,
        yoyo: true,
        repeatDelay: 4.6,
        delay: 3.2,
        ease: 'none',
      });
    }, scope);

    return () => {
      if (safety) window.clearTimeout(safety);
      ctx.revert();
    };
  }, []);

  return (
    <section
      ref={scope}
      className="relative overflow-hidden border-b border-white/10 bg-storm-gradient"
    >
      {/* Lightning sky */}
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox="0 0 1440 720"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
        aria-hidden="true"
      >
        {BOLTS.map((d, i) => (
          <path
            key={`glow-${i}`}
            d={d}
            className="hero-bolt-glow"
            stroke="var(--color-arc)"
            strokeWidth={7}
            strokeLinejoin="round"
            strokeLinecap="round"
            opacity={0.14}
            style={{ filter: 'blur(6px)' }}
          />
        ))}
        {BOLTS.map((d, i) => (
          <path
            key={`bolt-${i}`}
            d={d}
            className="hero-bolt"
            stroke="var(--color-volt)"
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
            opacity={0.16}
          />
        ))}
      </svg>

      {/* Grain of light behind the mascot */}
      <div
        className="pointer-events-none absolute -right-32 top-1/2 h-[42rem] w-[42rem] -translate-y-1/2 rounded-full opacity-30"
        style={{
          background:
            'radial-gradient(closest-side, rgb(255 230 0 / 0.22), rgb(34 211 238 / 0.08) 55%, transparent 75%)',
        }}
        aria-hidden="true"
      />

      <div className="relative mx-auto grid w-full max-w-6xl items-center gap-10 px-4 pb-16 pt-14 sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-6 lg:px-8 lg:pb-24 lg:pt-20">
        <div className="max-w-2xl text-center lg:text-left">
          <p className="hero-kicker text-sm font-semibold uppercase tracking-[0.25em] text-arc">
            Central Ohio Electrical Contractor
          </p>
          <h1 className="hero-headline mt-5 font-display text-[2.6rem] uppercase leading-[1.05] tracking-wide text-snow sm:text-6xl lg:text-[4.2rem]">
            Powering Ohio with{' '}
            <span className="text-volt text-volt-glow">Quality</span> You Can Trust.
          </h1>
          <p className="hero-sub mx-auto mt-6 max-w-xl text-lg text-muted lg:mx-0">
            Professional electrical installations, upgrades, repairs, and service for
            homes, farms &amp; businesses — safe, dependable, and code-compliant.
          </p>

          <div className="hero-ctas mt-9 flex flex-wrap items-center justify-center gap-4 lg:justify-start">
            <span className="rounded-[14px] bg-linear-to-br from-volt to-amber p-px shadow-volt-glow transition-shadow hover:shadow-volt-glow-lg">
              <Link
                href="/book"
                className="inline-flex h-13 items-center gap-2 rounded-[13px] bg-volt px-8 text-base font-bold text-storm transition-all hover:brightness-105"
              >
                <CalendarCheck className="h-5 w-5" aria-hidden="true" />
                Book a Service
              </Link>
            </span>
            <a
              href="tel:+16144010766"
              className="inline-flex h-13 items-center gap-2 rounded-[13px] border border-emergency/70 bg-emergency/10 px-8 text-base font-bold text-white transition-all hover:bg-emergency hover:shadow-emergency-glow"
            >
              <PhoneCall className="h-5 w-5 text-emergency transition-colors group-hover:text-white" aria-hidden="true" />
              24/7 Emergency — Call Now
            </a>
          </div>

          <ul className="hero-chips mt-9 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 lg:justify-start">
            {heroChips.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-2 text-sm text-muted">
                <Icon className="h-4 w-4 text-amber" aria-hidden="true" />
                {label}
              </li>
            ))}
          </ul>
        </div>

        {/* Mascot */}
        <motion.div
          className="relative mx-auto lg:mx-0"
          initial={
            reducedMotion
              ? { opacity: 0 }
              : { opacity: 0, y: 90, scale: 0.85, rotate: -4 }
          }
          animate={
            reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1, rotate: 0 }
          }
          transition={
            reducedMotion
              ? { duration: 0.4 }
              : { type: 'spring', stiffness: 120, damping: 14, mass: 1, delay: 0.85 }
          }
        >
          <div className="animate-float">
            <Image
              src="/mascot.png"
              alt="The Pikavolt mascot — a golden electrician critter in a black cap, holding linesman pliers and a screwdriver, with a lightning-bolt tail"
              width={690}
              height={1028}
              priority
              className="h-auto w-56 drop-shadow-[0_24px_48px_rgba(8,26,33,0.9)] sm:w-64 lg:w-[340px]"
            />
          </div>
          <div
            className="absolute -bottom-4 left-1/2 h-6 w-3/4 -translate-x-1/2 rounded-[100%] bg-black/50 blur-lg"
            aria-hidden="true"
          />
          <span className="absolute -left-6 top-8 hidden lg:block" aria-hidden="true">
            <Zap className="h-7 w-7 fill-volt text-volt animate-pulse-ring" />
          </span>
        </motion.div>
      </div>
    </section>
  );
}
