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
    psyche: { calculator: 4, wire: 3, shark: 2, sweat: 5, disciple: 3 },
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
  if (name === 'venue')   renderVenue();
  if (name === 'table-preview') renderTablePreview();
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
    el.addEventListener('click', () => {
      state.selectedVenueId = v.id;
      saveState();
      showScreen('venue');
    });
    container.appendChild(el);
  });

  // Selected node already gets a yellow ring as the "you are here" marker.
}

function renderTablePreview() {
  updateStatusBar();
  const root = $('#table-preview');
  if (!root || !state.session) { showScreen('map'); return; }
  const venue = D.VENUES.find(v => v.id === state.session.venueId);
  const seatHtml = state.session.seats.map(seat => {
    const oppDef = D.OPPONENTS[seat.opponentId] || {};
    const partnerDef = seat.kind === 'partner' ? D.PARTNERS[state.partnerId] : null;
    const desc = seat.kind === 'hero' ? 'You. Bankroll, focus, and one good night between you and Vegas.'
      : seat.kind === 'partner' ? (partnerDef?.blurb || 'Your partner. Watch his signals.')
      : (oppDef.label || '');
    const role = seat.kind === 'hero' ? 'You' : seat.kind === 'partner' ? 'Partner' : 'Opponent';
    const initials = initialsFor(seat.kind === 'hero' ? 'Mike McDermott' : seat.name);
    // Joey has a portrait sheet — show his "neutral" face in the avatar
    const avatarHtml = (oppDef.portraitDir && oppDef.portraitMoods)
      ? `<div class="tp-avatar has-image"><img src="${oppDef.portraitDir}neutral.jpg" alt="" /></div>`
      : (partnerDef?.portraitDir)
        ? `<div class="tp-avatar has-image"><img src="${partnerDef.portraitDir}neutral.jpg" alt="" /></div>`
        : `<div class="tp-avatar">${initials}</div>`;
    const tint = seat.portraitTint || (partnerDef ? '#3a2a1a' : '#3a2a1a');
    return `
      <div class="tp-seat" data-kind="${seat.kind}" style="--portrait-tint: ${tint}">
        <div class="tp-header">
          ${avatarHtml}
          <div class="tp-text">
            <span class="tp-name">${seat.kind === 'hero' ? 'Mike McDermott' : seat.name}</span>
            <span class="tp-role">${role}</span>
          </div>
        </div>
        <div class="tp-desc">${desc}</div>
      </div>
    `;
  }).join('');

  const npcCount = state.session.seats.length - 1;
  const partnerLine = state.partnerId ? ` · partnering with ${D.PARTNERS[state.partnerId].shortName || 'partner'}` : '';
  root.innerHTML = `
    <div class="table-preview-head">
      <span class="preview-eyebrow">${venue.name}</span>
      <h1>Meet the Table</h1>
      <span class="preview-sub">${npcCount} player${npcCount === 1 ? '' : 's'} sit across from you${partnerLine}.</span>
    </div>
    <div class="table-preview-seats">${seatHtml}</div>
    <div class="table-preview-actions">
      <button class="btn" id="preview-back">&larr; Back to Venue</button>
      <button class="btn primary" id="preview-take-seat">Take Your Seat</button>
    </div>
  `;
  $('#preview-back').addEventListener('click', () => {
    // Refund the buy-in and return to venue page
    state.cash += venue.buyIn;
    state.session = null;
    saveState();
    showScreen('venue');
  });
  $('#preview-take-seat').addEventListener('click', takeSeat);
}

function renderVenue() {
  updateStatusBar();
  const page = $('#venue-page');
  if (!page) return;
  if (!state.selectedVenueId) { showScreen('map'); return; }
  const v = D.VENUES.find(x => x.id === state.selectedVenueId);
  if (!v) { showScreen('map'); return; }
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

  const heroImage = v.interiorImage
    ? `<img src="${v.interiorImage}" alt="" />`
    : '';

  page.innerHTML = `
    <div class="venue-page-hero">
      <button class="venue-page-back" id="venue-back-btn">&larr; Back to map</button>
      ${heroImage}
      <div class="venue-page-hero-text">
        <div class="meta">${v.gameType} · ${dollars(v.buyIn)} buy-in</div>
        <h1>${v.name}</h1>
        <div class="blurb">${v.blurb}</div>
      </div>
    </div>
    <div class="venue-page-body">
      <div class="panel-block">
        <div class="block-title">Money</div>
        <div class="panel-stat"><span class="lbl">Game Type</span> <span class="val">${v.gameType}</span></div>
        <div class="panel-stat"><span class="lbl">Buy-In</span> <span class="val">${dollars(v.buyIn)}</span></div>
        <div class="panel-stat"><span class="lbl">Payout</span> <span class="val good">${v.payoutHint}</span></div>
        <div class="panel-stat"><span class="lbl">Respect</span> <span class="val amber">${v.rpHint}</span></div>
      </div>
      <div class="panel-block">
        <div class="block-title">Table</div>
        <div class="panel-stat"><span class="lbl">Players</span> <span class="val">${(v.opponents || [v.opponentId]).length} NPCs ${v.partnerAvailable ? '· partner allowed' : ''}</span></div>
        <div class="panel-stat"><span class="lbl">Competence</span> <span class="val"><span class="competence-dots">${competenceDots}</span></span></div>
        <div class="panel-stat"><span class="lbl">Cheating Risk</span> <span class="val ${riskClass}">${riskText.split(' — ')[0]}</span></div>
        <div class="panel-stat"><span class="lbl">Partner</span> <span class="val">${v.partnerAvailable ? 'Available' : (v.partnerNote || 'Unavailable')}</span></div>
      </div>
      <div class="panel-block">
        <div class="block-title">Status</div>
        <div class="panel-stat"><span class="lbl">Unlock</span> <span class="val">${unlocked ? 'Open' : unlockText(v)}</span></div>
        <div class="panel-stat"><span class="lbl">Your Cash</span> <span class="val ${state.cash >= v.buyIn ? 'good' : 'warn'}">${dollars(state.cash)}</span></div>
        <div class="panel-stat"><span class="lbl">Your Respect</span> <span class="val amber">${state.rp} RP</span></div>
        <div class="panel-stat"><span class="lbl">Loan</span> <span class="val ${state.loan ? 'warn' : ''}">${state.loan ? `Owe ${dollars(state.loan.total)}` : 'None'}</span></div>
      </div>
      <div class="venue-page-actions">
        ${unlocked
          ? `<button class="btn primary" id="enter-venue">${state.cash < v.buyIn ? 'NOT ENOUGH CASH' : 'Enter Venue'}</button>
             ${v.partnerAvailable ? '<button class="btn" id="call-worm">📞 Call Worm</button>' : '<button class="btn ghost" disabled>No partner allowed here</button>'}`
          : `<button class="btn ghost" disabled>${unlockText(v)}</button>
             <button class="btn ghost" disabled>—</button>`}
        <button class="btn" id="venue-back-btn-2">Back to map</button>
      </div>
    </div>
  `;
  const enterBtn = $('#enter-venue', page);
  if (enterBtn) {
    enterBtn.disabled = state.cash < v.buyIn;
    enterBtn.addEventListener('click', () => { state.partnerId = null; enterVenue(v); });
  }
  const callWormBtn = $('#call-worm', page);
  if (callWormBtn) {
    callWormBtn.disabled = state.cash < v.buyIn;
    callWormBtn.addEventListener('click', () => {
      state.partnerId = 'worm';
      enterVenue(v);
    });
  }
  page.querySelector('#venue-back-btn').addEventListener('click', () => showScreen('map'));
  page.querySelector('#venue-back-btn-2')?.addEventListener('click', () => showScreen('map'));
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
  const oppList = venue.opponents || [venue.opponentId];
  const primaryOpp = D.OPPONENTS[oppList[0]];
  const isTournament = venue.gameType === 'Tournament';
  const startStack = isTournament ? venue.tournamentStartingStack : venue.buyIn;

  // Seats: hero (0), optional partner (1), then opponents in venue order.
  const partnerSits = partner && partner.sitsAtTable !== false && partner.profile;
  const seats = [{ id: 'player', name: 'Mike', kind: 'hero' }];
  if (partnerSits) {
    seats.push({
      id: 'worm',
      name: partner.shortName || 'Worm',
      kind: 'partner',
      profile: partner.profile,
      portraitTint: partner.portraitTint,
      label: partner.label,
    });
  }
  oppList.forEach((oId, i) => {
    const o = D.OPPONENTS[oId];
    seats.push({
      id: `opp_${i}`,
      name: o.name,
      kind: 'opponent',
      profile: o.profile,
      opponentId: oId,
      portraitTint: o.portraitTint,
      label: o.label,
    });
  });

  state.session = {
    venueId: venue.id,
    opponentId: oppList[0],
    opponentList: oppList,
    partnerId: state.partnerId,
    isTournament,
    startStack,
    buyIn: venue.buyIn,
    startingRP: state.rp,
    seats,
    stacks: seats.map(() => startStack),
    suspicion: partner ? partner.suspicionFloor : 0,
    handsPlayed: 0,
    cleanShowdownsWon: 0,
    successfulCheats: 0,
    bestHandCat: 0,
    netFromCheats: 0,
    busted: false,
    wormMuted: false,
    wormLastSignal: null,
  };
  state.focus = Math.min(100, state.focus + 10);
  // Show the table preview before dropping into the hand
  showScreen('table-preview');
  updateStatusBar();
  saveState();
}

function takeSeat() {
  if (!state.session) return;
  const venue = D.VENUES.find(v => v.id === state.session.venueId);
  const primaryOpp = D.OPPONENTS[state.session.opponentList[0]];
  const partner = state.partnerId ? D.PARTNERS[state.partnerId] : null;
  const partnerSits = partner && partner.sitsAtTable !== false && partner.profile;
  $('#opp-portrait').style.setProperty('--portrait-tint', primaryOpp.portraitTint);
  $('#opp-name').textContent = primaryOpp.name;
  setupPortraitArea($('#opp-face'), primaryOpp);
  setupWormPanel(partnerSits ? partner : null);
  setupOpponentLayout();
  showScreen('poker');
  startNewHand(true);
  saveState();
}

// Convenience: indices for hero / partner / opponent given current session
function heroIdx()    { return 0; }
function partnerIdx() { return state.session.seats.findIndex(s => s.kind === 'partner'); }
function opponentIdx(){ return state.session.seats.findIndex(s => s.kind === 'opponent'); }
function allOpponentIdxs() { return state.session.seats.map((s, i) => ({ s, i })).filter(({ s }) => s.kind === 'opponent').map(({ i }) => i); }
function allTableNonHeroIdxs() { return state.session.seats.map((s, i) => ({ s, i })).filter(({ s }) => s.kind !== 'hero').map(({ i }) => i); }
function isHeroTurn() { return hand && hand.toActIdx === 0; }
function isMultiOpp() { return allTableNonHeroIdxs().length > 1; }

let hand = null;
let raiseAmount = 0;
let pendingShowdown = false;

function startNewHand(firstHand) {
  const venue = D.VENUES.find(v => v.id === state.session.venueId);
  const oppIdxs = allOpponentIdxs();

  if (state.session.isTournament) {
    if (state.session.stacks[heroIdx()] <= 0) {
      state.session.busted = true;
      return endSession();
    }
    // Tournament victory = all opponents busted
    const opponentsLeft = oppIdxs.some(i => state.session.stacks[i] > 0);
    if (!opponentsLeft) {
      state.session.tournamentWin = true;
      return endSession();
    }
  } else {
    if (state.session.stacks[heroIdx()] <= 0) {
      if (state.cash >= venue.buyIn) {
        state.cash -= venue.buyIn;
        state.session.stacks[heroIdx()] = venue.buyIn;
      } else {
        state.session.busted = true;
        return endSession();
      }
    }
    // Cash: re-buy each busted opponent silently (some +RP only for first KO each)
    let firstKO = false;
    oppIdxs.forEach(i => {
      if (state.session.stacks[i] <= 0) {
        state.session.stacks[i] = venue.buyIn;
        if (!firstKO) { state.rp += 30; firstKO = true; }
      }
    });
    if (firstKO) setBanner('KO — opponent re-buys. +30 RP.', 'good');
    const pIdx = partnerIdx();
    if (pIdx >= 0 && state.session.stacks[pIdx] <= 0) {
      state.session.stacks[pIdx] = venue.buyIn;
    }
  }

  state.session.handsPlayed++;
  state.handsPlayedTotal++;

  // Build players[] for the engine. Stacks are pulled from session.
  const players = state.session.seats.map((s, i) => ({
    id: s.id,
    name: s.name,
    profile: s.profile || null,
    stack: state.session.stacks[i],
  }));
  // Button rotates each hand around the table.
  const buttonIndex = (state.session.handsPlayed - 1) % players.length;

  hand = P.createHand({
    players,
    smallBlind: venue.blinds.small,
    bigBlind: venue.blinds.big,
    buttonIndex,
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
  // Multi-opp: greet from the primary villain
  if (isMultiOpp()) {
    const primaryIdx = allOpponentIdxs()[0];
    pushDialog(primaryIdx, 'hand_start');
  }
  fireWormSignal('preflop');
  scheduleAITurn();
}

function syncStacksFromHand() {
  if (!hand || !state.session) return;
  hand.seats.forEach((s, i) => { state.session.stacks[i] = s.stack; });
}

function renderFight() {
  if (!hand) return;
  const startStack = state.session.startStack;
  const oIdx = opponentIdx();
  const pIdx = partnerIdx();

  // Hero + opponent chip bars. In multi-opp, the left header switches to a
  // venue/table summary instead of any single opponent.
  $('#hero-chips-label').textContent = dollars(hand.seats[heroIdx()].stack);
  $('#hero-chips-bar').style.width = Math.max(0, Math.min(100, (hand.seats[heroIdx()].stack / startStack) * 100)) + '%';
  if (isMultiOpp()) {
    // Top-left header tracks the focused (= most recent or current) player
    const fIdx = state.session.focusedOppIdx ?? allOpponentIdxs()[0];
    const fSeat = hand.seats[fIdx];
    if (fSeat) {
      $('#opp-name').textContent = fSeat.name;
      $('#opp-chips-label').textContent = dollars(fSeat.stack);
      const oppBar = $('#opp-chips-bar');
      if (oppBar) oppBar.style.width = Math.max(0, Math.min(100, (fSeat.stack / startStack) * 100)) + '%';
    }
  } else {
    $('#opp-chips-label').textContent = dollars(hand.seats[oIdx].stack);
    $('#opp-chips-bar').style.width  = Math.max(0, Math.min(100, (hand.seats[oIdx].stack / startStack) * 100)) + '%';
  }

  $('#pot-amount').textContent = dollars(hand.pot);
  $('#hand-status').textContent = streetLabel(hand.street);
  $('#focus-fill').style.width = state.focus + '%';
  $('#focus-label').textContent = state.focus + '%';
  $('#suspicion-fill').style.width = Math.round(state.session.suspicion * 100) + '%';
  $('#suspicion-pct').textContent = Math.round(state.session.suspicion * 100) + '%';

  // Community + hero hole cards
  $('#community-row').innerHTML = '';
  for (let i = 0; i < 5; i++) {
    if (hand.board[i]) $('#community-row').appendChild(makeCardEl(hand.board[i]));
    else $('#community-row').appendChild(makePlaceholderEl());
  }
  $('#hole-row').innerHTML = '';
  hand.seats[heroIdx()].hole.forEach(c => $('#hole-row').appendChild(makeCardEl(c)));

  // Worm panel updates
  renderWormPanel();

  // Opponent area: single big portrait vs. multi-opp felt seats + namecard
  if (isMultiOpp()) {
    // Auto-follow the current actor when it's NOT the hero
    if (!hand.finished) {
      const cur = hand.toActIdx;
      const curSeat = state.session.seats[cur];
      if (curSeat && curSeat.kind !== 'hero') {
        state.session.focusedOppIdx = cur;
      }
    }
    renderFeltSeats();
    renderFocusedOppLeftRail();
    $('#opp-portrait').classList.remove('to-act');
  } else {
    $('#opp-portrait').classList.toggle('to-act', hand.toActIdx === oIdx);
  }
  const wormPortrait = $('#worm-portrait');
  if (wormPortrait) wormPortrait.classList.toggle('to-act', pIdx >= 0 && hand.toActIdx === pIdx);

  renderActionBar();
  renderTellFeed();
  refreshOpponentMood();
  refreshWormMood();
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
  if (hand.finished || !isHeroTurn()) return;
  const venue = D.VENUES.find(v => v.id === state.session.venueId);
  const acts = P.legalActions(hand, 0);
  const owed = P.callAmount(hand, 0);

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

  // Cheating — Peek and Muck. Only the dealer touches the deck, so these are
  // only available when the hero seat (0) holds the button this hand.
  const heroIsDealer = hand.buttonIndex === heroIdx();
  const cheatPeek = document.createElement('button');
  cheatPeek.className = 'action-btn cheat';
  const peekRisk = Math.round(cheatRiskPct('peek') * 100);
  cheatPeek.innerHTML = `<span>CHEAT: PEEK DECK</span><span class="key">${heroIsDealer ? peekRisk + '% risk' : 'DEALER ONLY'}</span>`;
  cheatPeek.disabled = !heroIsDealer || venue.cheatingRisk === 'extreme' || hand.street !== 'preflop';
  cheatPeek.addEventListener('click', cheatPeekTopCard);
  bar.appendChild(cheatPeek);

  const muckBtn = document.createElement('button');
  muckBtn.className = 'action-btn cheat';
  const muckRisk = Math.round(cheatRiskPct('muck') * 100);
  muckBtn.innerHTML = `<span>CHEAT: MUCK CARD</span><span class="key">${heroIsDealer ? muckRisk + '% risk' : 'DEALER ONLY'}</span>`;
  muckBtn.disabled = !heroIsDealer || !!state.sleeveCard || venue.cheatingRisk === 'extreme' || hand.street !== 'preflop';
  muckBtn.addEventListener('click', cheatMuckCard);
  bar.appendChild(muckBtn);
}

// ---------- Opponent layout (single big portrait vs. multi-opp stack) -------

function setupOpponentLayout() {
  const portrait = $('#opp-portrait');
  if (isMultiOpp()) {
    portrait.classList.add('multi-opp');
    state.session.focusedOppIdx = allOpponentIdxs()[0];
    // Inner content is rendered per-focus by renderFocusedOppLeftRail
    state.session.leftRailMode = null;
  } else {
    portrait.classList.remove('multi-opp');
    portrait.innerHTML = `
      <div class="portrait-face" id="opp-face"></div>
      <div class="tell-feed" id="tell-feed">
        <span class="tell-marker">// Visual Feed</span>
        <span id="tell-text">He waits. Stone-faced.</span>
      </div>
    `;
    const primaryOpp = D.OPPONENTS[state.session.opponentList[0]];
    setupPortraitArea($('#opp-face'), primaryOpp);
  }
}

// Look up the character definition (opp or partner) for a given seat.
function characterFor(sessionSeat) {
  if (!sessionSeat) return null;
  if (sessionSeat.kind === 'partner') return D.PARTNERS[state.partnerId] || null;
  return D.OPPONENTS[sessionSeat.opponentId] || null;
}

// Render the left rail for the focused player. Picks portrait-sheet mode
// (Joey's faces, Worm's faces) when available, else stylised namecard.
function renderFocusedOppLeftRail() {
  if (!isMultiOpp()) return;
  const idx = state.session.focusedOppIdx;
  if (idx == null) return;
  const sessionSeat = state.session.seats[idx];
  if (!sessionSeat) return;
  const oppDef = characterFor(sessionSeat) || {};
  const portrait = $('#opp-portrait');
  const wantMode = (oppDef.portraitDir && oppDef.portraitMoods) ? 'portrait' : 'namecard';
  const lastIdx = state.session.lastLeftRailIdx;
  // Re-render only when focused opp changes (avoids reloading <img>s)
  if (state.session.leftRailMode !== wantMode || lastIdx !== idx) {
    if (wantMode === 'portrait') {
      portrait.style.setProperty('--portrait-tint', sessionSeat.portraitTint);
      portrait.innerHTML = `
        <div class="portrait-face" id="opp-face"></div>
        <div class="dialog-bubble">
          <span class="dialog-speaker" id="dialog-speaker"></span>
          <span class="dialog-text" id="dialog-text"></span>
        </div>
      `;
      setupPortraitArea($('#opp-face'), oppDef);
    } else {
      portrait.innerHTML = `
        <div class="opp-namecard" id="opp-namecard">
          <span class="nc-initials"></span>
          <span class="nc-name"></span>
          <span class="nc-label"></span>
        </div>
        <div class="dialog-bubble">
          <span class="dialog-speaker" id="dialog-speaker"></span>
          <span class="dialog-text" id="dialog-text"></span>
        </div>
      `;
      const nc = $('#opp-namecard');
      if (nc) nc.style.setProperty('--portrait-tint', sessionSeat.portraitTint || '#3a2a1a');
      const initials = initialsFor(sessionSeat.name);
      nc.querySelector('.nc-initials').textContent = initials;
      nc.querySelector('.nc-name').textContent = sessionSeat.name;
      nc.querySelector('.nc-label').textContent = oppDef.label || '';
    }
    state.session.leftRailMode = wantMode;
    state.session.lastLeftRailIdx = idx;
  }
  // Refresh mood if portrait-sheet mode
  if (wantMode === 'portrait') refreshOpponentMood();
}

function renderFeltSeats() {
  const felt = document.querySelector('.felt');
  if (!felt || !hand) return;
  const idxs = allTableNonHeroIdxs();
  felt.dataset.opps = idxs.length;
  // Remove old seats
  Array.from(felt.querySelectorAll('.felt-seat')).forEach(el => el.remove());
  idxs.forEach((i, pos) => {
    const seat = hand.seats[i];
    const sessionSeat = state.session.seats[i];
    const lastEvt = [...hand.history].reverse().find(h => h.idx === i && h.street === hand.street);
    const lastLabel = lastEvt ? ({ raise: `RAISE ${dollars(lastEvt.amount)}`, call: `CALL ${dollars(lastEvt.amount)}`, fold: 'FOLD', check: 'CHECK' })[lastEvt.type] : '';
    const isToAct = !hand.finished && hand.toActIdx === i;
    const isBtn = hand.buttonIndex === i;
    const isSB = hand.sbIdx === i;
    const isBB = hand.bbIdx === i;
    const pip = isBtn ? 'BTN' : isSB ? 'SB' : isBB ? 'BB' : null;
    const el = document.createElement('div');
    el.className = 'felt-seat'
      + (seat.folded ? ' folded' : '')
      + (isToAct ? ' to-act' : '')
      + (seat.bet > 0 ? ' has-bet' : '')
      + (lastEvt ? ' acted' : '');
    el.dataset.pos = pos + 1;
    el.dataset.seatIdx = i;
    el.innerHTML = `
      ${pip ? `<div class="seat-btn-pip">${pip}</div>` : ''}
      <div class="seat-name">${seat.name}</div>
      <div class="seat-cards">${seat.folded ? '' : '<div class="seat-card"></div><div class="seat-card"></div>'}</div>
      <div class="seat-stack">${dollars(seat.stack)}</div>
      <div class="seat-bet">${seat.bet > 0 ? dollars(seat.bet) : ''}</div>
      ${lastEvt ? `<div class="seat-last-action">${lastLabel}</div>` : ''}
    `;
    el.addEventListener('click', () => setFocusedOpp(i));
    felt.appendChild(el);
  });
}

function setFocusedOpp(idx) {
  if (!state.session) return;
  state.session.focusedOppIdx = idx;
  renderFocusedOppNamecard();
}

function renderFocusedOppNamecard() { renderFocusedOppLeftRail(); }

function pushDialog(idx, situation) {
  if (!isMultiOpp()) return;
  const sessionSeat = state.session.seats[idx];
  if (!sessionSeat) return;
  const charDef = characterFor(sessionSeat);
  const line = D.pickDialog(charDef, situation);
  if (!line) return;
  setFocusedOpp(idx);
  speakDialog(sessionSeat.name, line);
}

// Force a line into the dialog bubble (for Worm signals, etc.) regardless of
// dialog dictionary lookup.
function speakLine(idx, line) {
  if (!isMultiOpp() || !line) return;
  const sessionSeat = state.session.seats[idx];
  if (!sessionSeat) return;
  setFocusedOpp(idx);
  // Re-render the left rail in case focus changed character type
  renderFocusedOppLeftRail();
  speakDialog(sessionSeat.name, line);
}

function speakDialog(speaker, line) {
  const speakerEl = $('#dialog-speaker');
  const textEl = $('#dialog-text');
  if (speakerEl) speakerEl.textContent = speaker;
  if (textEl) {
    textEl.classList.remove('fade');
    void textEl.offsetWidth;
    textEl.classList.add('fade');
    textEl.textContent = line;
  }
}

// ---------- Opponent portrait + mood (single-opp big portrait) ---------------

function setupPortraitArea(face, character) {
  face.innerHTML = '';
  if (character && character.portraitDir && character.portraitMoods) {
    character.portraitMoods.forEach(mood => {
      const img = document.createElement('img');
      img.className = 'face-mood';
      img.dataset.mood = mood;
      img.src = character.portraitDir + mood + '.jpg';
      img.alt = '';
      face.appendChild(img);
    });
    setMoodOn(face, 'neutral');
  } else if (character) {
    face.textContent = initialsFor(character.name);
    face.style.fontSize = '';
  }
}

function initialsFor(name) {
  if (!name) return '?';
  const words = name.split(' ').filter(w => w.length > 1 && !/^["'(]/.test(w));
  if (!words.length) return name.slice(0, 2).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

function setMoodOn(face, mood) {
  const imgs = face.querySelectorAll('img.face-mood');
  if (!imgs.length) return;
  imgs.forEach(img => img.classList.toggle('active', img.dataset.mood === mood));
}
function setMood(mood)     { setMoodOn($('#opp-face'), mood); }
function setWormMood(mood) { const f = $('#worm-face'); if (f) setMoodOn(f, mood); }

// ---------- Worm panel + signaling -----------------------------------------

// Wire the compact Worm side panel (right rail) + preload his portraits.
function setupWormPanel(partner) {
  const panel = $('#worm-side-panel');
  const btn = $('#worm-stop-btn');
  if (!panel || !btn) return;
  if (!partner) {
    panel.style.display = 'none';
    return;
  }
  panel.style.display = 'flex';
  panel.classList.toggle('muted', !!state.session.wormMuted);
  // Preload portraits in the side panel
  const portrait = $('#ws-portrait');
  portrait.innerHTML = '';
  partner.portraitMoods.forEach(mood => {
    const img = document.createElement('img');
    img.className = 'face-mood';
    img.dataset.mood = mood;
    img.src = partner.portraitDir + mood + '.jpg';
    img.alt = '';
    portrait.appendChild(img);
  });
  setMoodOn(portrait, 'waiting');
  $('#ws-signal').textContent = 'Watching the table.';
  btn.disabled = state.session.wormMuted;
  btn.textContent = state.session.wormMuted ? 'Signals muted' : 'Tell Worm to cool it';
  btn.onclick = () => {
    state.session.wormMuted = true;
    btn.disabled = true;
    btn.textContent = 'Signals muted';
    panel.classList.add('muted');
    $('#ws-signal').textContent = 'You caught his eye. He nods. No more signals.';
    const pIdx = partnerIdx();
    if (pIdx >= 0) speakLine(pIdx, 'You catch his eye. He nods. No more signals.');
    saveState();
  };
}

function renderWormPanel() {
  const pIdx = partnerIdx();
  const stackEl = $('#ws-stack');
  if (pIdx >= 0 && hand && stackEl) {
    stackEl.textContent = dollars(hand.seats[pIdx].stack);
  }
}

// Update the side panel when Worm signals — mood + line + pulse
function flashWormSidePanel(signal) {
  const panel = $('#worm-side-panel');
  const portrait = $('#ws-portrait');
  if (!panel || !portrait) return;
  setMoodOn(portrait, signal.mood);
  $('#ws-signal').textContent = signal.text;
  panel.classList.remove('signaling');
  void panel.offsetWidth;
  panel.classList.add('signaling');
}

function fireWormSignal(streetName) {
  const pIdx = partnerIdx();
  if (pIdx < 0 || !hand) return;
  if (state.session.wormMuted) return;
  const partner = D.PARTNERS[state.session.partnerId];
  const worm = hand.seats[pIdx];

  // Determine Worm's hand strength bucket
  let bucket;
  if (streetName === 'preflop' || hand.board.length === 0) {
    bucket = D.classifyWormHand(worm.hole, []);
  } else {
    const eq = P.estimateEquity(worm.hole, hand.board, 80);
    if (eq > 0.7) bucket = 'monster';
    else if (eq > 0.55) bucket = 'strong';
    else if (eq > 0.4) bucket = 'decent';
    else if (eq > 0.25) bucket = 'draw';
    else if (eq > 0.12) bucket = 'weak';
    else bucket = 'air';
  }
  const sig = D.WORM_SIGNALS[bucket] || D.WORM_SIGNALS.weak;
  state.session.wormLastSignal = sig;
  state.session.suspicion = Math.min(1, state.session.suspicion + (partner.suspicionPerSignal || 0));
  // Right-rail side panel: pulse + mood update + signal line
  flashWormSidePanel(sig);
  // Left rail: also push focus to Worm with the signal as his dialog bubble line
  speakLine(pIdx, sig.text);
}

// Mood picker — driven by live hand state, suspicion, last opp action, equity.
function refreshOpponentMood() {
  if (isMultiOpp()) return; // mini-card mode doesn't use the mood portraits
  if (!$('#opp-face')) return;
  const opp = D.OPPONENTS[state.session?.opponentId];
  if (!opp || !opp.portraitMoods) return;
  const oIdx = opponentIdx();

  // Suspicion takes precedence
  const susp = state.session.suspicion || 0;
  if (susp >= 0.55) return setMood('suspicious');
  if (susp >= 0.30) return setMood('angry');

  if (!hand) return setMood('neutral');

  if (hand.finished) {
    if (hand.winnerIdxs.includes(oIdx)) return setMood('confident');
    const lastOpp = [...hand.history].reverse().find(h => h.idx === oIdx);
    if (lastOpp && lastOpp.type === 'fold') return setMood('resigned');
    return setMood('defeated');
  }

  const oppSeat = hand.seats[oIdx];
  const equity = P.estimateEquity(oppSeat.hole, hand.board, 80);

  const lastOpp = [...hand.history].reverse().find(h => h.idx === oIdx && h.street === hand.street);
  if (lastOpp) {
    if (lastOpp.type === 'raise') return setMood(equity > 0.55 ? 'confident' : 'observing');
    if (lastOpp.type === 'fold')  return setMood('resigned');
    if (lastOpp.type === 'call' && lastOpp.amount > hand.bigBlind * 4) {
      return setMood(equity > 0.5 ? 'observing' : 'anxious');
    }
  }

  if (hand.toActIdx === oIdx) return setMood('thinking');

  if (equity > 0.7)  return setMood('confident');
  if (equity > 0.45) return setMood('observing');
  if (equity > 0.25) return setMood('uncertain');
  return setMood('anxious');
}

// Worm mood reacts to his own hand strength and signaling state.
function refreshWormMood() {
  const pIdx = partnerIdx();
  if (pIdx < 0) return;
  const partner = D.PARTNERS[state.session.partnerId];
  if (!partner.portraitMoods) return;
  if (!hand) return setWormMood('neutral');
  if (hand.finished) {
    if (hand.winnerIdxs.includes(pIdx)) return setWormMood('happy');
    const last = [...hand.history].reverse().find(h => h.idx === pIdx);
    if (last && last.type === 'fold') return setWormMood('resigned');
    return setWormMood('focused');
  }
  if (state.session.suspicion >= 0.6) return setWormMood('shocked');
  if (hand.toActIdx === pIdx) return setWormMood('focused');
  // Match the last signal pose if we just signaled
  if (state.session.wormLastSignal && !state.session.wormMuted) {
    return setWormMood(state.session.wormLastSignal.mood);
  }
  return setWormMood('waiting');
}

function renderTellFeed() {
  const tellEl = $('#tell-text');
  if (!tellEl) return; // multi-opp mode: no tell feed
  const tell = P.aiTell(hand, opponentIdx());
  tellEl.textContent = tell ? tell.text : 'He waits. Stone-faced.';
}

// ---------- Inner monologue --------------------------------------------------

function pushIntrusion(voiceKey, text) {
  const voice = D.VOICES[voiceKey];
  if (!voice) return;
  const klass = voiceKey === 'CALCULATOR' ? 'calc'
    : voiceKey === 'SHARK' ? 'shark'
    : voiceKey === 'WIRE' ? 'wire'
    : voiceKey === 'DISCIPLE' ? 'disciple' : 'sweat';
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
  if (!hand || !isHeroTurn()) return;
  const heroSeat = hand.seats[heroIdx()];
  const equity = P.estimateEquity(heroSeat.hole, hand.board, 200);
  const owed = P.callAmount(hand, 0);
  const potOdds = owed / (hand.pot + owed || 1);
  const tell = P.aiTell(hand, opponentIdx());
  const debt = state.loan ? state.loan.total : 0;
  const ctx = {
    equity, owed, potOdds,
    pot: hand.pot, stack: heroSeat.stack, debt, tell,
    heroHole: heroSeat.hole, board: hand.board,
    heroBest: heroSeat.best || (hand.street === 'river' ? P.bestFiveOfSeven([...heroSeat.hole, ...hand.board]) : null),
    street: hand.street,
  };

  const psy = state.psyche;
  const voicesByStat = {
    CALCULATOR: (psy.calculator || 0) / 5,
    SHARK:      (psy.shark      || 0) / 5,
    WIRE:       (psy.wire       || 0) / 5,
    COLD_SWEAT: (psy.sweat      || 0) / 5,
    DISCIPLE:   (psy.disciple   || 0) / 5,
  };
  const lineup = [];
  if (Math.random() < voicesByStat.CALCULATOR) lineup.push('CALCULATOR');
  if (state.loan && Math.random() < voicesByStat.COLD_SWEAT) lineup.push('COLD_SWEAT');
  else if (Math.random() < voicesByStat.COLD_SWEAT * 0.7) lineup.push('COLD_SWEAT');
  if (equity > 0.55 && Math.random() < voicesByStat.SHARK) lineup.push('SHARK');
  if (tell && Math.random() < voicesByStat.WIRE) lineup.push('WIRE');
  // The Disciple chimes in more often pre-flop and on the river.
  const discProb = voicesByStat.DISCIPLE * (hand.street === 'preflop' ? 0.85 : hand.street === 'river' ? 0.75 : 0.35);
  if (Math.random() < discProb) lineup.push('DISCIPLE');

  if (!lineup.length) {
    const picks = ['CALCULATOR', 'SHARK', 'WIRE', 'COLD_SWEAT', 'DISCIPLE'];
    lineup.push(picks[Math.floor(Math.random() * picks.length)]);
  }
  // Cap at 2 voices per moment, stagger
  lineup.slice(0, 2).forEach((v, i) => {
    setTimeout(() => {
      const voice = D.VOICES[v];
      if (voice) pushIntrusion(v, voice.speak(ctx));
    }, i * 320);
  });
}

// ---------- Player + AI action loop -----------------------------------------

function playerAct(action) {
  if (!hand || hand.finished) return;
  if (!isHeroTurn()) return;
  const prevStreet = hand.street;
  P.applyAction(hand, action);
  syncStacksFromHand();
  if (hand.finished) return resolveHand();
  if (hand.street !== prevStreet) fireWormSignal(hand.street);
  renderFight();
  if (!isHeroTurn()) scheduleAITurn();
  else fireIntrusionsForState();
}

function scheduleAITurn() {
  if (!hand || hand.finished || isHeroTurn()) return;
  renderFight();
  setTimeout(() => {
    if (!hand || hand.finished || isHeroTurn()) return;
    const idx = hand.toActIdx;
    const prevStreet = hand.street;
    const action = P.aiDecide(hand, idx);
    P.applyAction(hand, action);
    syncStacksFromHand();
    flashAIAction(action, idx);
    if (hand.finished) return resolveHand();
    if (hand.street !== prevStreet) fireWormSignal(hand.street);
    renderFight();
    if (!isHeroTurn()) scheduleAITurn();
    else fireIntrusionsForState();
  }, 900);
}

function flashAIAction(action, idx) {
  const name = state.session.seats[idx].name;
  let line = '';
  if (action.type === 'fold')  line = `${name} folds.`;
  if (action.type === 'check') line = `${name} taps the felt.`;
  if (action.type === 'call')  line = `${name} calls ${dollars(action.amount)}.`;
  if (action.type === 'raise') line = `${name} raises ${dollars(action.amount)}.`;
  // Single-opp: surface in tell feed. Multi-opp: per-card last-action handles it.
  if (idx === opponentIdx() && !isMultiOpp()) {
    const tellEl = $('#tell-text');
    if (tellEl) tellEl.textContent = line;
  }
  if (idx === partnerIdx()) {
    const w = $('#worm-action');
    if (w) w.textContent = line;
  }
  // Multi-opp: speaker dialog for any non-hero seat
  const seat = state.session.seats[idx];
  if (isMultiOpp() && seat && seat.kind !== 'hero') {
    const situation = action.type === 'raise' ? 'raised'
      : action.type === 'call'  ? 'called'
      : action.type === 'fold'  ? 'folded'
      : 'neutral';
    pushDialog(idx, situation);
  }
}

// ---------- Special abilities and cheats ------------------------------------

function readIntent() {
  if (state.focus < 20) return;
  state.focus -= 20;
  const oppSeat = hand.seats[opponentIdx()];
  const eq = P.estimateEquity(oppSeat.hole, hand.board, 250);
  const oppEquity = 1 - eq; // Their equity vs hero
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
  if (hand.buttonIndex !== heroIdx()) {
    setBanner('Only the dealer can touch the deck.', 'bad');
    return;
  }
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
  if (!hand || hand.buttonIndex !== heroIdx()) {
    setBanner('Only the dealer can muck a card.', 'bad');
    return;
  }
  const risk = cheatRiskPct('muck');
  state.session.suspicion = Math.min(1, state.session.suspicion + 0.22);
  if (Math.random() < risk) return cheatBusted();
  const hero = hand.seats[heroIdx()];
  const idx = hero.hole[0].rank >= hero.hole[1].rank ? 0 : 1;
  state.sleeveCard = { ...hero.hole[idx] };
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
  state.session.stacks[heroIdx()] = 0;
  endSession();
}

// ---------- Hand resolution --------------------------------------------------

function resolveHand() {
  renderFight();
  const heroSeat = hand.seats[heroIdx()];

  // Update session bookkeeping
  if (hand.winnerIdxs.includes(heroIdx())) state.session.cleanShowdownsWon++;
  if (heroSeat.best) state.session.bestHandCat = Math.max(state.session.bestHandCat, heroSeat.best.category);

  // For showdown display, pick the most relevant "villain" — the winning non-hero,
  // or the best-handed live non-hero, falling back to the first opponent.
  const villains = hand.seats.map((s, i) => ({ s, i })).filter(({ i }) => i !== heroIdx());
  let villainPick = null;
  const winningVillain = villains.find(({ i }) => hand.winnerIdxs.includes(i));
  if (winningVillain) villainPick = winningVillain;
  else {
    const showdownVillains = villains.filter(({ s }) => s.best).sort((a, b) => P.compareScores(b.s.best.score, a.s.best.score));
    villainPick = showdownVillains[0] || villains.find(({ s }) => s.kind === 'opponent') || villains[0];
  }
  const oppSeat = villainPick.s;

  pendingShowdown = true;
  const sd = $('#showdown');
  const heroWon = hand.winnerIdxs.includes(heroIdx());
  const split = hand.winnerIdxs.length > 1 && heroWon;
  $('#showdown-title').textContent = split ? 'Split Pot' : (heroWon ? 'You Take The Pot' : `Pot Goes To ${oppSeat.name}`);
  $('#showdown-reason').textContent = hand.reason;
  const ho = $('#showdown-opp');
  const hh = $('#showdown-hero');
  ho.innerHTML = ''; hh.innerHTML = '';
  const wentToShowdown = !!oppSeat.best;
  heroSeat.hole.forEach(c => hh.appendChild(makeCardEl(c)));
  oppSeat.hole.forEach(c => {
    const el = wentToShowdown ? makeCardEl(c) : (() => { const x = makeCardEl(c); x.classList.add('back'); x.innerHTML = ''; return x; })();
    ho.appendChild(el);
  });
  $('#showdown-hero-name').textContent = heroSeat.best ? heroSeat.best.name : '—';
  $('#showdown-opp-name').textContent  = oppSeat.best && wentToShowdown ? `${oppSeat.name} — ${oppSeat.best.name}` : `${oppSeat.name} — Mucked`;
  sd.classList.remove('hidden');
  // Multi-opp: winner says their line, focus the relevant villain
  if (isMultiOpp()) {
    if (heroWon) {
      // Have the displayed villain react to losing
      if (villainPick.s.kind === 'opponent') pushDialog(villainPick.i, 'lost');
    } else {
      // Winner is non-hero — they speak
      const winnerIdx = hand.winnerIdxs[0];
      const winnerSeat = hand.seats[winnerIdx];
      if (winnerSeat?.kind === 'opponent') pushDialog(winnerIdx, 'won');
    }
  }
  $('#next-hand-btn').onclick = () => {
    if (state.session.stacks[heroIdx()] <= 0) return endSession();
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
    cashReturned = state.session.stacks[heroIdx()];
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
    state.partnerId = null;
    enterVenue(D.VENUES.find(v => v.id === 'firehouse'));
    return;
  }
  if (stage === 'poker-worm') {
    // Three-handed demo at the Deli with Worm as partner.
    state.cash = 800; state.rp = 60;
    state.partnerId = 'worm';
    enterVenue(D.VENUES.find(v => v.id === 'deli'));
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
