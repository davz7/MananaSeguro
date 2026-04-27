# WhatsApp Adapter — Mañana Seguro

FastAPI webhook that connects Meta Cloud API to the Mañana Seguro bot logic.

## Flows

| Input | Response |
|---|---|
| Free text | Claude advisory (AI) |
| A number | Asks for years → returns retirement projection |
| Anything else | Claude handles it conversationally |

---

## 1. Get Meta credentials (free)

1. Go to [developers.facebook.com](https://developers.facebook.com) → **Create App** → **Business** → **WhatsApp**.
2. In **WhatsApp > API Setup** you'll find:
   - **Phone Number ID** → `WHATSAPP_PHONE_NUMBER_ID`
   - **Temporary access token** → `WHATSAPP_TOKEN` (valid 24 h; generate a permanent one for production)
3. Choose any string for `WHATSAPP_VERIFY_TOKEN` (e.g. `manana_seguro_dev`).

---

## 2. Expose your local server with ngrok

```bash
# Install ngrok: https://ngrok.com/download
ngrok http 8000
# Copy the https URL, e.g. https://abc123.ngrok-free.app
```

---

## 3. Register the webhook in Meta

1. In **WhatsApp > Configuration > Webhook**, click **Edit**.
2. **Callback URL**: `https://abc123.ngrok-free.app/webhook`
3. **Verify token**: the value you set in `WHATSAPP_VERIFY_TOKEN`
4. Subscribe to the **messages** field.

---

## 4. Run locally

```bash
cd manana-seguro-bot
cp .env.example .env
# Fill in WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_VERIFY_TOKEN, ANTHROPIC_API_KEY

pip install -r requirements.txt
uvicorn whatsapp.webhook:app --reload --port 8000
```

Send a WhatsApp message to the test number shown in the Meta dashboard.

---

## Environment variables

| Variable | Description |
|---|---|
| `WHATSAPP_TOKEN` | Meta Cloud API access token |
| `WHATSAPP_PHONE_NUMBER_ID` | From Meta Business dashboard |
| `WHATSAPP_VERIFY_TOKEN` | Any string you choose for webhook verification |
| `ANTHROPIC_API_KEY` | From [console.anthropic.com](https://console.anthropic.com) |
