// Turns a completed state + seed into a concrete design variant,
// then renders a mockup card that visualises that variant.
// Reroll = same state, new seed. History log keeps previous variants.

import { steps } from './schema.js';

function getTypePairOption(value) {
  const field = steps.flatMap(s => s.fields).find(f => f.id === 'typePair');
  if (!field) return null;
  return field.options.find(o => o.value === value) || field.options[0];
}

// Fallback palettes per visual tone (mirror the schema values).
const FALLBACK_PALETTES = {
  'brutally-minimal': ['#f7f6f3', '#e6e3dc', '#1a1a1a', '#8a8680', '#c3392e'],
  'warm-editorial': ['#edecea', '#c7a17a', '#1c4831', '#b03a2e', '#c49a02'],
  'maximalist': ['#f5e9d7', '#ff5a1f', '#6a2cd6', '#19b67a', '#1a1a1a'],
  'retro-futurist': ['#0c1a2b', '#1f3a5f', '#e7c85c', '#d94e4e', '#a3b8c9'],
  'organic': ['#ece5d4', '#a8b893', '#4b5a3e', '#c28e4a', '#2e3324'],
  'luxury': ['#181613', '#e9dfd1', '#b69660', '#3a332d', '#7a6a52'],
  'playful': ['#fff4c2', '#ff6b9d', '#4cc2ff', '#3a3a3a', '#76e085'],
  'brutalist': ['#d9d7d2', '#0a0a0a', '#e64b1e', '#f2f0eb', '#9c9892'],
  'art-deco': ['#1a1a1a', '#c9a243', '#e9e1c9', '#6b1f2a', '#2e4a3a'],
  'soft-pastel': ['#fbeef0', '#f5d0d9', '#cbe2d9', '#d4c9e8', '#4a4156'],
  'industrial': ['#b8b3ab', '#3f4448', '#1a1d20', '#d9d4cb', '#c94a1f'],
  'technical': ['#ffffff', '#e5e5e5', '#1a1a1a', '#0057b7', '#d1d1d1'],
};

// Tiny seeded PRNG (mulberry32) for deterministic variants.
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = seed;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function pick(rand, arr) { return arr[Math.floor(rand() * arr.length)]; }

function relLuminance(hex) {
  const m = hex.replace('#', '').match(/.{1,2}/g);
  if (!m) return 0.5;
  const [r, g, b] = m.map(h => {
    const c = parseInt(h, 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Derive a full variant from state + seed.
export function deriveVariant(state, seed) {
  const rand = mulberry32(seed);
  const toneKey = state.visualTone || 'warm-editorial';
  const palette = FALLBACK_PALETTES[toneKey] || FALLBACK_PALETTES['warm-editorial'];

  // Sort palette by luminance so we have predictable bg/ink choices,
  // then let the seed decide which to use for surface/accent.
  const sorted = [...palette].sort((a, b) => relLuminance(a) - relLuminance(b));
  const theme = state.theme || 'light';
  const darks = sorted.slice(0, 2);
  const lights = sorted.slice(-2);
  const mids = sorted.slice(1, 4);

  let bg, ink, surface, accent, muted;
  if (theme === 'dark' || (theme === 'both' && rand() < 0.5)) {
    bg = pick(rand, darks);
    ink = pick(rand, lights);
    surface = darks[1] || darks[0];
    muted = mids[Math.floor(rand() * mids.length)];
  } else {
    bg = pick(rand, lights);
    ink = pick(rand, darks);
    surface = lights[0];
    muted = mids[Math.floor(rand() * mids.length)];
  }

  // Accent: a mid swatch that is not bg/ink.
  const accentCandidates = palette.filter(c => c !== bg && c !== ink && c !== surface);
  accent = accentCandidates.length ? accentCandidates[Math.floor(rand() * accentCandidates.length)] : palette[0];

  // Respect brand hue if provided.
  if (state.brandHue && /^#[0-9a-f]{6}$/i.test(state.brandHue) && rand() < 0.6) {
    accent = state.brandHue;
  }

  const typeOpt = getTypePairOption(state.typePair) || { displayFont: 'Georgia, serif', bodyFont: 'system-ui, sans-serif', displayWeight: 500 };
  const stack = { display: typeOpt.displayFont, body: typeOpt.bodyFont };

  const layouts = ['left', 'centred', 'split'];
  const layout = pick(rand, layouts);

  const radii = [0, 2, 6, 12];
  const radius = pick(rand, radii);

  // Weight: schema-declared typePair weight wins, personality only nudges when not set.
  const personality = (state.personality || []).join(' ').toLowerCase();
  let displayWeight = typeOpt.displayWeight || 500;
  if (!typeOpt.displayWeight) {
    if (/bold|loud|confident|sharp/.test(personality)) displayWeight = 800;
    else if (/quiet|calm|refined|restrained/.test(personality)) displayWeight = 400;
    else if (/warm|handmade|soft/.test(personality)) displayWeight = 500;
  }

  const tracking = /editorial|refined|luxury/.test(personality) ? '-0.03em'
                 : /mechanical|technical|industrial/.test(personality) ? '0'
                 : '-0.015em';

  return {
    seed,
    palette,
    bg, ink, surface, accent, muted,
    displayFont: stack.display,
    bodyFont: stack.body,
    layout, radius, displayWeight, tracking, theme,
    tone: toneKey,
    bans: state.antiPatterns || [],
  };
}

// Render the mockup card HTML for a given variant + brand name.
export function renderMockup(variant, state) {
  const v = variant;
  const displayName = state.displayName || state.projectName || 'Your Brand';
  const desc = state.description || 'A short line describing the offer.';
  const audience = (state.audience || [])[0] || 'professionals';
  const primaryObj = (state.objectives || [])[0] || 'Get in touch';
  const personality = (state.personality || []).join(' / ') || 'considered';

  const swatches = v.palette.map(c => `<span class="mk-swatch" style="background:${c}" title="${c}"></span>`).join('');

  const layoutClass = `mk-layout-${v.layout}`;

  const inkOnAccent = relLuminance(v.accent) > 0.5 ? '#111' : '#fff';

  return `<article class="mk ${layoutClass}" style="
      --mk-bg:${v.bg}; --mk-ink:${v.ink}; --mk-surface:${v.surface};
      --mk-accent:${v.accent}; --mk-muted:${v.muted};
      --mk-radius:${v.radius}px;
      --mk-display:${v.displayFont}; --mk-body:${v.bodyFont};
      --mk-display-weight:${v.displayWeight}; --mk-tracking:${v.tracking};
      --mk-ink-on-accent:${inkOnAccent};
    ">
    <header class="mk-nav">
      <span class="mk-logo">${esc(displayName)}</span>
      <nav class="mk-links"><span>Work</span><span>About</span><span>Contact</span></nav>
    </header>
    <section class="mk-hero">
      <h1 class="mk-display">${esc(displayName)}<br><span class="mk-display-2">${esc(desc)}</span></h1>
      <p class="mk-body">Built for ${esc(audience)}. Tone: ${esc(personality)}.</p>
      <div class="mk-ctas">
        <button class="mk-btn mk-btn-primary">${esc(primaryObj)} →</button>
        <button class="mk-btn mk-btn-secondary">Learn more</button>
      </div>
    </section>
    <section class="mk-card">
      <div class="mk-card-label">Featured</div>
      <div class="mk-card-title">A concrete case study title.</div>
      <div class="mk-card-body">Two lines of body copy set in your chosen pair, giving a taste of the editorial rhythm.</div>
    </section>
    <footer class="mk-footer">
      <div class="mk-palette">${swatches}</div>
      <div class="mk-specimen">
        <span class="mk-specimen-aa">Aa</span>
        <span class="mk-specimen-note">${esc(v.tone)} · radius ${v.radius}px · ${esc(v.layout)}</span>
      </div>
    </footer>
  </article>`;
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function renderMockupThumb(variant) {
  const v = variant;
  const swatches = v.palette.map(c => `<span style="background:${c};flex:1;height:100%;display:block"></span>`).join('');
  return `<div class="log-thumb" style="background:${v.bg};color:${v.ink};border-radius:${Math.min(v.radius, 4)}px">
    <div class="log-thumb-swatches">${swatches}</div>
    <div class="log-thumb-label" style="font-family:${v.displayFont}">Aa · ${v.layout} · ${v.radius}px</div>
  </div>`;
}
