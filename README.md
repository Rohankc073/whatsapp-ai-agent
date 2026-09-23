# WhatsApp AI Agent

Automatically replies to messages on your WhatsApp Business number using OpenAI, your own reply rules and your business knowledge. Includes a login-protected dashboard with a live conversation viewer.

**Stack:** Next.js 15 · Supabase (Postgres, Auth, Realtime) · OpenAI · WhatsApp Cloud API · Vercel

## How replies work

For every incoming message:

1. The message is saved and appears live in **Conversations**.
2. If AI is off (globally in **Settings**, or for that chat), nothing is sent. You reply by hand.
3. The agent waits ~4 seconds, so several quick messages get one combined reply.
4. **Reply rules** are checked first, lowest priority number first:
   - **Exact reply** rules send your text word-for-word.
   - **AI guided** rules tell the AI how to answer.
   - **"Customer is…"** (intent) rules are matched by meaning, so the AI decides if they apply.
5. Otherwise the AI answers using only your **Knowledge** entries. It never promises funding, valuations or terms.
6. If the customer asks for a human, or the AI can't help, it sends your handoff message and turns AI off for that chat. The chat is flagged **Needs human**.

Use **Reply rules → Test the agent** to try messages without sending anything on WhatsApp.

Lead-form messages from Meta ads are answered like any other message. A starter "Lead form message" rule tells the AI to thank the person by name and ask about their business stage.

## Broadcasts (bulk messages)

Send the same message to many numbers, e.g. 20–30 leads, without opening each chat.

1. In [WhatsApp Manager → Message templates](https://business.facebook.com/wa/manage/message-templates/), create a template and wait for approval. WhatsApp only lets businesses start a conversation with an **approved template**.
   - Use `{{1}}` for the person's name.
   - To link a form, add a **Call to action → Visit website** button. Choose a *Dynamic* URL such as `https://yoursite.com/apply?ref={{1}}` and fill it with `{phone}`, so later you can tell who opened it.
2. In the dashboard go to **Broadcasts → New broadcast**. Paste numbers (one per line, optionally with a name) or upload a CSV. 10-digit numbers get the default country code (+91).
3. Pick the template, fill the blanks (`{first_name}`, `{name}` and `{phone}` are replaced for each person), check the preview and send.
4. Watch each number go sent → delivered → read → replied. Every message also appears in **Conversations**, and when someone replies the AI agent takes over.

If someone replies **STOP**, they're unsubscribed and skipped by future broadcasts. **START** subscribes them again.

Meta charges per template message. Keep lists to people who agreed to hear from you (e.g. your ad leads), because blocks and reports lower your number's quality rating.

## Setup

### 1. Supabase
1. Create a project at [supabase.com](https://supabase.com).
2. In the **SQL Editor**, run `supabase/migrations/0001_init.sql`, then `0002_broadcasts.sql`, then `supabase/seed.sql`.
3. Go to **Authentication → Sign In / Providers** and turn **off** "Allow new users to sign up". Only the users you add can log in.
4. Go to **Authentication → Users → Add user** and create your dashboard login (email and password).
5. Copy the URL, anon key and service role key from **Project Settings → API**.

### 2. Meta / WhatsApp Cloud API
1. In [developers.facebook.com](https://developers.facebook.com), create a **Business** app and add the **WhatsApp** product.
2. Add your business phone number under **WhatsApp → API Setup**. Copy its **Phone number ID** and the **WhatsApp Business Account ID** (needed for broadcasts).
3. Create a **permanent access token**: Business Settings → System users → add a user → assign the app and your WhatsApp account → generate a token with `whatsapp_business_messaging` and `whatsapp_business_management`.
4. Copy the **App secret** from App settings → Basic.
5. After deploying (step 4), open **WhatsApp → Configuration → Webhook**:
   - Callback URL: `https://YOUR-DOMAIN/api/webhook/whatsapp` (also shown on the dashboard's Settings page)
   - Verify token: the same value as `META_VERIFY_TOKEN`
   - Click **Verify and save**, then **subscribe to the `messages` field**.

> **Existing CRM integration:** a WhatsApp Business Account can have several apps subscribed to its webhooks, so your CRM keeps receiving leads. If your CRM is a WhatsApp provider (BSP) that owns the number, ask them to forward webhooks to this URL instead.
>
> **Using the WhatsApp Business app on the same number?** The number must be connected to the Cloud API, either directly or with Meta's *Coexistence* onboarding.

### 3. Run locally
```bash
cp .env.example .env.local   # fill in all values
npm install
npm run dev
```
To receive real webhooks locally, expose the app with `ngrok http 3000` and use the ngrok URL as the callback URL.

### 4. Deploy to Vercel
1. Push this folder to GitHub and import it in [vercel.com](https://vercel.com).
2. Add every variable from `.env.example` under **Settings → Environment Variables**.
3. Deploy, then set the webhook URL in Meta (step 2.5).

## Commands
| | |
|---|---|
| `npm run dev` | Start the dev server |
| `npm test` | Unit tests (rule matching, webhook signature, payload parsing) |
| `npm run typecheck` / `npm run lint` | Static checks |
| `npm run build` | Production build |

## Notes
- WhatsApp only allows free-form replies within **24 hours** of the customer's last message. Auto-replies are always inside that window. A manual reply to an older chat shows an error.
- Only text is understood. Photos and voice notes get the "unsupported message" reply (editable in Settings).
- Change the OpenAI model in **Settings** (the default comes from `OPENAI_MODEL`).
