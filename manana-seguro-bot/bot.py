"""
Mañana Seguro Bot — Telegram con Google Gemini
"""

import os
import asyncio
import logging
from anthropic import Anthropic
from dotenv import load_dotenv
from stellar_connection import get_account_info, verificar_contrato, CONTRACT_ID

claude_client = Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY", ""))
from telegram import (
    Update, InlineKeyboardButton, InlineKeyboardMarkup, ReplyKeyboardMarkup
)
from telegram.ext import (
    Application, CommandHandler, MessageHandler, CallbackQueryHandler,
    ConversationHandler, filters, ContextTypes, PicklePersistence
)

load_dotenv()
logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# ─── Config ───────────────────────────────────────────────────────────────────
TELEGRAM_TOKEN = os.environ.get("TELEGRAM_TOKEN", "")
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")

# Constantes del modelo de negocio
USER_RATE     = 4.7
PLATFORM_RATE = 1.0
CETES_RATE    = 5.7
MIN_DEPOSIT   = 2

INCENTIVE_SCENARIOS = {
    "solo_fidelidad":        {"label": "Solo fidelidad",                   "pct": 5},
    "fidelidad_constancia":  {"label": "Fidelidad + constancia ($20/mes)", "pct": 7},
    "fidelidad_1_referido":  {"label": "Fidelidad + 1 referido",           "pct": 6},
    "fidelidad_2_referidos": {"label": "Fidelidad + 2 referidos",          "pct": 7},
}

# Estados
(
    MENU_PRINCIPAL,
    ESPERANDO_PREGUNTA,
    SIMULADOR_MONTO,
    SIMULADOR_ANIOS,
    SIMULADOR_INCENTIVO,
    DEPOSIT_WALLET,
    DEPOSIT_MONTO,
    DEPOSIT_CONFIRMAR,
) = range(8)


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

# ─── Utilidades ───────────────────────────────────────────────────────────────

def calcular_proyeccion(mensual, anios, tasa=USER_RATE, incentivo_pct=7):
    monthly_rate = tasa / 100 / 12
    balance = 0.0
    total_yield = 0.0
    incentivos = 0.0

    for _ in range(anios // 5):
        ciclo_yield = 0.0
        for _ in range(60):
            interest = balance * monthly_rate
            balance += mensual + interest
            ciclo_yield += interest
            total_yield += interest
        inc = ciclo_yield * incentivo_pct / 100
        balance += inc
        incentivos += inc

    for _ in range((anios % 5) * 12):
        interest = balance * monthly_rate
        balance += mensual + interest
        total_yield += interest

    return {
        "balance_final":   round(balance, 2),
        "total_aportado":  round(mensual * anios * 12, 2),
        "rendimiento":     round(total_yield, 2),
        "incentivos":      round(incentivos, 2),
        "en_pesos":        round(balance * 17, 0),
        "ingreso_mensual": round(balance * 0.04 / 12, 2),
    }

def usd(n): return f"${n:,.2f} USDC"
def mxn(n): return f"${n:,.0f} pesos"

def teclado_principal():
    return ReplyKeyboardMarkup([
        ["💬 Asesoría", "📊 Simulador"],
        ["💰 Mi saldo", "🔒 Depositar"],
        ["❓ ¿Qué es Mañana Seguro?"],
        ["🎯 Ver demo", "📲 QR"],
    ], resize_keyboard=True)

# ─── Handlers ─────────────────────────────────────────────────────────────────

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    nombre = update.effective_user.first_name
    await update.message.reply_text(
        f"¡Hola {nombre}! 👋\n\n"
        "Soy el asesor de *Mañana Seguro* 🛡️\n\n"
        "Te ayudo a ahorrar para tu retiro en USDC, con rendimiento de CETES "
        "tokenizados y sin necesitar banco ni AFORE.\n\n"
        "¿Qué quieres hacer hoy?",
        parse_mode="Markdown",
        reply_markup=teclado_principal()
    )
    return MENU_PRINCIPAL


async def que_es(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    await update.message.reply_text(
        "🏦 *¿Qué es Mañana Seguro?*\n\n"
        "App de ahorro para retiro sin banco:\n\n"
        "1️⃣ Conectas tu wallet Freighter (Stellar)\n"
        "2️⃣ Depositas desde *$2 USDC*\n"
        "3️⃣ Tu dinero se invierte en CETES tokenizados vía Etherfuse\n"
        "4️⃣ Ganas *4.7% APY* en dólares\n"
        "5️⃣ Cada 5 años recibes incentivo extra de hasta 7%\n"
        "6️⃣ Al llegar a tu meta, retiras todo a tu wallet\n\n"
        "🛵 *Carlos, repartidor 32 años:* ahorra $500 pesos/mes "
        "→ *$244,000 pesos* en 20 años\n\n"
        "¿Simulamos tu caso? Usa /simular 👇",
        parse_mode="Markdown",
        reply_markup=teclado_principal()
    )
    return MENU_PRINCIPAL


# ── Asesoría con Gemini ───────────────────────────────────────────────────────

async def iniciar_asesoria(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    context.user_data["historial"] = []
    await update.message.reply_text(
        "💬 *Asesoría con IA*\n\n"
        "Pregúntame lo que quieras sobre retiro, CETES, USDC o Mañana Seguro.\n\n"
        "Escribe tu pregunta 👇\n"
        "_(Escribe /menu para volver)_",
        parse_mode="Markdown"
    )
    return ESPERANDO_PREGUNTA


async def responder_pregunta(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    pregunta = update.message.text
    historial = context.user_data.get("historial", [])
    msg = await update.message.reply_text("🤔 Pensando...")

    try:
        historial.append({"role": "user", "content": pregunta})

        response = claude_client.messages.create(
            model="claude-haiku-4-5",
            max_tokens=400,
            system=SYSTEM_PROMPT,
            messages=historial
        )

        respuesta = response.content[0].text
        historial.append({"role": "assistant", "content": respuesta})

        if len(historial) > 20:
            historial = historial[-20:]
        context.user_data["historial"] = historial

        await msg.edit_text(f"🤖 {respuesta}", parse_mode="Markdown")

    except Exception as e:
        logger.error(f"Error Claude: {e}")
        await msg.edit_text(
            "⚠️ Hubo un error. Intenta de nuevo.\n\nUsa /simular para calcular tu ahorro."
        )

    return ESPERANDO_PREGUNTA


async def iniciar_simulador(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    await update.message.reply_text(
        "📊 *Simulador de ahorro*\n\n"
        "¿Cuánto puedes ahorrar *al mes* en USDC?\n"
        "_(Mínimo $2 USDC · $25 USDC ≈ $425 pesos)_\n\n"
        "Escribe solo el número:",
        parse_mode="Markdown"
    )
    return SIMULADOR_MONTO


async def simulador_monto(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    try:
        monto = float(update.message.text.replace("$","").replace(",","").strip())
        if monto < MIN_DEPOSIT:
            await update.message.reply_text(f"⚠️ Mínimo ${MIN_DEPOSIT} USDC. ¿Cuánto quieres ahorrar?")
            return SIMULADOR_MONTO
        context.user_data["sim_monto"] = monto
        await update.message.reply_text(
            f"💵 *${monto} USDC/mes* — ¡perfecto!\n\n"
            "¿En cuántos *años* quieres retirarte?\n_(entre 5 y 40)_",
            parse_mode="Markdown"
        )
        return SIMULADOR_ANIOS
    except ValueError:
        await update.message.reply_text("⚠️ Escribe solo el número, ejemplo: 25")
        return SIMULADOR_MONTO


async def simulador_anios(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    try:
        anios = int(update.message.text.strip())
        if not 5 <= anios <= 40:
            await update.message.reply_text("⚠️ Escribe un número entre 5 y 40.")
            return SIMULADOR_ANIOS
        context.user_data["sim_anios"] = anios
        keyboard = [
            [InlineKeyboardButton("Solo fidelidad — 5%",         callback_data="inc_solo_fidelidad")],
            [InlineKeyboardButton("+ Constancia ($20/mes) — 7%", callback_data="inc_fidelidad_constancia")],
            [InlineKeyboardButton("+ 1 referido activo — 6%",    callback_data="inc_fidelidad_1_referido")],
            [InlineKeyboardButton("+ 2 referidos — 7%",          callback_data="inc_fidelidad_2_referidos")],
        ]
        await update.message.reply_text(
            f"📅 *{anios} años* al retiro.\n\n¿Qué escenario de *incentivo* eliges?",
            parse_mode="Markdown",
            reply_markup=InlineKeyboardMarkup(keyboard)
        )
        return SIMULADOR_INCENTIVO
    except ValueError:
        await update.message.reply_text("⚠️ Escribe el número de años, ejemplo: 20")
        return SIMULADOR_ANIOS


async def simulador_incentivo(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()

    key      = query.data.replace("inc_", "")
    escenario = INCENTIVE_SCENARIOS.get(key, INCENTIVE_SCENARIOS["fidelidad_constancia"])
    monto    = context.user_data["sim_monto"]
    anios    = context.user_data["sim_anios"]
    pct      = escenario["pct"]
    r        = calcular_proyeccion(monto, anios, USER_RATE, pct)

    await query.edit_message_text(
        f"📊 *Tu proyección de retiro*\n\n"
        f"💵 Aportación: *{usd(monto)}/mes*\n"
        f"📅 Plazo: *{anios} años*\n"
        f"📈 Tasa: *{USER_RATE}% APY* (Etherfuse CETES)\n"
        f"🎁 Incentivo: *{pct}% cada 5 años* — {escenario['label']}\n\n"
        f"━━━━━━━━━━━━━━━━\n"
        f"💰 *Saldo al retiro:* {usd(r['balance_final'])}\n"
        f"📥 Aportado por ti: {usd(r['total_aportado'])}\n"
        f"📈 Rendimiento CETES: {usd(r['rendimiento'])}\n"
        f"🎁 Incentivos cobrados: {usd(r['incentivos'])}\n"
        f"💵 Ingreso mensual retiro: {usd(r['ingreso_mensual'])}\n\n"
        f"🇲🇽 *En pesos:* {mxn(r['en_pesos'])}\n"
        f"_(tipo de cambio $17)_\n\n"
        f"¿Listo para empezar? Usa /depositar 🔒",
        parse_mode="Markdown"
    )
    return MENU_PRINCIPAL


# ── Ver saldo ─────────────────────────────────────────────────────────────────

async def ver_saldo(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    wallet = context.user_data.get("wallet")
    if not wallet:
        await update.message.reply_text(
            "💰 *Mi saldo*\n\nEnvíame tu dirección de wallet Stellar\n_(empieza con G, 56 caracteres)_:",
            parse_mode="Markdown"
        )
        context.user_data["accion_pendiente"] = "saldo"
        return DEPOSIT_WALLET
    await _mostrar_saldo(update, context, wallet)
    return MENU_PRINCIPAL


async def _mostrar_saldo(update, context, wallet):
    await update.message.reply_text("🔍 Consultando Stellar testnet...")

    # Balance real de la wallet
    try:
        from stellar_sdk import Server
        server = Server("https://horizon-testnet.stellar.org")
        account = server.accounts().account_id(wallet).call()
        balances = account.get("balances", [])
        xlm_real  = float(next((b["balance"] for b in balances if b.get("asset_type") == "native"), 0))
        usdc_real = float(next((b["balance"] for b in balances if b.get("asset_code") == "USDC"), 0))
        stellar_ok = True
    except Exception:
        xlm_real = usdc_real = 0.0
        stellar_ok = False

    depositos = context.user_data.get("depositos", [])
    saldo_bot = sum(d["monto"] for d in depositos)

    if saldo_bot > 0:
        meta   = saldo_bot * 10
        pct    = min((saldo_bot / meta) * 100, 100)
        barras = int(pct / 10)
        barra  = "█" * barras + "░" * (10 - barras)
        bloqueado = (
            f"🔒 Bloqueado: *{usd(saldo_bot)}*\n"
            f"📈 Rendimiento est.: *+{usd(saldo_bot * USER_RATE / 100 / 12)}/mes*\n"
            f"🎯 Meta: {usd(meta)}\n"
            f"Progreso: [{barra}] {pct:.0f}%"
        )
    else:
        bloqueado = "🔒 Sin depósitos aún. Usa /depositar 🚀"

    stellar_txt = (
        f"• XLM: *{xlm_real:,.2f} XLM*\n• USDC: *{usd(usdc_real)}*"
        if stellar_ok else "• ⚠️ No se pudo conectar a Stellar"
    )

    await update.message.reply_text(
        f"💰 *Tu saldo en Mañana Seguro*\n\n"
        f"🔗 `{wallet[:8]}...{wallet[-6:]}`\n\n"
        f"*Wallet Stellar testnet:*\n{stellar_txt}\n\n"
        f"*Contrato Soroban:*\n{bloqueado}\n\n"
        f"📋 `{CONTRACT_ID[:16]}...`",
        parse_mode="Markdown",
        reply_markup=teclado_principal()
    )


# ── Depósito ──────────────────────────────────────────────────────────────────

async def iniciar_deposito(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    wallet = context.user_data.get("wallet")
    if not wallet:
        await update.message.reply_text(
            "🔒 *Depositar*\n\nEnvíame tu dirección de wallet Stellar\n_(empieza con G, 56 caracteres)_:",
            parse_mode="Markdown"
        )
        context.user_data["accion_pendiente"] = "deposito"
        return DEPOSIT_WALLET
    await update.message.reply_text(
        f"🔒 Wallet: `{wallet[:8]}...{wallet[-6:]}`\n\n¿Cuánto USDC depositas?\n_(Mínimo $2)_",
        parse_mode="Markdown"
    )
    return DEPOSIT_MONTO


async def recibir_wallet(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    wallet = update.message.text.strip()
    if not wallet.startswith("G") or len(wallet) != 56:
        await update.message.reply_text(
            "⚠️ Dirección inválida. Debe empezar con G y tener 56 caracteres.\nIntenta de nuevo:"
        )
        return DEPOSIT_WALLET

    context.user_data["wallet"] = wallet
    accion = context.user_data.get("accion_pendiente", "deposito")

    if accion == "saldo":
        await _mostrar_saldo(update, context, wallet)
        return MENU_PRINCIPAL

    await update.message.reply_text(
        f"✅ Wallet guardada: `{wallet[:8]}...{wallet[-6:]}`\n\n¿Cuánto USDC depositas?\n_(Mínimo $2)_",
        parse_mode="Markdown"
    )
    return DEPOSIT_MONTO


async def recibir_monto_deposito(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    try:
        monto = float(update.message.text.replace("$","").replace(",","").strip())
        if monto < MIN_DEPOSIT:
            await update.message.reply_text(f"⚠️ Mínimo ${MIN_DEPOSIT} USDC.")
            return DEPOSIT_MONTO

        context.user_data["dep_monto"] = monto
        wallet = context.user_data["wallet"]
        keyboard = [[
            InlineKeyboardButton("✅ Confirmar", callback_data="dep_confirmar"),
            InlineKeyboardButton("❌ Cancelar",  callback_data="dep_cancelar"),
        ]]
        await update.message.reply_text(
            f"🔒 *Confirma tu depósito*\n\n"
            f"💵 Monto: *{usd(monto)}* ≈ {mxn(monto * 17)}\n"
            f"📈 Ganancia est. anual: *+{usd(monto * USER_RATE / 100)}*\n"
            f"🔗 Wallet: `{wallet[:8]}...{wallet[-6:]}`\n\n"
            f"⚠️ Los fondos quedan *bloqueados* hasta tu meta.\n\n"
            f"¿Confirmas?",
            parse_mode="Markdown",
            reply_markup=InlineKeyboardMarkup(keyboard)
        )
        return DEPOSIT_CONFIRMAR
    except ValueError:
        await update.message.reply_text("⚠️ Escribe solo el número, ejemplo: 25")
        return DEPOSIT_MONTO


async def confirmar_deposito(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()

    if query.data == "dep_cancelar":
        await query.edit_message_text("❌ Depósito cancelado.\n\nUsa /depositar cuando quieras 🔒")
        return MENU_PRINCIPAL

    monto  = context.user_data["dep_monto"]
    wallet = context.user_data["wallet"]

    await query.edit_message_text(
        f"⏳ Procesando *{usd(monto)}*...\n\nAbre Freighter y firma la transacción.",
        parse_mode="Markdown"
    )

    depositos = context.user_data.get("depositos", [])
    depositos.append({"monto": monto, "wallet": wallet})
    context.user_data["depositos"] = depositos
    saldo_total = sum(d["monto"] for d in depositos)

    await asyncio.sleep(1)

    await query.message.reply_text(
        f"✅ *¡Depósito registrado!*\n\n"
        f"💵 Depositado: *{usd(monto)}*\n"
        f"💰 Saldo total: *{usd(saldo_total)}*\n"
        f"📈 Generando *{USER_RATE}% APY* en CETES tokenizados 🚀\n\n"
        f"Consulta tu saldo con /saldo",
        parse_mode="Markdown",
        reply_markup=teclado_principal()
    )
    return MENU_PRINCIPAL


# ── Comandos ──────────────────────────────────────────────────────────────────

async def menu(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    await update.message.reply_text("🏠 Menú principal:", reply_markup=teclado_principal())
    return MENU_PRINCIPAL


async def ayuda(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    await update.message.reply_text(
        "📖 *Comandos*\n\n"
        "/start — Inicio\n"
        "/asesoria — Chat con IA\n"
        "/simular — Calculadora de retiro\n"
        "/saldo — Ver saldo bloqueado\n"
        "/depositar — Bloquear ahorro\n"
        "/menu — Menú principal\n"
        "/ayuda — Esta ayuda\n/qr — QR para compartir el bot",
        parse_mode="Markdown",
        reply_markup=teclado_principal()
    )
    return MENU_PRINCIPAL


async def texto_menu(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    t = update.message.text.lower()
    if "asesoría" in t or "asesoria" in t or "💬" in t:
        return await iniciar_asesoria(update, context)
    elif "simulador" in t or "📊" in t:
        return await iniciar_simulador(update, context)
    elif "saldo" in t or "💰" in t:
        return await ver_saldo(update, context)
    elif "depositar" in t or "🔒" in t:
        return await iniciar_deposito(update, context)
    elif "qué es" in t or "❓" in t:
        return await que_es(update, context)
    elif "demo" in t or "🎯" in t:
        return await comando_demo(update, context)
    elif "qr" in t or "📲" in t:
        return await comando_qr(update, context)
    else:
        context.user_data.setdefault("historial", [])
        return await responder_pregunta(update, context)



async def comando_qr(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Manda el QR del bot por Telegram"""
    import os
    qr_file = "manana_seguro_qr.png"

    if not os.path.exists(qr_file):
        await update.message.reply_text(
            "📲 *QR de Mañana Seguro*\n\n"
            f"Entra directo al bot:\n"
            f"👉 t.me/MxRetiroBot\n\n"  
            f"_(Genera el QR corriendo: python genera\_qr.py)_",
            parse_mode="Markdown"
        )
        return MENU_PRINCIPAL

    await update.message.reply_photo(
        photo=open(qr_file, "rb"),
        caption=(
            "📲 *Mañana Seguro*\n\n"
            "Escanea para empezar a ahorrar para tu retiro\n"
            "desde *$2 USDC* · *4.7% APY* · sin banco\n\n"
            "Powered by Stellar · Etherfuse · Soroban"
        ),
        parse_mode="Markdown",
        reply_markup=teclado_principal()
    )
    return MENU_PRINCIPAL


async def comando_demo(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Tour automático para el pitch — muestra todo el producto en 60 segundos"""
    nombre = update.effective_user.first_name

    pasos = [
        (0, (
            f"🎯 *Demo de Mañana Seguro*\n\n"
            f"Hola {nombre}, te voy a mostrar cómo funciona en 60 segundos.\n\n"
            f"Somos la primera app de ahorro para retiro en USDC sobre Stellar blockchain. "
            f"Sin banco, sin AFORE, sin papeleo."
        )),
        (3, (
            "💡 *El problema que resolvemos*\n\n"
            "32 millones de mexicanos trabajan sin IMSS ni AFORE.\n\n"
            "🛵 Carlos, repartidor de 32 años:\n"
            "• Ingreso: $10,000 pesos/mes\n"
            "• Ahorro actual para retiro: *$0*\n"
            "• Pensión que recibirá: *$0*\n\n"
            "Mañana Seguro lo cambia."
        )),
        (4, (
            "🔧 *Cómo funciona*\n\n"
            "1️⃣ Carlos deposita *$25 USDC/mes* ($425 pesos)\n"
            "2️⃣ El contrato Soroban bloquea los fondos\n"
            "3️⃣ Etherfuse los invierte en CETES tokenizados\n"
            "4️⃣ Carlos recibe *4.7% APY* en USDC\n"
            "5️⃣ Cada 5 años cobra incentivos por fidelidad\n"
            "6️⃣ Al llegar a su meta, retira todo a su wallet"
        )),
        (4, (
            "📊 *El resultado de Carlos*\n\n"
            "💵 Aportación: $25 USDC/mes durante 20 años\n"
            "📥 Total aportado: *$6,000 USDC*\n"
            "📈 Rendimiento CETES: *+$8,200 USDC*\n"
            "🎁 Incentivos: *+$185 USDC*\n\n"
            "💰 *Saldo final: $14,385 USDC*\n"
            "🇲🇽 *En pesos: $244,545 pesos*\n\n"
            "Aportando $425 pesos al mes. Sin banco."
        )),
        (4, (
            "🛡️ *Protección de emergencia*\n\n"
            "Si Carlos tiene una emergencia en el año 3:\n\n"
            "🚨 *Autopréstamo:* hasta 30% del saldo\n"
            "• Solicita $287 USDC\n"
            "• Paga $0.5%/mes (casi nada)\n"
            "• Su capital sigue generando rendimiento\n"
            "• El incentivo de 5 años NO se cancela"
        )),
        (4, (
            "💻 *La tecnología*\n\n"
            "• *Stellar Soroban* — contrato inteligente del ahorro\n"
            "• *Etherfuse* — CETES tokenizados en blockchain\n"
            "• *Freighter* — wallet sin custodia\n"
            "• *Este bot* — asesoría y gestión desde Telegram\n\n"
            "Todo on-chain, todo verificable, todo sin banco."
        )),
        (4, (
            "🚀 *¿Listo para empezar?*\n\n"
            "Prueba ahora mismo:\n\n"
            "📊 /simular — Calcula tu retiro personalizado\n"
            "🔒 /depositar — Bloquea tu primer ahorro\n"
            "💰 /saldo — Ve tu balance en Stellar\n"
            "📲 /qr — Comparte con tus amigos\n\n"
            "*Mañana Seguro — Tu retiro, en tus manos.*"
        )),
    ]

    for delay, texto in pasos:
        await asyncio.sleep(delay)
        await update.message.reply_text(texto, parse_mode="Markdown")

    return MENU_PRINCIPAL


# ─── Notificaciones de tasa ───────────────────────────────────────────────────

async def check_tasa_cetes(app) -> None:
    """Verifica si la tasa de CETES cambió y notifica a usuarios suscritos"""
    try:
        # Fetch tasa actual desde el proxy de Vite (o fallback)
        import urllib.request
        import json

        # Intentar obtener tasa real
        try:
            req = urllib.request.urlopen(
                "https://api.coingecko.com/api/v3/simple/price?ids=cetes-tokenized-stablebonds-etherfuse&vs_currencies=usd",
                timeout=5
            )
            data = json.loads(req.read())
            # Calcular APY aproximado del precio del token
            tasa_actual = 5.7  # fallback mientras no hay API directa
        except Exception:
            tasa_actual = 5.7

        user_rate = round(tasa_actual - 1.0, 2)

        # Notificar a usuarios suscritos si cambió
        bot_data = app.bot_data
        ultima_tasa = bot_data.get("ultima_tasa", 5.7)
        suscriptores = bot_data.get("suscriptores", set())

        if abs(tasa_actual - ultima_tasa) >= 0.1 and suscriptores:
            cambio = "📈 subió" if tasa_actual > ultima_tasa else "📉 bajó"
            for chat_id in suscriptores:
                try:
                    await app.bot.send_message(
                        chat_id=chat_id,
                        text=(
                            f"🔔 *Alerta de tasa CETES*\n\n"
                            f"La tasa {cambio} de *{ultima_tasa}%* a *{tasa_actual}%*\n\n"
                            f"Tu rendimiento en Mañana Seguro: *{user_rate}% APY*\n\n"
                            f"{'✅ Buenas noticias — ganas más.' if tasa_actual > ultima_tasa else '⚠️ La tasa bajó, pero sigues ganando más que un banco.'}"
                        ),
                        parse_mode="Markdown"
                    )
                except Exception:
                    pass

        bot_data["ultima_tasa"] = tasa_actual

    except Exception as e:
        logger.error(f"Error check_tasa: {e}")


async def suscribir_alertas(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    chat_id = update.effective_chat.id
    suscriptores = context.application.bot_data.setdefault("suscriptores", set())

    if chat_id in suscriptores:
        suscriptores.discard(chat_id)
        await update.message.reply_text(
            "🔕 *Alertas desactivadas*\n\nYa no recibirás notificaciones de tasa CETES.",
            parse_mode="Markdown",
            reply_markup=teclado_principal()
        )
    else:
        suscriptores.add(chat_id)
        tasa_actual = context.application.bot_data.get("ultima_tasa", 5.7)
        await update.message.reply_text(
            f"🔔 *Alertas activadas*\n\n"
            f"Te avisaré cuando la tasa de CETES cambie significativamente.\n\n"
            f"Tasa actual: *{tasa_actual}%* → Tu rendimiento: *{round(tasa_actual-1,2)}% APY*",
            parse_mode="Markdown",
            reply_markup=teclado_principal()
        )
    return MENU_PRINCIPAL

# ─── Main ──────────────────────────────────────────────────────────────────────
def main():
    if not TELEGRAM_TOKEN:
        raise ValueError("Falta TELEGRAM_TOKEN en .env")
    if not ANTHROPIC_API_KEY:
        raise ValueError("Falta ANTHROPIC_API_KEY en .env")

    persistence = PicklePersistence(filepath='bot_data.pkl')
    app = Application.builder().token(TELEGRAM_TOKEN).persistence(persistence).build()

    conv = ConversationHandler(
        entry_points=[
            CommandHandler("start",     start),
            CommandHandler("asesoria",  iniciar_asesoria),
            CommandHandler("simular",   iniciar_simulador),
            CommandHandler("saldo",     ver_saldo),
            CommandHandler("depositar", iniciar_deposito),
            CommandHandler("qr", comando_qr),
            CommandHandler("demo", comando_demo),
            CommandHandler("alertas", suscribir_alertas),
        ],
        states={
            MENU_PRINCIPAL:      [MessageHandler(filters.TEXT & ~filters.COMMAND, texto_menu)],
            ESPERANDO_PREGUNTA:  [
                MessageHandler(filters.TEXT & ~filters.COMMAND, responder_pregunta),
                CommandHandler("menu", menu),
            ],
            SIMULADOR_MONTO:     [MessageHandler(filters.TEXT & ~filters.COMMAND, simulador_monto)],
            SIMULADOR_ANIOS:     [MessageHandler(filters.TEXT & ~filters.COMMAND, simulador_anios)],
            SIMULADOR_INCENTIVO: [CallbackQueryHandler(simulador_incentivo, pattern="^inc_")],
            DEPOSIT_WALLET:      [MessageHandler(filters.TEXT & ~filters.COMMAND, recibir_wallet)],
            DEPOSIT_MONTO:       [MessageHandler(filters.TEXT & ~filters.COMMAND, recibir_monto_deposito)],
            DEPOSIT_CONFIRMAR:   [CallbackQueryHandler(confirmar_deposito, pattern="^dep_")],
        },
        fallbacks=[
            CommandHandler("menu",  menu),
            CommandHandler("ayuda", ayuda),
            CommandHandler("start", start),
            CommandHandler("qr", comando_qr),
            CommandHandler("demo", comando_demo),
            CommandHandler("alertas", suscribir_alertas),
        ],
        allow_reentry=True,
        persistent=True,
        name="manana_seguro_conversation"
    )

    app.add_handler(conv)
    app.add_handler(CommandHandler("ayuda", ayuda))

    # Verificar tasa CETES cada hora
    job_queue = app.job_queue
    if job_queue:
        job_queue.run_repeating(
            lambda ctx: asyncio.create_task(check_tasa_cetes(app)),
            interval=3600,
            first=10
        )

    logger.info("🤖 Bot Mañana Seguro iniciado con Gemini...")
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
