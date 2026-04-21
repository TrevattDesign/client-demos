// Calls the Claude API to generate outstanding clarification questions
// based on everything the user has filled in so far.
//
// Browser-direct Anthropic call. The API key is pasted once by the user
// and stored in localStorage. This is an internal tool, not public — the
// key never leaves the browser.

const KEY_STORAGE = 'anthropic-api-key';
const MODEL = 'claude-sonnet-4-5';

export function getApiKey() {
  try { return localStorage.getItem(KEY_STORAGE) || ''; } catch { return ''; }
}
export function setApiKey(k) {
  try { localStorage.setItem(KEY_STORAGE, k || ''); } catch {}
}

// Strip transient / computed / unrelated keys so the model sees only
// the brief content.
function briefSnapshot(state) {
  const ignore = new Set(['_clarifyQuestions', '_clarifySkipped']);
  const out = {};
  for (const [k, v] of Object.entries(state)) {
    if (ignore.has(k)) continue;
    if (v === '' || v === null || v === undefined) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    out[k] = v;
  }
  return out;
}

const SYSTEM = `You are a senior design strategist reviewing a client's design brief before it goes to the design team.

Your job: read the brief, find what is genuinely missing or ambiguous, and ask 2 to 4 precise follow-up questions that would materially change the design decisions.

Rules:
- Skip anything already answered. Do not restate fields the user filled.
- Skip nice-to-have questions. Only ask things that change what gets built.
- One question per issue. Concrete, specific, answerable in a sentence or two.
- Match British English. No em dashes. No filler.
- If the brief is complete enough, return an empty questions array.

Respond with a single valid JSON object, no preamble, no code fences:
{"questions":[{"q":"the question","why":"one short line on why it matters","placeholder":"example of a good answer"}]}`;

export async function fetchClarifyQuestions(state) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('NO_KEY');

  const brief = briefSnapshot(state);

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 800,
      system: SYSTEM,
      messages: [{
        role: 'user',
        content: `Here is the brief so far as JSON:\n\n${JSON.stringify(brief, null, 2)}\n\nReturn the JSON object with your follow-up questions.`,
      }],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    if (res.status === 401) throw new Error('BAD_KEY');
    throw new Error(`API ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  const text = (data.content || []).map(c => c.text || '').join('').trim();

  // Strip any accidental code fences.
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  const parsed = JSON.parse(cleaned);
  return Array.isArray(parsed.questions) ? parsed.questions : [];
}
