"""
WhatsApp Cloud API webhook for Mañana Seguro.

Flows:
  - Free text  → Claude advisory (core/ai_advisor.py)
  - Number     → ask for years, then return projection (core/proyecciones.py)
  - Any other  → Claude handles it conversationally
"""

import os
import httpx
from fastapi import FastAPI, Request, Response
from dotenv import load_dotenv

from core.ai_advisor import ask_claude
from core.proyecciones import calcular_proyeccion, usd, mxn

load_dotenv()

WHATSAPP_TOKEN = os.environ.get("WHATSAPP_TOKEN", "")
PHONE_NUMBER_ID = os.environ.get("WHATSAPP_PHONE_NUMBER_ID", "")
VERIFY_TOKEN = os.environ.get("WHATSAPP_VERIFY_TOKEN", "")

API_URL = f"https://graph.facebook.com/v19.0/{PHONE_NUMBER_ID}/messages"

app = FastAPI()

# In-memory state: {phone: {"step": "awaiting_years", "mensual": float}}
_sessions: dict[str, dict] = {}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _send(to: str, text: str) -> None:
    httpx.post(
        API_URL,
        headers={"Authorization": f"Bearer {WHATSAPP_TOKEN}"},
        json={
            "messaging_product": "whatsapp",
            "to": to,
            "type": "text",
            "text": {"body": text},
        },
        timeout=10,
    )


def _projection_text(mensual: float, anios: int) -> str:
    p = calcular_proyeccion(mensual, anios)
    return (
        f"📊 *Proyección Mañana Seguro*\n\n"
        f"💵 Ahorro mensual: {usd(mensual)}\n"
        f"📅 Plazo: {anios} años\n\n"
        f"💰 Balance final: {usd(p['balance_final'])} ({mxn(p['en_pesos'])})\n"
        f"📈 Rendimiento: {usd(p['rendimiento'])}\n"
        f"🎁 Incentivos: {usd(p['incentivos'])}\n"
        f"🏖️ Ingreso mensual al retiro: {usd(p['ingreso_mensual'])}\n\n"
        f"¡Empieza desde $2 USDC/mes! 🚀"
    )


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/webhook")
def verify(request: Request):
    """Meta webhook verification challenge."""
    params = request.query_params
    if (
        params.get("hub.mode") == "subscribe"
        and params.get("hub.verify_token") == VERIFY_TOKEN
    ):
        return Response(content=params["hub.challenge"], media_type="text/plain")
    return Response(status_code=403)


@app.post("/webhook")
async def receive(request: Request):
    body = await request.json()

    try:
        entry = body["entry"][0]["changes"][0]["value"]
        msg = entry["messages"][0]
    except (KeyError, IndexError):
        return {"status": "ignored"}

    phone = msg["from"]
    text = msg.get("text", {}).get("body", "").strip()

    if not text:
        return {"status": "ignored"}

    session = _sessions.get(phone, {})

    # ── Step 2: user replied with years ──────────────────────────────────────
    if session.get("step") == "awaiting_years":
        try:
            anios = int(text)
            if not (1 <= anios <= 50):
                raise ValueError
        except ValueError:
            _send(phone, "Por favor escribe un número de años entre 1 y 50 📅")
            return {"status": "ok"}

        mensual = session["mensual"]
        _sessions.pop(phone, None)
        _send(phone, _projection_text(mensual, anios))
        return {"status": "ok"}

    # ── Step 1: user sent a number (monthly savings) ──────────────────────────
    try:
        mensual = float(text.replace(",", "."))
        if mensual <= 0:
            raise ValueError
        _sessions[phone] = {"step": "awaiting_years", "mensual": mensual}
        _send(phone, f"¿Cuántos años planeas ahorrar? 📅 (escribe solo el número, ej: 20)")
        return {"status": "ok"}
    except ValueError:
        pass

    # ── Default: Claude advisory ──────────────────────────────────────────────
    _sessions.pop(phone, None)
    reply = ask_claude(text)
    _send(phone, reply)
    return {"status": "ok"}
