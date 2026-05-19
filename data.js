// ============================================================================
// Static game data: venues, opponents, partners, voices, phone messages, perks.
// Numbers and copy here are tuned for the Act 1 prototype loop only.
// ============================================================================

const VENUES = [
  {
    id: 'deli',
    name: "Joey's Knickerbocker Deli",
    blurb: 'Fluorescent lights humming. Smell of stale rye and pastrami.',
    gameType: 'Cash Game',
    buyIn: 50,
    blinds: { small: 1, big: 2 },
    competence: 1,                          // 1..5
    cheatingRisk: 'low',                    // low | high | extreme
    unlockRP: 0,
    unlockCash: 0,
    payoutHint: '$50 – $400 swings',
    rpHint: '+5 to +30 RP',
    partnerAvailable: true,
    coords: { x: 22, y: 70 },
    opponentId: 'deli_grinder',
    openings: ['day', 'night', 'late'],
  },
  {
    id: 'firehouse',
    name: 'The 4th Precinct Firehouse',
    blurb: 'A converted upstairs loft. Off-duty detectives and disciplined locals.',
    gameType: 'Tournament',
    buyIn: 150,
    tournamentStartingStack: 1500,
    tournamentWinPayout: 1000,
    blinds: { small: 10, big: 20 },
    competence: 4,
    cheatingRisk: 'extreme',
    unlockRP: 50,
    unlockCash: 0,
    payoutHint: '$1,000 + 80 RP top prize',
    rpHint: 'Tournament cash → +60 to +120 RP',
    partnerAvailable: false,
    partnerNote: 'Worm — Cops know him. Unavailable.',
    coords: { x: 55, y: 38 },
    opponentId: 'detective_callahan',
    openings: ['night', 'late'],
  },
  {
    id: 'elmwood',
    name: 'The Elmwood Country Club',
    blurb: 'Deep mahogany walls. The scotch is older than you.',
    gameType: 'Cash Game',
    buyIn: 1000,
    blinds: { small: 10, big: 20 },
    competence: 2,
    cheatingRisk: 'high',
    unlockRP: 250,
    unlockCash: 0,
    fullHouseShortcut: true,
    payoutHint: '$2,000 – $8,000 swings',
    rpHint: '+40 to +150 RP',
    partnerAvailable: true,
    coords: { x: 72, y: 22 },
    opponentId: 'trust_fund_kid',
    openings: ['night', 'late'],
  },
  {
    id: 'highrise',
    name: 'The 4th Street High-Rise',
    blurb: 'A penthouse cash game. No address, no last names. Rumours only.',
    gameType: 'Cash Game',
    buyIn: 2500,
    blinds: { small: 25, big: 50 },
    competence: 3,
    cheatingRisk: 'high',
    unlockRP: 9999,                          // unlock only via Royal/Straight Flush
    royalShortcut: true,
    hidden: true,
    payoutHint: '$5,000 – $20,000 swings',
    rpHint: '+80 to +300 RP',
    partnerAvailable: true,
    coords: { x: 68, y: 60 },
    opponentId: 'silk_glove',
    openings: ['late'],
  },
];

const OPPONENTS = {
  deli_grinder: {
    name: 'Joey "Pickles" Pellegrino',
    label: 'Tired truck dispatcher',
    portraitTint: '#7a4b1f',
    profile: { competence: 0.3, aggression: 0.3, bluff: 0.06 },
    tells: [
      { strength: 'strong', text: 'He stares at the board. Doesn\'t blink. Hands flat on the felt.' },
      { strength: 'strong', text: 'A small smile pulls at the corner of his mouth before he hides it.' },
      { strength: 'weak',   text: 'He swallows hard. Reaches for his coffee and forgets to drink it.' },
      { strength: 'weak',   text: 'His ankle keeps tapping the table leg. He won\'t look at the pot.' },
      { strength: 'neutral', text: 'He shrugs at the floor. Indecisive, like a man at a butcher counter.' },
    ],
  },
  detective_callahan: {
    name: 'Det. Sgt. Callahan',
    label: 'Off-duty homicide, 27 years on the job',
    portraitTint: '#3a4a3a',
    profile: { competence: 0.78, aggression: 0.55, bluff: 0.18 },
    tells: [
      { strength: 'strong', text: 'He sets his coffee mug down with a deliberate, careful click.' },
      { strength: 'strong', text: 'His eyes settle, half-lidded. The look he gives suspects in the box.' },
      { strength: 'weak',   text: 'He glances twice at his stack. He\'s measuring an exit.' },
      { strength: 'weak',   text: 'He sucks the inside of his cheek. Calculating, not enjoying.' },
      { strength: 'neutral', text: 'Stillness. A learned, professional stillness.' },
    ],
  },
  trust_fund_kid: {
    name: 'Chip Donnelly III',
    label: 'Hedge fund, two ex-wives, no fear',
    portraitTint: '#7a5a2a',
    profile: { competence: 0.45, aggression: 0.78, bluff: 0.32 },
    tells: [
      { strength: 'strong', text: 'He leans back, drapes an arm over the chair. Crocodile, sunning itself.' },
      { strength: 'strong', text: 'He pushes the chips forward gently. Like a tip he wants you to notice.' },
      { strength: 'weak',   text: 'He talks. He won\'t shut up. He\'s filling the silence with himself.' },
      { strength: 'weak',   text: 'Two fingers tap the rail. Three times. Four times. He\'s grinding his molars.' },
      { strength: 'neutral', text: 'He sips the scotch and watches you watching him.' },
    ],
  },
  silk_glove: {
    name: '"Silk Glove" Tomasz',
    label: 'Old country money. Quiet hands.',
    portraitTint: '#553a3a',
    profile: { competence: 0.82, aggression: 0.62, bluff: 0.24 },
    tells: [
      { strength: 'strong', text: 'He rolls a chip across his knuckles. Patient. The chip never falls.' },
      { strength: 'strong', text: 'A long exhale through the nose. The kind a man makes before pulling a trigger.' },
      { strength: 'weak',   text: 'He smooths his cuff. Twice. The fabric was already flat.' },
      { strength: 'weak',   text: 'His pupils widen for a half-second. A vulnerability he\'d kill to have hidden.' },
      { strength: 'neutral', text: 'He waits. He has nothing but time and patience left in him.' },
    ],
  },
};

const PARTNERS = {
  worm: {
    id: 'worm',
    name: 'Worm (Lester Murphy)',
    blurb: 'Sleight of hand expert. High risk, high reward.',
    synergy: ['Adds "The Squeeze" to your action menu', 'Cheat success +15%', 'Signals strong hole cards via UI hints'],
    risk: 'Table Suspicion starts at 20%. If caught, both of you are banned permanently.',
    cut: 0.4,
    cheatBonus: 0.15,
    suspicionFloor: 0.2,
  },
  tony: {
    id: 'tony',
    name: 'Tony B.',
    blurb: 'Card counter / distractor. Lower risk, smaller payoff.',
    synergy: ['Counts the deck — Calculator gets +10% accuracy', 'Cheat success +5%', 'Distracts opponents during your Peeks'],
    risk: 'Table Suspicion starts at 8%. If caught, you take the heat alone.',
    cut: 0.25,
    cheatBonus: 0.05,
    suspicionFloor: 0.08,
  },
};

// The four inner-monologue voices. Each voice produces a line for a given
// game state. Lines lean on the active hand context. Calculator is objective;
// Shark pushes aggression; Wire reads opponents; Cold Sweat fears ruin.

const VOICES = {
  CALCULATOR: {
    name: 'THE CALCULATOR',
    color: '#cfe88a',
    icon: '∑',
    speak({ equity, potOdds, pot, owed, stack, debt }) {
      if (owed === 0) {
        if (equity > 0.65) return `Equity ${Math.round(equity*100)}%. We're ahead. Value bet, half pot.`;
        if (equity > 0.35) return `Equity ${Math.round(equity*100)}%. Marginal. Check and play for free cards.`;
        return `Equity ${Math.round(equity*100)}%. We have nothing. Check, fold to bets.`;
      }
      const needed = (potOdds*100).toFixed(0);
      if (equity > potOdds + 0.08) return `Equity ${Math.round(equity*100)}% > ${needed}% pot odds. Mathematical call.`;
      if (equity > potOdds - 0.05) return `Roughly break-even. ${Math.round(equity*100)}% vs ${needed}% needed.`;
      return `${Math.round(equity*100)}% equity vs ${needed}% needed. The math is screaming fold.`;
    },
  },
  SHARK: {
    name: 'THE SHARK',
    color: '#f1c44a',
    icon: '♠',
    speak({ equity, owed, pot, stack }) {
      if (equity > 0.7) return 'He\'s weak. Bury him. Pile chips in. Make it hurt.';
      if (owed === 0) return 'Why are we tip-toeing? Bet. Take it down without a showdown.';
      if (stack < pot) return 'All-in. Either we double up or we go home a man.';
      return 'He\'s scared. I can smell it. Raise him again.';
    },
  },
  WIRE: {
    name: 'THE WIRE',
    color: '#9fd6a3',
    icon: '◉',
    speak({ tell }) {
      if (!tell) return 'He\'s blank. Stone. Wait for him to crack.';
      return tell.text;
    },
  },
  COLD_SWEAT: {
    name: 'THE COLD SWEAT',
    color: '#d96b5a',
    icon: '✶',
    speak({ equity, owed, stack, debt, pot }) {
      if (debt > 0 && stack - owed < debt) {
        return `If we lose this pot we can\'t pay Grama. Remember the last time. Fold.`;
      }
      if (equity < 0.3 && owed > 0) return 'We\'re behind. Don\'t throw good money after bad. Lay it down.';
      if (stack < pot * 2) return 'This is our roll. One hand. Don\'t do it.';
      return 'Tight. Patient. Live to play tomorrow.';
    },
  },
};

// Phone inbox seed messages. The state machine can push more as days advance.
const PHONE_MESSAGES = [
  {
    from: 'WORM',
    time: '2:14 AM',
    body: '"Yo Mike, found a game at the luxury high-rise on 4th. Pure silk. Trust fund kids losing daddy\'s money. Bring a grand. I\'ll meet u outside."',
    unread: true,
    tag: 'worm_highrise',
  },
  {
    from: 'GRAMA',
    time: '10:45 AM',
    body: '"McDermott. I haven\'t forgotten you. Don\'t make me come looking."',
    unread: false,
  },
  {
    from: 'PROF. PETROVSKY',
    time: 'Yesterday',
    body: '"Michael, you missed the mock trial. Your dean is asking questions. Please, focus on your future."',
    unread: false,
  },
];

const RANK_BANDS = [
  { min: 0,   label: 'Chump' },
  { min: 50,  label: 'Street Grinder' },
  { min: 150, label: 'Local Legend' },
  { min: 400, label: 'Made Man' },
  { min: 800, label: 'Card Mechanic' },
];

function rankFor(rp) {
  let band = RANK_BANDS[0];
  for (const b of RANK_BANDS) if (rp >= b.min) band = b;
  return band.label;
}

const TIME_CYCLE = ['MORNING', 'EVENING', 'LATE NIGHT'];

window.GameData = {
  VENUES, OPPONENTS, PARTNERS, VOICES, PHONE_MESSAGES,
  RANK_BANDS, TIME_CYCLE, rankFor,
};
