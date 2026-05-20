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
    coords: { x: 56, y: 78 },
    opponentId: 'deli_grinder',
    opponents: ['deli_grinder', 'pizza_tony', 'cab_driver_pete'],
    openings: ['day', 'night', 'late'],
    interiorImage: 'joey-deli.jpg',
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
    coords: { x: 42, y: 67 },
    opponentId: 'detective_callahan',
    opponents: ['detective_callahan', 'detective_torres', 'patrol_donovan', 'captain_ortiz', 'judge_levine'],
    openings: ['night', 'late'],
    interiorImage: 'firehouse.jpg',
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
    coords: { x: 58, y: 22 },
    opponentId: 'trust_fund_kid',
    opponents: ['trust_fund_kid', 'broker_kessler', 'heir_ashford'],
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
    coords: { x: 30, y: 12 },
    opponentId: 'silk_glove',
    opponents: ['silk_glove', 'broker_kessler', 'trust_fund_kid'],
    openings: ['late'],
  },
];

const OPPONENTS = {
  deli_grinder: {
    name: 'Joey "Pickles" Pellegrino',
    label: 'Tired truck dispatcher',
    portraitTint: '#7a4b1f',
    portraitDir: 'joey/',
    portraitMoods: ['neutral','confident','uncertain','suspicious','resigned','thinking','anxious','observing','angry','defeated'],
    profile: { competence: 0.3, aggression: 0.3, bluff: 0.06 },
    dialog: {
      hand_start: ['So we play again, McDermott.', 'New deal. New problems.', 'Long shift tonight.'],
      strong:    ['Sleep on it, kid. There\'s the door.', 'You\'re catching me on a good one.'],
      weak:      ['Maybe I shoulda stayed at the deli.', 'These cards don\'t love me.'],
      neutral:   ['You been at this long, McDermott?', 'My back is killing me.'],
      raised:    ['Try me.', 'I\'ll bump it.'],
      called:    ['Sure, sure. I\'ll see it.'],
      folded:    ['I got a wife and three kids. Take it.', 'Not this one.'],
      won:       ['Sometimes the cards just love an old man.', 'I needed that.'],
      lost:      ['Ay. You got me good.', 'Eh. Tomorrow\'s another night.'],
    },
    tells: [
      { strength: 'strong', text: 'He stares at the board. Doesn\'t blink. Hands flat on the felt.' },
      { strength: 'strong', text: 'A small smile pulls at the corner of his mouth before he hides it.' },
      { strength: 'weak',   text: 'He swallows hard. Reaches for his coffee and forgets to drink it.' },
      { strength: 'weak',   text: 'His ankle keeps tapping the table leg. He won\'t look at the pot.' },
      { strength: 'neutral', text: 'He shrugs at the floor. Indecisive, like a man at a butcher counter.' },
    ],
  },
  pizza_tony: {
    name: 'Pizza Tony',
    label: 'Delivery guy on a break. Smells of garlic.',
    portraitTint: '#6a3a1a',
    profile: { competence: 0.28, aggression: 0.4, bluff: 0.15 },
    dialog: {
      hand_start: ['Three hours of deliveries. Now this.', 'I\'m on my dinner break.'],
      strong:    ['You wanna bet against the pie?', 'I got the goods, McDermott.'],
      weak:      ['I\'m losin\' it.', 'My boss is gonna kill me.'],
      raised:    ['Bumping it up.', 'I\'ll raise.'],
      called:    ['I\'m in.', 'Sure, sure.'],
      folded:    ['Forget about it.', 'I\'m done.'],
      won:       ['That pays for the gas, eh?', 'Boom.'],
      lost:      ['Ah, geez.', 'Tough break.'],
    },
    tells: [
      { strength: 'strong', text: 'Tony cracks his knuckles slowly. He thinks he\'s running the room.' },
      { strength: 'weak',   text: 'Tony stares at the ceiling, mumbling about pepperoni.' },
      { strength: 'neutral', text: 'Tony wipes his hands on his apron and shrugs.' },
    ],
  },
  cab_driver_pete: {
    name: 'Pete the Cabbie',
    label: 'Yellow cab. Two ex-wives.',
    portraitTint: '#5a4520',
    profile: { competence: 0.4, aggression: 0.32, bluff: 0.12 },
    dialog: {
      hand_start: ['I got a fare in twenty.', 'Just one more hand.'],
      strong:    ['You wanna get out of my way, McDermott?', 'I got this one, kid.'],
      weak:      ['Eh, the wife will kill me.', 'I shouldn\'t be here.'],
      raised:    ['Bump it.', 'Up we go.'],
      called:    ['Call.', 'Fine.'],
      folded:    ['I\'m out.', 'Out, out, out.'],
      won:       ['That pays for the brake job.', 'Easy money.'],
      lost:      ['Damn brakes.', 'Aw, hell.'],
    },
    tells: [
      { strength: 'strong', text: 'Pete jokes about his shift. Relaxed. Means he likes his cards.' },
      { strength: 'weak',   text: 'Pete drums on his coffee cup. He\'s working out an exit.' },
      { strength: 'neutral', text: 'Pete looks at his watch like it owes him money.' },
    ],
  },
  detective_callahan: {
    name: 'Det. Sgt. Callahan',
    label: 'Off-duty homicide, 27 years on the job',
    portraitTint: '#3a4a3a',
    profile: { competence: 0.78, aggression: 0.55, bluff: 0.18 },
    dialog: {
      hand_start: ['Let\'s see what you got tonight, son.', 'Fresh deck. Same liars.'],
      strong:    ['I\'ve put away tougher liars than you, son.', 'Don\'t do anything stupid.'],
      weak:      ['Hmph. Get on with it.', 'Move it along.'],
      raised:    ['Let\'s see how brave you really are.', 'I\'ll raise.'],
      called:    ['I\'ll see.', 'Call.'],
      folded:    ['Not tonight.', 'Nope.'],
      won:       ['Like taking it from a perp\'s pocket.', 'Tough night for you, kid.'],
      lost:      ['Hmph. Well played, son.', 'You earned that one.'],
    },
    tells: [
      { strength: 'strong', text: 'He sets his coffee mug down with a deliberate, careful click.' },
      { strength: 'strong', text: 'His eyes settle, half-lidded. The look he gives suspects in the box.' },
      { strength: 'weak',   text: 'He glances twice at his stack. He\'s measuring an exit.' },
      { strength: 'weak',   text: 'He sucks the inside of his cheek. Calculating, not enjoying.' },
      { strength: 'neutral', text: 'Stillness. A learned, professional stillness.' },
    ],
  },
  detective_torres: {
    name: 'Det. Torres',
    label: 'Narcotics. Hates losing.',
    portraitTint: '#4a3a2a',
    profile: { competence: 0.6, aggression: 0.78, bluff: 0.3 },
    dialog: {
      hand_start: ['C\'mon, hurry up.', 'New hand. Let\'s go.'],
      strong:    ['Wanna run a tab on this one too?', 'You\'re cooked.'],
      weak:      ['Quit stalling. We ain\'t got all night.', 'Make the call, kid.'],
      raised:    ['Push some chips, McDermott. Show me.', 'Raise.'],
      called:    ['Yeah, I\'m in.'],
      folded:    ['Whatever. Next.', 'Pass.'],
      won:       ['That\'s how we do it on the street.', 'You owe me, kid.'],
      lost:      ['You got lucky.', 'Damn.'],
    },
    tells: [
      { strength: 'strong', text: 'Torres goes quiet. The man can\'t shut up when he\'s got air.' },
      { strength: 'weak',   text: 'A flurry of jokes. He\'s building cover.' },
    ],
  },
  patrol_donovan: {
    name: 'Off. Donovan',
    label: 'Rookie. Plays scared.',
    portraitTint: '#2a3a4a',
    profile: { competence: 0.35, aggression: 0.22, bluff: 0.04 },
    dialog: {
      hand_start: ['Uh — okay, ready.', 'Deal me in.'],
      strong:    ['Uh, I think... yeah, yeah I\'ll bet.', 'I... I got something.'],
      weak:      ['Maybe... maybe I should...', 'I dunno.'],
      raised:    ['Sorry, was that too much?', 'Raise. I think.'],
      called:    ['Call.', 'O-okay.'],
      folded:    ['I... I\'m out.', 'No thanks.'],
      won:       ['I won? Really?', 'Holy — sorry, holy moly.'],
      lost:      ['Oh.', 'Th-that was a lot.'],
    },
    tells: [
      { strength: 'strong', text: 'Donovan finally relaxes his shoulders. He\'s got something.' },
      { strength: 'weak',   text: 'He folds his arms tight. He\'s already folding the cards in his head.' },
    ],
  },
  captain_ortiz: {
    name: 'Capt. Ortiz',
    label: 'Tournament regular. Senior brass.',
    portraitTint: '#3a3a3a',
    profile: { competence: 0.82, aggression: 0.5, bluff: 0.16 },
    dialog: {
      hand_start: ['Deal.', 'Let\'s see it.'],
      strong:    ['Carefully now, McDermott.', 'Mind the pot.'],
      weak:      ['Hmm.', 'Patience.'],
      raised:    ['Pressure check, gentlemen.', 'Raise.'],
      called:    ['I\'ll see.'],
      folded:    ['Out.', 'No.'],
      won:       ['Discipline pays.', 'Good hand.'],
      lost:      ['Well played.', 'Hmph.'],
    },
    tells: [
      { strength: 'strong', text: 'Ortiz takes his time with the chip stack. Stacking is meditation.' },
      { strength: 'weak',   text: 'A subtle exhale. The captain doesn\'t like being on the back foot.' },
    ],
  },
  judge_levine: {
    name: 'Judge Levine',
    label: 'Civil bench. Cold operator.',
    portraitTint: '#3a2a3a',
    profile: { competence: 0.88, aggression: 0.42, bluff: 0.1 },
    dialog: {
      hand_start: ['Proceed.', 'Order. Let us begin.'],
      strong:    ['I\'ll see your tell, son.', 'The verdict is in.'],
      weak:      ['I have all night.', 'Continue.'],
      raised:    ['The court raises.', 'Raise.'],
      called:    ['Sustained.'],
      folded:    ['Dismissed.', 'I withdraw.'],
      won:       ['Adjourned.', 'Case closed.'],
      lost:      ['Curious.', 'Noted.'],
    },
    tells: [
      { strength: 'strong', text: 'The judge tents his fingers. The verdict is in his hand.' },
      { strength: 'weak',   text: 'He removes his glasses. Wipes them. Buys himself time.' },
    ],
  },
  trust_fund_kid: {
    name: 'Chip Donnelly III',
    label: 'Hedge fund, two ex-wives, no fear',
    portraitTint: '#7a5a2a',
    profile: { competence: 0.45, aggression: 0.78, bluff: 0.32 },
    dialog: {
      hand_start: ['Let\'s gamble, gentlemen.', 'I\'ve got a flight at six.'],
      strong:    ['Daddy taught me well.', 'You really wanna find out?'],
      weak:      ['Don\'t even bother, McDermott.', 'I\'m practically asleep.'],
      raised:    ['Pocket change.', 'Make it interesting.'],
      called:    ['Sure, why not.'],
      folded:    ['Boring.', 'Pass.'],
      won:       ['Easy money.', 'Cheers.'],
      lost:      ['Whatever. It\'s petty cash.', 'Lucky river.'],
    },
    tells: [
      { strength: 'strong', text: 'He leans back, drapes an arm over the chair. Crocodile, sunning itself.' },
      { strength: 'strong', text: 'He pushes the chips forward gently. Like a tip he wants you to notice.' },
      { strength: 'weak',   text: 'He talks. He won\'t shut up. He\'s filling the silence with himself.' },
      { strength: 'weak',   text: 'Two fingers tap the rail. Three times. Four times. He\'s grinding his molars.' },
      { strength: 'neutral', text: 'He sips the scotch and watches you watching him.' },
    ],
  },
  broker_kessler: {
    name: 'M. Kessler',
    label: 'Broker. Reads the room. Slow.',
    portraitTint: '#5a4a2a',
    profile: { competence: 0.7, aggression: 0.5, bluff: 0.2 },
    dialog: {
      hand_start: ['Markets are open.', 'Let\'s see the spread.'],
      strong:    ['I like the position.', 'Long this one.'],
      weak:      ['Hedge accordingly.', 'I\'m underwater.'],
      raised:    ['I\'ll size up.', 'Increase exposure.'],
      called:    ['I\'ll see it through.'],
      folded:    ['Take the loss. Move on.', 'Out.'],
      won:       ['Returns secured.', 'A good quarter.'],
      lost:      ['Bad timing.', 'Acceptable loss.'],
    },
    tells: [
      { strength: 'strong', text: 'Kessler checks his watch. Twice.' },
      { strength: 'weak',   text: 'He pulls at his collar like the AC just died.' },
    ],
  },
  heir_ashford: {
    name: 'Bunny Ashford',
    label: 'Heir, day-drinks, splashes the pot',
    portraitTint: '#7a4a4a',
    profile: { competence: 0.28, aggression: 0.82, bluff: 0.4 },
    dialog: {
      hand_start: ['Bartender! ... oh, deal me in.', 'Hello, fellows.'],
      strong:    ['I rather like these.', 'Cheers to me.'],
      weak:      ['Are these even my cards?', 'Hmm.'],
      raised:    ['Make it spicy!', 'Up we go.'],
      called:    ['Why not, eh?'],
      folded:    ['Bored.', 'I\'m out, lads.'],
      won:       ['Splendid! Another scotch!', 'Mummy will be pleased.'],
      lost:      ['Oh, blast.', 'Whatever, it\'s nothing.'],
    },
    tells: [
      { strength: 'strong', text: 'Bunny laughs at his own joke. He never laughs for free.' },
      { strength: 'weak',   text: 'He frowns at the cards. Slightly cross-eyed. Probably won\'t remember calling.' },
    ],
  },
  silk_glove: {
    name: '"Silk Glove" Tomasz',
    label: 'Old country money. Quiet hands.',
    portraitTint: '#553a3a',
    profile: { competence: 0.82, aggression: 0.62, bluff: 0.24 },
    dialog: {
      hand_start: ['Welcome, McDermott.', 'Slowly now.'],
      strong:    ['Care to dance?', 'You came to the wrong house.'],
      weak:      ['Patience is a virtue, no?', 'Hmph.'],
      raised:    ['I will raise.', 'A gentle push.'],
      called:    ['I see.', 'Yes.'],
      folded:    ['Some other night.', 'I yield.'],
      won:       ['You play well. Almost.', 'Cards, you know, do not lie.'],
      lost:      ['Bravo.', 'A worthy hand.'],
    },
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
    shortName: 'Worm',
    blurb: 'Sleight of hand expert. Sits at the table with you. High risk, high reward.',
    synergy: ['Sits at the table as a third player', 'Signals his hand strength to you', 'Cheat success +15%', 'Can call your peek/muck attempts off the radar'],
    risk: 'Table Suspicion starts at 20%. Each of his signals raises it more. If you\'re caught, both of you are banned permanently.',
    cut: 0.4,
    cheatBonus: 0.15,
    suspicionFloor: 0.2,
    suspicionPerSignal: 0.06,
    profile: { competence: 0.55, aggression: 0.7, bluff: 0.28 },
    portraitDir: 'worm/',
    portraitTint: '#3a3a52',
    portraitMoods: ['resigned','signaling','thinking','confident','anxious','shocked','happy','neutral','focused','suspicious','waiting'],
    label: 'Your partner — sleight-of-hand specialist',
    dialog: {
      hand_start: ['Eyes up, Mikey.', 'Watch the signals.', 'Let\'s eat tonight.'],
      strong:    ['I got the hammer, partner.', 'They\'re cooked.'],
      weak:      ['Nothin\' here.', 'I\'m dust.'],
      raised:    ['Boom. Bumping it.', 'Squeeze play, Mikey.', 'I\'m raising.'],
      called:    ['I\'ll see it.', 'In.'],
      folded:    ['Letting this one go.', 'Pass.', 'Not my hand.'],
      won:       ['That\'s mine, Mikey.', 'Easy money, partner.', 'Boom — split it after.'],
      lost:      ['Ah, hell.', 'Damn, they had it.'],
    },
  },
  tony: {
    id: 'tony',
    name: 'Tony B.',
    shortName: 'Tony',
    blurb: 'Card counter / distractor. Stays off the table. Lower risk, smaller payoff.',
    synergy: ['Counts the deck — Calculator gets +10% accuracy', 'Cheat success +5%', 'Distracts opponents during your Peeks'],
    risk: 'Table Suspicion starts at 8%. If caught, you take the heat alone.',
    cut: 0.25,
    cheatBonus: 0.05,
    suspicionFloor: 0.08,
    suspicionPerSignal: 0,
    sitsAtTable: false,
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
  DISCIPLE: {
    name: 'THE DISCIPLE',
    color: '#c4a8d6',
    icon: '❦',
    speak(ctx) {
      return discipleLine(ctx) || 'Brunson. Chan. Moss. Ungar. The old gods. They all played this same game.';
    },
  },
};

// ----- The Disciple's library --------------------------------------------------
// Mike's encyclopedic knowledge of poker history. Triggered by the current
// hole cards or the made hand on the river.

function rankChar(r) { return ({14:'A',13:'K',12:'Q',11:'J',10:'T'})[r] || String(r); }

function handSignature(hole) {
  if (!hole || hole.length !== 2) return null;
  const [a, b] = hole;
  const hi = Math.max(a.rank, b.rank);
  const lo = Math.min(a.rank, b.rank);
  if (hi === lo) return rankChar(hi) + rankChar(lo);                     // "AA"
  return rankChar(hi) + rankChar(lo) + (a.suit === b.suit ? 's' : 'o'); // "AKs" / "AKo"
}

const HAND_TRIVIA = {
  // ---------- Pocket pairs ----------
  AA: [
    'Pocket Rockets. American Airlines. Bullets. The best hand in poker, and the most cursed if you slow-play them.',
    'Stu Ungar said it best: "Aces always win — until they don\'t."',
    'Pre-flop you\'re an 85% favourite against any random hand. Build the pot.',
  ],
  KK: [
    'Cowboys. King Kong. Every player has a Kings story that ends with someone catching their Ace.',
    'Daniel Negreanu loses sleep over Kings. Wait for the Ace on the flop. Fold them if it comes.',
    'Phil Hellmuth: "I can dodge bullets, baby!" — that was the night he ran into pocket Kings.',
  ],
  QQ: [
    'The Hilton Sisters. Ladies. The third-best starting hand — hates a King or Ace on the flop.',
    'Doyle Brunson called Queens the second-hardest hand to play. The first was Ace-King.',
  ],
  JJ: [
    'Fishhooks. Every pro will tell you the same thing — with Jacks, a Queen, King, or Ace is always coming on the flop.',
    'Brothers. They look beautiful pre-flop. They get cracked more than any other pair.',
  ],
  TT: [
    'Dimes. Bo Derek — a perfect pair of tens.',
    'Mike Caro wrote that pocket tens is the hand where new players first learn what variance really means.',
  ],
  99: [
    'Wayne Gretzky. Number 99. Easy to over-play, easy to lay down.',
    'Nines. Set-mine in position, fold them out of position. Boring works.',
  ],
  88: [
    'Snowmen. Set or get out — that\'s the entire strategy with eights.',
  ],
  77: [
    'Hockey sticks. Walking sticks. The Sunset Strip.',
    'Sevens. The middle-pair purgatory.',
  ],
  66: [
    'Route 66. The speed limit. The most under-rated set-miner in hold\'em.',
  ],
  55: [
    'Speed limit. Nickels. Snakes.',
  ],
  44: [
    'Sailboats. Magnum P.I.\'s pistol.',
  ],
  33: [
    'Crabs. Treys. They scuttle sideways and bite you on the river.',
  ],
  22: [
    'Ducks. The smallest pair. Implied odds, or fold.',
    'Deuces. Worth playing only when you can win a big pot or lose a small one.',
  ],
  // ---------- Broadway combos ----------
  AKs: [
    'Big Slick — suited. T.J. Cloutier said he\'d rather have AKs than aces. He\'s mostly wrong, but he\'s mostly Cloutier.',
    'Slick suited. Coin-flip against any pair under tens.',
  ],
  AKo: [
    'Anna Kournikova. Looks great. Never wins. That\'s what they say.',
    'Big Slick offsuit. The hand Phil Hellmuth still complains about on Twitter.',
  ],
  AQs: [
    'Antony and Cleopatra. Big Chick suited. Dominates AJ, dies to AK.',
  ],
  AQo: [
    'Big Chick. Mrs. Slick. Plays well against limpers — dies in a raised pot against AK.',
  ],
  AJs: [
    'Ajax — the cleaner. Suited paint, plays straights and flushes well.',
  ],
  AJo: [
    'Ajax. Looks like the world. Gets dominated by every higher Ace.',
  ],
  ATo: [
    'Johnny Moss\'s hand. The Grand Old Man loved Ace-Ten — said it caught more rivers than any combo he played.',
  ],
  KQs: [
    'Marriage — suited. Royalty. The hand for straights and royal-flush dreams.',
  ],
  KQo: [
    'Royal Marriage. Calling stations love this hand. It loves them back.',
  ],
  KJo: [
    'Kojak. "Who loves ya, baby?" Telly Savalas\'s favourite.',
  ],
  QJs: [
    'Maverick. The 1994 Mel Gibson movie ended on Queen-Jack.',
  ],
  JTs: [
    'T.J. Cloutier swore by Jack-Ten suited. Said it was the best hand in hold\'em for straights and flushes both.',
  ],
  // ---------- Mythical hands ----------
  T2s: [
    'The Doyle Brunson. Doyle won the WSOP Main Event in 1976 AND 1977 holding this exact hand. Twice in a row.',
    'Ten-Deuce. Doyle never lived it down. He hates that the whole world knows now.',
  ],
  T2o: [
    'The Doyle Brunson. Two World Series of Poker championships, back-to-back, with Ten-Deuce. 1976 and \'77.',
  ],
  '72o': [
    'The Hammer. The worst starting hand in hold\'em. Win with it and never let the table forget.',
    'Beer Hand. Local rule: win with 7-2 offsuit and the table buys you a round.',
  ],
  '72s': [
    'Suited Hammer. Still trash. Looks slightly less like trash.',
  ],
  '54s': [
    'The Moneymaker. Chris Moneymaker bluffed Sammy Farha off the better hand at the 2003 final table with 5-4 suited.',
  ],
  '73o': [
    'Joe Hachem held 7-3 in his pocket when he won the 2005 WSOP Main Event\'s last hand. Australia\'s first world champion.',
  ],
  '23o': [
    'Michael Jordan. Number 23. The G.O.A.T. hand for fans of failure.',
  ],
  // ---------- Suited connectors ----------
  '89s': ['Suited connectors. The kind of hand Stu Ungar made monsters with.'],
  '78s': ['The Hammer of Thor — 7-8 suited. Doyle Brunson loved this one in late position.'],
  '67s': ['Suited connector. Disguised straights, big implied odds when you flop the world.'],
  '56s': ['Five-six suited. The kind of hand that wins a tournament if you let it.'],
  '45s': ['Suited gappers. Implied odds or fold.'],
};

// Reverence for made hands on the river.
const MADE_HAND_LORE = {
  9: [ // Straight flush
    'Straight flush. Stu Ungar made one against Mansour Matloubi in the \'97 Main Event. Cards have memory.',
    'One in 72,193 hands. Take a moment. Most pros never see one.',
  ],
  8: [ // Four of a kind
    'Quads. The hand that pays off your rent for six months and changes how the table looks at you forever.',
    'Four of a kind. The kind of hand Daniel Negreanu calls out loud before the river falls.',
  ],
  7: [ // Full house
    'A boat. Phil Hellmuth: "My poker brain told me he had a boat!"',
    'Full house. The hand that broke Sammy Farha\'s heart against Moneymaker in 2003 — except Moneymaker had nothing.',
  ],
  6: [ // Flush
    'Flush. Doyle Brunson once said flushes are the worst hand in poker — they look strong but they\'re not.',
    'A flush on the river. Watch the four-of-a-suit board. Watch their face.',
  ],
  5: [ // Straight
    'Straight. Johnny Chan made one with J-9 against Erik Seidel on the \'88 Main\'s final hand. Slow-played the river perfectly.',
    'A made straight. Half the time you win, half the time someone\'s drawing dead.',
  ],
  4: [ // Three of a kind
    'Trips. Sammy Farha\'s favourite trap. Hidden in a connected board, lethal.',
  ],
};

function discipleLine(ctx) {
  const { heroHole, board, heroBest, street } = ctx || {};
  // River made-hand reverence
  if (street === 'river' && heroBest && MADE_HAND_LORE[heroBest.category]) {
    const pool = MADE_HAND_LORE[heroBest.category];
    return pool[Math.floor(Math.random() * pool.length)];
  }
  // Starting-hand trivia (pre-flop and flop)
  if ((street === 'preflop' || street === 'flop') && heroHole) {
    const sig = handSignature(heroHole);
    const pool = HAND_TRIVIA[sig];
    if (pool) return pool[Math.floor(Math.random() * pool.length)];
  }
  return null;
}

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

// Worm's signal pool, keyed by his hand strength bucket. The first key whose
// predicate matches determines what Worm communicates this street.
const WORM_SIGNALS = {
  monster: { mood: 'signaling', text: 'Worm taps his glass twice — slow, deliberate. Premium pair. Trap him.' },
  strong:  { mood: 'signaling', text: 'Worm runs a finger along his eyebrow. Big card, suited. He likes it.' },
  decent:  { mood: 'confident', text: 'Worm flicks a chip across his knuckles. Mid-range hand, drawing live.' },
  draw:    { mood: 'thinking',  text: 'Worm scratches his ear. He\'s on a draw — flush or straight.' },
  weak:    { mood: 'resigned',  text: 'Worm shrugs at his cards. Nothing. He\'ll fold to a real bet.' },
  air:     { mood: 'anxious',   text: 'Worm rubs his jaw. Total air. Don\'t commit chips alongside him.' },
};

function classifyWormHand(hole, board) {
  if (!hole || hole.length !== 2) return 'weak';
  const [a, b] = hole;
  const hi = Math.max(a.rank, b.rank);
  const lo = Math.min(a.rank, b.rank);
  const suited = a.suit === b.suit;
  const connected = (hi - lo) === 1;
  const pair = hi === lo;
  if (!board || board.length === 0) {
    if (pair && hi >= 11) return 'monster';
    if (pair) return 'strong';
    if (hi === 14 && lo >= 10 && suited) return 'strong';
    if (hi === 14 && lo >= 10) return 'decent';
    if (hi >= 13 && lo >= 10 && suited) return 'decent';
    if (suited && connected && hi >= 8) return 'draw';
    if (suited && connected) return 'weak';
    return 'air';
  }
  // Post-flop: rough hand-strength classification based on equity proxy
  return null; // we'll fall back to equity-based eval in game.js
}

function pickDialog(opp, situation) {
  if (!opp || !opp.dialog) return null;
  const pool = opp.dialog[situation];
  if (!pool || !pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

// Secret objectives — opps occasionally pull the hero aside with a side-deal.
// The {target} placeholder is filled with a randomly-picked OTHER opponent
// at the table when the objective is offered.
const SECRET_OBJECTIVES = {
  deli_grinder: {
    offer: 'Listen, McDermott. Do me a favour tonight. I want {target} bled dry. You target him, you forget anyone else exists, and there\'ll be something in it for you.',
    rewardRP: 35,
    rewardCash: 80,
    declineLine: 'Hmph. I see how it is.',
    acceptLine: 'Good boy. Now go to work.',
  },
  pizza_tony: {
    offer: 'Hey kid, between you and me — {target} owes me money. If he loses tonight, I get my cut. You help me out, I\'ll cut you in. Maybe even tell you his tell if you\'re smart enough to ask.',
    rewardRP: 25,
    rewardCash: 60,
    declineLine: 'Suit yourself.',
    acceptLine: 'Atta boy. Bury him.',
  },
  cab_driver_pete: {
    offer: 'McDermott, I drove {target} home last week. He cried about his wife the whole way. Man\'s soft right now. Take his stack tonight and there\'s a tip in it for you.',
    rewardRP: 30,
    rewardCash: 70,
    declineLine: 'Eh. Worth asking.',
    acceptLine: 'Atta boy. Make him cry again.',
  },
  detective_callahan: {
    offer: 'McDermott. I need {target} broken tonight. Take his roll, I\'ll forget I ever saw your face in here. Tell me how he plays and I\'ll forget twice.',
    rewardRP: 80,
    rewardCash: 250,
    declineLine: 'Hm. Smart. You don\'t want to owe me.',
    acceptLine: 'Good. Make it look natural.',
  },
  detective_torres: {
    offer: 'Yo McDermott. You see {target}? He\'s got a wire under that jacket. Or — he\'s got a tell I can\'t crack. Bust him for me tonight.',
    rewardRP: 60,
    rewardCash: 180,
    declineLine: 'Whatever, McDermott.',
    acceptLine: 'Good. Eat him alive.',
  },
  captain_ortiz: {
    offer: 'McDermott. I want a word. {target} is going to embarrass this department if he wins tonight. Take him out and there\'s a quiet thank-you waiting.',
    rewardRP: 70,
    rewardCash: 200,
    declineLine: 'Understood. We didn\'t speak.',
    acceptLine: 'Discreet. I appreciate that.',
  },
  trust_fund_kid: {
    offer: 'McDermott, dear boy. {target} insulted my mother at the club. I want him *gutted* tonight. Make it happen and I\'ll wire you something for the trouble.',
    rewardRP: 50,
    rewardCash: 400,
    declineLine: 'Suit yourself. The offer was generous.',
    acceptLine: 'Wonderful. Make him weep.',
  },
  silk_glove: {
    offer: 'McDermott. There is unfinished business between {target} and me. He should not leave this room with chips. You understand. There would be — appreciation.',
    rewardRP: 100,
    rewardCash: 600,
    declineLine: 'Pity. I had hopes.',
    acceptLine: 'Then we have an understanding.',
  },
};

window.GameData = {
  VENUES, OPPONENTS, PARTNERS, VOICES, PHONE_MESSAGES, WORM_SIGNALS,
  SECRET_OBJECTIVES,
  RANK_BANDS, TIME_CYCLE, rankFor, classifyWormHand, pickDialog,
};
