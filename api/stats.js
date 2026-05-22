const QUIZZES = ['person-quiz', 'person-landing', 'entrepreneur-quiz', 'entrepreneur-landing'];
const PERSON_STEPS = ['start','s1','s2','s3','s4','s5','s6','s7','s8','s9','s10','s11','form','lead','score','cta','downsell'];
const ENT_STEPS    = ['start','s1','s2','s3','s4','s5','s6','s7','s8','s9','s10','s11','s12','s13','s14','form','lead','score','cta','downsell'];

const STEPS = {
  'person-quiz':          PERSON_STEPS,
  'person-landing':       PERSON_STEPS,
  'entrepreneur-quiz':    ENT_STEPS,
  'entrepreneur-landing': ENT_STEPS,
};

// Generate array of dates between from and to (inclusive), YYYY-MM-DD
function dateRange(from, to) {
  const dates = [];
  const cur = new Date(from);
  const end = new Date(to);
  while (cur <= end) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'GET') return res.status(405).end();

  const kvUrl   = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_READ_ONLY_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!kvUrl || !kvToken) return res.status(500).json({ error: 'KV not configured' });

  const { from, to } = req.query || {};
  const auth = { Authorization: `Bearer ${kvToken}` };
  const result = {};

  for (const quiz of QUIZZES) {
    const steps = STEPS[quiz];

    let keys;
    if (from && to) {
      // For date range: sum across each day
      const dates = dateRange(from, to);
      // We'll collect per-day keys and sum them
      const dayKeys = steps.flatMap(s => dates.map(d => `funneld:${quiz}:${s}:${d}`));
      const resp = await fetch(`${kvUrl}/mget/${dayKeys.map(k => encodeURIComponent(k)).join('/')}`, {
        headers: auth,
      });
      const data = await resp.json();
      const values = data.result || [];

      result[quiz] = {};
      steps.forEach((s, si) => {
        let total = 0;
        dates.forEach((_, di) => {
          total += parseInt(values[si * dates.length + di] || '0', 10);
        });
        result[quiz][s] = total;
      });
    } else {
      // Total (all time)
      keys = steps.map(s => `funnel:${quiz}:${s}`);
      const resp = await fetch(`${kvUrl}/mget/${keys.map(k => encodeURIComponent(k)).join('/')}`, {
        headers: auth,
      });
      const data = await resp.json();
      const values = data.result || [];

      result[quiz] = {};
      steps.forEach((s, i) => {
        result[quiz][s] = parseInt(values[i] || '0', 10);
      });
    }
  }

  return res.status(200).json(result);
};
