const ACCOUNT_ID = '1936275000000008002';
const MATON_BASE = 'https://gateway.maton.ai/zoho-mail';
const FROM_TO = 'login@databutton.com.br';
const DEFAULT_CONNECTION = '8e5ae861-263f-4677-a888-215d372e1cca';

function matonHeaders(env) {
  return {
    'Authorization': `Bearer ${env.MATON_API_KEY}`,
    'Maton-Connection': env.MATON_CONNECTION || DEFAULT_CONNECTION,
    'Content-Type': 'application/json',
  };
}

// Search and delete old status emails for this user
async function cleanOldStatusEmails(email, env) {
  try {
    const searchKey = encodeURIComponent(`subject:status:${email}`);
    const url = `${MATON_BASE}/api/accounts/${ACCOUNT_ID}/messages/search?searchKey=${searchKey}&limit=50`;
    const resp = await fetch(url, { headers: matonHeaders(env) });
    const json = await resp.json().catch(() => ({}));

    const messages = json?.data || [];
    if (!messages.length) return 0;

    // Get folderId from first message, delete all
    let deleted = 0;
    for (const msg of messages) {
      const folderId = msg.folderId || msg.folderID;
      const messageId = msg.messageId || msg.messageID;
      if (!folderId || !messageId) continue;

      await fetch(
        `${MATON_BASE}/api/accounts/${ACCOUNT_ID}/folders/${folderId}/messages/${messageId}`,
        { method: 'DELETE', headers: matonHeaders(env) }
      );
      deleted++;
    }
    return deleted;
  } catch {
    return 0;
  }
}

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

    // Delete old status emails for this user before sending new one
    const deleted = await cleanOldStatusEmails(email, env);

    // Build and send new status email
    const ts = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    const subject = `status:${email}:${s}:${w}:${t}:${sr}:${wr}`;
    const content = `email=${email}\ntier=${t}\nsession=${s}%\nweekly=${w}%\nsession_reset=${sr}\nweekly_reset=${wr}\nmodel=${model || 'unknown'}\nts=${ts}`;

    const matonResp = await fetch(
      `${MATON_BASE}/api/accounts/${ACCOUNT_ID}/messages`,
      {
        method: 'POST',
        headers: matonHeaders(env),
        body: JSON.stringify({
          fromAddress: FROM_TO,
          toAddress: FROM_TO,
          subject,
          content,
          mailFormat: 'plaintext',
        }),
      }
    );

    const result = await matonResp.json().catch(() => ({}));

    // Cache on success (TTL 30 min)
    if (result?.status?.code === 200) {
      await env.STATUS_KV.put(cacheKey, cacheVal, { expirationTtl: 1800 });
    }

    return Response.json({ ...result, cleaned: deleted }, { status: matonResp.status });
  },
};
