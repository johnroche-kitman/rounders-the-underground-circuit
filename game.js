// ============================================================================
// Rounders: The Underground Circuit — main game module
// State management, screen routing, fight-mode controller, day clock, debt.
// ============================================================================

const P = window.PokerEngine;
const D = window.GameData;

const STORAGE_KEY = 'rounders.save.v1';

// ---------------------------------------------------------------- State -----

function defaultState() {
  return {
    day: 1,
    timeIndex: 1,                          // 0 morning, 1 evening, 2 late night
    cash: 100,
    rp: 0,
    loan: null,                            // { principal, total, dueDay }
    focus: 100,
    debuffs: [],                           // { id, daysLeft, ... }
    selectedVenueId: null,
    enteredVenueId: null,
    partnerId: null,
    unlockedVenues: ['deli'],
    revealedHighrise: false,
    fullHouseRewarded: false,
    royalRewarded: false,
    sleeveCard: null,                      // mucked card available next hand
    suspicion: 0,
    messages: D.PHONE_MESSAGES.map(m => ({ ...m })),
    psyche: { calculator: 4, wire: 3, shark: 2, sweat: 5 },
    physical: { sleightOfHand: 2 },
    perks: ['Johnny Chan\'s Blessing'],
    skillPoints: 2,
    session: null,                         // active poker session
    lastFinancials: null,
    bestHandThisSession: 0,
    handsPlayedTotal: 0,
    cleanShowdownsWon: 0,
    successfulCheats: 0,
  };
}

let state = loadState();

function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (s && typeof s.cash === 'number') return Object.assign(defaultState(), s);
  } catch (e) {}
  return defaultState();
}

function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
}

// Hot reset for prototyping
window.resetRounders = () => { localStorage.removeItem(STORAGE_KEY); location.reload(); };

// ---------------------------------------------------------------- Utils -----

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function dollars(n) {
  const sign = n < 0 ? '-' : '';
  return sign + '$' + Math.abs(Math.round(n)).toLocaleString('en-US');
}

function competenceLabel(n) {
  return ['', 'Fish', 'Soft', 'Mixed', 'Grinders', 'Sharks'][n] || 'Sharks';
}

function setBanner(text, kind = '') {
  const old = $('.banner'); if (old) old.remove();
  const el = document.createElement('div');
  el.className = `banner ${kind}`;
  el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

function showScreen(name) {
  $$('.screen').forEach(s => s.classList.remove('active'));
  const screen = document.getElementById(`screen-${name}`);
  if (screen) screen.classList.add('active');
  if (name === 'map')     renderMap();
  if (name === 'phone')   renderPhone();
  if (name === 'sheet')   renderSheet();
  if (name === 'vig')     renderVig();
}

// ---------------------------------------------------------------- Status ----

function updateStatusBar() {
  $('#status-day').textContent = `DAY ${state.day} — ${D.TIME_CYCLE[state.timeIndex]}`;
  $('#status-cash').textContent = dollars(state.cash);
  $('#status-rp').textContent = `${state.rp} RP · ${D.rankFor(state.rp)}`;
  const loanEl = $('#status-loan');
  if (state.loan) {
    const daysLeft = state.loan.dueDay - state.day;
    loanEl.textContent = `OWE GRAMA ${dollars(state.loan.total)} · ${daysLeft}d`;
    loanEl.classList.remove('clean');
  } else {
    loanEl.textContent = 'None';
    loanEl.classList.add('clean');
  }
}

// ---------------------------------------------------------------- Day clock --

function advanceTime(steps = 1) {
  for (let i = 0; i < steps; i++) {
    state.timeIndex++;
    if (state.timeIndex >= D.TIME_CYCLE.length) {
      state.timeIndex = 0;
      state.day++;
      // Decay debuffs
      state.debuffs = state.debuffs
        .map(b => ({ ...b, daysLeft: b.daysLeft - 1 }))
        .filter(b => b.daysLeft > 0);
      checkDebt();
    }
  }
  updateStatusBar();
  saveState();
}

function checkDebt() {
  if (!state.loan) return;
  if (state.day > state.loan.dueDay) {
    // Past due: triggers consequences
    state.rp = Math.max(0, state.rp - 150);
    state.debuffs.push({ id: 'bruised', label: 'Bruised Hands (Focus -50%)', daysLeft: 3 });
    state.loan = null;
    state.focus = Math.min(state.focus, 50);
    setBanner('GRAMA FOUND YOU. Bruised hands — Focus halved for 3 days.', 'bad');
  }
}

// ---------------------------------------------------------------- MAP -----

function renderMap() {
  updateStatusBar();
  const container = $('#venue-nodes');
  container.innerHTML = '';

  D.VENUES.forEach(v => {
    const unlocked = isUnlocked(v);
    const hide = v.hidden && !state.revealedHighrise;
    const el = document.createElement('div');
    el.className = 'venue-node' + (unlocked ? '' : ' locked') + (v.id === state.selectedVenueId ? ' selected' : '') + (v.id === 'highrise' ? ' special' : '') + (hide ? ' hidden' : '');
    el.style.left = v.coords.x + '%';
    el.style.top = v.coords.y + '%';
    el.innerHTML = `
      <div class="node-pin"></div>
      <div class="node-label">${v.name}${unlocked ? '' : ' [LOCKED]'}</div>
      <div class="node-tagline">${v.blurb}</div>
    `;
    el.addEventListener('click', () => { state.selectedVenueId = v.id; renderMap(); });
    container.appendChild(el);
  });

  // Selected node already gets a yellow ring as the "you are here" marker.

  // Detail panel
  const panel = $('#venue-panel');
  if (!state.selectedVenueId) {
    panel.classList.add('empty');
    panel.innerHTML = '<em>Select a venue node above to inspect.</em>';
    return;
  }
  const v = D.VENUES.find(x => x.id === state.selectedVenueId);
  const unlocked = isUnlocked(v);
  const competenceDots = Array.from({ length: 5 }, (_, i) =>
    `<span class="${i < v.competence ? 'on' : ''}"></span>`).join('');
  const riskClass = v.cheatingRisk === 'low' ? 'good'
    : v.cheatingRisk === 'high' ? 'amber' : 'warn';
  const riskText = v.cheatingRisk === 'low'
    ? 'LOW — Distracted players, light penalties.'
    : v.cheatingRisk === 'high'
    ? 'HIGH — Sharp surveillance, heavy penalties.'
    : 'EXTREME — Cops at the table. Instant ban + arrest.';
  panel.classList.remove('empty');
  panel.innerHTML = `
    <div class="panel-header">
      <h2>${v.name}</h2>
      <div class="panel-sub">${v.blurb}</div>
    </div>
    <div class="panel-block">
      <div class="panel-stat"><span class="lbl">Game Type</span> <span class="val">${v.gameType}</span></div>
      <div class="panel-stat"><span class="lbl">Buy-In</span> <span class="val">${dollars(v.buyIn)}</span></div>
      <div class="panel-stat"><span class="lbl">Payout</span> <span class="val good">${v.payoutHint}</span></div>
      <div class="panel-stat"><span class="lbl">Respect</span> <span class="val amber">${v.rpHint}</span></div>
    </div>
    <div class="panel-block">
      <div class="panel-stat"><span class="lbl">Competence</span> <span class="val"><span class="competence-dots">${competenceDots}</span></span></div>
      <div class="panel-stat"><span class="lbl">Cheating Risk</span> <span class="val ${riskClass}">${riskText.split(' — ')[0]}</span></div>
      <div class="panel-stat"><span class="lbl">Partner</span> <span class="val">${v.partnerAvailable ? 'Available' : (v.partnerNote || 'Unavailable')}</span></div>
      <div class="panel-stat"><span class="lbl">Unlock</span> <span class="val">${unlocked ? 'Open' : unlockText(v)}</span></div>
    </div>
    <div class="panel-actions">
      ${unlocked
        ? `<button class="btn primary" id="enter-venue">${state.cash < v.buyIn ? 'NOT ENOUGH CASH' : 'Enter Venue'}</button>
           ${v.partnerAvailable ? '<button class="btn" id="recruit-partner">Recruit Partner</button>' : ''}`
        : `<button class="btn" disabled>${unlockText(v)}</button>`}
    </div>
  `;
  const enterBtn = $('#enter-venue', panel);
  if (enterBtn) {
    enterBtn.disabled = state.cash < v.buyIn;
    enterBtn.addEventListener('click', () => { state.partnerId = null; enterVenue(v); });
  }
  const recruitBtn = $('#recruit-partner', panel);
  if (recruitBtn) {
    recruitBtn.disabled = state.cash < v.buyIn;
    recruitBtn.addEventListener('click', () => openTeamUp(v));
  }
}

function isUnlocked(v) {
  return state.unlockedVenues.includes(v.id);
}

function unlockText(v) {
  if (v.id === 'highrise') {
    return state.revealedHighrise ? `Buy-in ${dollars(v.buyIn)}` : 'Hit a Royal/Straight Flush to reveal';
  }
  const parts = [];
  if (v.unlockRP > 0) parts.push(`${v.unlockRP} RP`);
  if (v.fullHouseShortcut) parts.push('or Full House');
  return parts.length ? `Locked — needs ${parts.join(' ')}` : 'Locked';
}

function checkUnlocks() {
  D.VENUES.forEach(v => {
    if (state.unlockedVenues.includes(v.id)) return;
    if (v.unlockRP && state.rp >= v.unlockRP) state.unlockedVenues.push(v.id);
  });
}

// ---------------------------------------------------------------- TEAM-UP ---

let teamupContext = null;
function openTeamUp(venue) {
  teamupContext = { venue };
  state.partnerId = null;
  $('#teamup-sub').textContent = `Before entering: ${venue.name}`;
  const grid = $('#partner-grid');
  grid.innerHTML = '';
  Object.values(D.PARTNERS).forEach(p => {
    const card = document.createElement('div');
    card.className = 'partner-card';
    card.dataset.id = p.id;
    card.innerHTML = `
      <h3>${p.name}</h3>
      <div class="desc">${p.blurb}</div>
      <ul>
        ${p.synergy.map(s => `<li>+ ${s}</li>`).join('')}
        <li class="risk">! ${p.risk}</li>
        <li class="cut">$ Cut: ${Math.round(p.cut * 100)}% of net profit</li>
      </ul>
    `;
    card.addEventListener('click', () => {
      state.partnerId = p.id;
      $$('.partner-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      $('#teamup-confirm').disabled = false;
      $('#partner-summary').style.display = 'block';
      $('#partner-summary').innerHTML = `<strong>${p.name}</strong> will sit with you at ${venue.name}. Suspicion starts at <span class="blood">${Math.round(p.suspicionFloor*100)}%</span>.`;
    });
    grid.appendChild(card);
  });
  $('#teamup-confirm').disabled = true;
  $('#partner-summary').style.display = 'none';
  $('#teamup-confirm').onclick = () => enterVenue(venue);
  $('#teamup-skip').onclick = () => { state.partnerId = null; enterVenue(venue); };
  showScreen('teamup');
}

// ---------------------------------------------------------------- POKER -----

function enterVenue(venue) {
  if (state.cash < venue.buyIn) {
    setBanner('Not enough cash for the buy-in.', 'bad');
    return;
  }
  state.cash -= venue.buyIn;
  state.enteredVenueId = venue.id;
  const partner = state.partnerId ? D.PARTNERS[state.partnerId] : null;
  const opponent = D.OPPONENTS[venue.opponentId];
  const isTournament = venue.gameType === 'Tournament';
  const startStack = isTournament ? venue.tournamentStartingStack : venue.buyIn;
  state.session = {
    venueId: venue.id,
    opponentId: venue.opponentId,
    partnerId: state.partnerId,
    isTournament,
    startStack,
    buyIn: venue.buyIn,
    startingRP: state.rp,
    playerStack: startStack,
    oppStack: startStack,
    suspicion: partner ? partner.suspicionFloor : 0,
    handsPlayed: 0,
    cleanShowdownsWon: 0,
    successfulCheats: 0,
    bestHandCat: 0,
    netFromCheats: 0,
    busted: false,
  };
  state.focus = Math.min(100, state.focus + 10);
  $('#opp-portrait').style.setProperty('--portrait-tint', opponent.portraitTint);
  $('#opp-face').textContent = opponent.name.split(' ').map(s => s[0]).join('').slice(0, 2);
  $('#opp-name').textContent = opponent.name;
  showScreen('poker');
  updateStatusBar();
  startNewHand(true);
  saveState();
}

let hand = null;
let raiseAmount = 0;
let pendingShowdown = false;

function startNewHand(firstHand) {
  const venue = D.VENUES.find(v => v.id === state.session.venueId);
  // Tournament: bust = session over. KO opp = win the prize.
  if (state.session.isTournament) {
    if (state.session.playerStack <= 0) {
      state.session.busted = true;
      return endSession();
    }
    if (state.session.oppStack <= 0) {
      state.session.tournamentWin = true;
      return endSession();
    }
  } else {
    // Cash game: re-buy from cash if busted (and have funds)
    if (state.session.playerStack <= 0) {
      if (state.cash >= venue.buyIn) {
        state.cash -= venue.buyIn;
        state.session.playerStack = venue.buyIn;
      } else {
        state.session.busted = true;
        return endSession();
      }
    }
    if (state.session.oppStack <= 0) {
      state.session.oppStack = venue.buyIn;
      state.rp += 30;
      setBanner('KO — opponent re-buys. +30 RP.', 'good');
    }
  }
  state.session.handsPlayed++;
  state.handsPlayedTotal++;
  const playerOnButton = (state.session.handsPlayed % 2) === 1;
  hand = P.createHand({
    playerStack: state.session.playerStack,
    oppStack: state.session.oppStack,
    smallBlind: venue.blinds.small,
    bigBlind: venue.blinds.big,
    playerOnButton,
    sleeveCard: state.sleeveCard,
  });
  if (state.sleeveCard) {
    state.sleeveCard = null;
    pushIntrusion('SHARK', 'You slip the card down. Mike — that\'s ours now.');
  }
  pendingShowdown = false;
  $('#showdown').classList.add('hidden');
  raiseAmount = 0;
  $('#intrusions').innerHTML = '';
  fireIntrusionsForState();
  renderFight();
  // If AI is first to act, run AI.
  scheduleAITurn();
}

function renderFight() {
  if (!hand) return;
  const venue = D.VENUES.find(v => v.id === state.session.venueId);
  $('#hero-chips-label').textContent = dollars(hand.playerStack);
  $('#opp-chips-label').textContent = dollars(hand.oppStack);
  // Bars scale to starting stack
  const startStack = state.session.startStack;
  $('#hero-chips-bar').style.width = Math.max(0, Math.min(100, (hand.playerStack / startStack) * 100)) + '%';
  $('#opp-chips-bar').style.width  = Math.max(0, Math.min(100, (hand.oppStack / startStack) * 100)) + '%';
  $('#pot-amount').textContent = dollars(hand.pot);
  $('#hand-status').textContent = streetLabel(hand.street);
  $('#focus-fill').style.width = state.focus + '%';
  $('#focus-label').textContent = state.focus + '%';
  $('#suspicion-fill').style.width = Math.round(state.session.suspicion * 100) + '%';
  $('#suspicion-pct').textContent = Math.round(state.session.suspicion * 100) + '%';

  // Cards
  $('#community-row').innerHTML = '';
  for (let i = 0; i < 5; i++) {
    if (hand.board[i]) $('#community-row').appendChild(makeCardEl(hand.board[i]));
    else $('#community-row').appendChild(makePlaceholderEl());
  }
  $('#hole-row').innerHTML = '';
  hand.heroHole.forEach(c => $('#hole-row').appendChild(makeCardEl(c)));

  // Partner signal
  if (state.session.partnerId === 'worm') {
    $('#partner-rail-header').style.display = 'block';
    const ps = $('#partner-signal');
    ps.style.display = 'block';
    const oppPair = hand.oppHole[0].rank === hand.oppHole[1].rank;
    const oppSuited = hand.oppHole[0].suit === hand.oppHole[1].suit;
    const high = Math.max(hand.oppHole[0].rank, hand.oppHole[1].rank);
    let signal = 'Worm taps his glass twice. Nothing dangerous.';
    if (oppPair) signal = `Worm coughs once. He\'s holding a pair${high >= 10 ? ' — a big one' : ''}.`;
    else if (oppSuited && high >= 12) signal = 'Worm runs a finger across his eyebrow. Suited paint.';
    else if (high >= 13) signal = 'Worm tugs his cuff. He\'s got an Ace or King.';
    ps.textContent = signal;
  } else {
    $('#partner-rail-header').style.display = 'none';
    $('#partner-signal').style.display = 'none';
  }

  renderActionBar();
  renderTellFeed();
}

function streetLabel(s) {
  return s === 'preflop' ? 'Pre-Flop'
       : s === 'flop' ? 'Flop'
       : s === 'turn' ? 'Turn'
       : s === 'river' ? 'River'
       : 'Showdown';
}

function makeCardEl(card) {
  const el = document.createElement('div');
  el.className = 'card' + (P.isRed(card) ? ' red' : '');
  el.innerHTML = `
    <span class="corner">${P.rankLabel(card.rank)}<br>${card.suit}</span>
    <span class="pip">${card.suit}</span>
    <span class="corner tr">${P.rankLabel(card.rank)}<br>${card.suit}</span>
  `;
  return el;
}
function makePlaceholderEl() {
  const el = document.createElement('div');
  el.className = 'card placeholder';
  return el;
}

function renderActionBar() {
  const bar = $('#action-bar');
  bar.innerHTML = '';
  if (hand.finished || hand.toAct !== 'player') return;
  const venue = D.VENUES.find(v => v.id === state.session.venueId);
  const acts = P.legalActions(hand);
  const owed = P.callAmount(hand, 'player');

  acts.forEach((a, i) => {
    if (a.type === 'raise') {
      const wrap = document.createElement('div');
      wrap.className = 'action-btn';
      wrap.style.flexDirection = 'column';
      wrap.innerHTML = `
        <span>RAISE</span>
        <div class="raise-controls">
          <input type="range" min="${a.min}" max="${a.max}" step="${venue.blinds.big}" value="${Math.min(Math.max(a.min, Math.floor(hand.pot * 0.66)), a.max)}" />
          <span class="raise-amt"></span>
        </div>
        <button class="btn primary" style="margin-top: 6px;">Commit</button>
      `;
      const slider = wrap.querySelector('input');
      const amt = wrap.querySelector('.raise-amt');
      const updateAmt = () => { amt.textContent = dollars(+slider.value); };
      slider.addEventListener('input', updateAmt);
      updateAmt();
      wrap.querySelector('button').addEventListener('click', () => playerAct({ type: 'raise', amount: +slider.value }));
      bar.appendChild(wrap);
      return;
    }
    const btn = document.createElement('button');
    btn.className = 'action-btn';
    let label = a.type.toUpperCase();
    if (a.type === 'call') label = `CALL ${dollars(a.amount)}`;
    btn.innerHTML = `<span>${label}</span><span class="key">[${i+1}]</span>`;
    btn.addEventListener('click', () => playerAct(a));
    bar.appendChild(btn);
  });

  // Special abilities
  const readBtn = document.createElement('button');
  readBtn.className = 'action-btn special';
  readBtn.innerHTML = `<span>READ INTENT</span><span class="key">Focus -20</span>`;
  readBtn.disabled = state.focus < 20;
  readBtn.addEventListener('click', readIntent);
  bar.appendChild(readBtn);

  // Cheating — Peek and Muck (and Squeeze if partner is Worm and we owe nothing)
  const cheatPeek = document.createElement('button');
  cheatPeek.className = 'action-btn cheat';
  const peekRisk = Math.round(cheatRiskPct('peek') * 100);
  cheatPeek.innerHTML = `<span>CHEAT: PEEK DECK</span><span class="key">${peekRisk}% risk</span>`;
  cheatPeek.disabled = venue.cheatingRisk === 'extreme' || hand.street !== 'preflop';
  cheatPeek.addEventListener('click', cheatPeekTopCard);
  bar.appendChild(cheatPeek);

  const muckBtn = document.createElement('button');
  muckBtn.className = 'action-btn cheat';
  const muckRisk = Math.round(cheatRiskPct('muck') * 100);
  muckBtn.innerHTML = `<span>CHEAT: MUCK CARD</span><span class="key">${muckRisk}% risk</span>`;
  muckBtn.disabled = !!state.sleeveCard || venue.cheatingRisk === 'extreme' || hand.street !== 'preflop';
  muckBtn.addEventListener('click', cheatMuckCard);
  bar.appendChild(muckBtn);
}

function renderTellFeed() {
  const opp = D.OPPONENTS[state.session.opponentId];
  // Wire stat affects reliability of the tell read
  const tell = P.aiTell(hand, opp.profile);
  if (tell) {
    $('#tell-text').textContent = tell.text;
  } else {
    $('#tell-text').textContent = 'He waits. Stone-faced.';
  }
}

// ---------- Inner monologue --------------------------------------------------

function pushIntrusion(voiceKey, text) {
  const voice = D.VOICES[voiceKey];
  if (!voice) return;
  const klass = voiceKey === 'CALCULATOR' ? 'calc'
    : voiceKey === 'SHARK' ? 'shark'
    : voiceKey === 'WIRE' ? 'wire' : 'sweat';
  const el = document.createElement('div');
  el.className = `intrusion ${klass}`;
  el.innerHTML = `<span class="voice-name">${voice.icon}  ${voice.name}</span>${text}`;
  $('#intrusions').appendChild(el);
  // Cap at 8 visible
  const all = $$('#intrusions .intrusion');
  while (all.length > 8) all.shift().remove();
  $('#intrusions').scrollTop = $('#intrusions').scrollHeight;
}

function fireIntrusionsForState() {
  if (!hand || hand.toAct !== 'player') return;
  const equity = P.estimateEquity(hand.heroHole, hand.board, 200);
  const owed = P.callAmount(hand, 'player');
  const potOdds = owed / (hand.pot + owed || 1);
  const opp = D.OPPONENTS[state.session.opponentId];
  const tell = P.aiTell(hand, opp.profile);
  const debt = state.loan ? state.loan.total : 0;
  const ctx = { equity, owed, potOdds, pot: hand.pot, stack: hand.playerStack, debt, tell };

  // Probability each voice speaks scales with its stat (0..5 → 0..1)
  const voicesByStat = {
    CALCULATOR: state.psyche.calculator / 5,
    SHARK: state.psyche.shark / 5,
    WIRE: state.psyche.wire / 5,
    COLD_SWEAT: state.psyche.sweat / 5,
  };
  // Pick 1–2 voices that feel relevant given context
  const lineup = [];
  if (Math.random() < voicesByStat.CALCULATOR) lineup.push('CALCULATOR');
  if (state.loan && Math.random() < voicesByStat.COLD_SWEAT) lineup.push('COLD_SWEAT');
  else if (Math.random() < voicesByStat.COLD_SWEAT * 0.7) lineup.push('COLD_SWEAT');
  if (equity > 0.55 && Math.random() < voicesByStat.SHARK) lineup.push('SHARK');
  if (tell && Math.random() < voicesByStat.WIRE) lineup.push('WIRE');
  // Always at least one voice during big decisions
  if (!lineup.length) {
    const picks = ['CALCULATOR', 'SHARK', 'WIRE', 'COLD_SWEAT'];
    lineup.push(picks[Math.floor(Math.random() * picks.length)]);
  }
  // Take up to 2 with small stagger
  lineup.slice(0, 2).forEach((v, i) => {
    setTimeout(() => {
      const voice = D.VOICES[v];
      pushIntrusion(v, voice.speak(ctx));
    }, i * 320);
  });
}

// ---------- Player + AI action loop -----------------------------------------

function playerAct(action) {
  if (!hand || hand.finished) return;
  if (hand.toAct !== 'player') return;
  P.applyAction(hand, action);
  state.session.playerStack = hand.playerStack;
  state.session.oppStack = hand.oppStack;
  if (hand.finished) return resolveHand();
  renderFight();
  if (hand.toAct === 'opp') scheduleAITurn();
  else fireIntrusionsForState();
}

function scheduleAITurn() {
  if (!hand || hand.finished || hand.toAct !== 'opp') return;
  renderFight();
  setTimeout(() => {
    if (!hand || hand.finished || hand.toAct !== 'opp') return;
    const opp = D.OPPONENTS[state.session.opponentId];
    const action = P.aiDecide(hand, opp.profile);
    P.applyAction(hand, action);
    state.session.playerStack = hand.playerStack;
    state.session.oppStack = hand.oppStack;
    flashAIAction(action);
    if (hand.finished) return resolveHand();
    renderFight();
    if (hand.toAct === 'opp') scheduleAITurn();
    else fireIntrusionsForState();
  }, 900);
}

function flashAIAction(action) {
  const opp = D.OPPONENTS[state.session.opponentId];
  let line = '';
  if (action.type === 'fold')  line = `${opp.name} folds.`;
  if (action.type === 'check') line = `${opp.name} taps the felt.`;
  if (action.type === 'call')  line = `${opp.name} calls ${dollars(action.amount)}.`;
  if (action.type === 'raise') line = `${opp.name} raises ${dollars(action.amount)}.`;
  $('#tell-text').textContent = line;
}

// ---------- Special abilities and cheats ------------------------------------

function readIntent() {
  if (state.focus < 20) return;
  state.focus -= 20;
  const opp = D.OPPONENTS[state.session.opponentId];
  const eq = P.estimateEquity(hand.oppHole, hand.board, 250);
  const oppEquity = 1 - eq + 0; // Their equity vs hero
  // Show actual bluff/strength read
  const text = oppEquity > 0.65
    ? `He has it. Genuine strength — roughly ${Math.round(oppEquity*100)}% to win at showdown.`
    : oppEquity > 0.4
    ? `Mixed. About ${Math.round(oppEquity*100)}% — he\'s in this hand but not ahead.`
    : `He\'s on air. Maybe ${Math.round(oppEquity*100)}% equity. This is a bluff.`;
  pushIntrusion('WIRE', text);
  renderFight();
}

function cheatRiskPct(kind) {
  const venue = D.VENUES.find(v => v.id === state.session.venueId);
  const baseRisk = venue.cheatingRisk === 'low' ? 0.25
    : venue.cheatingRisk === 'high' ? 0.55
    : 0.95;
  const sleight = state.physical.sleightOfHand / 5;
  const partner = state.partnerId ? D.PARTNERS[state.partnerId].cheatBonus : 0;
  let kindMod = kind === 'peek' ? -0.05 : 0.05;
  return Math.max(0.05, Math.min(0.95, baseRisk - sleight * 0.4 - partner + kindMod));
}

function cheatPeekTopCard() {
  if (!hand) return;
  const risk = cheatRiskPct('peek');
  state.session.suspicion = Math.min(1, state.session.suspicion + 0.15);
  if (Math.random() < risk) return cheatBusted();
  const top = hand.deck[hand.deck.length - 1];
  state.session.successfulCheats++;
  state.successfulCheats++;
  pushIntrusion('SHARK', `You glimpse the next card off the deck — ${P.rankLabel(top.rank)}${top.suit}. Now you know what's coming on the flop.`);
  renderFight();
}

function cheatMuckCard() {
  if (state.sleeveCard) return;
  const risk = cheatRiskPct('muck');
  state.session.suspicion = Math.min(1, state.session.suspicion + 0.22);
  if (Math.random() < risk) return cheatBusted();
  // Take the better hole card into the sleeve. Force the other to be replaced
  // by a random new card next hand (handled via createHand sleeveCard slot).
  const idx = hand.heroHole[0].rank >= hand.heroHole[1].rank ? 0 : 1;
  state.sleeveCard = { ...hand.heroHole[idx] };
  state.session.successfulCheats++;
  state.successfulCheats++;
  pushIntrusion('SHARK', `${P.rankLabel(state.sleeveCard.rank)}${state.sleeveCard.suit} disappears up your sleeve. You\'ll see it again next hand.`);
  renderFight();
}

function cheatBusted() {
  setBanner('BUSTED CHEATING. You forfeit the table.', 'bad');
  const venue = D.VENUES.find(v => v.id === state.session.venueId);
  if (venue.cheatingRisk === 'extreme') {
    state.rp = Math.max(0, state.rp - 200);
    state.debuffs.push({ id: 'bruised', label: 'Bruised Hands', daysLeft: 4 });
  } else {
    state.rp = Math.max(0, state.rp - 60);
  }
  state.session.busted = true;
  state.session.playerStack = 0;
  endSession();
}

// ---------- Hand resolution --------------------------------------------------

function resolveHand() {
  renderFight();
  // Update session bookkeeping
  if (hand.winner === 'player') state.session.cleanShowdownsWon++;
  // Track best hand reached
  if (hand.heroBest) {
    state.session.bestHandCat = Math.max(state.session.bestHandCat, hand.heroBest.category);
  }
  pendingShowdown = true;
  const sd = $('#showdown');
  $('#showdown-title').textContent =
    hand.winner === 'player' ? 'You Take The Pot' :
    hand.winner === 'opp'    ? 'Pot Goes To Them' : 'Split Pot';
  $('#showdown-reason').textContent = hand.reason;
  const ho = $('#showdown-opp');
  const hh = $('#showdown-hero');
  ho.innerHTML = ''; hh.innerHTML = '';
  // Show opp cards only at true showdown (street reached river + neither folded)
  const wentToShowdown = hand.heroBest && hand.villBest;
  hand.heroHole.forEach(c => hh.appendChild(makeCardEl(c)));
  hand.oppHole.forEach(c => {
    const el = wentToShowdown ? makeCardEl(c) : (() => { const x = makeCardEl(c); x.classList.add('back'); x.innerHTML = ''; return x; })();
    ho.appendChild(el);
  });
  $('#showdown-hero-name').textContent = hand.heroBest ? hand.heroBest.name : '—';
  $('#showdown-opp-name').textContent  = hand.villBest && wentToShowdown ? hand.villBest.name : 'Mucked';
  sd.classList.remove('hidden');
  $('#next-hand-btn').onclick = () => {
    if (state.session.playerStack <= 0 || state.session.oppStack <= 0) {
      // Bust or KO → end session and rebuy/award handled in startNewHand
    }
    if (state.session.playerStack <= 0) return endSession();
    startNewHand(false);
  };
  $('#leave-table-btn').onclick = () => endSession();
}

function endSession() {
  // Award RP for milestone hands and unlock checks
  if (state.session.bestHandCat >= 6 && !state.fullHouseRewarded) {
    state.rp += 100;
    state.fullHouseRewarded = true;
    setBanner('FULL HOUSE — Word spreads. +100 RP.', 'good');
  }
  if (state.session.bestHandCat >= 8 && !state.royalRewarded) {
    state.royalRewarded = true;
    state.revealedHighrise = true;
    if (!state.unlockedVenues.includes('highrise')) state.unlockedVenues.push('highrise');
    setBanner('STRAIGHT FLUSH OR BETTER — A door opens on 4th Street.', 'good');
  }

  const venue = D.VENUES.find(v => v.id === state.session.venueId);
  // Compute cash returned and gross net based on cash vs. tournament.
  let cashReturned;
  let grossNet;
  if (state.session.isTournament) {
    // Won (KO opp): payout. Busted or left: 0 (buy-in is gone).
    cashReturned = state.session.tournamentWin ? venue.tournamentWinPayout : 0;
    grossNet = cashReturned - state.session.buyIn;
  } else {
    cashReturned = state.session.playerStack; // chips = cash in cash games
    grossNet = cashReturned - state.session.buyIn;
  }
  let cashGain = cashReturned;
  // Partner cut on positive net profit only
  let partnerCut = 0;
  if (state.session.partnerId && grossNet > 0) {
    partnerCut = Math.round(grossNet * D.PARTNERS[state.session.partnerId].cut);
    cashGain -= partnerCut;
  }
  // House rake (5%) on positive net profit only
  const rake = grossNet > 0 ? Math.round(grossNet * 0.05) : 0;
  cashGain -= rake;
  state.cash += cashGain;

  // RP awards
  let rpGain = 0;
  rpGain += state.session.cleanShowdownsWon * 8;
  rpGain += state.session.successfulCheats * 12;
  // Tournament bonus
  if (venue.gameType === 'Tournament' && grossNet > 0) rpGain += 60;
  // Penalize bust
  if (state.session.busted) rpGain -= 20;
  state.rp = Math.max(0, state.rp + rpGain);

  state.cleanShowdownsWon += state.session.cleanShowdownsWon;
  checkUnlocks();
  // Recompute lastFinancials
  state.lastFinancials = {
    venueName: venue.name,
    buyIn: state.session.buyIn,
    cashAtDeparture: cashReturned,
    rake,
    partnerCut,
    netProfit: grossNet - rake - partnerCut,
    newBankroll: state.cash,
    cleanShowdownsWon: state.session.cleanShowdownsWon,
    successfulCheats: state.session.successfulCheats,
    rpGain,
    rpTotal: state.rp,
    busted: state.session.busted,
    tournamentWin: !!state.session.tournamentWin,
    bestHandCat: state.session.bestHandCat,
  };
  state.session = null;
  advanceTime(1);
  saveState();
  renderPostGame();
  showScreen('postgame');
}

// ---------------------------------------------------------------- THE VIG --

function renderVig() {
  updateStatusBar();
  const slider = $('#loan-slider');
  const update = () => {
    const principal = +slider.value;
    // Vigorish curve: 20% base + 0.012% per dollar (exponential-ish)
    const vigRate = 0.20 + (principal / 2500) * 0.40;
    const vig = Math.round(principal * vigRate);
    const total = principal + vig;
    // Days to repay shrinks as principal grows
    const days = principal <= 500 ? 5 : principal <= 1500 ? 3 : 2;
    $('#loan-principal').textContent = dollars(principal);
    $('#loan-vig').textContent = dollars(vig);
    $('#loan-total').textContent = dollars(total);
    $('#loan-deadline').textContent = `Day ${state.day + days} (${days} in-game days)`;
    slider.dataset.principal = principal;
    slider.dataset.total = total;
    slider.dataset.due = state.day + days;
  };
  slider.oninput = update;
  update();
  $('#loan-accept').onclick = () => {
    if (state.loan) {
      setBanner('Pay your existing tab first.', 'bad');
      return;
    }
    const principal = +slider.dataset.principal;
    const total = +slider.dataset.total;
    const dueDay = +slider.dataset.due;
    state.cash += principal;
    state.loan = { principal, total, dueDay };
    setBanner(`Grama gives you ${dollars(principal)}. ${dollars(total)} due Day ${dueDay}.`, '');
    saveState();
    showScreen('map');
  };
  $('#loan-decline').onclick = () => showScreen('map');
}

function payOffLoan() {
  if (!state.loan) return;
  if (state.cash < state.loan.total) {
    setBanner('Not enough cash to clear the tab.', 'bad');
    return;
  }
  state.cash -= state.loan.total;
  state.loan = null;
  state.rp += 30;
  setBanner('Debt cleared. +30 RP — Grama nods.', 'good');
  saveState();
  updateStatusBar();
}

// ---------------------------------------------------------------- PHONE ----

function renderPhone() {
  const list = $('#nokia-messages');
  list.innerHTML = '';
  state.messages.forEach((m, i) => {
    const div = document.createElement('div');
    div.className = 'nokia-msg ' + (m.unread ? 'unread' : 'read');
    div.innerHTML = `
      <div><span class="from">${m.from}</span><span class="time">(${m.time})</span></div>
      <div class="nokia-body">${m.body}</div>
    `;
    div.addEventListener('click', () => {
      m.unread = false;
      saveState();
      renderPhone();
    });
    list.appendChild(div);
  });
}

function familyCall() {
  if (state.cash >= 50) {
    setBanner('You already have cash. Save the call for when you\'re truly broke.', '');
    return;
  }
  state.cash += 50;
  setBanner('Family wires $50. No interest, no deadline. Get back to grinding.', '');
  saveState();
  updateStatusBar();
  showScreen('map');
}

// ---------------------------------------------------------------- SHEET ----

function renderSheet() {
  $('#sheet-rank').textContent = D.rankFor(state.rp);
  $('#sheet-points').textContent = state.skillPoints;
  const psycheDefs = [
    { key: 'calculator', name: 'The Calculator', desc: 'Displays exact percentage outs and pot-odds in real-time.' },
    { key: 'wire',       name: 'The Wire',       desc: 'Increases detection of opponent physical tells.' },
    { key: 'shark',      name: 'The Shark',      desc: 'Unlocks higher-tier bluffing dialogue and intimidation.' },
    { key: 'sweat',      name: 'The Cold Sweat', desc: 'Warns when an opponent is statistically unbeatable.' },
  ];
  renderStatList('#sheet-psyche', psycheDefs, 'psyche');
  const physDefs = [
    { key: 'sleightOfHand', name: 'Sleight of Hand', desc: 'Lowers risk of getting caught mucking or peeking.' },
  ];
  renderStatList('#sheet-physical', physDefs, 'physical');
  const perks = $('#sheet-perks');
  perks.innerHTML = '';
  state.perks.forEach(p => {
    const el = document.createElement('div');
    el.className = 'perk-item';
    el.innerHTML = `<span class="perk-name">${p}</span><span class="muted">Once per game, ignore a psychological "Tilt" status effect.</span>`;
    perks.appendChild(el);
  });
}

function renderStatList(sel, defs, bucket) {
  const root = $(sel);
  root.innerHTML = '';
  defs.forEach(def => {
    const val = state[bucket][def.key];
    const bar = Array.from({ length: 5 }, (_, i) =>
      `<span class="${i < val ? 'on' : ''}"></span>`).join('');
    const row = document.createElement('div');
    row.className = 'stat-row';
    row.innerHTML = `
      <span class="stat-name">${def.name}</span>
      <span class="stat-bar">${bar}</span>
      <span class="stat-desc">${def.desc}</span>
      <button ${state.skillPoints <= 0 || val >= 5 ? 'disabled' : ''}>+ INVEST</button>
    `;
    row.querySelector('button').addEventListener('click', () => {
      if (state.skillPoints <= 0 || val >= 5) return;
      state[bucket][def.key] = val + 1;
      state.skillPoints--;
      saveState();
      renderSheet();
    });
    root.appendChild(row);
  });
}

// ---------------------------------------------------------------- POSTGAME --

function renderPostGame() {
  const f = state.lastFinancials;
  if (!f) return;
  $('#postgame-title').textContent = f.busted ? 'Session Over — You Busted' : 'Session Over';
  $('#postgame-venue').textContent = f.venueName;
  const finReport = $('#financial-report');
  finReport.innerHTML = `
    <div class="report-line"><span>Starting Buy-In</span><span class="neg">-${dollars(f.buyIn)}</span></div>
    <div class="report-line"><span>Cash At Departure</span><span class="pos">+${dollars(f.cashAtDeparture)}</span></div>
    <div class="report-line"><span>House Rake (5%)</span><span class="neg">-${dollars(f.rake)}</span></div>
    ${f.partnerCut ? `<div class="report-line"><span>Partner Cut</span><span class="neg">-${dollars(f.partnerCut)}</span></div>` : ''}
    <div class="report-line total ${f.netProfit >= 0 ? 'win' : 'loss'}">
      <span>Net Cash Profit</span>
      <span>${f.netProfit >= 0 ? '+' : ''}${dollars(f.netProfit)} → ${dollars(f.newBankroll)}</span>
    </div>
  `;
  const rep = $('#reputation-report');
  rep.innerHTML = `
    <div class="report-line"><span>Clean Showdowns Won</span><span class="pos">+${f.cleanShowdownsWon * 8} RP</span></div>
    <div class="report-line"><span>Successful Cheats</span><span class="pos">+${f.successfulCheats * 12} RP</span></div>
    ${f.busted ? '<div class="report-line"><span>Bust Penalty</span><span class="neg">-20 RP</span></div>' : ''}
    <div class="report-line total ${f.rpGain >= 0 ? 'win' : 'loss'}">
      <span>Net Respect</span>
      <span>${f.rpGain >= 0 ? '+' : ''}${f.rpGain} RP → ${f.rpTotal} RP</span>
    </div>
  `;
  const refl = $('#reflection-list');
  refl.innerHTML = '';
  // Compose two intrusions reflecting on the result
  if (f.netProfit > 0) {
    addReflection('CALCULATOR', 'calc',  `Clean extraction of capital. ${Math.round((f.netProfit / f.buyIn) * 100)}% ROI on the buy-in.`);
    addReflection('SHARK',      'shark', 'They\'ll remember the way you shut the trap. That\'s what we wanted.');
  } else if (f.busted) {
    addReflection('COLD_SWEAT', 'sweat', 'We had nothing. We had less than nothing. And we pushed anyway.');
    addReflection('CALCULATOR', 'calc',  'Variance is a long game. The math doesn\'t apologise.');
  } else {
    addReflection('WIRE',       'wire',  'You read the table well. Not every night is a payday.');
    addReflection('COLD_SWEAT', 'sweat', 'We live to play tomorrow. That has to count for something.');
  }
  function addReflection(voiceKey, klass, text) {
    const v = D.VOICES[voiceKey];
    const el = document.createElement('div');
    el.className = `intrusion ${klass}`;
    el.innerHTML = `<span class="voice-name">${v.icon}  ${v.name}</span>${text}`;
    refl.appendChild(el);
  }
  state.lastFinancials = null;
  saveState();
}

// ---------------------------------------------------------------- WIRING ----

function init() {
  // Top status bar
  updateStatusBar();
  // Generic data-screen buttons
  $$('[data-screen]').forEach(btn => {
    btn.addEventListener('click', () => showScreen(btn.dataset.screen));
  });
  // Advance time button
  $('#advance-time').addEventListener('click', () => {
    advanceTime(1);
    renderMap();
  });
  // Safety nets
  $('#vig-node').addEventListener('click', () => showScreen('vig'));
  $('#phone-node').addEventListener('click', () => showScreen('phone'));
  // Phone keys
  $$('.nokia-key').forEach(k => k.addEventListener('click', () => {
    const a = k.dataset.action;
    if (a === 'family') familyCall();
    if (a === 'back')   showScreen('map');
    if (a === 'reply')  setBanner('Reply drafted — Worm will meet you outside.', '');
  }));
  // Keyboard shortcuts inside fight mode
  document.addEventListener('keydown', (e) => {
    const inFight = $('#screen-poker').classList.contains('active');
    if (!inFight || !hand || hand.finished || hand.toAct !== 'player') return;
    const acts = P.legalActions(hand);
    const num = +e.key;
    if (num >= 1 && num <= acts.length) {
      const a = acts[num - 1];
      if (a.type === 'raise') return; // ignore — needs slider
      playerAct(a);
    }
    if (e.key === 'p' || e.key === 'P') cheatPeekTopCard();
    if (e.key === 'm' || e.key === 'M') cheatMuckCard();
    if (e.key === 'r' || e.key === 'R') readIntent();
  });
  showScreen('map');
  // Friendly default selection so the panel isn't blank on first load
  if (!state.selectedVenueId) { state.selectedVenueId = 'deli'; renderMap(); }
  // ?stage=NAME for screenshot / deep-link demos.
  applyStageParam();
}

function applyStageParam() {
  const stage = new URLSearchParams(location.search).get('stage');
  if (!stage) return;
  if (stage === 'map') {
    state.selectedVenueId = 'firehouse';
    state.unlockedVenues = ['deli', 'firehouse', 'elmwood'];
    state.cash = 1250; state.rp = 320; state.day = 14; state.timeIndex = 2;
    updateStatusBar(); renderMap();
    return;
  }
  if (stage === 'vig') { showScreen('vig'); return; }
  if (stage === 'phone') { showScreen('phone'); return; }
  if (stage === 'sheet') { showScreen('sheet'); return; }
  if (stage === 'teamup') { openTeamUp(D.VENUES.find(v => v.id === 'elmwood')); return; }
  if (stage === 'poker') {
    // Fabricate a mid-hand fight-mode view for screenshots.
    state.cash = 1250; state.rp = 320;
    const venue = D.VENUES.find(v => v.id === 'firehouse');
    state.session = {
      venueId: 'firehouse', opponentId: 'detective_callahan', partnerId: null,
      isTournament: true, startStack: 1500, buyIn: 150, startingRP: 320,
      playerStack: 1800, oppStack: 1200, suspicion: 0.12,
      handsPlayed: 4, cleanShowdownsWon: 2, successfulCheats: 0,
      bestHandCat: 1, netFromCheats: 0, busted: false,
    };
    const opp = D.OPPONENTS.detective_callahan;
    document.querySelector('#opp-portrait').style.setProperty('--portrait-tint', opp.portraitTint);
    document.querySelector('#opp-face').textContent = 'DC';
    document.querySelector('#opp-name').textContent = opp.name;
    showScreen('poker');
    // Manually build a hand with a flop already on the board.
    hand = P.createHand({
      playerStack: 1800, oppStack: 1200,
      smallBlind: 10, bigBlind: 20, playerOnButton: false,
    });
    // Force pre-flop call + check then a flop:
    P.applyAction(hand, { type: 'call', amount: 10 });
    P.applyAction(hand, { type: 'check' });
    // Pre-load a couple of intrusions
    fireIntrusionsForState();
    renderFight();
    return;
  }
  if (stage === 'postgame') {
    state.lastFinancials = {
      venueName: "Joey's Knickerbocker Deli",
      buyIn: 50,
      cashAtDeparture: 450,
      rake: 20,
      partnerCut: 0,
      netProfit: 380,
      newBankroll: 1582,
      cleanShowdownsWon: 5,
      successfulCheats: 2,
      rpGain: 64,
      rpTotal: 355,
      busted: false,
      tournamentWin: false,
      bestHandCat: 3,
    };
    renderPostGame(); showScreen('postgame');
    return;
  }
}

document.addEventListener('DOMContentLoaded', init);
