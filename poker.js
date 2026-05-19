// ============================================================================
// Texas Hold'em engine — heads-up (player vs single NPC) for the prototype.
// Hand evaluation works on 7 cards (2 hole + 5 board) and returns a comparable
// score array so we can compare hands without branching.
// ============================================================================

const SUITS = ['♠', '♥', '♦', '♣'];
const RANK_NAMES = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };

function rankLabel(r) { return RANK_NAMES[r] || String(r); }
function cardLabel(c) { return rankLabel(c.rank) + c.suit; }
function isRed(card) { return card.suit === '♥' || card.suit === '♦'; }

function newDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (let rank = 2; rank <= 14; rank++) {
      deck.push({ rank, suit });
    }
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
// Returns { category, name, score } where score is an array suitable for
// lexicographic comparison. Higher is always better.

const CATEGORY_NAMES = [
  'High Card', 'Pair', 'Two Pair', 'Three of a Kind', 'Straight',
  'Flush', 'Full House', 'Four of a Kind', 'Straight Flush', 'Royal Flush'
];

function bestFiveOfSeven(cards) {
  // 7 choose 5 = 21 combinations. Cheap to brute force.
  const idxs = [0, 1, 2, 3, 4, 5, 6];
  let best = null;
  for (let a = 0; a < 7; a++)
    for (let b = a + 1; b < 7; b++) {
      const five = idxs.filter(i => i !== a && i !== b).map(i => cards[i]);
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

  // Sort by count desc, then by rank desc
  const grouped = Object.entries(counts)
    .map(([r, c]) => ({ rank: +r, count: c }))
    .sort((a, b) => b.count - a.count || b.rank - a.rank);

  const isFlush = suits.every(s => s === suits[0]);

  // Straight detection (handle wheel A-2-3-4-5)
  const uniqueRanks = [...new Set(ranks)].sort((a, b) => b - a);
  let straightHigh = null;
  if (uniqueRanks.length === 5) {
    if (uniqueRanks[0] - uniqueRanks[4] === 4) straightHigh = uniqueRanks[0];
    else if (uniqueRanks.join(',') === '14,5,4,3,2') straightHigh = 5;
  }

  if (isFlush && straightHigh === 14) {
    return { category: 9, name: 'Royal Flush', score: [9] };
  }
  if (isFlush && straightHigh) {
    return { category: 8, name: 'Straight Flush', score: [8, straightHigh] };
  }
  if (grouped[0].count === 4) {
    return { category: 7, name: 'Four of a Kind', score: [7, grouped[0].rank, grouped[1].rank] };
  }
  if (grouped[0].count === 3 && grouped[1].count === 2) {
    return { category: 6, name: 'Full House', score: [6, grouped[0].rank, grouped[1].rank] };
  }
  if (isFlush) {
    return { category: 5, name: 'Flush', score: [5, ...ranks] };
  }
  if (straightHigh) {
    return { category: 4, name: 'Straight', score: [4, straightHigh] };
  }
  if (grouped[0].count === 3) {
    const kickers = grouped.slice(1).map(g => g.rank);
    return { category: 3, name: 'Three of a Kind', score: [3, grouped[0].rank, ...kickers] };
  }
  if (grouped[0].count === 2 && grouped[1].count === 2) {
    const pairHigh = Math.max(grouped[0].rank, grouped[1].rank);
    const pairLow = Math.min(grouped[0].rank, grouped[1].rank);
    return { category: 2, name: 'Two Pair', score: [2, pairHigh, pairLow, grouped[2].rank] };
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

// ----- Monte Carlo win probability ------------------------------------------
// Used by The Calculator voice and by AI to evaluate situations.

function estimateEquity(hole, board, samples = 250) {
  const known = [...hole, ...board];
  let wins = 0, ties = 0;
  for (let s = 0; s < samples; s++) {
    const deck = newDeck().filter(c =>
      !known.some(k => k.rank === c.rank && k.suit === c.suit)
    );
    shuffle(deck);
    const villainHole = [deck.pop(), deck.pop()];
    const remaining = [...board];
    while (remaining.length < 5) remaining.push(deck.pop());
    const heroBest = bestFiveOfSeven([...hole, ...remaining]);
    const villainBest = bestFiveOfSeven([...villainHole, ...remaining]);
    const cmp = compareScores(heroBest.score, villainBest.score);
    if (cmp > 0) wins++;
    else if (cmp === 0) ties++;
  }
  return (wins + ties / 2) / samples;
}

// ----- Heads-up hand state machine ------------------------------------------
// Simplified no-limit cash game. SB = small blind, BB = big blind. Player is
// alternately on the button each hand. Action menu: check, call, bet/raise,
// fold, plus special abilities handled at the UI layer.

function createHand({ playerStack, oppStack, smallBlind, bigBlind, playerOnButton, sleeveCard }) {
  const deck = shuffle(newDeck());

  // If a card is in the sleeve, swap it into hero's hand by removing one and
  // pushing the sleeve card in instead.
  let heroHole;
  let oppHole = [deck.pop(), deck.pop()];
  if (sleeveCard) {
    // Remove the sleeve card from the live deck if it's still there.
    const idx = deck.findIndex(c => c.rank === sleeveCard.rank && c.suit === sleeveCard.suit);
    if (idx >= 0) deck.splice(idx, 1);
    heroHole = [sleeveCard, deck.pop()];
  } else {
    heroHole = [deck.pop(), deck.pop()];
  }

  // In heads-up: button (SB) acts first pre-flop, BB acts first post-flop.
  const hand = {
    deck,
    heroHole,
    oppHole,
    board: [],
    pot: 0,
    playerStack,
    oppStack,
    smallBlind,
    bigBlind,
    playerOnButton,
    playerBet: 0,
    oppBet: 0,
    street: 'preflop', // preflop | flop | turn | river | showdown
    toAct: null,
    lastAggressor: null,
    history: [],
    finished: false,
    winner: null,
    reason: null,
  };

  // Post blinds (these accumulate into hand.pot, not overwrite)
  const sbAmt = Math.min(smallBlind, playerOnButton ? hand.playerStack : hand.oppStack);
  const bbAmt = Math.min(bigBlind, playerOnButton ? hand.oppStack : hand.playerStack);
  if (playerOnButton) {
    hand.playerStack -= sbAmt; hand.playerBet = sbAmt;
    hand.oppStack -= bbAmt; hand.oppBet = bbAmt;
    hand.toAct = 'player'; // SB acts first pre-flop
  } else {
    hand.oppStack -= sbAmt; hand.oppBet = sbAmt;
    hand.playerStack -= bbAmt; hand.playerBet = bbAmt;
    hand.toAct = 'opp';
  }
  hand.pot = sbAmt + bbAmt;
  hand.lastAggressor = 'bb_post'; // pseudo-aggressor so BB can option-raise
  hand.actionsThisStreet = 0;
  return hand;
}

function callAmount(hand, who) {
  if (who === 'player') return Math.max(0, hand.oppBet - hand.playerBet);
  return Math.max(0, hand.playerBet - hand.oppBet);
}

function legalActions(hand) {
  const who = hand.toAct;
  if (hand.finished) return [];
  const owed = callAmount(hand, who);
  const actions = [];
  if (owed === 0) {
    actions.push({ type: 'check' });
  } else {
    actions.push({ type: 'call', amount: owed });
  }
  const stack = who === 'player' ? hand.playerStack : hand.oppStack;
  if (stack > 0) {
    const minRaise = Math.max(hand.bigBlind, owed);
    actions.push({ type: 'raise', min: minRaise, max: stack });
  }
  if (owed > 0) actions.push({ type: 'fold' });
  return actions;
}

function applyAction(hand, action) {
  const who = hand.toAct;
  const opp = who === 'player' ? 'opp' : 'player';
  const owed = callAmount(hand, who);

  hand.actionsThisStreet = (hand.actionsThisStreet || 0) + 1;

  if (action.type === 'fold') {
    hand.finished = true;
    hand.winner = opp;
    hand.reason = `${who === 'player' ? 'Mike' : 'Opponent'} folds.`;
    hand.history.push({ who, type: 'fold', street: hand.street });
    awardPot(hand);
    return hand;
  }

  if (action.type === 'check') {
    hand.history.push({ who, type: 'check', street: hand.street });
    return advanceAfterAction(hand, false);
  }

  if (action.type === 'call') {
    payInto(hand, who, owed);
    hand.history.push({ who, type: 'call', amount: owed, street: hand.street });
    return advanceAfterAction(hand, false);
  }

  if (action.type === 'raise') {
    const raise = action.amount;
    const totalNeeded = owed + raise;
    payInto(hand, who, totalNeeded);
    hand.history.push({ who, type: 'raise', amount: raise, street: hand.street });
    hand.lastAggressor = who;
    return advanceAfterAction(hand, true);
  }
  return hand;
}

function payInto(hand, who, amount) {
  if (who === 'player') {
    const paid = Math.min(amount, hand.playerStack);
    hand.playerStack -= paid;
    hand.playerBet += paid;
    hand.pot += paid;
  } else {
    const paid = Math.min(amount, hand.oppStack);
    hand.oppStack -= paid;
    hand.oppBet += paid;
    hand.pot += paid;
  }
}

function advanceAfterAction(hand, wasAggressive) {
  // Pass action to opponent unless the street is closed.
  const closed = isStreetClosed(hand, wasAggressive);
  if (!closed) {
    hand.toAct = hand.toAct === 'player' ? 'opp' : 'player';
    return hand;
  }
  // Move chips into pot for tracking, reset bets, deal next street.
  hand.playerBet = 0; hand.oppBet = 0;
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
    hand.street = 'showdown';
    return resolveShowdown(hand);
  }
  // First to act post-flop is whoever is NOT on the button.
  hand.toAct = hand.playerOnButton ? 'opp' : 'player';
  hand.lastAggressor = null;
  hand.actionsThisStreet = 0;
  // If someone is all-in, run out remaining streets automatically.
  if (hand.playerStack === 0 || hand.oppStack === 0) {
    return runOutBoard(hand);
  }
  return hand;
}

function isStreetClosed(hand, wasAggressive) {
  if (wasAggressive) return false;            // raise always reopens action
  if (hand.playerBet !== hand.oppBet) return false;
  // Both must have acted at least once on this street.
  return (hand.actionsThisStreet || 0) >= 2;
}

function runOutBoard(hand) {
  while (hand.board.length < 5) {
    hand.board.push(hand.deck.pop());
  }
  hand.street = 'showdown';
  return resolveShowdown(hand);
}

function resolveShowdown(hand) {
  const heroBest = bestFiveOfSeven([...hand.heroHole, ...hand.board]);
  const villBest = bestFiveOfSeven([...hand.oppHole, ...hand.board]);
  const cmp = compareScores(heroBest.score, villBest.score);
  hand.heroBest = heroBest;
  hand.villBest = villBest;
  if (cmp > 0) hand.winner = 'player';
  else if (cmp < 0) hand.winner = 'opp';
  else hand.winner = 'tie';
  hand.finished = true;
  hand.reason = cmp === 0
    ? `Split pot — both hold ${heroBest.name}.`
    : `${hand.winner === 'player' ? 'Mike wins' : 'Opponent wins'} with ${(hand.winner === 'player' ? heroBest : villBest).name}.`;
  awardPot(hand);
  return hand;
}

function awardPot(hand) {
  if (hand.winner === 'player') {
    hand.playerStack += hand.pot;
  } else if (hand.winner === 'opp') {
    hand.oppStack += hand.pot;
  } else {
    hand.playerStack += Math.floor(hand.pot / 2);
    hand.oppStack += hand.pot - Math.floor(hand.pot / 2);
  }
}

// ----- AI -------------------------------------------------------------------
// Competence scales how often the AI plays correctly vs. randomly.
// Aggression scales bet sizes when betting.
// Tells: aiTell describes what the player would see if they read intent.

function aiDecide(hand, profile) {
  const owed = callAmount(hand, 'opp');
  const equity = estimateEquity(hand.oppHole, hand.board, 120);
  const potOdds = owed / (hand.pot + owed || 1);
  const competence = profile.competence || 0.5;
  const aggression = profile.aggression || 0.4;
  const bluffRate = profile.bluff || 0.1;

  // Add noise inversely proportional to competence: low-skill players think
  // they have better hands than they do, or fold winners.
  const noise = (1 - competence) * (Math.random() - 0.5) * 0.4;
  const perceivedEquity = Math.max(0, Math.min(1, equity + noise));

  const willBluff = Math.random() < bluffRate && hand.oppStack > hand.bigBlind * 4;

  if (perceivedEquity > 0.75 || (willBluff && perceivedEquity > 0.4)) {
    // Raise
    const sizing = Math.max(hand.bigBlind, Math.floor(hand.pot * (0.5 + aggression * 0.8)));
    const raise = Math.min(sizing, hand.oppStack - owed);
    if (raise <= 0) {
      return owed > 0 ? { type: 'call', amount: owed } : { type: 'check' };
    }
    return { type: 'raise', amount: raise };
  }
  if (perceivedEquity > potOdds + 0.05) {
    return owed > 0 ? { type: 'call', amount: owed } : { type: 'check' };
  }
  if (owed === 0) return { type: 'check' };
  return { type: 'fold' };
}

// Tell text varies based on whether the AI is strong or weak. The Wire voice
// uses this to give the player a probabilistic read.
function aiTell(hand, profile) {
  const equity = estimateEquity(hand.oppHole, hand.board, 80);
  const tells = profile.tells || [];
  // Pick a behavior — strong vs weak skew.
  let pool;
  if (equity > 0.65) pool = tells.filter(t => t.strength === 'strong');
  else if (equity < 0.35) pool = tells.filter(t => t.strength === 'weak');
  else pool = tells.filter(t => t.strength === 'neutral');
  if (!pool || pool.length === 0) pool = tells;
  if (!pool || pool.length === 0) return null;
  return { ...pool[Math.floor(Math.random() * pool.length)], trueEquity: equity };
}

// Exports
window.PokerEngine = {
  newDeck, shuffle, cardLabel, rankLabel, isRed,
  evaluateFive, bestFiveOfSeven, compareScores, estimateEquity,
  createHand, legalActions, applyAction, callAmount,
  aiDecide, aiTell, CATEGORY_NAMES,
};
