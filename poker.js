// ============================================================================
// Texas Hold'em engine — N-handed (2 or 3 seats supported in the prototype).
// Seat 0 is the hero by convention. Each seat carries its own stack, hole
// cards, bet, folded/all-in flags.
// ============================================================================

const SUITS = ['♠', '♥', '♦', '♣'];
const RANK_NAMES = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };

function rankLabel(r) { return RANK_NAMES[r] || String(r); }
function cardLabel(c) { return rankLabel(c.rank) + c.suit; }
function isRed(card) { return card.suit === '♥' || card.suit === '♦'; }

function newDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (let rank = 2; rank <= 14; rank++) deck.push({ rank, suit });
  }
  return deck;
}

function shuffle(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

// ----- Hand evaluation ------------------------------------------------------

const CATEGORY_NAMES = [
  'High Card', 'Pair', 'Two Pair', 'Three of a Kind', 'Straight',
  'Flush', 'Full House', 'Four of a Kind', 'Straight Flush', 'Royal Flush'
];

function bestFiveOfSeven(cards) {
  let best = null;
  for (let a = 0; a < 7; a++)
    for (let b = a + 1; b < 7; b++) {
      const five = [0,1,2,3,4,5,6].filter(i => i !== a && i !== b).map(i => cards[i]);
      const ev = evaluateFive(five);
      if (!best || compareScores(ev.score, best.score) > 0) best = ev;
    }
  return best;
}

function evaluateFive(cards) {
  const ranks = cards.map(c => c.rank).sort((a, b) => b - a);
  const suits = cards.map(c => c.suit);
  const counts = {};
  for (const r of ranks) counts[r] = (counts[r] || 0) + 1;

  const grouped = Object.entries(counts)
    .map(([r, c]) => ({ rank: +r, count: c }))
    .sort((a, b) => b.count - a.count || b.rank - a.rank);

  const isFlush = suits.every(s => s === suits[0]);
  const uniqueRanks = [...new Set(ranks)].sort((a, b) => b - a);
  let straightHigh = null;
  if (uniqueRanks.length === 5) {
    if (uniqueRanks[0] - uniqueRanks[4] === 4) straightHigh = uniqueRanks[0];
    else if (uniqueRanks.join(',') === '14,5,4,3,2') straightHigh = 5;
  }

  if (isFlush && straightHigh === 14) return { category: 9, name: 'Royal Flush', score: [9] };
  if (isFlush && straightHigh)        return { category: 8, name: 'Straight Flush', score: [8, straightHigh] };
  if (grouped[0].count === 4)         return { category: 7, name: 'Four of a Kind', score: [7, grouped[0].rank, grouped[1].rank] };
  if (grouped[0].count === 3 && grouped[1].count === 2)
    return { category: 6, name: 'Full House', score: [6, grouped[0].rank, grouped[1].rank] };
  if (isFlush)                        return { category: 5, name: 'Flush', score: [5, ...ranks] };
  if (straightHigh)                   return { category: 4, name: 'Straight', score: [4, straightHigh] };
  if (grouped[0].count === 3) {
    const kickers = grouped.slice(1).map(g => g.rank);
    return { category: 3, name: 'Three of a Kind', score: [3, grouped[0].rank, ...kickers] };
  }
  if (grouped[0].count === 2 && grouped[1].count === 2) {
    const pairHi = Math.max(grouped[0].rank, grouped[1].rank);
    const pairLo = Math.min(grouped[0].rank, grouped[1].rank);
    return { category: 2, name: 'Two Pair', score: [2, pairHi, pairLo, grouped[2].rank] };
  }
  if (grouped[0].count === 2) {
    const kickers = grouped.slice(1).map(g => g.rank);
    return { category: 1, name: 'Pair', score: [1, grouped[0].rank, ...kickers] };
  }
  return { category: 0, name: 'High Card', score: [0, ...ranks] };
}

function compareScores(a, b) {
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const av = a[i] || 0;
    const bv = b[i] || 0;
    if (av !== bv) return av - bv;
  }
  return 0;
}

// ----- Equity estimate ------------------------------------------------------
// Approximates win probability against ONE random opponent. Good enough for
// AI heuristics and Calculator-voice readouts at heads-up. With N opponents
// raise the threshold heuristically.

// Win probability vs N random opponents. Hero wins outright iff they beat
// every villain. samples scale down a bit per-villain to keep this cheap.
function estimateEquity(hole, board, oppCount = 1, samples = 250) {
  // Back-compat: 3rd argument used to be the sample count.
  if (typeof oppCount === 'number' && oppCount > 8) { samples = oppCount; oppCount = 1; }
  oppCount = Math.max(1, oppCount);
  // Cap samples for performance with many opps
  samples = Math.max(60, Math.floor(samples / Math.max(1, oppCount * 0.5)));
  const known = [...hole, ...board];
  let wins = 0, ties = 0;
  for (let s = 0; s < samples; s++) {
    const deck = newDeck().filter(c => !known.some(k => k.rank === c.rank && k.suit === c.suit));
    shuffle(deck);
    const oppHands = [];
    for (let i = 0; i < oppCount; i++) {
      oppHands.push([deck.pop(), deck.pop()]);
    }
    const remaining = [...board];
    while (remaining.length < 5) remaining.push(deck.pop());
    const heroBest = bestFiveOfSeven([...hole, ...remaining]);
    let heroAhead = true;
    let tieWithSomeone = false;
    for (const oh of oppHands) {
      const ob = bestFiveOfSeven([...oh, ...remaining]);
      const cmp = compareScores(heroBest.score, ob.score);
      if (cmp < 0) { heroAhead = false; break; }
      if (cmp === 0) tieWithSomeone = true;
    }
    if (heroAhead && !tieWithSomeone) wins++;
    else if (heroAhead) ties++;
  }
  return (wins + ties / 2) / samples;
}

// ============================================================================
// N-player hand state machine
// ============================================================================

function createHand({ players, smallBlind, bigBlind, buttonIndex, sleeveCard }) {
  // players: [{ id, name, stack, profile? }, ...] in seating order
  const deck = shuffle(newDeck());
  const n = players.length;
  const seats = players.map(p => ({
    id: p.id,
    name: p.name || p.id,
    profile: p.profile || null,
    stack: p.stack,
    bet: 0,
    folded: false,
    allIn: false,
    actedThisStreet: false,
    hole: [deck.pop(), deck.pop()],
    best: null,
  }));

  // Sleeve card swaps into seat 0 (hero).
  if (sleeveCard) {
    const idx = deck.findIndex(c => c.rank === sleeveCard.rank && c.suit === sleeveCard.suit);
    if (idx >= 0) deck.splice(idx, 1);
    seats[0].hole = [sleeveCard, seats[0].hole[1]];
  }

  // Blinds. In heads-up, the button posts the SB; in 3+ handed, SB is the
  // seat left of the button.
  const sbIdx = n === 2 ? buttonIndex : (buttonIndex + 1) % n;
  const bbIdx = n === 2 ? (buttonIndex + 1) % n : (buttonIndex + 2) % n;
  const sbAmt = Math.min(smallBlind, seats[sbIdx].stack);
  const bbAmt = Math.min(bigBlind, seats[bbIdx].stack);
  seats[sbIdx].stack -= sbAmt; seats[sbIdx].bet = sbAmt;
  seats[bbIdx].stack -= bbAmt; seats[bbIdx].bet = bbAmt;

  // First to act pre-flop:
  //   2-handed: button (= SB) acts first
  //   3+ handed: player left of BB acts first
  const firstPreflop = n === 2 ? buttonIndex : (bbIdx + 1) % n;

  return {
    deck,
    seats,
    n,
    buttonIndex,
    sbIdx,
    bbIdx,
    smallBlind,
    bigBlind,
    street: 'preflop',
    board: [],
    pot: sbAmt + bbAmt,
    toActIdx: firstPreflop,
    lastAggressorIdx: null,
    history: [],
    finished: false,
    winnerIdxs: [],
    reason: null,
  };
}

function topBet(hand) {
  return Math.max(0, ...hand.seats.map(s => s.bet));
}

function callAmount(hand, idx) {
  return Math.max(0, topBet(hand) - hand.seats[idx].bet);
}

function activeSeats(hand) {
  return hand.seats
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => !s.folded && !s.allIn);
}

function liveSeats(hand) {
  return hand.seats.map((s, i) => ({ s, i })).filter(({ s }) => !s.folded);
}

function legalActions(hand, idx) {
  if (hand.finished) return [];
  if (idx === undefined) idx = hand.toActIdx;
  const seat = hand.seats[idx];
  if (seat.folded || seat.allIn) return [];
  const owed = callAmount(hand, idx);
  const actions = [];
  if (owed === 0) actions.push({ type: 'check' });
  else actions.push({ type: 'call', amount: Math.min(owed, seat.stack) });
  if (seat.stack > 0) {
    const minRaise = Math.max(hand.bigBlind, owed);
    actions.push({ type: 'raise', min: minRaise, max: seat.stack });
  }
  if (owed > 0) actions.push({ type: 'fold' });
  return actions;
}

function applyAction(hand, action) {
  const idx = hand.toActIdx;
  const seat = hand.seats[idx];
  const owed = callAmount(hand, idx);
  seat.actedThisStreet = true;

  const evt = { idx, id: seat.id, type: action.type, street: hand.street };

  if (action.type === 'fold') {
    seat.folded = true;
    hand.history.push(evt);
    const live = liveSeats(hand);
    if (live.length === 1) {
      hand.finished = true;
      hand.winnerIdxs = [live[0].i];
      hand.reason = `${live[0].s.name} wins. Others folded.`;
      awardPot(hand);
      return hand;
    }
    return advanceTurn(hand, false);
  }
  if (action.type === 'check') {
    hand.history.push(evt);
    return advanceTurn(hand, false);
  }
  if (action.type === 'call') {
    const paid = Math.min(owed, seat.stack);
    seat.stack -= paid; seat.bet += paid; hand.pot += paid;
    if (seat.stack === 0) seat.allIn = true;
    evt.amount = paid;
    hand.history.push(evt);
    return advanceTurn(hand, false);
  }
  if (action.type === 'raise') {
    const raise = action.amount;
    const totalNeeded = owed + raise;
    const paid = Math.min(totalNeeded, seat.stack);
    seat.stack -= paid; seat.bet += paid; hand.pot += paid;
    if (seat.stack === 0) seat.allIn = true;
    evt.amount = raise;
    hand.history.push(evt);
    hand.lastAggressorIdx = idx;
    // Re-open action — everyone else must respond
    hand.seats.forEach((s, i) => { if (i !== idx && !s.folded && !s.allIn) s.actedThisStreet = false; });
    return advanceTurn(hand, true);
  }
  return hand;
}

function nextActiveIdx(hand, fromIdx) {
  let cur = fromIdx;
  for (let i = 0; i < hand.n; i++) {
    cur = (cur + 1) % hand.n;
    const s = hand.seats[cur];
    if (!s.folded && !s.allIn) return cur;
  }
  return -1;
}

function advanceTurn(hand, wasAggressive) {
  const live = liveSeats(hand);
  if (live.length === 1) {
    hand.finished = true;
    hand.winnerIdxs = [live[0].i];
    hand.reason = `${live[0].s.name} wins. Others folded.`;
    awardPot(hand);
    return hand;
  }
  const closed = isStreetClosed(hand, wasAggressive);
  if (!closed) {
    const next = nextActiveIdx(hand, hand.toActIdx);
    if (next === -1) return runOutBoard(hand);
    hand.toActIdx = next;
    return hand;
  }
  return advanceStreet(hand);
}

function isStreetClosed(hand, wasAggressive) {
  if (wasAggressive) return false;
  const live = liveSeats(hand).map(x => x.s);
  const tb = topBet(hand);
  const allMatched = live.every(s => s.allIn || s.bet === tb);
  if (!allMatched) return false;
  // Every active seat must have acted at least once on this street
  return activeSeats(hand).every(({ s }) => s.actedThisStreet);
}

function advanceStreet(hand) {
  hand.seats.forEach(s => { s.bet = 0; s.actedThisStreet = false; });
  hand.lastAggressorIdx = null;

  if (hand.street === 'preflop') {
    hand.board.push(hand.deck.pop(), hand.deck.pop(), hand.deck.pop());
    hand.street = 'flop';
  } else if (hand.street === 'flop') {
    hand.board.push(hand.deck.pop());
    hand.street = 'turn';
  } else if (hand.street === 'turn') {
    hand.board.push(hand.deck.pop());
    hand.street = 'river';
  } else {
    return resolveShowdown(hand);
  }

  // Post-flop: first to act is the first non-folded, non-all-in seat left of button
  const first = nextActiveIdx(hand, hand.buttonIndex);
  if (first === -1) return runOutBoard(hand);
  hand.toActIdx = first;
  // If only one active seat (others all-in or folded) — run it out
  if (activeSeats(hand).length <= 1) return runOutBoard(hand);
  return hand;
}

function runOutBoard(hand) {
  while (hand.board.length < 5) hand.board.push(hand.deck.pop());
  hand.street = 'showdown';
  return resolveShowdown(hand);
}

function resolveShowdown(hand) {
  hand.street = 'showdown';
  const live = liveSeats(hand);
  live.forEach(({ s }) => { s.best = bestFiveOfSeven([...s.hole, ...hand.board]); });
  live.sort((a, b) => compareScores(b.s.best.score, a.s.best.score));
  // Find all tied at the top
  const top = live[0].s.best.score;
  const winners = live.filter(x => compareScores(x.s.best.score, top) === 0).map(x => x.i);
  hand.winnerIdxs = winners;
  hand.finished = true;
  hand.reason = winners.length === 1
    ? `${hand.seats[winners[0]].name} wins with ${hand.seats[winners[0]].best.name}.`
    : `Split pot — ${winners.map(i => hand.seats[i].name).join(' / ')} (${hand.seats[winners[0]].best.name}).`;
  awardPot(hand);
  return hand;
}

function awardPot(hand) {
  // Simple split — no side pots in the prototype
  const share = Math.floor(hand.pot / hand.winnerIdxs.length);
  let remainder = hand.pot - share * hand.winnerIdxs.length;
  hand.winnerIdxs.forEach(i => {
    hand.seats[i].stack += share;
  });
  if (remainder > 0) hand.seats[hand.winnerIdxs[0]].stack += remainder;
}

// ============================================================================
// AI
// ============================================================================

function aiDecide(hand, idx) {
  const seat = hand.seats[idx];
  const profile = seat.profile || { competence: 0.5, aggression: 0.4, bluff: 0.1 };
  const owed = callAmount(hand, idx);
  // Multi-way equity: count remaining live opponents (excluding self)
  const liveOppCount = liveSeats(hand).filter(({ i }) => i !== idx).length;
  const equity = estimateEquity(seat.hole, hand.board, liveOppCount);
  const potOdds = owed / (hand.pot + owed || 1);
  const competence = profile.competence;
  const aggression = profile.aggression;
  const bluffRate  = profile.bluff;

  const noise = (1 - competence) * (Math.random() - 0.5) * 0.4;
  const perceived = Math.max(0, Math.min(1, equity + noise));

  const willBluff = Math.random() < bluffRate && seat.stack > hand.bigBlind * 4;

  if (perceived > 0.72 || (willBluff && perceived > 0.4)) {
    const sizing = Math.max(hand.bigBlind, Math.floor(hand.pot * (0.5 + aggression * 0.8)));
    const raise = Math.min(sizing, seat.stack - owed);
    if (raise <= 0) return owed > 0 ? { type: 'call', amount: owed } : { type: 'check' };
    return { type: 'raise', amount: raise };
  }
  if (perceived > potOdds + 0.05) {
    return owed > 0 ? { type: 'call', amount: owed } : { type: 'check' };
  }
  if (owed === 0) return { type: 'check' };
  return { type: 'fold' };
}

function aiTell(hand, idx) {
  const seat = hand.seats[idx];
  if (!seat.profile?.tells) return null;
  const eq = estimateEquity(seat.hole, hand.board, 60);
  const pool = eq > 0.65 ? seat.profile.tells.filter(t => t.strength === 'strong')
             : eq < 0.35 ? seat.profile.tells.filter(t => t.strength === 'weak')
             : seat.profile.tells.filter(t => t.strength === 'neutral');
  const used = pool.length ? pool : seat.profile.tells;
  if (!used || !used.length) return null;
  return { ...used[Math.floor(Math.random() * used.length)], trueEquity: eq };
}

// Exports
window.PokerEngine = {
  newDeck, shuffle, cardLabel, rankLabel, isRed,
  evaluateFive, bestFiveOfSeven, compareScores, estimateEquity,
  createHand, legalActions, applyAction, callAmount, topBet,
  liveSeats, activeSeats, aiDecide, aiTell,
  CATEGORY_NAMES,
};
