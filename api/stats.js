const QUIZZES = ['person-quiz', 'person-landing', 'entrepreneur-quiz', 'entrepreneur-landing'];
const PERSON_STEPS = ['start','s1','s2','s3','s4','s5','s6','s7','s8','s9','s10','s11','form','lead','score','cta','downsell'];
const ENT_STEPS    = ['start','s1','s2','s3','s4','s5','s6','s7','s8','s9','s10','s11','s12','s13','s14','form','lead','score','cta','downsell'];

const STEPS = {
  'person-quiz':          PERSON_STEPS,
  'person-landing':       PERSON_STEPS,
  'entrepreneur-quiz':    ENT_STEPS,
  'entrepreneur-landing': ENT_STEPS,
};

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'GET') return res.status(405).end();

  const kvUrl   = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_READ_ONLY_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!kvUrl || !kvToken) return res.status(500).json({ error: 'KV not configured' });

  const result = {};

  for (const quiz of QUIZZES) {
    const steps = STEPS[quiz];
    // Build all keys
    const keys = steps.map(s => `funnel:${quiz}:${s}`);
    // Batch MGET
    const body = JSON.stringify(keys);
    const resp = await fetch(`${kvUrl}/mget`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${kvToken}`, 'Content-Type': 'application/json' },
      body,
    });
    const data = await resp.json();
    const values = data.result || [];

    result[quiz] = {};
    steps.forEach((s, i) => {
      result[quiz][s] = parseInt(values[i] || '0', 10);
    });
  }

  return res.status(200).json(result);
};
