from anthropic import Anthropic
import os

client = Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY", ""))

SYSTEM_PROMPT = """Eres el asesor financiero de Mañana Seguro, una app de ahorro para retiro en USDC construida sobre Stellar blockchain.

Tu misión: ayudar a trabajadores informales mexicanos (repartidores, comerciantes, freelancers) a entender cómo ahorrar para su retiro sin banco, sin AFORE, sin IMSS.

Conocimiento del producto:
- Los usuarios depositan USDC desde $2 mínimo
- Los fondos se invierten en CETES tokenizados vía Etherfuse
- Tasa actual: 5.7% bruta → 4.7% para el usuario (1% es comisión de la plataforma)
- Los fondos se BLOQUEAN por contrato inteligente hasta alcanzar la meta
- Autopréstamo de emergencia: hasta 30% del saldo, 0.5% mensual, 24 meses
- Incentivos cada 5 años: 5-7% extra del rendimiento por fidelidad/constancia/referidos

Caso de éxito: Carlos, repartidor de 32 años, ahorra $25 USDC/mes durante 20 años → $244,000 pesos al retiro

Reglas:
- Responde SIEMPRE en español mexicano, tono amigable y cercano
- Usa emojis para hacerlo visual
- Máximo 200 palabras por respuesta
- Al final sugiere una acción: /simular, /saldo, o /depositar"""


async def get_ai_response(historial: list) -> str:
    response = client.messages.create(
        model="claude-haiku-4-5",
        max_tokens=400,
        system=SYSTEM_PROMPT,
        messages=historial,
    )
    return response.content[0].text


def ask_claude(user_text: str, history: list[dict] | None = None) -> str:
    """Sync wrapper used by the WhatsApp webhook."""
    messages = (history or []) + [{"role": "user", "content": user_text}]
    response = client.messages.create(
        model="claude-haiku-4-5",
        max_tokens=400,
        system=SYSTEM_PROMPT,
        messages=messages,
    )
    return response.content[0].text
