module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const kvUrl   = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  if (!kvUrl || !kvToken) return res.status(500).json({ error: 'KV not configured' });

  const auth = { Authorization: `Bearer ${kvToken}` };

  // Find all funnel:* keys via SCAN
  let cursor = '0';
  const allKeys = [];
  do {
    const r = await fetch(`${kvUrl}/scan/${cursor}?match=funnel:*&count=100`, { headers: auth });
    const d = await r.json();
    const [nextCursor, keys] = d.result;
    cursor = nextCursor;
    allKeys.push(...keys);
  } while (cursor !== '0');

  if (allKeys.length === 0) return res.status(200).json({ deleted: 0 });

  // Delete all found keys via DEL (path format)
  const del = await fetch(`${kvUrl}/del/${allKeys.map(k => encodeURIComponent(k)).join('/')}`, {
    method: 'POST',
    headers: auth,
  });
  const result = await del.json();

  return res.status(200).json({ deleted: allKeys.length, result: result.result });
};
