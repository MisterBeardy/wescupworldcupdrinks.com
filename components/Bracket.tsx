'use client'
import { Mode, Game } from '@/lib/types'
import { TEAMS, MODE_META } from '@/lib/teams'
import { buildBracket, KoSlot } from '@/lib/bracket'
import DrinkLink from './DrinkLink'

interface Props {
  mode: Mode
  knockoutGames: Game[]
  drankSet: Set<string>
  onToggle: (abbr: string) => void
}

const teamByAbbr = (abbr?: string) => TEAMS.find(t => t.abbr === abbr)

// Bracket geometry (px). A binary tree lays out cleanly when each round's
// vertical pitch doubles: a parent sits at the midpoint of its two children.
const CARD_H = 58        // compact card (R32 → SF)
const CARD_H_LG = 86     // roomier card with drink text (SF, Final)
const PITCH = 76         // centre-to-centre spacing of Round-of-32 cards
const HALF_H = PITCH * 8 // height of one half of the bracket (8 R32 leaves)
const LABEL_H = 28       // column-header height, kept uniform so rows align
const CONN_W = 26        // connector column width
const LINE = 'rgba(255,255,255,0.15)'

const half = <T,>(arr: T[]): [T[], T[]] => {
  const mid = arr.length / 2
  return [arr.slice(0, mid), arr.slice(mid)]
}

export default function Bracket({ mode, knockoutGames, drankSet, onToggle }: Props) {
  const { columns, final, third } = buildBracket(knockoutGames)

  function TeamRow({
    abbr,
    label,
    score,
    pens,
    won,
    showDrink,
  }: {
    abbr?: string
    label: string
    score?: number
    pens?: number
    won: boolean
    showDrink: boolean
  }) {
    const team = teamByAbbr(abbr)

    if (!team) {
      return (
        <div className="flex-1 flex items-center px-2 min-h-0">
          <span className="text-white/25 text-[9px] font-bold uppercase tracking-wide truncate">
            {label || 'TBD'}
          </span>
        </div>
      )
    }

    const drink = team[mode]
    const hasDrank = abbr ? drankSet.has(abbr) : false

    return (
      <div className={[
        'flex-1 flex items-center gap-1.5 px-2 min-h-0',
        won ? 'bg-yellow-400/10' : '',
        hasDrank ? 'opacity-50' : '',
      ].join(' ')}>
        <span className="text-sm leading-none flex-shrink-0">{team.flag}</span>
        <div className="flex-1 min-w-0">
          <div className={`text-[11px] font-bold leading-tight truncate ${won ? 'text-yellow-300' : 'text-white/80'}`}>
            {team.name}
          </div>
          {showDrink && drink && (
            <div className={`text-[9px] leading-tight truncate ${MODE_META[mode].textSoft}`}>
              <DrinkLink drink={drink} />
            </div>
          )}
        </div>
        {score !== undefined && (
          <span className={`font-['Bebas_Neue'] text-sm leading-none flex-shrink-0 ${won ? 'text-yellow-300' : 'text-white/50'}`}>
            {score}
            {pens !== undefined && <span className="text-[9px] align-top ml-0.5 opacity-70">({pens})</span>}
          </span>
        )}
        {won && abbr && !hasDrank && (
          <button
            onClick={() => onToggle(abbr)}
            title="Mark as drank"
            className="text-[9px] bg-yellow-400/20 hover:bg-yellow-400/40 border border-yellow-400/40 text-yellow-300 rounded px-1 leading-none flex-shrink-0 transition-colors"
          >
            🥃
          </button>
        )}
        {hasDrank && (
          <button
            onClick={() => abbr && onToggle(abbr)}
            title="Undo"
            className="text-[9px] text-orange-400 flex-shrink-0"
          >
            ✓
          </button>
        )}
      </div>
    )
  }

  function Card({ slot, height, showDrink }: { slot: KoSlot; height: number; showDrink: boolean }) {
    const isFinal = slot.status === 'final'
    const isLive = slot.status === 'live'
    return (
      <div
        style={{ height }}
        className={[
          'w-full border rounded-lg overflow-hidden flex flex-col relative',
          isLive ? 'border-red-500/50 bg-red-950/20' :
          isFinal ? 'border-yellow-400/30 bg-yellow-950/10' :
                    'border-white/12 bg-white/4',
        ].join(' ')}
      >
        {isLive && <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />}
        <TeamRow
          abbr={slot.homeAbbr}
          label={slot.homeLabel}
          score={slot.homeScore}
          pens={slot.homePens}
          won={slot.winnerAbbr != null && slot.winnerAbbr === slot.homeAbbr}
          showDrink={showDrink}
        />
        <div className="border-t border-white/8" />
        <TeamRow
          abbr={slot.awayAbbr}
          label={slot.awayLabel}
          score={slot.awayScore}
          pens={slot.awayPens}
          won={slot.winnerAbbr != null && slot.winnerAbbr === slot.awayAbbr}
          showDrink={showDrink}
        />
      </div>
    )
  }

  // One half of one round, absolutely positioned so each card sits at the
  // midpoint of the two children that feed it.
  function Column({ slots, depth, width, tall }: { slots: KoSlot[]; depth: number; width: string; tall?: boolean }) {
    const h = tall ? CARD_H_LG : CARD_H
    const pitch = PITCH * Math.pow(2, depth)
    return (
      <div className={`relative flex-shrink-0 ${width}`} style={{ height: HALF_H }}>
        {slots.map((s, i) => {
          const center = pitch * (i + 0.5)
          return (
            <div key={s.num} className="absolute left-0 right-0 flex justify-center" style={{ top: center - h / 2 }}>
              <Card slot={s} height={h} showDrink={!!tall} />
            </div>
          )
        })}
      </div>
    )
  }

  // Connector between a round (children, at `depth`) and the next (parents).
  // `side` flips the geometry so both halves point toward the centre.
  function Connector({ depth, side }: { depth: number; side: 'left' | 'right' }) {
    const parents = 8 / Math.pow(2, depth + 1)
    const childPitch = PITCH * Math.pow(2, depth)
    const outer = side === 'left' ? 0 : CONN_W
    const inner = side === 'left' ? CONN_W : 0
    const bus = CONN_W / 2
    return (
      <div className="flex flex-col flex-shrink-0">
        <div style={{ height: LABEL_H }} />
        <svg width={CONN_W} height={HALF_H}>
          {Array.from({ length: parents }).map((_, j) => {
            const c1 = childPitch * (2 * j + 0.5)
            const c2 = childPitch * (2 * j + 1.5)
            const mid = (c1 + c2) / 2
            return (
              <g key={j}>
                <line x1={outer} y1={c1} x2={bus} y2={c1} stroke={LINE} />
                <line x1={outer} y1={c2} x2={bus} y2={c2} stroke={LINE} />
                <line x1={bus} y1={c1} x2={bus} y2={c2} stroke={LINE} />
                <line x1={bus} y1={mid} x2={inner} y2={mid} stroke={LINE} />
              </g>
            )
          })}
        </svg>
      </div>
    )
  }

  // Straight connector between a Semi-Final and the Final (both centred).
  function StraightConnector() {
    return (
      <div className="flex flex-col flex-shrink-0">
        <div style={{ height: LABEL_H }} />
        <svg width={CONN_W} height={HALF_H}>
          <line x1={0} y1={HALF_H / 2} x2={CONN_W} y2={HALF_H / 2} stroke={LINE} />
        </svg>
      </div>
    )
  }

  function ColHeader({ label }: { label: string }) {
    return (
      <div
        className="text-[10px] font-bold uppercase tracking-widest text-yellow-400/70 text-center whitespace-nowrap flex items-center justify-center"
        style={{ height: LABEL_H }}
      >
        {label}
      </div>
    )
  }

  const widths = ['w-32', 'w-32', 'w-36', 'w-44'] // r32, r16, qf, sf
  const halves = columns.map(c => half(c.slots))

  return (
    <div className="w-full overflow-x-auto pb-8">
      <div className="min-w-[1620px] px-4 py-6">
        {/* Title */}
        <div className="text-center mb-6">
          <h2 className="font-['Bebas_Neue'] text-3xl tracking-widest text-yellow-400">
            ⚽ Knockout Bracket
          </h2>
          <p className="text-white/30 text-xs mt-1">
            Fills in automatically as each match finishes · Jul 4 – Jul 19
          </p>
        </div>

        {/* Bracket: R32 → R16 → QF → SF → Final → SF → QF → R16 → R32 */}
        <div className="flex items-start justify-center">

          {/* LEFT half */}
          {columns.map((col, ci) => (
            <div key={`L-${col.id}`} className="flex items-start">
              <div className="flex flex-col items-center">
                <ColHeader label={col.label} />
                <Column slots={halves[ci][0]} depth={ci} width={widths[ci]} tall={col.id === 'sf'} />
              </div>
              <Connector depth={ci} side="left" />
            </div>
          ))}

          {/* FINAL */}
          <div className="flex flex-col items-center flex-shrink-0">
            <ColHeader label="🏆 Final · Jul 19" />
            <div className="relative w-52" style={{ height: HALF_H }}>
              <div className="absolute left-0 right-0 flex justify-center" style={{ top: HALF_H / 2 - CARD_H_LG / 2 }}>
                <Card slot={final} height={CARD_H_LG} showDrink />
              </div>
            </div>
          </div>

          {/* RIGHT half (mirrored) */}
          {[...columns].reverse().map((col, ri) => {
            const ci = columns.length - 1 - ri
            return (
              <div key={`R-${col.id}`} className="flex items-start">
                {ci === columns.length - 1
                  ? <StraightConnector />
                  : <Connector depth={ci} side="right" />}
                <div className="flex flex-col items-center">
                  <ColHeader label={col.label} />
                  <Column slots={halves[ci][1]} depth={ci} width={widths[ci]} tall={col.id === 'sf'} />
                </div>
              </div>
            )
          })}

        </div>

        {/* Third-place + venue */}
        <div className="flex flex-col items-center gap-4 mt-2">
          <div className="text-center">
            <div className="font-['Bebas_Neue'] text-yellow-400 text-lg tracking-wider">MetLife Stadium</div>
            <div className="text-white/30 text-[10px]">East Rutherford, NJ</div>
          </div>
          <div className="flex flex-col items-center">
            <div className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2">🥉 Third-Place Play-off · Jul 18</div>
            <div className="w-52">
              <Card slot={third} height={CARD_H_LG} showDrink />
            </div>
          </div>
        </div>

        {/* Key */}
        <div className="flex items-center justify-center gap-6 mt-8 flex-wrap">
          <div className="flex items-center gap-1.5 text-[10px] text-white/30">
            <div className="w-3 h-3 border border-yellow-400/40 rounded bg-yellow-950/20" />
            Final result
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-white/30">
            <div className="w-3 h-3 border border-red-500/40 rounded bg-red-950/20" />
            Live
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-white/30">
            <div className="w-3 h-3 border border-white/12 rounded bg-white/4" />
            TBD — awaiting earlier rounds
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-white/30">
            <span>🥃</span>
            Tap a winner to mark your drink
          </div>
        </div>
      </div>
    </div>
  )
}
