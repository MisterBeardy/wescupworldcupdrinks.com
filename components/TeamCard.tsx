'use client'
import { Button, Chip } from '@misterbeardy/design-system'
import { Team, Mode, Game } from '@/lib/types'
import DrinkLink from './DrinkLink'

interface Props {
  team: Team
  mode: Mode
  game?: Game
  isWinner: boolean
  isLive: boolean
  hasDrank: boolean
  onToggle: (abbr: string) => void
}

const OUTCOME_TONE = { won: 'success', lost: 'danger', draw: 'neutral' } as const

export default function TeamCard({ team, mode, game, isWinner, isLive, hasDrank, onToggle }: Props) {
  const drink = team[mode]

  const myScore = game ? (game.home === team.abbr ? game.hs : game.as) : null
  const oppAbbr = game ? (game.home === team.abbr ? game.away : game.home) : null
  const oppScore = game ? (game.home === team.abbr ? game.as : game.hs) : null

  const outcome = game?.status === 'final'
    ? isWinner ? 'won' : myScore === oppScore ? 'draw' : 'lost'
    : null

  // Flat card: state shows on the border and in the chips, never as a wash.
  const cardClass = [
    'flex flex-col rounded-[var(--radius-lg)] border bg-surface p-4',
    hasDrank ? 'border-border'
    : isWinner ? 'border-accent'
    : isLive ? 'border-danger'
    : 'border-border',
  ].join(' ')

  return (
    <div className={cardClass}>
      {/* Result, and whether you've had the drink */}
      {((game && game.status !== 'scheduled') || hasDrank) && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-3 text-xs">
          {game?.status === 'live' && (
            <>
              <Chip tone="danger">LIVE</Chip>
              <span className="num font-semibold">{myScore}–{oppScore}</span>
              <span className="text-muted">vs {oppAbbr}</span>
              {game.min && <span className="num text-danger-text">{game.min}&apos;</span>}
            </>
          )}
          {game?.status === 'final' && (
            <>
              {outcome && <Chip tone={OUTCOME_TONE[outcome]}>{outcome.toUpperCase()}</Chip>}
              <span className="num font-semibold">{myScore}–{oppScore}</span>
              <span className="text-muted">vs {oppAbbr}</span>
            </>
          )}
          {hasDrank && <span className="ml-auto"><Chip tone="ink">DRANK</Chip></span>}
        </div>
      )}

      <span className="text-3xl block mb-1 leading-none">{team.flag}</span>
      <div className="text-base font-semibold mb-0.5">{team.name}</div>
      <div className="num text-[10px] uppercase tracking-wider text-muted mb-3">{team.conf} · Group {team.g}</div>

      <div className="mb-3 flex-1">
        {mode === 'usa' && (
          <div className="num text-[10px] uppercase tracking-wider text-muted mb-1">Bar sub</div>
        )}
        <div className="text-[13px] font-semibold mb-0.5">
          <DrinkLink drink={drink} />
        </div>
        <div className="text-xs text-muted leading-snug">{drink.desc}</div>
      </div>

      <Button
        size="sm"
        variant={hasDrank ? 'ghost' : isWinner ? 'soft' : 'secondary'}
        style={{ width: '100%' }}
        aria-pressed={hasDrank}
        onClick={() => onToggle(team.abbr)}
      >
        {hasDrank ? 'Drank it' : isWinner ? 'Drink now' : 'Mark as won'}
      </Button>
    </div>
  )
}
