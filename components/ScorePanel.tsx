'use client'
import { useState } from 'react'
import { Game, Mode } from '@/lib/types'
import { Chip, ErrorState, Group, Segmented, Skeleton } from '@misterbeardy/design-system'
import { teamByAbbr } from '@/lib/teams'
import DrinkLink from './DrinkLink'
import type { ScoresStatus } from './GamePage'

interface Props {
  games: Game[]
  mode: Mode
  drankSet: Set<string>
  today: string           // YYYY-MM-DD in the viewer's local timezone
  fetchedAt: string
  status: ScoresStatus
  showSkeleton: boolean   // loading has taken long enough to show placeholders
  refreshFailed: boolean  // the last refresh failed but earlier scores are still shown
  onRetry: () => void
}

// Stands in for either tab's content until scores have loaded: placeholders
// while loading, or what went wrong with a way to try again.
function ScoresPending({ status, showSkeleton, onRetry }: Pick<Props, 'status' | 'showSkeleton' | 'onRetry'>) {
  return (
    // Holds the skeleton's height from the start so the page doesn't jump.
    <div className="max-w-xl mx-auto min-h-36">
      {status === 'error' ? (
        <Group>
          <ErrorState title="Couldn't load scores" onRetry={onRetry}>
            Check your connection. Your drinks are saved on this device.
          </ErrorState>
        </Group>
      ) : showSkeleton && (
        <Group>
          <Skeleton count={3} label="Loading scores" />
        </Group>
      )}
    </div>
  )
}

// A single game card used in both Today and Upcoming tabs
function GameCard({ g, mode }: { g: Game; mode: Mode }) {
  const ht = g.home ? teamByAbbr(g.home) : undefined
  const at = g.away ? teamByAbbr(g.away) : undefined
  const homeLabel  = ht   ? `${ht.flag} ${ht.name}`   : (g.homePlaceholder ?? 'TBD')
  const awayLabel  = at   ? `${at.flag} ${at.name}`   : (g.awayPlaceholder ?? 'TBD')
  const homeDrink  = ht   ? ht[mode]                  : undefined
  const awayDrink  = at   ? at[mode]                  : undefined
  const isTBD      = !ht || !at

  // Round label — shorten for display
  const roundShort = g.round
    ?.replace('Matchday', 'MD')
    ?.replace('Round of 32', 'R32')
    ?.replace('Round of 16', 'R16')
    ?.replace('Quarter-final', 'QF')
    ?.replace('Semi-final', 'SF')
    ?.replace('Match for third place', '3rd Place')

  return (
    <div className={`rounded-[var(--radius-lg)] border border-border overflow-hidden w-full max-w-sm ${isTBD ? 'bg-surface-alt' : 'bg-surface'}`}>
      {/* Header: time + venue */}
      <div className="flex items-start justify-between gap-2 px-3 pt-2.5 pb-2 border-b border-border">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="num font-semibold text-sm leading-none">{g.time}</span>
            {roundShort && (
              <span className="num text-muted text-[10px] uppercase tracking-wider leading-none">· {roundShort}</span>
            )}
          </div>
          {(g.stadium || g.city) && (
            <div className="mt-1">
              {g.stadium && <div className="text-xs leading-tight">{g.stadium}</div>}
              {g.city    && <div className="text-muted text-[11px] leading-tight">{g.city}</div>}
            </div>
          )}
        </div>
        {g.group && (
          <span className="num text-[10px] text-muted uppercase tracking-wider flex-shrink-0 mt-0.5">
            {g.group.replace('Group ', 'Grp ')}
          </span>
        )}
      </div>

      {/* Teams + drinks */}
      <div>
        {/* Home team */}
        <div className="px-3 pt-2 pb-1">
          <div className={`font-semibold text-sm leading-tight ${ht ? '' : 'text-muted italic'}`}>
            {homeLabel}
          </div>
          {homeDrink && (
            <div className="text-xs font-semibold mt-0.5">
              <DrinkLink drink={homeDrink} />
            </div>
          )}
          {!homeDrink && isTBD && (
            <div className="text-[11px] text-muted mt-0.5">Drink TBD</div>
          )}
        </div>

        {/* VS divider */}
        <div className="num px-3 text-muted text-[10px] uppercase tracking-widest">vs</div>

        {/* Away team */}
        <div className="px-3 pt-1 pb-2">
          <div className={`font-semibold text-sm leading-tight ${at ? '' : 'text-muted italic'}`}>
            {awayLabel}
          </div>
          {awayDrink && (
            <div className="text-xs font-semibold mt-0.5">
              <DrinkLink drink={awayDrink} />
            </div>
          )}
          {!awayDrink && isTBD && (
            <div className="text-[11px] text-muted mt-0.5">Drink TBD</div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ScorePanel({ games, mode, drankSet, today, fetchedAt, status, showSkeleton, refreshFailed, onRetry }: Props) {
  const [tab, setTab] = useState<'today' | 'upcoming'>('today')

  const todayGames     = games.filter(g => g.date === today)
  const liveGames      = todayGames.filter(g => g.status === 'live')
  const todayWinners   = todayGames
    .filter(g => g.status === 'final' && g.hs !== g.as)
    .map(g => {
      const winAbbr  = g.hs > g.as ? g.home : g.away
      const loseAbbr = g.hs > g.as ? g.away : g.home
      return {
        team:    winAbbr  ? teamByAbbr(winAbbr)  : undefined,
        opp:     loseAbbr ? teamByAbbr(loseAbbr) : undefined,
        ws:      Math.max(g.hs, g.as),
        ls:      Math.min(g.hs, g.as),
        winAbbr: winAbbr ?? '',
      }
    })
    .filter(x => x.team)
  const todayScheduled = todayGames.filter(g => g.status === 'scheduled')

  const upcomingGames = games
    .filter(g => g.status === 'scheduled' && g.date !== today)
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff))

  // Group upcoming by date
  const byDay: Record<string, Game[]> = {}
  upcomingGames.forEach(g => {
    if (!byDay[g.date]) byDay[g.date] = []
    byDay[g.date].push(g)
  })

  // Only format once we have a real fetch timestamp. Rendering a time during SSR
  // (or from a render-time `new Date()`) would differ from the client's clock and
  // timezone, causing a hydration mismatch.
  const fmtTime   = fetchedAt ? new Date(fetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
  const hasContent = todayGames.length > 0

  // Short "Mon · Jun 22" style label for a YYYY-MM-DD date. Parsed at local noon
  // so the weekday/day are correct in the viewer's timezone.
  function dayLabel(date: string) {
    const d = new Date(date + 'T12:00:00')
    if (date === today) {
      return `Today · ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    }
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  // "06/21" style label for the Today tab, in the viewer's local timezone.
  const todayShort = today
    ? new Date(today + 'T12:00:00').toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' })
    : ''

  const label = 'num text-[11px] uppercase tracking-widest text-muted mb-2 text-center'

  return (
    <div className="border-y border-border bg-surface-alt">
      {/* Tabs */}
      <div className="flex justify-center px-4 pt-4">
        <Segmented
          label="Games"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'today', label: `Today${todayShort ? ` · ${todayShort}` : ''}` },
            { value: 'upcoming', label: 'Upcoming games' },
          ]}
        />
      </div>

      {/* TODAY TAB */}
      {status !== 'ready' && (
        <div className="p-4">
          <ScoresPending status={status} showSkeleton={showSkeleton} onRetry={onRetry} />
        </div>
      )}

      {tab === 'today' && status === 'ready' && (
        <div className="p-4 space-y-5">
          {!hasContent && (
            <p className="text-muted text-sm text-center">No games today — check Upcoming for the next matchday.</p>
          )}

          {/* Live now */}
          {liveGames.length > 0 && (
            <div>
              <div className={label}>Live now</div>
              <div className="flex flex-wrap gap-3 justify-center">
                {liveGames.map(g => {
                  const ht = g.home ? teamByAbbr(g.home) : undefined
                  const at = g.away ? teamByAbbr(g.away) : undefined
                  return (
                    <div key={`live-${g.home}-${g.away}`} className="bg-surface border border-danger rounded-[var(--radius-lg)] overflow-hidden w-full max-w-sm">
                      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border">
                        <Chip tone="danger">LIVE</Chip>
                        {g.min && <span className="num text-danger-text text-xs font-semibold">{g.min}&apos;</span>}
                        {g.stadium && <span className="text-muted text-[11px] ml-auto truncate">{g.stadium}</span>}
                      </div>
                      <div className="px-3 py-2 flex items-center gap-3">
                        <div className="flex-1">
                          <div className="font-semibold text-sm">{ht?.flag} {ht?.name}</div>
                          {ht && <div className="text-xs font-semibold"><DrinkLink drink={ht[mode]} /></div>}
                        </div>
                        <span className="num text-2xl font-semibold">{g.hs}–{g.as}</span>
                        <div className="flex-1 text-right">
                          <div className="font-semibold text-sm">{at?.name} {at?.flag}</div>
                          {at && <div className="text-xs font-semibold"><DrinkLink drink={at[mode]} /></div>}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Winners */}
          {todayWinners.length > 0 && (
            <div>
              <div className={label}>Winners — drink up</div>
              <div className="flex flex-wrap gap-2 justify-center">
                {todayWinners.map(({ team, opp, ws, ls, winAbbr }) => (
                  <div
                    key={winAbbr}
                    className={`bg-surface border border-border rounded-[var(--radius-md)] px-3 py-2 flex items-center gap-2 transition-opacity ${drankSet.has(winAbbr) ? 'opacity-40' : ''}`}
                  >
                    <span className="text-2xl">{team!.flag}</span>
                    <div>
                      <div className="font-semibold text-sm leading-none">{team!.name}</div>
                      <div className="text-xs font-semibold mt-1">
                        <DrinkLink drink={team![mode]} />
                      </div>
                      <div className="text-[11px] text-muted mt-0.5">
                        <span className="num">{ws}–{ls}</span> vs {opp?.flag} {opp?.name}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Still to play */}
          {todayScheduled.length > 0 && (
            <div>
              <div className={label}>Still to play today</div>
              <div className="flex flex-col gap-3 items-center">
                {todayScheduled.map(g => <GameCard key={`today-${g.home}-${g.away}-${g.time}`} g={g} mode={mode} />)}
              </div>
            </div>
          )}

          {fmtTime && (refreshFailed ? (
            <p className="text-muted text-[11px] text-center">Couldn&apos;t refresh · showing scores from <span className="num">{fmtTime}</span> · trying again every 60s</p>
          ) : (
            <p className="text-muted text-[11px] text-center">Updated <span className="num">{fmtTime}</span> · auto-refreshes every 60s</p>
          ))}
        </div>
      )}

      {/* UPCOMING TAB */}
      {tab === 'upcoming' && status === 'ready' && (
        <div className="p-4 space-y-6">
          {Object.keys(byDay).length === 0 && (
            <p className="text-muted text-sm text-center">No upcoming games loaded yet.</p>
          )}
          {Object.keys(byDay).sort().map(date => (
            <div key={date}>
              {/* Day header */}
              <div className="flex items-center gap-3 mb-3">
                <div className="flex-1 border-t border-border" />
                <span className="num text-xs tracking-widest text-muted uppercase">
                  {dayLabel(date)}
                </span>
                <div className="flex-1 border-t border-border" />
              </div>
              {/* Game cards grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 justify-items-center">
                {byDay[date].map(g => (
                  <GameCard key={`up-${g.date}-${g.time}-${g.home}-${g.away}`} g={g} mode={mode} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
