'use client'
import { useState, useEffect, useCallback } from 'react'
import { Mode, Game } from '@/lib/types'
import { TEAMS, MODES, MODE_META, localToday, toLocalDateStr, teamByAbbr } from '@/lib/teams'
import TeamCard from '@/components/TeamCard'
import ScorePanel from '@/components/ScorePanel'
import Bracket from '@/components/Bracket'
import PullToRefresh from '@/components/PullToRefresh'

const DRANK_KEY = 'wc2026_drank_v3'
const GROUPS = ['A','B','C','D','E','F','G','H','I','J','K','L']
const KNOCKOUT_ROUNDS = new Set([
  'Round of 32', 'Round of 16', 'Quarter-final', 'Semi-final', 'Match for third place', 'Final',
])

type View = 'groups' | 'bracket'

// Convert each game's canonical UTC kickoff into the viewer's local date + time.
// Runs in the browser, so date/time always match the timezone of whoever is viewing.
function localizeGames(games: Game[]): Game[] {
  return games.map(g => {
    const d = new Date(g.kickoff)
    return {
      ...g,
      date: toLocalDateStr(d),
      time: d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }),
    }
  })
}

export default function GamePage() {
  const [mode, setMode] = useState<Mode>('auth')
  const [drankSet, setDrankSet] = useState<Set<string>>(new Set())
  const [games, setGames] = useState<Game[]>([])
  const [fetchedAt, setFetchedAt] = useState('')
  const [group, setGroup] = useState('ALL')
  const [search, setSearch] = useState('')
  const [view, setView] = useState<View>('groups')
  const [today, setToday] = useState('')

  // Resolve "today" in the browser's local timezone after mount (avoids any
  // server/client timezone mismatch during hydration).
  useEffect(() => {
    setToday(localToday())
  }, [])

  // Load drank state from localStorage
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(DRANK_KEY) ?? '[]')
      setDrankSet(new Set(saved))
    } catch {}
  }, [])

  // Fetch scores
  const fetchScores = useCallback(async () => {
    try {
      const res = await fetch('/api/scores')
      const data = await res.json()
      setGames(localizeGames(data.games ?? []))
      setFetchedAt(data.fetchedAt ?? new Date().toISOString())
    } catch {}
  }, [])

  // Manual refresh (pull-to-refresh): re-resolve today + refetch scores.
  const handleRefresh = useCallback(() => {
    setToday(localToday())
    return fetchScores()
  }, [fetchScores])

  useEffect(() => {
    fetchScores()
    const timer = setInterval(fetchScores, 60_000)
    return () => clearInterval(timer)
  }, [fetchScores])

  // Refresh as soon as the app returns to the foreground. Installed/standalone
  // web apps (home-screen icon) pause timers while backgrounded, so without this
  // a reopened app can show stale scores. Also re-resolves "today" to catch a
  // day rollover on a device left open overnight.
  useEffect(() => {
    const onForeground = () => {
      if (document.visibilityState !== 'visible') return
      setToday(localToday())
      fetchScores()
    }
    window.addEventListener('focus', onForeground)
    document.addEventListener('visibilitychange', onForeground)
    return () => {
      window.removeEventListener('focus', onForeground)
      document.removeEventListener('visibilitychange', onForeground)
    }
  }, [fetchScores])

  // Full reload every 15 minutes for always-on displays (a kiosk, an iPad left
  // open) so they pick up new deploys and stay healthy over long sessions. Only
  // reloads while visible; "drank" state lives in localStorage, so it survives.
  useEffect(() => {
    const RELOAD_MS = 15 * 60 * 1000
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') window.location.reload()
    }, RELOAD_MS)
    return () => clearInterval(timer)
  }, [])

  const toggleDrank = (abbr: string) => {
    setDrankSet(prev => {
      const next = new Set(prev)
      if (next.has(abbr)) next.delete(abbr)
      else next.add(abbr)
      localStorage.setItem(DRANK_KEY, JSON.stringify([...next]))
      return next
    })
  }

  const resetDrank = () => {
    if (!confirm('Reset all confirmed drinks?')) return
    setDrankSet(new Set())
    localStorage.setItem(DRANK_KEY, '[]')
  }

  // Derived score state
  const winners = new Set<string>()
  const liveSet = new Set<string>()
  const gameByTeam = new Map<string, Game>()

  games.forEach(g => {
    if (g.status === 'final') {
      if (g.hs > g.as && g.home) winners.add(g.home)
      else if (g.as > g.hs && g.away) winners.add(g.away)
    } else if (g.status === 'live') {
      if (g.home) liveSet.add(g.home)
      if (g.away) liveSet.add(g.away)
    }
    if (g.status !== 'scheduled') {
      if (g.home) gameByTeam.set(g.home, g)
      if (g.away) gameByTeam.set(g.away, g)
    }
  })

  // Today's group pills
  const todayGames = games.filter(g => g.date === today && g.status !== 'scheduled')
  const pillsByGroup = new Map<string, Game[]>()
  todayGames.forEach(g => {
    const ht = g.home ? teamByAbbr(g.home) : undefined
    if (!ht) return
    const arr = pillsByGroup.get(ht.g) ?? []
    arr.push(g)
    pillsByGroup.set(ht.g, arr)
  })

  // Stats
  const todayWinCount = games.filter(g => g.date === today && g.status === 'final' && g.hs !== g.as).length

  // Filtered teams
  const filteredTeams = TEAMS.filter(t => {
    if (group !== 'ALL' && t.g !== group) return false
    if (!search) return true
    const s = search.toLowerCase()
    return t.name.toLowerCase().includes(s) ||
      t.auth.drink.toLowerCase().includes(s) ||
      t.usa.drink.toLowerCase().includes(s)
  })

  const groupsToShow = group === 'ALL'
    ? GROUPS.filter(g => filteredTeams.some(t => t.g === g))
    : [group]

  return (
    <PullToRefresh onRefresh={handleRefresh}>
    <div className="min-h-screen text-[#f0ede6]" style={{
      background: '#1a3a1a',
      backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 60px,rgba(255,255,255,.015) 60px,rgba(255,255,255,.015) 61px),repeating-linear-gradient(90deg,transparent,transparent 60px,rgba(255,255,255,.015) 60px,rgba(255,255,255,.015) 61px)'
    }}>

      {/* Header */}
      <header className="text-center px-4 pt-8 pb-5 border-b-2 border-dashed border-white/10">
        <div className="text-[11px] tracking-[0.25em] text-yellow-400 uppercase mb-1">⚽ 2026 FIFA World Cup — Live</div>
        <h1 className="font-['Bebas_Neue'] text-7xl tracking-tight leading-none">
          DRINK<span className="text-yellow-400">&</span>WIN
        </h1>
        <p className="text-sm text-[#b8b4aa] mt-2 max-w-md mx-auto">
          Winners auto-highlight. Tap their button to confirm you drank the shot.
        </p>

        {/* Stats */}
        <div className="flex justify-center gap-8 mt-4 flex-wrap">
          {[
            { n: todayWinCount, l: 'Won Today' },
            { n: drankSet.size, l: 'Shots Drank' },
            { n: liveSet.size || '—', l: 'Live Now' },
            { n: games.filter(g => g.status === 'final').length, l: 'Finished' },
          ].map(({ n, l }) => (
            <div key={l} className="text-center">
              <span className="font-['Bebas_Neue'] text-3xl text-yellow-400 block leading-none">{n}</span>
              <span className="text-[10px] tracking-[0.14em] uppercase text-[#b8b4aa]">{l}</span>
            </div>
          ))}
        </div>

        {/* Controls row */}
        <div className="flex items-center justify-center gap-3 mt-3 flex-wrap">
          <button onClick={resetDrank} className="border border-dashed border-red-500 text-red-500 hover:bg-red-500 hover:text-white text-[11px] uppercase tracking-widest font-bold px-3 py-1.5 rounded transition-colors">
            ✕ Reset Drinks
          </button>
        </div>

        {/* Mode toggle */}
        <div className="flex justify-center mt-3">
          <div className="flex bg-black/35 border border-[#2d5a2d] rounded-full overflow-hidden">
            {MODES.map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-5 py-2 text-xs font-bold uppercase tracking-widest transition-all ${mode === m ? `${MODE_META[m].active} rounded-full` : 'text-[#b8b4aa] hover:text-white'}`}
              >
                {MODE_META[m].label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Score panel */}
      <ScorePanel games={games} mode={mode} drankSet={drankSet} today={today} fetchedAt={fetchedAt} />

      {/* View toggle — Groups vs Bracket */}
      <div className="flex justify-center px-4 pt-4 pb-0">
        <div className="flex bg-black/35 border border-[#2d5a2d] rounded-full overflow-hidden">
          <button
            onClick={() => setView('groups')}
            className={`px-5 py-2 text-xs font-bold uppercase tracking-widest transition-all ${
              view === 'groups' ? 'bg-yellow-400 text-black rounded-full' : 'text-[#b8b4aa] hover:text-white'
            }`}
          >
            ⚽ Groups
          </button>
          <button
            onClick={() => setView('bracket')}
            className={`px-5 py-2 text-xs font-bold uppercase tracking-widest transition-all ${
              view === 'bracket' ? 'bg-yellow-400 text-black rounded-full' : 'text-[#b8b4aa] hover:text-white'
            }`}
          >
            🏆 Bracket
          </button>
        </div>
      </div>

      {/* Bracket view */}
      {view === 'bracket' && (
        <Bracket
          mode={mode}
          knockoutGames={games.filter(g => KNOCKOUT_ROUNDS.has(g.round ?? ''))}
          drankSet={drankSet}
          onToggle={toggleDrank}
        />
      )}

      {/* Groups view */}
      {view === 'groups' && (
        <>
          {/* Group filters */}
          <div className="flex justify-center gap-2 px-4 pt-3 pb-1 flex-wrap">
            {['ALL', ...GROUPS].map(g => (
              <button
                key={g}
                onClick={() => setGroup(g)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  group === g
                    ? 'bg-yellow-400 border-yellow-400 text-black font-bold'
                    : 'border-[#2d5a2d] text-[#b8b4aa] hover:border-yellow-400/40 hover:text-white'
                }`}
              >
                {g}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="flex justify-center px-4 pb-3 pt-1">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="🔍 Search team or drink..."
              className="bg-[#0f2a0f] border border-[#2d5a2d] text-[#f0ede6] placeholder-[#b8b4aa] rounded-full px-4 py-2 text-sm w-full max-w-xs outline-none focus:border-yellow-400 transition-colors"
            />
          </div>

          {/* Groups */}
          <main className="max-w-7xl mx-auto px-4 pb-16">
            {groupsToShow.length === 0 && (
              <p className="text-center text-[#b8b4aa] py-12">No teams found — maybe they didn&apos;t qualify. Like Italy. 🫡</p>
            )}

            {groupsToShow.map(g => {
              const groupTeams = filteredTeams.filter(t => t.g === g)
              if (!groupTeams.length) return null
              const pills = pillsByGroup.get(g) ?? []

              return (
                <section key={g} className="mb-8">
                  <div className="border-b border-yellow-400/20 pb-1.5 mb-2">
                    <h2 className="font-['Bebas_Neue'] text-2xl tracking-widest text-yellow-400">⚽ Group {g}</h2>
                  </div>

                  {/* Result pills — today only */}
                  {pills.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {pills.map(game => {
                        const ht = game.home ? teamByAbbr(game.home) : undefined
                        const at = game.away ? teamByAbbr(game.away) : undefined
                        if (!ht) return null
                        if (game.status === 'live') {
                          return (
                            <span key={`${game.home}-${game.away}`} className="inline-flex items-center gap-1.5 bg-red-500/10 border border-red-500/35 rounded-md px-2 py-1 text-xs text-white">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                              {ht.flag} {ht.name}
                              <span className="font-['Bebas_Neue'] text-sm">{game.hs}–{game.as}</span>
                              {at?.name} {at?.flag}
                            </span>
                          )
                        }
                        if (game.hs === game.as) {
                          return (
                            <span key={`${game.home}-${game.away}`} className="inline-flex items-center gap-1.5 bg-white/5 border border-white/12 rounded-full px-2.5 py-0.5 text-xs text-[#b8b4aa]">
                              {ht.flag} {ht.name} <span className="font-['Bebas_Neue'] text-sm text-white">{game.hs}–{game.as}</span> {at?.name} {at?.flag} <span className="text-[10px]">DRAW</span>
                            </span>
                          )
                        }
                        const winAbbr = game.hs > game.as ? game.home : game.away
                        const wt = winAbbr ? teamByAbbr(winAbbr) : undefined
                        const lt = game.hs > game.as ? (game.away ? teamByAbbr(game.away) : undefined) : (game.home ? teamByAbbr(game.home) : undefined)
                        const ws = Math.max(game.hs, game.as), ls = Math.min(game.hs, game.as)
                        return (
                          <span key={`${game.home}-${game.away}`} title={`Beat ${lt?.name}`} className="inline-flex items-center gap-1.5 bg-yellow-400/8 border border-yellow-400/25 rounded-full px-2.5 py-0.5 text-xs text-yellow-400 font-semibold">
                            {wt?.flag} {wt?.name} <span className="font-['Bebas_Neue'] text-sm opacity-70">{ws}–{ls}</span>
                          </span>
                        )
                      })}
                    </div>
                  )}

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                    {groupTeams.map(team => (
                      <TeamCard
                        key={team.abbr}
                        team={team}
                        mode={mode}
                        game={gameByTeam.get(team.abbr)}
                        isWinner={winners.has(team.abbr)}
                        isLive={liveSet.has(team.abbr)}
                        hasDrank={drankSet.has(team.abbr)}
                        onToggle={toggleDrank}
                      />
                    ))}
                  </div>
                </section>
              )
            })}
          </main>
        </>
      )}

      <footer className="text-center py-4 text-[10px] text-[#b8b4aa] border-t border-white/8">
        Scores refresh every 60s · Drink responsibly · World Cup June 11 – July 19 2026 🍺
      </footer>
    </div>
    </PullToRefresh>
  )
}
