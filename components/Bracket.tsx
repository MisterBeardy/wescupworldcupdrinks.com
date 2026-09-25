'use client'
import { Mode, Game } from '@/lib/types'
import { Icon } from '@misterbeardy/design-system'
import { TEAMS } from '@/lib/teams'
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
const LINE = 'var(--border)'

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
    edge,
  }: {
    abbr?: string
    label: string
    score?: number
    pens?: number
    won: boolean
    showDrink: boolean
    edge: 'top' | 'bottom'
  }) {
    const team = teamByAbbr(abbr)

    if (!team) {
      return (
        <div className="flex-1 flex items-center px-2 min-h-0">
          <span className="num text-muted text-[10px] uppercase tracking-wide truncate">
            {label || 'TBD'}
          </span>
        </div>
      )
    }

    const drink = team[mode]
    const hasDrank = abbr ? drankSet.has(abbr) : false
    // Only the winner's row takes taps: the whole row marks (or un-marks) the
    // drink, so the target is the row, not the small glyph at its end.
    const tappable = won && !!abbr

    return (
      <div className={[
        // pointer-events-none: a positioned row would otherwise sit over the
        // other row's enlarged tap area and swallow its taps.
        'relative flex-1 flex items-center min-h-0 pointer-events-none',
        hasDrank ? 'opacity-50' : '',
      ].join(' ')}>
        {tappable && (
          <button
            onClick={() => onToggle(abbr)}
            title={hasDrank ? 'Drank — tap to undo' : 'Mark as drank'}
            aria-label={`Mark ${team.name} as drank`}
            aria-pressed={hasDrank}
            className={[
              'bracket-hit absolute inset-0 pointer-events-auto hover:bg-surface-alt',
              'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent',
              edge === 'top'
                ? 'rounded-t-[calc(var(--radius-md)-1px)]'
                : 'rounded-b-[calc(var(--radius-md)-1px)]',
            ].join(' ')}
          />
        )}
        <div className="relative flex-1 min-w-0 flex items-center gap-1.5 px-2">
          <span className="text-sm leading-none flex-shrink-0">{team.flag}</span>
          <div className="flex-1 min-w-0">
            <div className={`text-[11px] leading-tight truncate ${won ? 'font-bold' : 'text-muted'}`}>
              {team.name}
            </div>
            {showDrink && drink && (
              <div className="text-[10px] leading-tight truncate">
                <DrinkLink drink={drink} className="pointer-events-auto" />
              </div>
            )}
          </div>
          {score !== undefined && (
            <span className={`num text-xs leading-none flex-shrink-0 ${won ? 'font-bold' : 'text-muted'}`}>
              {score}
              {pens !== undefined && <span className="text-[9px] align-top ml-0.5 opacity-70">({pens})</span>}
            </span>
          )}
          {tappable && !hasDrank && (
            <span className="grid place-items-center w-4 h-4 rounded-sm bg-accent-soft text-accent-text flex-shrink-0">
              <Icon name="plus" size={10} />
            </span>
          )}
          {hasDrank && (
            <span className="text-success-text flex-shrink-0" aria-label="Drank" role="img">
              <Icon name="check" size={12} />
            </span>
          )}
        </div>
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
          'w-full border rounded-[var(--radius-md)] flex flex-col relative',
          isLive ? 'border-danger bg-surface' :
          isFinal ? 'border-border bg-surface' :
                    'border-border border-dashed bg-surface-alt',
        ].join(' ')}
      >
        {isLive && <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-danger animate-pulse" />}
        <TeamRow
          abbr={slot.homeAbbr}
          label={slot.homeLabel}
          score={slot.homeScore}
          pens={slot.homePens}
          won={slot.winnerAbbr != null && slot.winnerAbbr === slot.homeAbbr}
          showDrink={showDrink}
          edge="top"
        />
        <div className="border-t border-border" />
        <TeamRow
          abbr={slot.awayAbbr}
          label={slot.awayLabel}
          score={slot.awayScore}
          pens={slot.awayPens}
          won={slot.winnerAbbr != null && slot.winnerAbbr === slot.awayAbbr}
          showDrink={showDrink}
          edge="bottom"
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
        className="num text-[10px] uppercase tracking-widest text-muted text-center whitespace-nowrap flex items-center justify-center"
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
          <h2 className="text-2xl font-bold">
            Knockout bracket
          </h2>
          <p className="text-muted text-xs mt-1">
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
            <ColHeader label="Final · Jul 19" />
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
            <div className="font-semibold">MetLife Stadium</div>
            <div className="text-muted text-[11px]">East Rutherford, NJ</div>
          </div>
          <div className="flex flex-col items-center">
            <div className="num text-[10px] uppercase tracking-widest text-muted mb-2">Third-place play-off · Jul 18</div>
            <div className="w-52">
              <Card slot={third} height={CARD_H_LG} showDrink />
            </div>
          </div>
        </div>

        {/* Key */}
        <div className="flex items-center justify-center gap-6 mt-8 flex-wrap">
          <div className="flex items-center gap-1.5 text-[11px] text-muted">
            <div className="w-3 h-3 border border-border rounded-sm bg-surface" />
            Final result
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted">
            <div className="w-3 h-3 border border-danger rounded-sm bg-surface" />
            Live
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted">
            <div className="w-3 h-3 border border-dashed border-border rounded-sm bg-surface-alt" />
            TBD — awaiting earlier rounds
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted">
            <span className="grid place-items-center w-4 h-4 rounded-sm bg-accent-soft text-accent-text"><Icon name="plus" size={10} /></span>
            Tap a winner to mark your drink
          </div>
        </div>
      </div>
    </div>
  )
}
