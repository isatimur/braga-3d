// Find the chat id for TELEGRAM_CHAT_ID (api/coder.js). Send your bot any
// message in Telegram first, then run:
//
//   TELEGRAM_BOT_TOKEN=<token> node scripts/telegram-whoami.mjs
//
// It prints the chat id, type and first name of everyone who wrote to the bot
// in the last 24 h. It reads updates without an offset, so it consumes none.
// It never prints the token.
const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
if (!token) {
  console.error('Set TELEGRAM_BOT_TOKEN in the environment (from @BotFather).');
  process.exit(1);
}

async function call(method, body = {}) {
  const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
  const j = await r.json().catch(() => null);
  if (!j?.ok) throw new Error(`${method}: HTTP ${r.status} ${j?.description || ''}`.trim());
  return j.result;
}

try {
  const me = await call('getMe');
  console.log(`Bot: @${me.username} (id ${me.id})`);
  const hook = await call('getWebhookInfo');
  if (hook.url) console.log('Warning: this bot has a webhook set; /api/coder needs none (getUpdates fails while one is set). Remove it with deleteWebhook.');
  const updates = await call('getUpdates', { limit: 100, timeout: 0 });
  const seen = new Map();
  for (const u of updates) {
    const m = u.message || u.edited_message;
    if (!m?.chat) continue;
    seen.set(m.chat.id, { type: m.chat.type, name: m.chat.first_name || m.chat.title || '', user: m.from?.username || '' });
  }
  if (!seen.size) {
    console.log('No messages yet. Open the bot in Telegram, press Start or send "hi", and run this again.');
  } else {
    console.log('Chats that wrote to the bot (chat id  type  name):');
    for (const [id, c] of seen) console.log(`  ${id}  ${c.type}  ${c.name}${c.user ? ` (@${c.user})` : ''}`);
    console.log('Set TELEGRAM_CHAT_ID to your own chat id (type "private").');
  }
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
