'use client'
import { useState } from 'react'
import { Game, Mode } from '@/lib/types'
import { teamByAbbr, MODE_META } from '@/lib/teams'
import DrinkLink from './DrinkLink'

interface Props {
  games: Game[]
  mode: Mode
  drankSet: Set<string>
  today: string           // YYYY-MM-DD in the viewer's local timezone
  fetchedAt: string
}

// A single game card used in both Today and Upcoming tabs
function GameCard({ g, mode }: { g: Game; mode: Mode }) {
  const ht = g.home ? teamByAbbr(g.home) : undefined
  const at = g.away ? teamByAbbr(g.away) : undefined
  const drinkCls = MODE_META[mode].text

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
    <div className={`rounded-xl border overflow-hidden w-full max-w-sm ${isTBD ? 'border-white/10 bg-white/3' : 'border-white/15 bg-[#0a1a0a]'}`}>
      {/* Header: time + venue */}
      <div className="flex items-start justify-between gap-2 px-3 pt-2.5 pb-2 border-b border-white/8">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-purple-300 font-bold text-sm tracking-wide leading-none">{g.time}</span>
            {roundShort && (
              <span className="text-white/30 text-[10px] font-bold uppercase tracking-wider leading-none">· {roundShort}</span>
            )}
          </div>
          {(g.stadium || g.city) && (
            <div className="mt-0.5">
              {g.stadium && <div className="text-white/55 text-[11px] leading-tight">{g.stadium}</div>}
              {g.city    && <div className="text-white/30 text-[10px] leading-tight">{g.city}</div>}
            </div>
          )}
        </div>
        {g.group && (
          <span className="text-[10px] font-bold text-yellow-400/50 uppercase tracking-wider flex-shrink-0 mt-0.5">
            {g.group.replace('Group ', 'Grp ')}
          </span>
        )}
      </div>

      {/* Teams + drinks */}
      <div className="divide-y divide-white/6">
        {/* Home team */}
        <div className="flex items-center gap-2 px-3 py-2">
          <div className="flex-1 min-w-0">
            <div className={`font-bold text-sm leading-tight ${ht ? 'text-white' : 'text-white/35 italic'}`}>
              {homeLabel}
            </div>
            {homeDrink && (
              <div className={`text-[11px] font-semibold mt-0.5 ${drinkCls}`}>
                {MODE_META[mode].icon} <DrinkLink drink={homeDrink} />
              </div>
            )}
            {!homeDrink && isTBD && (
              <div className="text-[10px] text-white/20 mt-0.5">Drink TBD</div>
            )}
          </div>
        </div>

        {/* VS divider */}
        <div className="flex items-center px-3 py-0.5">
          <div className="flex-1 border-t border-white/0" />
          <span className="text-white/20 text-[10px] font-bold uppercase tracking-widest px-2">vs</span>
          <div className="flex-1 border-t border-white/0" />
        </div>

        {/* Away team */}
        <div className="flex items-center gap-2 px-3 py-2">
          <div className="flex-1 min-w-0">
            <div className={`font-bold text-sm leading-tight ${at ? 'text-white' : 'text-white/35 italic'}`}>
              {awayLabel}
            </div>
            {awayDrink && (
              <div className={`text-[11px] font-semibold mt-0.5 ${drinkCls}`}>
                {MODE_META[mode].icon} <DrinkLink drink={awayDrink} />
              </div>
            )}
            {!awayDrink && isTBD && (
              <div className="text-[10px] text-white/20 mt-0.5">Drink TBD</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ScorePanel({ games, mode, drankSet, today, fetchedAt }: Props) {
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

  return (
    <div className="bg-[#0d1f0d] border-b border-white/10">
      {/* Tabs */}
      <div className="flex border-b border-white/10">
        {(['today', 'upcoming'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={[
              'flex-1 py-3 text-xs font-bold uppercase tracking-widest transition-colors relative',
              tab === t ? 'text-white' : 'text-white/35 hover:text-white/60',
            ].join(' ')}
          >
            {t === 'today' ? `📅 Today${todayShort ? ` · ${todayShort}` : ''}` : '🔮 Upcoming Games'}
            {tab === t && (
              <span className={`absolute bottom-0 left-0 right-0 h-0.5 ${t === 'today' ? 'bg-yellow-400' : 'bg-purple-400'}`} />
            )}
          </button>
        ))}
      </div>

      {/* TODAY TAB */}
      {tab === 'today' && (
        <div className="p-4 space-y-5">
          {!hasContent && (
            <p className="text-white/40 text-sm text-center">No games today — check Upcoming for the next matchday.</p>
          )}

          {/* Live now */}
          {liveGames.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-2 text-center">🔴 Live Now</div>
              <div className="flex flex-wrap gap-3 justify-center">
                {liveGames.map(g => {
                  const ht = g.home ? teamByAbbr(g.home) : undefined
                  const at = g.away ? teamByAbbr(g.away) : undefined
                  const drinkCls = MODE_META[mode].text
                  return (
                    <div key={`live-${g.home}-${g.away}`} className="bg-red-500/12 border border-red-500/45 rounded-xl overflow-hidden w-full max-w-sm">
                      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-red-500/20">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        <span className="text-red-400 text-[10px] font-bold uppercase tracking-widest">Live</span>
                        {g.min && <span className="text-red-400 text-[10px] font-bold ml-auto">{g.min}&apos;</span>}
                        {g.stadium && <span className="text-white/30 text-[10px] ml-auto truncate">{g.stadium}</span>}
                      </div>
                      <div className="px-3 py-2 flex items-center gap-3">
                        <div className="flex-1">
                          <div className="font-bold text-white text-sm">{ht?.flag} {ht?.name}</div>
                          {ht && <div className={`text-[11px] font-semibold ${drinkCls}`}>{MODE_META[mode].icon} <DrinkLink drink={ht[mode]} /></div>}
                        </div>
                        <span className="font-['Bebas_Neue'] text-2xl text-white">{g.hs}–{g.as}</span>
                        <div className="flex-1 text-right">
                          <div className="font-bold text-white text-sm">{at?.name} {at?.flag}</div>
                          {at && <div className={`text-[11px] font-semibold ${drinkCls}`}><DrinkLink drink={at[mode]} /> {MODE_META[mode].icon}</div>}
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
              <div className="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-2 text-center">{MODE_META[mode].icon} Winners — Drink Up</div>
              <div className="flex flex-wrap gap-2 justify-center">
                {todayWinners.map(({ team, opp, ws, ls, winAbbr }) => (
                  <div
                    key={winAbbr}
                    className={`bg-yellow-400/12 border border-yellow-400/35 rounded-lg px-3 py-2 flex items-center gap-2 transition-opacity ${drankSet.has(winAbbr) ? 'opacity-30' : ''}`}
                  >
                    <span className="text-2xl">{team!.flag}</span>
                    <div>
                      <div className="font-['Bebas_Neue'] text-base text-white leading-none">{team!.name}</div>
                      <div className={`text-xs font-bold mt-0.5 ${MODE_META[mode].text}`}>
                        {MODE_META[mode].icon} <DrinkLink drink={team![mode]} />
                      </div>
                      <div className="text-[10px] font-['Bebas_Neue'] text-white/40 mt-0.5">
                        {ws}–{ls} vs {opp?.flag} {opp?.name}
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
              <div className="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-2 text-center">⏰ Still to Play Today</div>
              <div className="flex flex-col gap-3 items-center">
                {todayScheduled.map(g => <GameCard key={`today-${g.home}-${g.away}-${g.time}`} g={g} mode={mode} />)}
              </div>
            </div>
          )}

          {fmtTime && (
            <p className="text-white/25 text-[10px] text-center">✓ Updated {fmtTime} · auto-refreshes every 60s</p>
          )}
        </div>
      )}

      {/* UPCOMING TAB */}
      {tab === 'upcoming' && (
        <div className="p-4 space-y-6">
          {Object.keys(byDay).length === 0 && (
            <p className="text-white/40 text-sm text-center">No upcoming games loaded yet.</p>
          )}
          {Object.keys(byDay).sort().map(date => (
            <div key={date}>
              {/* Day header */}
              <div className="flex items-center gap-3 mb-3">
                <div className="flex-1 border-t border-white/10" />
                <span className="font-['Bebas_Neue'] text-sm tracking-widest text-purple-300 uppercase">
                  {dayLabel(date)}
                </span>
                <div className="flex-1 border-t border-white/10" />
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
