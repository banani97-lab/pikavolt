'use client';

import { motion, useReducedMotion, type Variants } from 'framer-motion';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface RevealProps {
  children: ReactNode;
  className?: string;
  /** Stagger children (each direct child should be a <RevealItem>). */
  stagger?: boolean;
  delay?: number;
}

const parent: Variants = {
  hidden: {},
  visible: (stagger: boolean) => ({
    transition: stagger ? { staggerChildren: 0.08 } : undefined,
  }),
};

const item: Variants = {
  hidden: { opacity: 0, y: 28 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.21, 0.66, 0.32, 1] },
  },
};

const itemStill: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.4 } },
};

/**
 * Scroll-reveal wrapper (framer-motion whileInView). Fades + lifts content in
 * once as it enters the viewport; falls back to a plain fade when the visitor
 * prefers reduced motion.
 */
export function Reveal({ children, className, stagger = false, delay = 0 }: RevealProps) {
  const reduced = useReducedMotion();
  if (stagger) {
    return (
      <motion.div
        className={className}
        custom={true}
        variants={parent}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-80px' }}
      >
        {children}
      </motion.div>
    );
  }
  return (
    <motion.div
      className={className}
      variants={reduced ? itemStill : item}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-80px' }}
      transition={{ delay }}
    >
      {children}
    </motion.div>
  );
}

/** Child of a staggered <Reveal stagger>. */
export function RevealItem({ children, className }: { children: ReactNode; className?: string }) {
  const reduced = useReducedMotion();
  return (
    <motion.div className={cn(className)} variants={reduced ? itemStill : item}>
      {children}
    </motion.div>
  );
}
