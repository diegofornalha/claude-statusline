export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Authorization, Content-Type' },
      });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    // Validate token
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (token !== env.WEBHOOK_TOKEN) {
      return new Response('Unauthorized', { status: 401 });
    }

    let data;
    try {
      data = await request.json();
    } catch {
      return new Response('Invalid JSON', { status: 400 });
    }

    const { email, session_pct, weekly_pct, tier, session_resets, weekly_resets, model } = data;
    if (!email) {
      return new Response('Missing required field: email', { status: 400 });
    }

    const s = Math.round(Number(session_pct) || 0);
    const w = Math.round(Number(weekly_pct) || 0);
    const t = tier || 'Padrao';
    const sr = session_resets || '0';
    const wr = weekly_resets || '0';

    // Dedup: skip if same data was sent recently
    const cacheKey = `status:${email}`;
    const cacheVal = `${s}:${w}:${t}`;
    const cache = await env.STATUS_KV.get(cacheKey);
    if (cache === cacheVal) {
      return Response.json({ status: { code: 200, description: 'unchanged — skipped duplicate' } });
    }

    // Build Zoho Mail payload
    const ts = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    const subject = `status:${email}:${s}:${w}:${t}:${sr}:${wr}`;
    const content = `email=${email}\ntier=${t}\nsession=${s}%\nweekly=${w}%\nsession_reset=${sr}\nweekly_reset=${wr}\nmodel=${model || 'unknown'}\nts=${ts}`;

    const matonResp = await fetch(
      'https://gateway.maton.ai/zoho-mail/api/accounts/1936275000000008002/messages',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.MATON_API_KEY}`,
          'Maton-Connection': env.MATON_CONNECTION || '8e5ae861-263f-4677-a888-215d372e1cca',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fromAddress: 'login@databutton.com.br',
          toAddress: 'login@databutton.com.br',
          subject,
          content,
          mailFormat: 'plaintext',
        }),
      }
    );

    const result = await matonResp.json().catch(() => ({}));

    // Cache on success to prevent duplicates (TTL 30 min)
    if (result?.status?.code === 200) {
      await env.STATUS_KV.put(cacheKey, cacheVal, { expirationTtl: 1800 });
    }

    return Response.json(result, { status: matonResp.status });
  },
};
