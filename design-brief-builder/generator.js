// Generates the final .md output from the collected state.
// The output is shaped to be dropped into a project and picked up
// by Claude CMS / the /impeccable skill on every website change.

const visualToneBlurbs = {
  'brutally-minimal': 'Brutally minimal. Almost nothing on screen. Every element earns its place.',
  'warm-editorial': 'Warm editorial. High-end magazine layout with the approachability of a personal studio.',
  'maximalist': 'Maximalist. Dense, layered, loud on purpose. Every surface earns attention.',
  'retro-futurist': 'Retro-futurist. 1970s mainframe terminal meets tomorrow. Technical, slightly uncanny.',
  'organic': 'Organic. Natural forms, soft edges, earthy materials. Calm and breathing.',
  'luxury': 'Luxury. Refined, expensive, quiet confidence. Nothing shouts.',
  'playful': 'Playful. Toy-like, generous, lightly absurd. Warmth over polish.',
  'brutalist': 'Brutalist. Raw, structural, unvarnished. Grid visible, type honest.',
  'art-deco': 'Art deco. Geometric, ornamented, stately. Strong symmetry.',
  'soft-pastel': 'Soft pastel. Gentle, muted, reassuring. Low contrast, high trust.',
  'industrial': 'Industrial. Utilitarian, precise, no fluff. Function-first.',
  'technical': 'Technical document. Spec-sheet precision. Data-dense, legible, honest.',
};

const themeLine = {
  light: 'Light.',
  dark: 'Dark.',
  both: 'Both light and dark, user toggleable.',
  auto: 'Auto. Follow the user system preference.',
};

const performanceLine = {
  speed: 'Speed first. Static output, minimal JS, aggressive optimisation.',
  balanced: 'Balanced. Interactive where it earns its weight.',
  rich: 'Rich and interactive. JS is fine where it is justified.',
};

const neutralLine = {
  warm: 'Warm greys (cream, stone, sand).',
  cool: 'Cool greys (slate, steel, fog).',
  neutral: 'True greys.',
  tinted: 'Greys tinted toward the brand hue (subtle, 0.005 to 0.01 chroma).',
};

const typePairLine = {
  'editorial-serif': 'Editorial serif display paired with a refined sans body.',
  'geometric-sans': 'Geometric sans display paired with a humanist sans body.',
  'grotesk-serif': 'Grotesk display paired with a transitional serif body.',
  'mono-display': 'Monospace display used sparingly, paired with a sans body. Avoid using mono as shorthand for "technical".',
  'all-serif': 'Serif display and serif body for a true editorial feel.',
  'all-sans': 'A single sans family, used across the full weight range.',
  'handmade': 'Custom, handmade, or display-led. Let the display face carry the character.',
};

function languageLine(state) {
  if (state.language === 'en-US') return 'American English.';
  if (state.language === 'other') return state.languageOther ? `${state.languageOther}.` : 'Other. See notes.';
  return 'British English. Use colour, realise, behaviour, centre, organise.';
}

const accessibilityLine = {
  AA: 'WCAG 2.2 AA. Sufficient contrast, full keyboard support, visible focus, alt text on all non-decorative imagery.',
  AAA: 'WCAG 2.2 AAA. Stricter contrast thresholds, plain-language copy, enhanced focus indicators.',
  custom: 'Custom accessibility requirements. See accessibility notes below.',
};

function bulletList(items) {
  if (!items || items.length === 0) return '_None specified._';
  return items.map(i => `- ${i}`).join('\n');
}

function quoteText(text) {
  if (!text) return '';
  return text.split('\n').map(l => `> ${l}`).join('\n');
}

function firstOr(arr, fallback) {
  if (Array.isArray(arr) && arr.length) return arr[0];
  return fallback;
}

export function generateMarkdown(state) {
  const s = state;
  const name = s.displayName || s.projectName || 'This project';
  const now = new Date().toISOString().slice(0, 10);
  const emotion = firstOr(s.emotion, null);

  const refUrls = Array.isArray(s.referencesUrls) ? s.referencesUrls : [];
  const urlLikes = refUrls.filter(r => r.mode === 'like').map(r => r.url);
  const urlAvoids = refUrls.filter(r => r.mode === 'avoid').map(r => r.url);
  const brandLikes = Array.isArray(s.referencesLikes) ? s.referencesLikes : [];
  const brandAvoids = Array.isArray(s.referencesAvoids) ? s.referencesAvoids : [];
  const allLikes = [...urlLikes, ...brandLikes];
  const allAvoids = [...urlAvoids, ...brandAvoids];

  const antiPatternsBlock = (s.antiPatterns || '').trim()
    ? (s.antiPatterns || '').split('\n').map(l => l.trim()).filter(Boolean).map(l => `- ${l}`).join('\n')
    : '_None specified._';

  const clarifyQs = Array.isArray(s._clarifyQuestions) ? s._clarifyQuestions : [];
  const clarifyAs = Array.isArray(s.clarifications) ? s.clarifications : [];
  const clarifyPairs = clarifyQs
    .map((q, i) => ({ q: q.q || '', a: (clarifyAs[i] || '').trim() }))
    .filter(p => p.a);
  const clarifyBlock = clarifyPairs.length
    ? clarifyPairs.map(p => `**Q.** ${p.q}\n\n${quoteText(p.a)}`).join('\n\n')
    : '';

  return `---
name: ${s.projectName || 'project'}
display_name: ${name}
type: design-context
created: ${now}
version: 1
---

# ${name} — Design Context

<!--
  CLAUDE CMS TRIGGER
  ------------------
  This file defines the design context for ${name}.
  It MUST be read and applied every time a change to the website is requested.

  When the user asks to add, change, remove, design, or rewrite ANY part of
  this site, load this file first and check every decision against the
  Design Context, Design Principles, and Constraints below.

  If a requested change conflicts with this context, flag the conflict to
  the user before proceeding. Do not silently override these rules.

  Pair this file with the /impeccable skill (craft mode). When /impeccable
  gathers context, it should find this file and proceed directly to craft
  rather than re-running teach.
-->

## When to apply this context

Load and apply this file whenever the user asks to:

- Add, change, or remove any part of the website
- Design a new page, section, or component
- Write or rewrite copy, headings, or microcopy
- Pick colours, type, spacing, or motion
- Review an existing design decision
- Build anything via \`/impeccable craft\`

If a request conflicts with the principles below, raise the conflict before acting.

---

## Project

${s.description || '_No description provided._'}

**Website type:** ${s.siteType || 'unspecified'}

---

## Users

**Primary audience:** ${(s.audience && s.audience.length) ? s.audience.join(', ') : 'Not specified'}

**Context of use:** ${(s.context && s.context.length) ? s.context.join(', ') : 'Not specified'}

**Objectives:**
${bulletList(s.objectives || [])}

---

## Brand personality

**Three words:** ${(s.personality && s.personality.length) ? s.personality.join(', ') : 'Not specified'}

**Primary emotion to evoke:** ${emotion || 'Not specified'}

---

## Aesthetic direction

**Visual tone:** ${visualToneBlurbs[s.visualTone] || 'Not specified'}

**Theme:** ${themeLine[s.theme] || 'Not specified'}

**Inspirations:**
${bulletList(allLikes)}

**Avoid resembling:**
${bulletList(allAvoids)}

---

## Explicit bans

The following patterns are explicitly banned on this project. Do not introduce them, even if asked indirectly. If the user asks for something that requires one of these, propose an alternative first.

${antiPatternsBlock}

Plus the standard impeccable absolute bans:

- No side-stripe coloured borders on cards, list items, callouts, or alerts (\`border-left\` or \`border-right\` greater than 1px is forbidden regardless of colour or variable name)
- No gradient text (\`background-clip: text\` combined with any gradient)
- No pure black (#000) or pure white (#fff) — always tint
- No reflex fonts: Inter, Fraunces, Newsreader, Lora, Crimson, Playfair, Cormorant, Syne, IBM Plex, Space Mono, Space Grotesk, DM Sans, DM Serif, Outfit, Plus Jakarta Sans, Instrument Sans/Serif

---

## Colour and type seeds

**Brand hue:** ${s.brandHue || 'Not specified — pick during craft.'}

**Grey tint:** ${neutralLine[s.neutralTemp] || 'Not specified.'}

**Type pairing direction:** ${typePairLine[s.typePair] || 'Not specified — pick during craft, following the impeccable font-selection procedure. Do not pick from the reflex-fonts list.'}

These are starting points, not final choices. The final palette and type pair are chosen during \`/impeccable craft\` by following the colour and font-selection procedures in the impeccable skill.

---

## Constraints

**Accessibility:** ${accessibilityLine[s.accessibility] || accessibilityLine.AA}

**Motion:**
${bulletList(s.reducedMotion && s.reducedMotion.length ? s.reducedMotion : ['Respect prefers-reduced-motion'])}

${s.accessibilityNotes ? `**Accessibility notes:**\n\n${quoteText(s.accessibilityNotes)}\n` : ''}

**Performance priority:** ${performanceLine[s.performance] || 'Balanced.'}

**Tech stack:** ${(s.stack && s.stack.length) ? s.stack.join(', ') : 'Not specified'}

**Language:** ${languageLine(s)}

${s.notes ? `**Additional notes:**\n\n${quoteText(s.notes)}` : ''}

${clarifyBlock ? `---\n\n## Clarifications\n\nFollow-ups captured during the brief. Apply these alongside the fields above.\n\n${clarifyBlock}\n` : ''}

---

## Design principles

Derived from the above. Apply these to every decision:

1. **Intentional over impressive.** Every element earns its place. If it does not serve the objectives listed above, cut it.
2. **Context over default.** Choose theme, density, and tone from how the audience actually uses the site, not from a safe default.
3. **Typography and spacing carry the load.** Not colour tricks, not decorative flourishes.
4. **Distinctive, not generic.** Reject reflex fonts, reflex palettes, and the AI-slop patterns listed above.
5. **Accessible by default.** WCAG 2.2 AA baseline. Reduced motion respected. Keyboard and screen reader parity.
6. **Copy is part of the design.** Every word earns its place. Match the brand personality. ${s.language === 'en-US' ? 'American English.' : s.language === 'other' ? (s.languageOther ? `${s.languageOther}.` : 'See notes for language.') : 'British English unless specified otherwise.'}

---

## For /impeccable craft

When invoked via \`/impeccable craft\`, use this file as Design Context and skip the teach flow. Go straight to craft. Apply the principles above, respect the bans, and return production-grade code that reflects the tone and personality declared here.
`;
}
