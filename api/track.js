// POST /api/track  { quiz, event }
// quiz: 'person-quiz' | 'person-landing' | 'entrepreneur-quiz' | 'entrepreneur-landing'
// event: 'start' | 's1'..'s11' | 'form' | 'lead' | 'score' | 'cta' | 'downsell'

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).end();

  const { quiz, event } = req.body || {};
  if (!quiz || !event) return res.status(400).json({ error: 'quiz and event required' });

  const kvUrl   = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  if (!kvUrl || !kvToken) return res.status(500).json({ error: 'KV not configured' });

  const auth = { Authorization: `Bearer ${kvToken}` };
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  // Total counter
  const key = `funnel:${quiz}:${event}`;
  // Daily counter
  const dayKey = `funneld:${quiz}:${event}:${today}`;

  await Promise.all([
    fetch(`${kvUrl}/incr/${encodeURIComponent(key)}`,    { method: 'POST', headers: auth }),
    fetch(`${kvUrl}/incr/${encodeURIComponent(dayKey)}`, { method: 'POST', headers: auth }),
  ]);

  return res.status(200).json({ ok: true });
};
