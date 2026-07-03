// World Cup 2026 knockout bracket — 48 teams → Round of 32 → R16 → QF → SF → Final.
//
// Each knockout fixture is keyed by its FIFA match number (assigned server-side in
// app/api/scores/route.ts). The tournament tree below is fixed and published in
// advance, so we can resolve every slot's teams — even before a match is played —
// by propagating winners up from the Round of 32.

import { Game, GameStatus } from './types'

// Which two earlier matches feed each knockout match: [homeFeeder, awayFeeder].
// Round of 32 matches (73–88) are the leaves and have no feeders.
const FEEDERS: Record<number, [number, number]> = {
  // Round of 16 (89–96) ← winners of the Round of 32
  89: [74, 77], 90: [73, 75], 91: [76, 78], 92: [79, 80],
  93: [83, 84], 94: [81, 82], 95: [86, 88], 96: [85, 87],
  // Quarter-finals (97–100) ← winners of the Round of 16
  97: [89, 90], 98: [93, 94], 99: [91, 92], 100: [95, 96],
  // Semi-finals (101–102) ← winners of the Quarter-finals
  101: [97, 98], 102: [99, 100],
  // Third-place play-off (103) ← losers of the Semi-finals
  103: [101, 102],
  // Final (104) ← winners of the Semi-finals
  104: [101, 102],
}

export type KoRoundId = 'r32' | 'r16' | 'qf' | 'sf' | 'final'

export interface KoSlot {
  num: number
  homeAbbr?: string     // resolved team abbr (undefined until known)
  awayAbbr?: string
  homeLabel: string     // placeholder shown when the team is not yet known
  awayLabel: string
  homeScore?: number
  awayScore?: number
  homePens?: number
  awayPens?: number
  status?: GameStatus
  winnerAbbr?: string
}

export interface KoColumn {
  id: KoRoundId
  label: string
  slots: KoSlot[]       // in top-to-bottom bracket order
}

export interface BracketData {
  columns: KoColumn[]   // r32 → r16 → qf → sf (each rendered split into two halves)
  final: KoSlot         // match 104
  third: KoSlot         // match 103 (third-place play-off)
}

// Short human label for a feeder slot, e.g. "R16·3", used when a match's inputs
// aren't decided yet and the feed hasn't supplied a placeholder of its own.
function feederLabel(num: number): string {
  if (num >= 73 && num <= 88) return `R32·${num - 72}`
  if (num >= 89 && num <= 96) return `R16·${num - 88}`
  if (num >= 97 && num <= 100) return `QF·${num - 96}`
  if (num >= 101 && num <= 102) return `SF·${num - 100}`
  return `M${num}`
}

// Round-of-32 leaves under a match, in top-to-bottom order — used to lay the
// bracket out vertically so children sit either side of their parent.
function leaves(num: number): number[] {
  const f = FEEDERS[num]
  return f ? [...leaves(f[0]), ...leaves(f[1])] : [num]
}

export function buildBracket(games: Game[]): BracketData {
  const byNum = new Map<number, Game>()
  games.forEach(g => { if (g.num != null) byNum.set(g.num, g) })

  const winnerMemo = new Map<number, string | undefined>()
  const loserMemo = new Map<number, string | undefined>()

  // Resolve a match's two teams: use the feed's teams when known, otherwise
  // propagate the winner (or loser, for the third-place match) of each feeder.
  function teamsOf(num: number): [string | undefined, string | undefined] {
    const g = byNum.get(num)
    const fed = FEEDERS[num]
    const isThird = num === 103
    let home = g?.home
    let away = g?.away
    if (!home && fed) home = isThird ? loserOf(fed[0]) : winnerOf(fed[0])
    if (!away && fed) away = isThird ? loserOf(fed[1]) : winnerOf(fed[1])
    return [home, away]
  }

  // Which side won: goals first, penalty shootout as the knockout tiebreak.
  function decide(g: Game | undefined): 'home' | 'away' | undefined {
    if (!g || g.status !== 'final') return undefined
    if (g.hs > g.as) return 'home'
    if (g.as > g.hs) return 'away'
    if (g.homePens != null && g.awayPens != null && g.homePens !== g.awayPens) {
      return g.homePens > g.awayPens ? 'home' : 'away'
    }
    return undefined
  }

  function winnerOf(num: number): string | undefined {
    if (winnerMemo.has(num)) return winnerMemo.get(num)
    winnerMemo.set(num, undefined) // guard against cycles during recursion
    const [home, away] = teamsOf(num)
    const side = decide(byNum.get(num))
    const w = side === 'home' ? home : side === 'away' ? away : undefined
    winnerMemo.set(num, w)
    return w
  }

  function loserOf(num: number): string | undefined {
    if (loserMemo.has(num)) return loserMemo.get(num)
    loserMemo.set(num, undefined)
    const [home, away] = teamsOf(num)
    const side = decide(byNum.get(num))
    const l = side === 'home' ? away : side === 'away' ? home : undefined
    loserMemo.set(num, l)
    return l
  }

  function slot(num: number): KoSlot {
    const g = byNum.get(num)
    const fed = FEEDERS[num]
    const [home, away] = teamsOf(num)
    const played = g?.status === 'live' || g?.status === 'final'

    const homeFallback = g?.homePlaceholder ?? (fed ? feederLabel(fed[0]) : 'TBD')
    const awayFallback = g?.awayPlaceholder ?? (fed ? feederLabel(fed[1]) : 'TBD')

    return {
      num,
      homeAbbr: home,
      awayAbbr: away,
      homeLabel: home ? '' : homeFallback,
      awayLabel: away ? '' : awayFallback,
      homeScore: played ? g!.hs : undefined,
      awayScore: played ? g!.as : undefined,
      homePens: g?.homePens,
      awayPens: g?.awayPens,
      status: g?.status,
      winnerAbbr: winnerOf(num),
    }
  }

  // Vertical ordering: sort each round's matches by the position of their
  // subtree within the Round of 32, so the tree reads top-to-bottom.
  const r32Order = leaves(104)
  const rank = new Map(r32Order.map((n, i) => [n, i]))
  const orderRound = (nums: number[]) =>
    [...nums].sort(
      (a, b) =>
        Math.min(...leaves(a).map(l => rank.get(l)!)) -
        Math.min(...leaves(b).map(l => rank.get(l)!)),
    )

  const range = (start: number, end: number) =>
    Array.from({ length: end - start + 1 }, (_, i) => start + i)

  const columns: KoColumn[] = [
    { id: 'r32', label: 'Round of 32', slots: r32Order.map(slot) },
    { id: 'r16', label: 'Round of 16', slots: orderRound(range(89, 96)).map(slot) },
    { id: 'qf', label: 'Quarter-finals', slots: orderRound(range(97, 100)).map(slot) },
    { id: 'sf', label: 'Semi-finals', slots: orderRound(range(101, 102)).map(slot) },
  ]

  return { columns, final: slot(104), third: slot(103) }
}
