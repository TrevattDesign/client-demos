import { steps, presets } from './schema.js';
import { generateMarkdown } from './generator.js';
import { deriveVariant, renderMockup, renderMockupThumb } from './preview.js';
import { fetchClarifyQuestions, getApiKey, setApiKey } from './clarify.js';

const CLARIFY_STEP = steps.length;       // hidden interstitial
const REVIEW_STEP = steps.length + 1;    // final review

let currentVariant = null;
let variantHistory = [];

const state = loadState() || {};
let currentStep = 0;

// Migrate: wrap scalar values into arrays for fields that are now chips.
for (const step of steps) {
  for (const f of step.fields) {
    if (f.type === 'chips' && state[f.id] !== undefined && !Array.isArray(state[f.id])) {
      state[f.id] = state[f.id] ? [state[f.id]] : [];
    }
    if ((f.type === 'radio' || f.type === 'radioVisual') && f.default && state[f.id] === undefined) {
      state[f.id] = f.default;
    }
  }
}
saveState();

const stepNav = document.getElementById('step-nav');
const stepContent = document.getElementById('step-content');
const progressFill = document.getElementById('progress-fill');
const btnBack = document.getElementById('btn-back');
const btnNext = document.getElementById('btn-next');

function saveState() {
  try { localStorage.setItem('design-brief-state', JSON.stringify(state)); } catch {}
}
function loadState() {
  try { return JSON.parse(localStorage.getItem('design-brief-state') || 'null'); } catch { return null; }
}

function slugify(s) {
  return (s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function normalizeOption(opt) {
  return typeof opt === 'string' ? { value: opt, label: opt } : opt;
}

function setValue(id, value, transform) {
  if (transform === 'slug') value = slugify(value);
  state[id] = value;
  saveState();
}

function toggleInArray(id, value, max) {
  const arr = Array.isArray(state[id]) ? [...state[id]] : [];
  const i = arr.indexOf(value);
  if (i >= 0) {
    arr.splice(i, 1);
  } else {
    if (max && arr.length >= max) {
      if (max === 1) {
        // single-select: replace
        state[id] = [value];
        saveState();
        return true;
      }
      return false;
    }
    arr.push(value);
  }
  state[id] = arr;
  saveState();
  return true;
}

function renderStepNav() {
  stepNav.innerHTML = steps.map((s, i) => `
    <button class="step-nav-item ${i === currentStep ? 'active' : ''} ${i < currentStep ? 'done' : ''}"
      data-step="${i}" type="button">
      <span class="step-num">${i + 1}</span>
      <span class="step-name">${esc(s.title)}</span>
    </button>
  `).join('') + `
    <button class="step-nav-item ${currentStep >= CLARIFY_STEP ? 'active' : ''}"
      data-step="${REVIEW_STEP}" type="button">
      <span class="step-num">${steps.length + 1}</span>
      <span class="step-name">Review</span>
    </button>
  `;
  stepNav.querySelectorAll('.step-nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      currentStep = parseInt(btn.dataset.step, 10);
      render();
    });
  });
  const effective = Math.min(currentStep, steps.length);
  const pct = (effective / steps.length) * 100;
  progressFill.style.width = `${pct}%`;
}

// Icon monograms for tech stack chips.
const stackIcons = {
  astro: { label: 'A', style: 'background:#ff5d01;color:#fff' },
  next: { label: '▲', style: 'background:#000;color:#fff' },
  remix: { label: 'R', style: 'background:#121212;color:#fff' },
  svelte: { label: 'S', style: 'background:#ff3e00;color:#fff' },
  wp: { label: 'W', style: 'background:#21759b;color:#fff' },
  framer: { label: 'F', style: 'background:#0055ff;color:#fff' },
  html: { label: '<>', style: 'background:#e34f26;color:#fff;font-size:0.65rem' },
  react: { label: '⚛', style: 'background:#20232a;color:#61dafb' },
  gsap: { label: 'G', style: 'background:#0ae448;color:#0b0e1a' },
  tw: { label: 'TW', style: 'background:#06b6d4;color:#fff;font-size:0.65rem' },
  css: { label: '#', style: 'background:#1572b6;color:#fff' },
  cf: { label: 'CF', style: 'background:#f38020;color:#fff;font-size:0.65rem' },
  vercel: { label: '▲', style: 'background:#fff;color:#000;border:1px solid #000' },
};

function iconHTML(iconKey) {
  const i = stackIcons[iconKey];
  if (!i) return '';
  return `<span class="chip-icon" style="${i.style}">${i.label}</span>`;
}

function renderField(field) {
  const val = state[field.id];

  const label = `
    <label class="field-label" for="f-${field.id}">
      <span class="field-title">${esc(field.label)}${field.required ? ' <span class="req">*</span>' : ''}</span>
      ${field.help ? `<span class="field-help">${esc(field.help)}</span>` : ''}
    </label>
  `;

  let control = '';

  if (field.type === 'text') {
    control = `<input type="text" id="f-${field.id}" class="input"
      value="${val ? esc(val) : ''}"
      placeholder="${esc(field.placeholder || '')}"
      data-transform="${field.transform || ''}">`;
  }

  if (field.type === 'textarea') {
    control = `<textarea id="f-${field.id}" class="input textarea" rows="${field.rows || 3}"
      placeholder="${esc(field.placeholder || '')}">${esc(val || '')}</textarea>`;
  }

  if (field.type === 'radio') {
    control = `<div class="radio-grid">` + field.options.map(raw => {
      const opt = normalizeOption(raw);
      const selected = val === opt.value;
      return `
        <label class="radio-option ${selected ? 'selected' : ''}">
          <input type="radio" name="${field.id}" value="${esc(opt.value)}" ${selected ? 'checked' : ''}>
          <span class="radio-text">
            <span class="radio-label">${esc(opt.label)}</span>
            ${opt.caption ? `<span class="radio-caption">${esc(opt.caption)}</span>` : ''}
          </span>
        </label>`;
    }).join('') + `</div>`;
  }

  if (field.type === 'chips') {
    const selected = Array.isArray(val) ? val : [];
    const count = field.max ? `<span class="chip-count">${selected.length}${field.max ? ` / ${field.max}` : ''}</span>` : '';
    const knownValues = new Set(field.options.map(o => normalizeOption(o).value));
    const knownChips = field.options.map(raw => {
      const opt = normalizeOption(raw);
      const isSel = selected.includes(opt.value);
      const icon = opt.icon ? iconHTML(opt.icon) : '';
      return `<button type="button" class="chip ${icon ? 'chip-with-icon' : ''} ${isSel ? 'selected' : ''}" data-value="${esc(opt.value)}">${icon}<span>${esc(opt.label)}</span></button>`;
    }).join('');
    const customChips = selected.filter(v => !knownValues.has(v)).map(v =>
      `<button type="button" class="chip chip-custom selected" data-value="${esc(v)}"><span>${esc(v)}</span><span class="chip-x" aria-hidden="true">×</span></button>`
    ).join('');
    const writeIn = field.writeIn
      ? `<div class="write-in">
          <input type="text" class="input write-in-input" placeholder="${esc(field.writeInPlaceholder || 'Add your own')}">
          <button type="button" class="btn btn-sm write-in-add">Add</button>
        </div>`
      : '';
    const chipGrid = `<div class="chip-grid">${knownChips}${customChips}</div>`;
    if (field.writeInFirst && field.writeIn) {
      control = `${count}${writeIn}${chipGrid}`;
    } else {
      control = `${count}${chipGrid}${writeIn}`;
    }
  }

  if (field.type === 'radioVisual') {
    control = `<div class="radio-visual-grid">` + field.options.map(opt => {
      const selected = val === opt.value;
      const swatches = (opt.swatches || []).map(c => `<span style="background:${c}"></span>`).join('');
      return `
        <button type="button" class="radio-visual ${selected ? 'selected' : ''}" data-value="${esc(opt.value)}">
          <div class="radio-visual-swatches">${swatches}</div>
          <div class="radio-visual-label">${esc(opt.label)}</div>
          ${opt.caption ? `<div class="radio-visual-caption">${esc(opt.caption)}</div>` : ''}
        </button>`;
    }).join('') + `</div>`;
  }

  if (field.type === 'references') {
    const urls = Array.isArray(state[field.id + 'Urls']) ? state[field.id + 'Urls'] : [];
    const likes = new Set(Array.isArray(state[field.id + 'Likes']) ? state[field.id + 'Likes'] : []);
    const avoids = new Set(Array.isArray(state[field.id + 'Avoids']) ? state[field.id + 'Avoids'] : []);
    const urlRows = urls.map((u, i) => {
      let host = '';
      try { host = new URL(u.url).hostname; } catch {}
      const favicon = host ? `https://www.google.com/s2/favicons?sz=64&domain=${host}` : '';
      return `<div class="refs-url-row is-${u.mode}" data-idx="${i}">
        ${favicon ? `<img class="refs-url-favicon" src="${esc(favicon)}" alt="">` : `<span class="refs-url-favicon"></span>`}
        <input type="url" class="input" value="${esc(u.url)}" data-role="url" placeholder="https://example.com">
        <select data-role="mode">
          <option value="like" ${u.mode === 'like' ? 'selected' : ''}>Inspiration</option>
          <option value="avoid" ${u.mode === 'avoid' ? 'selected' : ''}>Avoid</option>
        </select>
        <button type="button" class="chip-x" data-role="remove" aria-label="Remove">×</button>
      </div>`;
    }).join('');
    const addRow = `<div class="refs-url-add">
      <input type="url" class="input refs-url-new" placeholder="Paste a URL">
      <select class="refs-url-new-mode">
        <option value="like">Inspiration</option>
        <option value="avoid">Avoid</option>
      </select>
      <button type="button" class="btn btn-sm refs-url-add-btn">Add</button>
    </div>`;

    const likesCount = likes.size;
    const avoidsCount = avoids.size;
    const summary = `<div class="tri-summary">
      <span class="tri-pill tri-pill-like">● ${likesCount} inspiration${likesCount === 1 ? '' : 's'}</span>
      <span class="tri-pill tri-pill-avoid">● ${avoidsCount} avoid${avoidsCount === 1 ? '' : 's'}</span>
    </div>`;
    const groups = field.groups.map(g => {
      const chips = g.items.map(item => {
        let s = 'none';
        if (likes.has(item)) s = 'like';
        else if (avoids.has(item)) s = 'avoid';
        return `<button type="button" class="chip chip-tri chip-tri-${s}" data-value="${esc(item)}">${esc(item)}</button>`;
      }).join('');
      return `<details class="tri-group" open>
        <summary>${esc(g.name)}</summary>
        <div class="chip-grid">${chips}</div>
      </details>`;
    }).join('');

    control = `
      <div class="refs-section-title">Paste URLs</div>
      <div class="refs-urls">${urlRows}</div>
      ${addRow}
      <div class="refs-section-title">Or pick from the list</div>
      ${summary}
      <div class="tri-groups">${groups}</div>
    `;
  }

  if (field.type === 'checkboxes') {
    const selected = Array.isArray(val) ? val : [];
    const knownValues = new Set(field.options.map(o => normalizeOption(o).value));
    const knownBoxes = field.options.map(raw => {
      const opt = normalizeOption(raw);
      const isSel = selected.includes(opt.value);
      return `
        <label class="checkbox-option ${isSel ? 'selected' : ''}">
          <input type="checkbox" value="${esc(opt.value)}" ${isSel ? 'checked' : ''}>
          <span>${esc(opt.label)}</span>
        </label>`;
    }).join('');
    const customBoxes = selected.filter(v => !knownValues.has(v)).map(v =>
      `<label class="checkbox-option checkbox-custom selected">
        <input type="checkbox" value="${esc(v)}" checked>
        <span>${esc(v)}</span>
        <button type="button" class="chip-x" data-remove="${esc(v)}" aria-label="Remove">×</button>
      </label>`
    ).join('');
    const writeIn = field.writeIn
      ? `<div class="write-in">
          <input type="text" class="input write-in-input" placeholder="${esc(field.writeInPlaceholder || 'Add your own')}">
          <button type="button" class="btn btn-sm write-in-add">Add</button>
        </div>`
      : '';
    control = `<div class="checkbox-grid">${knownBoxes}${customBoxes}</div>${writeIn}`;
  }

  if (field.type === 'gallery') {
    control = `<div class="gallery-grid">` + field.options.map(opt => {
      const selected = val === opt.value;
      const swatches = (opt.palette || []).map(c =>
        `<span class="palette-swatch" style="background:${c}"></span>`
      ).join('');
      return `
        <button type="button" class="gallery-card ${selected ? 'selected' : ''}" data-value="${esc(opt.value)}">
          <div class="gallery-palette">${swatches}</div>
          <div class="gallery-label">${esc(opt.label)}</div>
          <div class="gallery-blurb">${esc(opt.blurb)}</div>
        </button>`;
    }).join('') + `</div>`;
  }

  if (field.type === 'typePair') {
    control = `<div class="typepair-grid">` + field.options.map(opt => {
      const selected = val === opt.value;
      return `
        <button type="button" class="typepair-card ${selected ? 'selected' : ''}" data-value="${esc(opt.value)}">
          <div class="typepair-preview">
            <div class="typepair-display" style="font-family:${opt.displayFont}">Aa</div>
            <div class="typepair-body" style="font-family:${opt.bodyFont}">The quick brown fox jumps over the lazy dog.</div>
          </div>
          <div class="typepair-label">${esc(opt.label)}</div>
        </button>`;
    }).join('') + `</div>`;
  }

  if (field.type === 'triStateGrouped') {
    const likes = new Set(Array.isArray(state[field.id + 'Likes']) ? state[field.id + 'Likes'] : []);
    const avoids = new Set(Array.isArray(state[field.id + 'Avoids']) ? state[field.id + 'Avoids'] : []);
    const likesCount = likes.size;
    const avoidsCount = avoids.size;
    const summary = `<div class="tri-summary">
      <span class="tri-pill tri-pill-like">● ${likesCount} inspiration${likesCount === 1 ? '' : 's'}</span>
      <span class="tri-pill tri-pill-avoid">● ${avoidsCount} avoid${avoidsCount === 1 ? '' : 's'}</span>
    </div>`;
    const groups = field.groups.map(g => {
      const chips = g.items.map(item => {
        let s = 'none';
        if (likes.has(item)) s = 'like';
        else if (avoids.has(item)) s = 'avoid';
        return `<button type="button" class="chip chip-tri chip-tri-${s}" data-value="${esc(item)}">${esc(item)}</button>`;
      }).join('');
      return `<details class="tri-group" open>
        <summary>${esc(g.name)}</summary>
        <div class="chip-grid">${chips}</div>
      </details>`;
    }).join('');
    control = `${summary}<div class="tri-groups">${groups}</div>`;
  }

  if (field.type === 'urlList') {
    const arr = Array.isArray(val) ? val : [];
    const max = field.max || 3;
    const padded = [...arr];
    while (padded.length < max) padded.push('');
    control = `<div class="url-list">` + padded.slice(0, max).map((u, i) => `
      <input type="url" class="input url-input" data-idx="${i}" value="${esc(u || '')}" placeholder="https://example.com">
    `).join('') + `</div>`;
  }

  if (field.type === 'color') {
    control = `<div class="color-row">
      <input type="color" id="f-${field.id}" class="color-input" value="${esc(val || '#1C4831')}">
      <input type="text" class="input color-text" value="${esc(val || '')}" placeholder="#1C4831">
      <button type="button" class="chip chip-clear">Clear</button>
    </div>`;
  }

  const mergeClass = field.merge ? ' field-merge' : '';
  return `<div class="field${mergeClass}" data-field="${field.id}" data-type="${field.type}">${label}${control}</div>`;
}

function shouldShowField(field) {
  if (field.id === 'languageOther') return state.language === 'other';
  return true;
}

function renderStep() {
  const step = steps[currentStep];
  const visible = step.fields.filter(shouldShowField);
  stepContent.innerHTML = `
    <header class="step-header">
      <div class="step-index">Step ${currentStep + 1} of ${steps.length + 1}</div>
      <h1 class="step-title">${esc(step.title)}</h1>
      <p class="step-subtitle">${esc(step.subtitle)}</p>
    </header>
    <div class="fields">${visible.map(renderField).join('')}</div>
  `;
  attachFieldHandlers({ fields: visible });
  updateNav();
}

function attachFieldHandlers(step) {
  step.fields.forEach(field => {
    const el = stepContent.querySelector(`[data-field="${field.id}"]`);
    if (!el) return;

    if (field.type === 'text') {
      el.querySelector('input').addEventListener('input', e => setValue(field.id, e.target.value));
      el.querySelector('input').addEventListener('blur', e => {
        if (field.transform === 'slug') {
          e.target.value = slugify(e.target.value);
          setValue(field.id, e.target.value);
        }
      });
    }

    if (field.type === 'textarea') {
      el.querySelector('textarea').addEventListener('input', e => setValue(field.id, e.target.value));
    }

    if (field.type === 'radio') {
      el.querySelectorAll('input[type="radio"]').forEach(input => {
        input.addEventListener('change', () => {
          setValue(field.id, input.value);
          if (field.id === 'language') { renderStep(); return; }
          el.querySelectorAll('.radio-option').forEach(o => o.classList.remove('selected'));
          input.closest('.radio-option').classList.add('selected');
          updateNav();
        });
      });
    }

    if (field.type === 'radioVisual') {
      el.querySelectorAll('.radio-visual').forEach(card => {
        card.addEventListener('click', () => {
          setValue(field.id, card.dataset.value);
          el.querySelectorAll('.radio-visual').forEach(c => c.classList.remove('selected'));
          card.classList.add('selected');
          updateNav();
        });
      });
    }

    if (field.type === 'references') {
      const urlsKey = field.id + 'Urls';
      const lKey = field.id + 'Likes';
      const aKey = field.id + 'Avoids';

      el.querySelectorAll('.refs-url-row').forEach(row => {
        const idx = parseInt(row.dataset.idx, 10);
        row.querySelector('[data-role="url"]').addEventListener('input', e => {
          const arr = [...(state[urlsKey] || [])];
          if (arr[idx]) { arr[idx] = { ...arr[idx], url: e.target.value }; state[urlsKey] = arr; saveState(); }
        });
        row.querySelector('[data-role="url"]').addEventListener('blur', () => renderStep());
        row.querySelector('[data-role="mode"]').addEventListener('change', e => {
          const arr = [...(state[urlsKey] || [])];
          if (arr[idx]) { arr[idx] = { ...arr[idx], mode: e.target.value }; state[urlsKey] = arr; saveState(); renderStep(); }
        });
        row.querySelector('[data-role="remove"]').addEventListener('click', () => {
          const arr = [...(state[urlsKey] || [])];
          arr.splice(idx, 1);
          state[urlsKey] = arr;
          saveState();
          renderStep();
        });
      });

      const newUrl = el.querySelector('.refs-url-new');
      const newMode = el.querySelector('.refs-url-new-mode');
      const addBtn = el.querySelector('.refs-url-add-btn');
      const doAddUrl = () => {
        const v = (newUrl.value || '').trim();
        if (!v) return;
        const arr = [...(state[urlsKey] || [])];
        arr.push({ url: v, mode: newMode.value });
        state[urlsKey] = arr;
        saveState();
        renderStep();
      };
      addBtn.addEventListener('click', doAddUrl);
      newUrl.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); doAddUrl(); } });

      el.querySelectorAll('.chip-tri').forEach(btn => {
        btn.addEventListener('click', () => {
          const v = btn.dataset.value;
          const likes = Array.isArray(state[lKey]) ? [...state[lKey]] : [];
          const avoids = Array.isArray(state[aKey]) ? [...state[aKey]] : [];
          const inLikes = likes.includes(v);
          const inAvoids = avoids.includes(v);
          if (!inLikes && !inAvoids) {
            likes.push(v);
          } else if (inLikes) {
            state[lKey] = likes.filter(x => x !== v);
            avoids.push(v);
            state[aKey] = avoids;
            saveState();
            renderStep();
            return;
          } else {
            state[aKey] = avoids.filter(x => x !== v);
            saveState();
            renderStep();
            return;
          }
          state[lKey] = likes;
          saveState();
          renderStep();
        });
      });
    }

    if (field.type === 'chips') {
      el.querySelectorAll('.chip').forEach(btn => {
        btn.addEventListener('click', () => {
          const isCustom = btn.classList.contains('chip-custom');
          const value = btn.dataset.value;
          const max = field.max;
          if (isCustom) {
            // remove custom
            const arr = Array.isArray(state[field.id]) ? [...state[field.id]] : [];
            const i = arr.indexOf(value);
            if (i >= 0) { arr.splice(i, 1); state[field.id] = arr; saveState(); renderStep(); return; }
          }
          const ok = toggleInArray(field.id, value, max);
          if (!ok) {
            btn.classList.add('shake');
            setTimeout(() => btn.classList.remove('shake'), 300);
            return;
          }
          // re-render to keep count / single-select state correct
          renderStep();
        });
      });

      if (field.writeIn) {
        const input = el.querySelector('.write-in-input');
        const add = el.querySelector('.write-in-add');
        const doAdd = () => {
          const v = (input.value || '').trim();
          if (!v) return;
          const arr = Array.isArray(state[field.id]) ? [...state[field.id]] : [];
          if (field.max && arr.length >= field.max) {
            if (field.max === 1) { state[field.id] = [v]; saveState(); renderStep(); }
            return;
          }
          if (!arr.includes(v)) arr.push(v);
          state[field.id] = arr;
          saveState();
          renderStep();
        };
        add.addEventListener('click', doAdd);
        input.addEventListener('keydown', e => {
          if (e.key === 'Enter') { e.preventDefault(); doAdd(); }
        });
      }
    }

    if (field.type === 'checkboxes') {
      el.querySelectorAll('.checkbox-option input[type="checkbox"]').forEach(input => {
        input.addEventListener('change', () => {
          toggleInArray(field.id, input.value);
          renderStep();
        });
      });
      el.querySelectorAll('.chip-x[data-remove]').forEach(x => {
        x.addEventListener('click', e => {
          e.preventDefault();
          const v = x.dataset.remove;
          const arr = Array.isArray(state[field.id]) ? state[field.id].filter(i => i !== v) : [];
          state[field.id] = arr;
          saveState();
          renderStep();
        });
      });
      if (field.writeIn) {
        const input = el.querySelector('.write-in-input');
        const add = el.querySelector('.write-in-add');
        const doAdd = () => {
          const v = (input.value || '').trim();
          if (!v) return;
          const arr = Array.isArray(state[field.id]) ? [...state[field.id]] : [];
          if (!arr.includes(v)) arr.push(v);
          state[field.id] = arr;
          saveState();
          renderStep();
        };
        add.addEventListener('click', doAdd);
        input.addEventListener('keydown', e => {
          if (e.key === 'Enter') { e.preventDefault(); doAdd(); }
        });
      }
    }

    if (field.type === 'gallery') {
      el.querySelectorAll('.gallery-card').forEach(card => {
        card.addEventListener('click', () => {
          setValue(field.id, card.dataset.value);
          el.querySelectorAll('.gallery-card').forEach(c => c.classList.remove('selected'));
          card.classList.add('selected');
          updateNav();
        });
      });
    }

    if (field.type === 'typePair') {
      el.querySelectorAll('.typepair-card').forEach(card => {
        card.addEventListener('click', () => {
          setValue(field.id, card.dataset.value);
          el.querySelectorAll('.typepair-card').forEach(c => c.classList.remove('selected'));
          card.classList.add('selected');
        });
      });
    }

    if (field.type === 'triStateGrouped') {
      el.querySelectorAll('.chip-tri').forEach(btn => {
        btn.addEventListener('click', () => {
          const v = btn.dataset.value;
          const lKey = field.id + 'Likes';
          const aKey = field.id + 'Avoids';
          const likes = Array.isArray(state[lKey]) ? [...state[lKey]] : [];
          const avoids = Array.isArray(state[aKey]) ? [...state[aKey]] : [];
          const inLikes = likes.includes(v);
          const inAvoids = avoids.includes(v);
          if (!inLikes && !inAvoids) {
            likes.push(v);
          } else if (inLikes) {
            state[lKey] = likes.filter(x => x !== v);
            avoids.push(v);
            state[aKey] = avoids;
            saveState();
            renderStep();
            return;
          } else {
            state[aKey] = avoids.filter(x => x !== v);
            saveState();
            renderStep();
            return;
          }
          state[lKey] = likes;
          saveState();
          renderStep();
        });
      });
    }

    if (field.type === 'urlList') {
      el.querySelectorAll('.url-input').forEach(input => {
        input.addEventListener('input', () => {
          const inputs = el.querySelectorAll('.url-input');
          const arr = Array.from(inputs).map(i => i.value.trim()).filter(Boolean);
          setValue(field.id, arr);
        });
      });
    }

    if (field.type === 'color') {
      const picker = el.querySelector('.color-input');
      const text = el.querySelector('.color-text');
      const clear = el.querySelector('.chip-clear');
      picker.addEventListener('input', () => {
        text.value = picker.value;
        setValue(field.id, picker.value);
      });
      text.addEventListener('input', () => {
        setValue(field.id, text.value);
        if (/^#[0-9a-f]{6}$/i.test(text.value)) picker.value = text.value;
      });
      clear.addEventListener('click', () => {
        text.value = '';
        setValue(field.id, '');
      });
    }
  });
}

function suggestForMe() {
  const type = state.siteType;
  if (!type) {
    alert('Pick a website type on step 1 first, then I can suggest the rest.');
    return;
  }
  const p = presets[type];
  if (!p) return;
  for (const [k, v] of Object.entries(p)) {
    const cur = state[k];
    const empty = cur === undefined || cur === '' || (Array.isArray(cur) && cur.length === 0);
    if (empty) state[k] = v;
  }
  saveState();
  render();
}

function validateCurrent() {
  const step = steps[currentStep];
  if (!step) return true;
  for (const f of step.fields) {
    if (!f.required) continue;
    if (!shouldShowField(f)) continue;
    let v = state[f.id];
    if (f.type === 'chips' && v !== undefined && !Array.isArray(v)) v = v ? [v] : [];
    if (f.type === 'chips' && f.min && (!Array.isArray(v) || v.length < f.min)) {
      return `Pick at least ${f.min} for "${f.label}".`;
    }
    if (v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)) {
      return `"${f.label}" is required.`;
    }
  }
  return true;
}

function updateNav() {
  btnBack.disabled = currentStep === 0;
  if (currentStep >= REVIEW_STEP) {
    btnNext.style.display = 'none';
  } else if (currentStep === CLARIFY_STEP) {
    btnNext.style.display = '';
    btnNext.textContent = 'Finish →';
  } else {
    btnNext.style.display = '';
    btnNext.textContent = currentStep === steps.length - 1 ? 'Review brief →' : 'Next →';
  }
}

function renderVariantStage() {
  const stage = document.getElementById('mockup-stage');
  const log = document.getElementById('log-list');
  if (!stage || !currentVariant) return;
  stage.innerHTML = renderMockup(currentVariant, state);
  if (log) {
    if (variantHistory.length === 0) {
      log.innerHTML = `<div class="log-empty">Reroll to save a variant here.</div>`;
    } else {
      log.innerHTML = variantHistory.map((v, i) =>
        `<button type="button" class="log-item" data-idx="${i}">${renderMockupThumb(v)}</button>`
      ).join('');
      log.querySelectorAll('.log-item').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.dataset.idx, 10);
          const restored = variantHistory[idx];
          // Swap: put current into history at that slot
          variantHistory[idx] = currentVariant;
          currentVariant = restored;
          renderVariantStage();
        });
      });
    }
  }
}

async function renderClarify(opts = {}) {
  const { regenerate = false } = opts;

  if (!getApiKey()) {
    stepContent.innerHTML = `
      <header class="step-header">
        <div class="step-index">One more thing</div>
        <h1 class="step-title">Clarifying questions</h1>
        <p class="step-subtitle">Paste your Anthropic API key to let Claude look for gaps in the brief. Stored locally in this browser only. Or skip straight to the review.</p>
      </header>
      <div class="fields">
        <div class="field">
          <label class="field-label"><span class="field-title">Anthropic API key</span>
            <span class="field-help">Starts with sk-ant-. Saved to localStorage on this machine.</span>
          </label>
          <div class="color-row">
            <input type="password" class="input" id="clarify-key" placeholder="sk-ant-..." style="flex:1">
            <button class="btn btn-primary" id="clarify-save-key" type="button">Save and continue</button>
            <button class="btn" id="clarify-skip" type="button">Skip</button>
          </div>
        </div>
      </div>
    `;
    document.getElementById('clarify-save-key').addEventListener('click', () => {
      const v = document.getElementById('clarify-key').value.trim();
      if (!v) return;
      setApiKey(v);
      renderClarify();
    });
    document.getElementById('clarify-skip').addEventListener('click', () => {
      state._clarifySkipped = true;
      saveState();
      currentStep = REVIEW_STEP;
      render();
    });
    updateNav();
    return;
  }

  // Loading state
  stepContent.innerHTML = `
    <header class="step-header">
      <div class="step-index">One more thing</div>
      <h1 class="step-title">Looking for gaps in the brief</h1>
      <p class="step-subtitle">Claude is reading what you've filled in and checking for anything ambiguous.</p>
    </header>
    <div class="clarify-loading">
      <div class="spinner" aria-hidden="true"></div>
      <p>Thinking...</p>
    </div>
  `;
  updateNav();

  let questions = state._clarifyQuestions;
  if (regenerate || !Array.isArray(questions)) {
    try {
      questions = await fetchClarifyQuestions(state);
      state._clarifyQuestions = questions;
      saveState();
    } catch (err) {
      const msg = err.message === 'BAD_KEY' ? 'That API key was rejected.'
        : err.message === 'NO_KEY' ? 'No API key set.'
        : `Request failed. ${err.message}`;
      stepContent.innerHTML = `
        <header class="step-header">
          <div class="step-index">One more thing</div>
          <h1 class="step-title">Couldn't reach Claude</h1>
          <p class="step-subtitle">${esc(msg)}</p>
        </header>
        <div class="clarify-actions">
          <button class="btn" id="clarify-retry" type="button">Try again</button>
          <button class="btn" id="clarify-change-key" type="button">Change API key</button>
          <button class="btn" id="clarify-skip" type="button">Skip to review</button>
        </div>
      `;
      document.getElementById('clarify-retry').addEventListener('click', () => renderClarify({ regenerate: true }));
      document.getElementById('clarify-change-key').addEventListener('click', () => { setApiKey(''); renderClarify(); });
      document.getElementById('clarify-skip').addEventListener('click', () => {
        state._clarifySkipped = true;
        saveState();
        currentStep = REVIEW_STEP;
        render();
      });
      return;
    }
  }

  const answers = Array.isArray(state.clarifications) ? state.clarifications : [];

  if (!questions.length) {
    stepContent.innerHTML = `
      <header class="step-header">
        <div class="step-index">One more thing</div>
        <h1 class="step-title">Nothing else to ask</h1>
        <p class="step-subtitle">The brief looks complete. Straight to the review.</p>
      </header>
      <div class="clarify-actions">
        <button class="btn btn-primary" id="clarify-to-review" type="button">Review brief →</button>
        <button class="btn" id="clarify-regen" type="button">Check again</button>
      </div>
    `;
    document.getElementById('clarify-to-review').addEventListener('click', () => {
      currentStep = REVIEW_STEP;
      render();
    });
    document.getElementById('clarify-regen').addEventListener('click', () => renderClarify({ regenerate: true }));
    return;
  }

  stepContent.innerHTML = `
    <header class="step-header">
      <div class="step-index">One more thing</div>
      <h1 class="step-title">A few follow-ups</h1>
      <p class="step-subtitle">Claude flagged ${questions.length} thing${questions.length === 1 ? '' : 's'} worth clarifying. Answer what you can. Blank is fine.</p>
    </header>
    <div class="fields">
      ${questions.map((q, i) => `
        <div class="field" data-clarify-idx="${i}">
          <label class="field-label">
            <span class="field-title">${esc(q.q || '')}</span>
            ${q.why ? `<span class="field-help">${esc(q.why)}</span>` : ''}
          </label>
          <textarea class="input textarea" rows="2" placeholder="${esc(q.placeholder || '')}">${esc(answers[i] || '')}</textarea>
        </div>
      `).join('')}
    </div>
    <div class="clarify-actions">
      <button class="btn" id="clarify-regen" type="button">↻ Ask different questions</button>
      <button class="btn" id="clarify-change-key" type="button">Change API key</button>
    </div>
  `;

  stepContent.querySelectorAll('[data-clarify-idx]').forEach(el => {
    const idx = parseInt(el.dataset.clarifyIdx, 10);
    el.querySelector('textarea').addEventListener('input', e => {
      const arr = Array.isArray(state.clarifications) ? [...state.clarifications] : [];
      arr[idx] = e.target.value;
      state.clarifications = arr;
      saveState();
    });
  });

  document.getElementById('clarify-regen').addEventListener('click', () => {
    state.clarifications = [];
    renderClarify({ regenerate: true });
  });
  document.getElementById('clarify-change-key').addEventListener('click', () => { setApiKey(''); renderClarify(); });
}

function renderReview() {
  const md = generateMarkdown(state);
  const filename = `${state.projectName || 'design-brief'}.md`;

  if (!currentVariant) {
    currentVariant = deriveVariant(state, Math.floor(Math.random() * 1e9));
  }

  stepContent.innerHTML = `
    <header class="step-header">
      <div class="step-index">Final step</div>
      <h1 class="step-title">Review and download</h1>
      <p class="step-subtitle">Drop this file into the project root. Claude CMS and <code>/impeccable</code> will pick it up on every website change.</p>
    </header>

    <section class="mockup-section">
      <div class="mockup-header">
        <div>
          <h2 class="mockup-title">One possible outcome</h2>
          <p class="mockup-sub">Generated within your guardrails. Reroll for another.</p>
        </div>
        <div class="mockup-actions">
          <button class="btn" id="btn-reroll" type="button">↻ Reroll</button>
        </div>
      </div>

      <div class="mockup-layout">
        <div class="mockup-stage" id="mockup-stage"></div>
        <aside class="mockup-log" id="mockup-log">
          <div class="log-title">History</div>
          <div class="log-list" id="log-list"></div>
        </aside>
      </div>
    </section>

    <div class="review-actions">
      <button class="btn btn-primary" id="btn-download">↓ Download ${esc(filename)}</button>
      <button class="btn" id="btn-copy">Copy markdown</button>
      <span class="review-hint">Save to the site repo as <code>${esc(filename)}</code> or <code>.impeccable.md</code> in the project root.</span>
    </div>

    <details class="preview" open>
      <summary>Markdown preview</summary>
      <pre class="markdown-preview"><code></code></pre>
    </details>
  `;

  renderVariantStage();
  stepContent.querySelector('.markdown-preview code').textContent = md;

  document.getElementById('btn-reroll').addEventListener('click', () => {
    if (currentVariant) variantHistory.unshift(currentVariant);
    variantHistory = variantHistory.slice(0, 6);
    currentVariant = deriveVariant(state, Math.floor(Math.random() * 1e9));
    renderVariantStage();
  });

  document.getElementById('btn-download').addEventListener('click', () => {
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById('btn-copy').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(md);
      const b = document.getElementById('btn-copy');
      const orig = b.textContent;
      b.textContent = 'Copied';
      setTimeout(() => (b.textContent = orig), 1500);
    } catch {
      alert('Copy failed. Select the preview text instead.');
    }
  });

  updateNav();
}

function render() {
  renderStepNav();
  if (currentStep === CLARIFY_STEP) renderClarify();
  else if (currentStep >= REVIEW_STEP) renderReview();
  else renderStep();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

btnNext.addEventListener('click', () => {
  const v = validateCurrent();
  if (v !== true) { alert(v); return; }
  currentStep = Math.min(currentStep + 1, REVIEW_STEP);
  render();
});

btnBack.addEventListener('click', () => {
  currentStep = Math.max(currentStep - 1, 0);
  render();
});

render();
