export type Mode = 'auth' | 'usa' | 'beer'

export interface Drink {
  drink: string
  desc: string
  wiki: string
}

export interface Team {
  g: string
  flag: string
  name: string
  abbr: string
  conf: string
  auth: Drink
  usa: Drink
  beer: Drink
}

export type GameStatus = 'final' | 'live' | 'scheduled'

export interface Game {
  home?: string           // abbr — undefined for placeholder teams (TBD)
  away?: string
  homePlaceholder?: string  // e.g. "1A", "3B/C/D", "W74"
  awayPlaceholder?: string
  hs: number              // home goals (after extra time, if played)
  as: number              // away goals
  homePens?: number       // penalty-shootout score (knockout draws only)
  awayPens?: number
  status: GameStatus
  kickoff: string         // canonical kickoff instant, UTC ISO 8601 (e.g. "2026-06-19T23:00:00.000Z")
  date: string            // YYYY-MM-DD in the viewer's local timezone (derived client-side from kickoff)
  time: string            // formatted kickoff time in the viewer's local timezone (derived client-side)
  min?: number
  prob?: Record<string, number>
  num?: number            // FIFA match number (knockout only) — stable slot id for the bracket
  round?: string          // e.g. "Matchday 10", "Round of 16", "Quarter-final"
  group?: string          // e.g. "Group A"
  stadium?: string        // e.g. "MetLife Stadium"
  city?: string           // e.g. "East Rutherford, NJ"
}

export interface ScoresResponse {
  games: Game[]
  fetchedAt: string
}
