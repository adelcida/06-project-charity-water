// ── Brand colours ──────────────────────────────────────────────────────────
const CW = {
  yellow: '#FFC907',
  navy:   '#003366',
  steel:  '#77A8BB',
  black:  '#1A1A1A',
  terra:  '#BF6C46',
  gray:   '#CBCCD1',
};

// ── Game constants ──────────────────────────────────────────────────────────
const WELL_RATES  = [0, 1, 3, 8];
const WELL_COSTS  = [0, 30, 100, 300];
const WELL_LABELS = ['Empty Lot', 'Basic Well', 'Hand Pump', 'Deep Well'];
const TANK_MAX    = 200;

const FACTS = [
  { stat: '2.2 Billion', body: 'people worldwide lack access to safely managed drinking water.',              source: 'WHO/UNICEF' },
  { stat: '6 Hours',     body: 'average daily time women & girls spend collecting water in sub-Saharan Africa.', source: 'UN Water'   },
  { stat: '1,000+',      body: 'children under 5 die every day from illness linked to unsafe water.',         source: 'UNICEF'     },
  { stat: '$4–$12',      body: 'returned for every $1 invested in water and sanitation.',                     source: 'World Bank' },
];

// ── State ───────────────────────────────────────────────────────────────────
let screen              = 'title';
let wells               = Array.from({ length: 6 }, (_, i) => ({ id: i, level: 0 }));
let waterAccumulated    = 0;
let waterCarried        = 0;
let score               = 0;
let coins               = 100;
let totalWaterCollected = 0;
let factIndex           = 0;
let thankYouShown       = false;

// ── Helpers ─────────────────────────────────────────────────────────────────
const $    = id => document.getElementById(id);
const show = el => el.classList.remove('hidden');
const hide = el => el.classList.add('hidden');

// ── Update all 6 well cards ─────────────────────────────────────────────────
// Reads the wells[] array and toggles classes/text on the existing HTML.
// Never builds or injects HTML — everything is already in index.html.
function updateWells() {
  wells.forEach(well => {
    const card     = $(`well-${well.id}`);
    const nextCost = well.level < 3 ? WELL_COSTS[well.level + 1] : null;
    const afford   = nextCost !== null && coins >= nextCost;

    // Border colour via CSS class
    card.className = 'well-card' + (well.level > 0 ? ` level-${well.level}` : '');

    // Show only the icon matching the current level
    card.querySelectorAll('.well-icon').forEach((img, i) => {
      img.classList.toggle('active', i === well.level);
    });

    card.querySelector('.well-max-badge').classList.toggle('hidden', well.level < 3);
    card.querySelector('.well-name').textContent = WELL_LABELS[well.level];

    const rateEl = card.querySelector('.well-rate');
    rateEl.textContent = well.level > 0 ? `+${WELL_RATES[well.level]} L/s` : '';
    rateEl.classList.toggle('hidden', well.level === 0);

    const btn    = card.querySelector('.well-upgrade-btn');
    const maxLbl = card.querySelector('.well-maxed-label');

    if (well.level < 3) {
      show(btn); hide(maxLbl);
      btn.textContent = `${well.level === 0 ? 'Build' : 'Upgrade'} — ${nextCost}¢`;
      btn.disabled    = !afford;
      btn.className   = `well-upgrade-btn ${afford ? 'can-afford' : 'cant-afford'}`;
    } else {
      hide(btn); show(maxLbl);
    }
  });
}

// ── Update score bar, buttons, fill bar ────────────────────────────────────
function updateHUD() {
  const rate    = wells.reduce((s, w) => s + WELL_RATES[w.level], 0);
  const tankPct = Math.min(100, (waterAccumulated / TANK_MAX) * 100);

  $('stat-score').textContent = `${Math.round(score)} L`;
  $('stat-coins').textContent = `${coins} ¢`;
  $('stat-total').textContent = `${Math.round(totalWaterCollected)} L`;
  $('stat-rate').textContent  = `${rate} L/s`;

  wells.every(w => w.level === 3) ? show($('all-maxed-badge')) : hide($('all-maxed-badge'));

  if (totalWaterCollected > 0) {
    show($('efficiency-text'));
    $('efficiency-text').textContent = `efficiency: ${Math.round((score / totalWaterCollected) * 100)}% delivered`;
  }

  $('water-accum').textContent       = Math.round(waterAccumulated);
  $('fill-pct-label').textContent    = `${Math.round(tankPct)}% · max ${TANK_MAX} L`;
  $('fill-bar').style.width          = tankPct + '%';
  $('stat-total-footer').textContent = `${Math.round(totalWaterCollected)} L`;

  // Collect button
  const btnCollect = $('btn-collect');
  btnCollect.disabled         = waterAccumulated <= 0;
  btnCollect.style.background = waterAccumulated > 0 ? CW.steel   : '#F0EDE5';
  btnCollect.style.color      = waterAccumulated > 0 ? '#fff'     : CW.gray;
  btnCollect.style.boxShadow  = waterAccumulated > 0 ? '0 3px 0 rgba(0,51,102,0.3)' : 'none';

  // Carrying badge
  waterCarried > 0 ? show($('carrying-badge')) : hide($('carrying-badge'));
  $('carrying-val').textContent = `${Math.round(waterCarried)} L`;

  // Delivery panel
  $('person-status-title').textContent = waterCarried > 0 ? 'Ready to deliver!'          : 'Waiting for water';
  $('person-status-sub').textContent   = waterCarried > 0 ? `${Math.round(waterCarried)} L to give` : 'collect from tank ←';

  waterCarried > 0 ? show($('conversion-preview')) : hide($('conversion-preview'));
  $('conv-water').textContent = `${Math.round(waterCarried)} L`;
  $('conv-coins').textContent = `+${Math.floor(waterCarried / 2)} ¢`;

  const btnDeliver = $('btn-deliver');
  btnDeliver.disabled         = waterCarried <= 0;
  btnDeliver.style.background = waterCarried > 0 ? CW.yellow : '#F0EDE5';
  btnDeliver.style.color      = waterCarried > 0 ? CW.black  : CW.gray;
  btnDeliver.style.boxShadow  = waterCarried > 0 ? `0 3px 0 ${CW.terra}` : 'none';

  $('stat-delivered-footer').textContent = `${Math.round(score)} L`;
}

// ── Rotate fact cards ────────────────────────────────────────────────────────
function updateFacts() {
  const f   = FACTS[factIndex % FACTS.length];
  const idx = factIndex % FACTS.length;

  $('fact-stat').textContent    = f.stat;
  $('fact-body').textContent    = f.body;
  $('fact-source').textContent  = `— ${f.source}`;
  $('fact-counter').textContent = `QUICK FACT — ${idx + 1} / ${FACTS.length}`;

  $('game-fact-stat').textContent   = f.stat;
  $('game-fact-body').textContent   = f.body;
  $('game-fact-source').textContent = `— ${f.source}`;

  ['fact-dots-title', 'fact-dots-game'].forEach(id => {
    const el = $(id);
    if (el) el.querySelectorAll('.dot, .fact-dot').forEach((dot, i) =>
      dot.classList.toggle('active', i === idx)
    );
  });
}

// ── Screen transitions ───────────────────────────────────────────────────────
function showTitle() {
  screen = 'title';
  show(document.getElementById('screen-title'));
  hide(document.getElementById('screen-game'));
  hide(document.getElementById('modal-thankyou'));
}

function showGame() {
  screen = 'game';
  hide(document.getElementById('screen-title'));
  show(document.getElementById('screen-game'));
  hide(document.getElementById('modal-thankyou'));
  updateWells();
  updateHUD();
}

// ── Game actions ─────────────────────────────────────────────────────────────
function collectWater() {
  if (waterAccumulated <= 0) return;
  const amount     = waterAccumulated;
  waterCarried        += amount;
  totalWaterCollected += amount;
  waterAccumulated     = 0;
  showFlash('collect-flash', 'collect-flash-val', `+${Math.round(amount)} L`, 2500);
  updateHUD();
}

function deliverWater() {
  if (waterCarried <= 0) return;
  const water  = waterCarried;
  const earned = Math.floor(water / 2);
  score        += water;
  coins        += earned;
  waterCarried  = 0;
  $('df-water').textContent = `${Math.round(water)} L`;
  $('df-coins').textContent = `+${earned} ¢`;
  showFlash('delivery-flash', null, null, 3000);
  updateHUD();
  updateWells();
}

function upgradeWell(id) {
  const well = wells.find(w => w.id === id);
  if (!well || well.level >= 3) return;
  const cost = WELL_COSTS[well.level + 1];
  if (coins < cost) return;
  coins      -= cost;
  well.level  = Math.min(3, well.level + 1);
  updateHUD();
  updateWells();
  if (wells.every(w => w.level === 3) && !thankYouShown) {
    thankYouShown = true;
    setTimeout(openModal, 600);
  }
}

function openModal() {
  $('m-score').textContent      = `${Math.round(score)} L`;
  $('m-coins').textContent      = `${coins} ¢`;
  $('m-total').textContent      = `${Math.round(totalWaterCollected)} L`;
  $('m-conv-total').textContent = `${Math.round(totalWaterCollected)} L`;
  $('m-conv-score').textContent = `${Math.round(score)} L`;
  $('m-conv-coins').textContent = `${coins} ¢`;
  show(document.getElementById('modal-thankyou'));
}

function continueGame() {
  thankYouShown = false;
  hide(document.getElementById('modal-thankyou'));
}

function resetGame() {
  wells               = Array.from({ length: 6 }, (_, i) => ({ id: i, level: 0 }));
  waterAccumulated    = 0;
  waterCarried        = 0;
  score               = 0;
  coins               = 100;
  totalWaterCollected = 0;
  thankYouShown       = false;
  hide(document.getElementById('modal-thankyou'));
  showTitle();
}

// ── Flash banner helper ──────────────────────────────────────────────────────
// Shows an element briefly then hides it. Optionally sets a text value first.
function showFlash(elId, valId, text, duration) {
  const el = $(elId);
  if (valId && text) $(valId).textContent = text;
  show(el);
  el.classList.add('anim-fade');
  setTimeout(() => { hide(el); el.classList.remove('anim-fade'); }, duration);
}

// ── Timers ───────────────────────────────────────────────────────────────────
setInterval(() => {
  if (screen !== 'game') return;
  const rate = wells.reduce((s, w) => s + WELL_RATES[w.level], 0);
  if (rate > 0) {
    waterAccumulated = Math.min(TANK_MAX, waterAccumulated + rate);
    updateHUD();
  }
}, 1500);

setInterval(() => { factIndex++; updateFacts(); }, 5000);

// ── Event listeners ──────────────────────────────────────────────────────────
$('btn-start').addEventListener('click', showGame);
$('btn-menu').addEventListener('click', showTitle);
$('btn-collect').addEventListener('click', collectWater);
$('btn-deliver').addEventListener('click', deliverWater);
$('btn-continue').addEventListener('click', continueGame);
$('btn-reset').addEventListener('click', resetGame);
$('main-reset-button').addEventListener('click', resetGame);

document.querySelectorAll('.well-upgrade-btn').forEach(btn => {
  btn.onclick = () => upgradeWell(Number(btn.closest('[data-id]').dataset.id));
});

// ── Boot ─────────────────────────────────────────────────────────────────────
updateFacts();
showTitle();