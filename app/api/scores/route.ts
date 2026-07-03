import { NextResponse } from 'next/server'
import { Game, ScoresResponse } from '@/lib/types'
import { TEAMS } from '@/lib/teams'

const SOURCE_URL =
  'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json'

// Optional live-score overlay (football-data.org). Dormant until the key is set.
const FD_URL = 'https://api.football-data.org/v4/competitions/WC/matches'

const NAME_MAP: Record<string, string> = {
  'Mexico': 'MEX', 'South Africa': 'RSA', 'South Korea': 'KOR',
  'Czech Republic': 'CZE', 'Czechia': 'CZE', 'Switzerland': 'SUI',
  'Canada': 'CAN', 'Qatar': 'QAT', 'Bosnia and Herzegovina': 'BIH',
  'Bosnia & Herzegovina': 'BIH', 'Brazil': 'BRA', 'Morocco': 'MAR',
  'Scotland': 'SCO', 'DR Congo': 'COD', 'Congo DR': 'COD',
  'Democratic Republic of the Congo': 'COD', 'USA': 'USA',
  'United States': 'USA', 'Australia': 'AUS', 'Türkiye': 'TUR',
  'Turkey': 'TUR', 'Ghana': 'GHA', 'Germany': 'GER',
  "Côte d'Ivoire": 'CIV', 'Ivory Coast': 'CIV', 'Ecuador': 'ECU',
  'Curaçao': 'CUW', 'Curacao': 'CUW', 'Netherlands': 'NED',
  'Japan': 'JPN', 'Sweden': 'SWE', 'Tunisia': 'TUN', 'Belgium': 'BEL',
  'Iran': 'IRN', 'IR Iran': 'IRN', 'Egypt': 'EGY', 'Uzbekistan': 'UZB',
  'Spain': 'ESP', 'Uruguay': 'URU', 'Cape Verde': 'CPV',
  'Saudi Arabia': 'KSA', 'France': 'FRA', 'Senegal': 'SEN',
  'Norway': 'NOR', 'New Zealand': 'NZL', 'Argentina': 'ARG',
  'Austria': 'AUT', 'Algeria': 'ALG', 'Jordan': 'JOR',
  'Portugal': 'POR', 'Colombia': 'COL', 'Iraq': 'IRQ',
  'Paraguay': 'PAR', 'England': 'ENG', 'Croatia': 'CRO',
  'Kazakhstan': 'KAZ', 'Haiti': 'HTI', 'Panama': 'PAN',
}

// Clean up venue strings from openfootball
function cleanVenue(ground: string): { stadium: string; city: string } {
  const MAP: Record<string, { stadium: string; city: string }> = {
    'Mexico City':                           { stadium: 'Estadio Azteca',         city: 'Mexico City, MEX' },
    'Guadalajara (Zapopan)':                 { stadium: 'Estadio Akron',           city: 'Guadalajara, MEX' },
    'Monterrey (Guadalupe)':                 { stadium: 'Estadio BBVA',            city: 'Monterrey, MEX' },
    'Vancouver':                             { stadium: 'BC Place',                city: 'Vancouver, CAN' },
    'Toronto':                               { stadium: 'BMO Field',               city: 'Toronto, CAN' },
    'Seattle':                               { stadium: 'Lumen Field',             city: 'Seattle, WA' },
    'San Francisco Bay Area (Santa Clara)':  { stadium: "Levi's Stadium",          city: 'Santa Clara, CA' },
    'Los Angeles (Inglewood)':               { stadium: 'SoFi Stadium',            city: 'Los Angeles, CA' },
    'Dallas (Arlington)':                    { stadium: 'AT&T Stadium',            city: 'Dallas, TX' },
    'Kansas City':                           { stadium: 'Arrowhead Stadium',       city: 'Kansas City, MO' },
    'Houston':                               { stadium: 'NRG Stadium',             city: 'Houston, TX' },
    'Atlanta':                               { stadium: 'Mercedes-Benz Stadium',   city: 'Atlanta, GA' },
    'Miami (Miami Gardens)':                 { stadium: 'Hard Rock Stadium',       city: 'Miami, FL' },
    'Philadelphia':                          { stadium: 'Lincoln Financial Field', city: 'Philadelphia, PA' },
    'Boston (Foxborough)':                   { stadium: 'Gillette Stadium',        city: 'Boston, MA' },
    'New York/New Jersey (East Rutherford)': { stadium: 'MetLife Stadium',         city: 'East Rutherford, NJ' },
  }
  return MAP[ground] ?? { stadium: ground, city: '' }
}

// Is this a placeholder team string like "1A", "2B", "3A/B/C", "W74" etc?
function isPlaceholder(name: string): boolean {
  return /^[123][A-L]|^W\d+|^L\d+/.test(name)
}

// First FIFA match number of each knockout round. Matches within a round are
// listed in match-number order in the source feed, so we number them by their
// index within the round. This gives every knockout fixture a stable slot id
// that survives placeholder → real-team resolution (see lib/bracket.ts).
const KO_ROUND_BASE: Record<string, number> = {
  'Round of 32': 73,
  'Round of 16': 89,
  'Quarter-final': 97,
  'Semi-final': 101,
  'Match for third place': 103,
  'Final': 104,
}

// Assign FIFA match numbers to knockout games, in source order per round.
function assignKnockoutNumbers(games: Game[]): void {
  const seen: Record<string, number> = {}
  for (const g of games) {
    const base = g.round ? KO_ROUND_BASE[g.round] : undefined
    if (base === undefined) continue
    const offset = seen[g.round!] ?? 0
    g.num = base + offset
    seen[g.round!] = offset + 1
  }
}

function toAbbr(name: string): string | undefined {
  if (isPlaceholder(name)) return undefined
  return NAME_MAP[name] ?? name.substring(0, 3).toUpperCase()
}

// Parse "2026-06-19" + "19:00 UTC-4" → canonical kickoff instant as a UTC ISO string.
// The viewer's local date/time are derived from this on the client, so the same
// instant renders correctly in whatever timezone the browser is in.
function parseKickoff(date: string, time: string): string {
  const offsetMatch = time.match(/UTC([+-]\d+)/)
  const offsetHours = offsetMatch ? parseInt(offsetMatch[1]) : -4
  const [h, m] = time.split(' ')[0].split(':').map(Number)
  const utcMs = Date.parse(`${date}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00Z`) - offsetHours * 3600000
  return new Date(utcMs).toISOString()
}

interface RawMatch {
  date: string
  time?: string
  team1: string
  team2: string
  score?: { ft?: number[]; et?: number[]; p?: number[] }
  group?: string
  round?: string
  ground?: string
}

// ----- Live overlay (football-data.org) -------------------------------------

interface FdTeam { name?: string; tla?: string }
interface FdMatch {
  status?: string
  minute?: number | string | null
  homeTeam?: FdTeam
  awayTeam?: FdTeam
  score?: { fullTime?: { home?: number | null; away?: number | null } }
}

// football-data.org names some national teams differently from openfootball.
// Keys are normalized (curly→straight apostrophes) before lookup.
const FD_NAME_MAP: Record<string, string> = {
  'Korea Republic': 'KOR', 'South Korea': 'KOR',
  'IR Iran': 'IRN', 'Iran': 'IRN',
  'Cabo Verde': 'CPV', 'Cape Verde': 'CPV',
  'Bosnia-Herzegovina': 'BIH', 'Bosnia and Herzegovina': 'BIH',
  'DR Congo': 'COD', 'Congo DR': 'COD',
  "Cote d'Ivoire": 'CIV', "Côte d'Ivoire": 'CIV', 'Ivory Coast': 'CIV',
  'Türkiye': 'TUR', 'Turkiye': 'TUR', 'Turkey': 'TUR',
  'Curaçao': 'CUW', 'Curacao': 'CUW',
  'United States': 'USA',
  'Czech Republic': 'CZE', 'Czechia': 'CZE',
}

// football-data 3-letter codes that differ from our internal abbr.
const FD_TLA_MAP: Record<string, string> = {
  HAI: 'HTI',   // Haiti — FIFA/football-data use HAI, we use HTI
}

// Resolve a football-data team to our internal abbr. Names are the most reliable
// signal (we map them straight to our abbr); the 3-letter code is a fallback,
// with explicit overrides for codes that differ from ours.
function fdAbbr(team: FdTeam | undefined, abbrs: Set<string>): string | undefined {
  if (!team) return undefined
  const name = (team.name ?? '').replace(/’/g, "'").trim()  // normalize curly apostrophe
  const byName = FD_NAME_MAP[name] ?? NAME_MAP[name]
  if (byName) return byName
  const tla = team.tla?.toUpperCase()
  if (tla && FD_TLA_MAP[tla]) return FD_TLA_MAP[tla]
  if (tla && abbrs.has(tla)) return tla
  return name ? name.slice(0, 3).toUpperCase() : undefined
}

// Unordered key for a fixture, so it matches regardless of home/away orientation.
function pairKey(a?: string, b?: string): string | undefined {
  return a && b ? [a, b].sort().join('|') : undefined
}

function parseMinute(min: number | string | null | undefined): number | undefined {
  if (min == null) return undefined
  const n = parseInt(String(min), 10)   // handles "45+2" → 45
  return Number.isFinite(n) ? n : undefined
}

// Overlay live/in-play scores (and any fresher finals) from football-data.org onto
// the openfootball base. No-op unless FOOTBALL_DATA_API_KEY is set; any failure is
// swallowed so the base schedule/scores always render.
async function applyLiveOverlay(games: Game[], abbrs: Set<string>): Promise<void> {
  const key = process.env.FOOTBALL_DATA_API_KEY
  if (!key) return
  try {
    const res = await fetch(FD_URL, {
      headers: { 'X-Auth-Token': key },
      next: { revalidate: 30 },
    })
    if (!res.ok) throw new Error(`football-data ${res.status}`)
    const data = await res.json()
    const matches: FdMatch[] = data.matches ?? []

    const byPair = new Map<string, FdMatch>()
    for (const m of matches) {
      const k = pairKey(fdAbbr(m.homeTeam, abbrs), fdAbbr(m.awayTeam, abbrs))
      if (k) byPair.set(k, m)
    }

    for (const g of games) {
      const k = pairKey(g.home, g.away)
      if (!k) continue
      const m = byPair.get(k)
      if (!m) continue

      const fh = m.score?.fullTime?.home ?? 0
      const fa = m.score?.fullTime?.away ?? 0
      // Align the score to our home/away (football-data may list them swapped).
      const sameOrientation = fdAbbr(m.homeTeam, abbrs) === g.home
      const hs = sameOrientation ? fh : fa
      const as = sameOrientation ? fa : fh

      if (m.status === 'IN_PLAY' || m.status === 'PAUSED') {
        g.status = 'live'
        g.hs = hs
        g.as = as
        const min = parseMinute(m.minute)
        if (min !== undefined) g.min = min
      } else if (m.status === 'FINISHED' && g.status !== 'final') {
        g.status = 'final'
        g.hs = hs
        g.as = as
      }
    }
  } catch (err) {
    console.error('Live overlay failed:', err)
  }
}

export async function GET() {
  try {
    const res = await fetch(SOURCE_URL, { next: { revalidate: 60 } })
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`)
    const data = await res.json()
    const rawMatches: RawMatch[] = data.matches ?? []

    const games: Game[] = rawMatches.map((m) => {
      const hasFT = Array.isArray(m.score?.ft)
      // Displayed score is after extra time when it was played; penalties (knockout
      // draws) are kept separate so the bracket can resolve the actual winner.
      const finalScore = m.score?.et ?? m.score?.ft
      const pens = m.score?.p
      const kickoff = parseKickoff(m.date, m.time ?? '20:00 UTC-4')
      const venue = m.ground ? cleanVenue(m.ground) : undefined

      return {
        home:          toAbbr(m.team1),
        away:          toAbbr(m.team2),
        homePlaceholder: isPlaceholder(m.team1) ? m.team1 : undefined,
        awayPlaceholder: isPlaceholder(m.team2) ? m.team2 : undefined,
        hs:            hasFT ? (finalScore?.[0] ?? 0) : 0,
        as:            hasFT ? (finalScore?.[1] ?? 0) : 0,
        homePens:      Array.isArray(pens) ? pens[0] : undefined,
        awayPens:      Array.isArray(pens) ? pens[1] : undefined,
        status:        hasFT ? 'final' : 'scheduled',
        kickoff,
        // date/time are placeholders; the client overwrites them with values
        // localized to the viewer's timezone (see GamePage.localizeGames).
        date:          kickoff.slice(0, 10),
        time:          '',
        round:         m.round,
        group:         m.group ?? undefined,
        stadium:       venue?.stadium,
        city:          venue?.city,
      }
    })

    // Number knockout fixtures while still in source (match-number) order, so the
    // bracket can key each game to a fixed slot regardless of kickoff-time sorting.
    assignKnockoutNumbers(games)

    // Overlay live in-play scores from football-data.org (no-op without an API key).
    await applyLiveOverlay(games, new Set(TEAMS.map(t => t.abbr)))

    // Sort chronologically by the canonical kickoff instant (UTC ISO sorts lexically).
    games.sort((a, b) => a.kickoff.localeCompare(b.kickoff))

    const response: ScoresResponse = { games, fetchedAt: new Date().toISOString() }
    return NextResponse.json(response, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30' },
    })
  } catch (err) {
    console.error('Score fetch failed:', err)
    return NextResponse.json(
      { games: [], fetchedAt: new Date().toISOString(), error: 'fetch_failed' },
      { status: 200 }
    )
  }
}
