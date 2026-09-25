'use client'
import { useState, useEffect, useCallback } from 'react'
import { Mode, Game } from '@/lib/types'
import { TEAMS, MODES, MODE_META, localToday, toLocalDateStr, teamByAbbr } from '@/lib/teams'
import TeamCard from '@/components/TeamCard'
import ScorePanel from '@/components/ScorePanel'
import Bracket from '@/components/Bracket'
import PullToRefresh from '@/components/PullToRefresh'
import { Banner, Button, Chip, Group, Input, Segmented, StatStrip } from '@misterbeardy/design-system'

const DRANK_KEY = 'wc2026_drank_v3'
const GROUPS = ['A','B','C','D','E','F','G','H','I','J','K','L']
const KNOCKOUT_ROUNDS = new Set([
  'Round of 32', 'Round of 16', 'Quarter-final', 'Semi-final', 'Match for third place', 'Final',
])

type View = 'groups' | 'bracket'
export type ScoresStatus = 'loading' | 'ready' | 'error'

// Only show the loading skeleton if the first fetch takes longer than this, so
// a fast load doesn't flash placeholders for a frame.
const SKELETON_DELAY_MS = 300

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
  // 'loading' until the first fetch settles, 'error' if no scores could be
  // loaded, 'ready' once we have scores (a later failed refresh keeps them).
  const [status, setStatus] = useState<ScoresStatus>('loading')
  const [showSkeleton, setShowSkeleton] = useState(false)
  const [refreshFailed, setRefreshFailed] = useState(false)
  const [online, setOnline] = useState(true)

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

  // Fetch scores. The route answers 200 with `error` set when its upstream
  // source fails, so that counts as a failure too.
  const fetchScores = useCallback(async () => {
    try {
      const res = await fetch('/api/scores')
      if (!res.ok) throw new Error(`Scores request failed: ${res.status}`)
      const data = await res.json()
      if (data.error) throw new Error(`Scores source failed: ${data.error}`)
      setGames(localizeGames(data.games ?? []))
      setFetchedAt(data.fetchedAt ?? new Date().toISOString())
      setStatus('ready')
      setRefreshFailed(false)
    } catch (err) {
      console.error(err)
      // Keep scores we already have; only an empty page becomes an error.
      setStatus(prev => (prev === 'ready' ? 'ready' : 'error'))
      setRefreshFailed(true)
    }
  }, [])

  // Try again from the error state: back to loading while it runs.
  const retryScores = useCallback(() => {
    setStatus('loading')
    return fetchScores()
  }, [fetchScores])

  useEffect(() => {
    if (status !== 'loading') {
      setShowSkeleton(false)
      return
    }
    const timer = setTimeout(() => setShowSkeleton(true), SKELETON_DELAY_MS)
    return () => clearTimeout(timer)
  }, [status])

  // Track connectivity: a warning Banner while offline, and a refetch the
  // moment the connection comes back.
  useEffect(() => {
    setOnline(navigator.onLine)
    const goOnline = () => {
      setOnline(true)
      fetchScores()
    }
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [fetchScores])

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
  // Score-derived stats have no value until scores load; don't show a false 0.
  const scoreStat = (n: number | string) => (status === 'ready' ? n : '—')
  const fmtFetched = fetchedAt ? new Date(fetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''

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
    <div className="min-h-screen bg-bg text-ink">

      {/* Offline */}
      {!online && (
        <div className="max-w-xl mx-auto px-4 pt-4">
          <Banner tone="warning" title="You're offline">
            {status === 'ready' && fmtFetched
              ? <>Scores are from <span className="num">{fmtFetched}</span>. They&apos;ll update when you&apos;re back online.</>
              : <>Scores will load when you&apos;re back online.</>}
          </Banner>
        </div>
      )}

      {/* Header */}
      <header className="text-center px-4 pt-8 pb-5">
        <div className="num text-[11px] tracking-[0.2em] text-accent-text uppercase mb-2">2026 FIFA World Cup — Live</div>
        <h1 className="text-6xl sm:text-7xl font-bold tracking-tight leading-none">
          WIN<span className="text-accent-text">&amp;</span>DRINK
        </h1>
        <p className="text-sm text-muted mt-3 max-w-md mx-auto">
          Winners auto-highlight. Tap their button to confirm you drank the shot.
        </p>

        {/* Stats */}
        <div className="max-w-xl mx-auto mt-5 text-left">
          <Group>
            <StatStrip stats={[
              { label: 'Won today', value: scoreStat(todayWinCount), accent: true },
              { label: 'Shots drank', value: drankSet.size },
              { label: 'Live now', value: scoreStat(liveSet.size || '—') },
              { label: 'Finished', value: scoreStat(games.filter(g => g.status === 'final').length) },
            ]} />
          </Group>
        </div>

        {/* Mode toggle */}
        <div className="flex justify-center mt-5">
          <Segmented
            label="Drink list"
            value={mode}
            onChange={setMode}
            options={MODES.map(m => ({ value: m, label: MODE_META[m].label }))}
          />
        </div>

        {/* Controls row */}
        <div className="flex justify-center mt-4">
          <Button variant="ghost" size="sm" onClick={resetDrank}>Reset drinks</Button>
        </div>
      </header>

      {/* Score panel */}
      <ScorePanel
        games={games}
        mode={mode}
        drankSet={drankSet}
        today={today}
        fetchedAt={fetchedAt}
        status={status}
        showSkeleton={showSkeleton}
        refreshFailed={refreshFailed && online}
        onRetry={retryScores}
      />

      {/* View toggle — Groups vs Bracket */}
      <div className="flex justify-center px-4 pt-6">
        <Segmented
          label="View"
          value={view}
          onChange={setView}
          options={[{ value: 'groups', label: 'Groups' }, { value: 'bracket', label: 'Bracket' }]}
        />
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
          <div className="flex justify-center gap-2 px-4 pt-4 pb-1 flex-wrap" role="group" aria-label="Group">
            {['ALL', ...GROUPS].map(g => (
              <button
                key={g}
                onClick={() => setGroup(g)}
                aria-pressed={group === g}
                className={`num min-w-8 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  group === g
                    ? 'bg-accent border-accent text-on-accent'
                    : 'bg-surface border-border text-muted hover:text-ink'
                }`}
              >
                {g}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="flex justify-center px-4 pb-4 pt-3">
            <div className="w-full max-w-xs">
              <Input
                type="search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search team or drink"
                aria-label="Search team or drink"
              />
            </div>
          </div>

          {/* Groups */}
          <main className="max-w-7xl mx-auto px-4 pb-16">
            {groupsToShow.length === 0 && (
              <p className="text-center text-muted py-12">No teams found — maybe they didn&apos;t qualify. Like Italy. 🫡</p>
            )}

            {groupsToShow.map(g => {
              const groupTeams = filteredTeams.filter(t => t.g === g)
              if (!groupTeams.length) return null
              const pills = pillsByGroup.get(g) ?? []

              return (
                <section key={g} className="mb-8">
                  <div className="border-b border-border pb-1.5 mb-3">
                    <h2 className="text-xl font-bold">Group {g}</h2>
                  </div>

                  {/* Result pills — today only */}
                  {pills.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {pills.map(game => {
                        const ht = game.home ? teamByAbbr(game.home) : undefined
                        const at = game.away ? teamByAbbr(game.away) : undefined
                        if (!ht) return null
                        const pill = 'inline-flex items-center gap-1.5 bg-surface border border-border rounded-full pl-1 pr-2.5 py-0.5 text-xs'
                        if (game.status === 'live') {
                          return (
                            <span key={`${game.home}-${game.away}`} className={pill}>
                              <Chip tone="danger">LIVE</Chip>
                              {ht.flag} {ht.name}
                              <span className="num font-semibold">{game.hs}–{game.as}</span>
                              {at?.name} {at?.flag}
                            </span>
                          )
                        }
                        if (game.hs === game.as) {
                          return (
                            <span key={`${game.home}-${game.away}`} className={pill}>
                              <Chip tone="neutral">DRAW</Chip>
                              {ht.flag} {ht.name} <span className="num font-semibold">{game.hs}–{game.as}</span> {at?.name} {at?.flag}
                            </span>
                          )
                        }
                        const winAbbr = game.hs > game.as ? game.home : game.away
                        const wt = winAbbr ? teamByAbbr(winAbbr) : undefined
                        const lt = game.hs > game.as ? (game.away ? teamByAbbr(game.away) : undefined) : (game.home ? teamByAbbr(game.home) : undefined)
                        const ws = Math.max(game.hs, game.as), ls = Math.min(game.hs, game.as)
                        return (
                          <span key={`${game.home}-${game.away}`} title={`Beat ${lt?.name}`} className={pill}>
                            <Chip tone="success">WON</Chip>
                            {wt?.flag} {wt?.name} <span className="num font-semibold">{ws}–{ls}</span>
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

      <footer className="text-center py-4 text-[11px] text-muted border-t border-border">
        Scores refresh every 60s · Drink responsibly · World Cup June 11 – July 19 2026 🍺
      </footer>
    </div>
    </PullToRefresh>
  )
}
