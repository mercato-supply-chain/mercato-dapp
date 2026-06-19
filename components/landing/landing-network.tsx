'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { useReveal, useParallax } from '@/hooks/use-scroll-motion'
import { Package, TrendingUp, ShieldCheck, Star } from 'lucide-react'

const NODES = [
  { id: 'sme', label: 'Industrias NOVA', sub: 'SME · Buyer', icon: Package, pos: 'top-0 left-1/2 -translate-x-1/2 -translate-y-2' },
  { id: 'inv', label: 'InverCap SA', sub: '+12.5% APR', icon: TrendingUp, pos: 'right-0 top-1/2 -translate-y-1/2 translate-x-2' },
  { id: 'sup', label: 'Acero del Pacífico', sub: 'Verified · 4.8★', icon: ShieldCheck, pos: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-2' },
  { id: 'rep', label: 'Reputation', sub: '↑ growing', icon: Star, pos: 'left-0 top-1/2 -translate-y-1/2 -translate-x-2' },
]

export function LandingNetwork() {
  const { ref, visible } = useReveal<HTMLElement>(0.15)
  const diagramParallax = useParallax(-0.06)
  const [pulse, setPulse] = React.useState(0)

  React.useEffect(() => {
    if (!visible) return
    const id = setInterval(() => setPulse((p) => (p + 1) % 4), 2200)
    return () => clearInterval(id)
  }, [visible])

  return (
    <section
      ref={ref}
      className="relative overflow-hidden border-y border-border/40 bg-gradient-to-b from-brand-ultra/80 via-background to-background py-24 dark:from-background md:py-32"
    >
      <div className="pointer-events-none absolute left-1/2 top-0 h-px w-2/3 -translate-x-1/2 bg-gradient-to-r from-transparent via-brand-light/50 to-transparent" />

      <div className="container relative mx-auto px-4">
        <div className="mx-auto max-w-6xl">
          <div className="mb-14 grid gap-12 lg:grid-cols-[1fr_1.15fr] lg:items-center lg:gap-20">
            <div
              className={cn(
                'transition-all duration-1000 ease-out',
                visible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-8',
              )}
            >
              <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.2em] text-brand-mid">Live connections</p>
              <h2 className="font-display mb-6 text-[clamp(2rem,4.5vw,3.25rem)] font-normal leading-[1.05] tracking-tight text-foreground">
                Capital, goods, and trust —
                <span className="text-muted-foreground"> moving together.</span>
              </h2>
              <p className="text-lg leading-relaxed text-muted-foreground md:text-xl">
                Every purchase order links an SME, verified supplier, and investors in one transparent flow.
              </p>
            </div>

            <div
              ref={diagramParallax.ref}
              style={diagramParallax.style}
              className={cn(
                'relative mx-auto aspect-square w-full max-w-md transition-all duration-1000 delay-150',
                visible ? 'opacity-100 scale-100' : 'opacity-0 scale-90',
              )}
            >
              <div className="glass-strong absolute inset-4 rounded-full opacity-60" aria-hidden />

              <svg className="absolute inset-0 h-full w-full" viewBox="0 0 400 400" aria-hidden>
                {[
                  'M200 70 L200 155',
                  'M245 200 L330 200',
                  'M200 245 L200 330',
                  'M70 200 L155 200',
                ].map((d, i) => (
                  <path
                    key={d}
                    d={d}
                    fill="none"
                    stroke="hsl(var(--brand-light))"
                    strokeWidth="2"
                    strokeDasharray="8 6"
                    className={cn(
                      'network-line-pulse transition-all duration-500',
                      pulse === i ? 'opacity-100 stroke-[3]' : 'opacity-25',
                    )}
                  />
                ))}
              </svg>

              <div className="absolute left-1/2 top-1/2 z-10 w-[54%] -translate-x-1/2 -translate-y-1/2">
                <div className="border-shine rounded-2xl shadow-glow-brand">
                  <div className="glass-strong rounded-2xl p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-light opacity-60" />
                        <span className="relative h-2 w-2 rounded-full bg-brand-light" />
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-brand-mid">In production</span>
                    </div>
                    <p className="text-sm font-bold text-foreground">PO #MKT-2847</p>
                    <p className="text-[11px] text-muted-foreground">Steel sheets · $48,500</p>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-brand-pale">
                      <div className="h-full w-[40%] rounded-full bg-gradient-to-r from-brand-dark to-brand-light" />
                    </div>
                  </div>
                </div>
              </div>

              {NODES.map((node, i) => {
                const Icon = node.icon
                const active = pulse === i
                return (
                  <div
                    key={node.id}
                    className={cn(
                      'absolute z-20 max-w-[150px] transition-all duration-500',
                      node.pos,
                      active ? 'float-a scale-105' : 'scale-100',
                    )}
                  >
                    <div
                      className={cn(
                        'glass-strong rounded-xl p-3 shadow-elevated transition-all duration-500',
                        active && 'shadow-glow-brand ring-2 ring-brand-light/30',
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={cn(
                            'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors',
                            active ? 'bg-brand-mid text-white' : 'bg-brand-pale text-brand-mid',
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-[11px] font-bold text-foreground">{node.label}</p>
                          <p className="text-[9px] text-muted-foreground">{node.sub}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
