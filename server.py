"""
Bible Pointer — voice backend.

Serves the static dashboard AND a /asr WebSocket that streams microphone audio
through a grammar-constrained Vosk recognizer (gapless, offline, free).

Env vars:
  PORT         (default 8080)
  VOSK_MODEL   path to the unpacked Vosk model dir (default ./model)
  STATIC_DIR   path to the dashboard files       (default ./public, then script dir)
"""
import json, os
from aiohttp import web, WSMsgType
from vosk import Model, KaldiRecognizer, SetLogLevel

SetLogLevel(-1)

BASE = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.environ.get("VOSK_MODEL", os.path.join(BASE, "model"))
_default_static = os.path.join(BASE, "public")
if not os.path.isdir(_default_static):
    _default_static = BASE
STATIC_DIR = os.environ.get("STATIC_DIR", _default_static)
PORT = int(os.environ.get("PORT", "8080"))
SAMPLE_RATE = 16000

# Grammar restricts recognition to Bible vocabulary so number homophones
# ("two" vs "to", "four" vs "for", "six" vs "sex") resolve correctly. Ranges use
# "through" (we exclude "to" on purpose). "[unk]" lets non-vocab audio be ignored.
BOOK_WORDS = ("genesis exodus leviticus numbers deuteronomy joshua judges ruth "
              "samuel kings chronicles ezra nehemiah esther job psalm psalms "
              "proverbs ecclesiastes song of solomon canticles isaiah jeremiah "
              "lamentations ezekiel daniel hosea joel amos obadiah jonah micah "
              "nahum habakkuk zephaniah haggai zechariah malachi matthew mark "
              "luke john acts romans corinthians galatians ephesians philippians "
              "colossians thessalonians timothy titus philemon hebrews james "
              "peter jude revelation revelations")
NUM_WORDS = ("zero one two three four five six seven eight nine ten eleven twelve "
             "thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty "
             "thirty forty fifty sixty seventy eighty ninety hundred")
ORD_WORDS = ("first second third fourth fifth sixth seventh eighth ninth tenth "
             "eleventh twelfth thirteenth fourteenth fifteenth sixteenth "
             "seventeenth eighteenth nineteenth twentieth")
CONNECTORS = "chapter verse verses through"
GRAMMAR = json.dumps([" ".join([BOOK_WORDS, NUM_WORDS, ORD_WORDS, CONNECTORS]), "[unk]"])

print("Loading Vosk model from:", MODEL_DIR)
model = Model(MODEL_DIR)
print("Model loaded. Serving static from:", STATIC_DIR)


async def asr_handler(request):
    ws = web.WebSocketResponse(heartbeat=30)
    await ws.prepare(request)
    rec = KaldiRecognizer(model, SAMPLE_RATE, GRAMMAR)
    try:
        async for msg in ws:
            if msg.type == WSMsgType.BINARY:
                if rec.AcceptWaveform(bytes(msg.data)):
                    text = json.loads(rec.Result()).get("text", "")
                    if text:
                        await ws.send_json({"type": "final", "text": text})
                else:
                    partial = json.loads(rec.PartialResult()).get("partial", "")
                    await ws.send_json({"type": "partial", "text": partial})
            elif msg.type == WSMsgType.TEXT:
                try:
                    obj = json.loads(msg.data)
                except Exception:
                    obj = {}
                if obj.get("eof"):
                    text = json.loads(rec.FinalResult()).get("text", "")
                    await ws.send_json({"type": "final", "text": text})
                    rec = KaldiRecognizer(model, SAMPLE_RATE, GRAMMAR)
            elif msg.type == WSMsgType.ERROR:
                break
    finally:
        return ws


async def index(request):
    return web.FileResponse(os.path.join(STATIC_DIR, "index.html"))


def make_app():
    app = web.Application(client_max_size=8 * 1024 * 1024)
    app.router.add_get("/asr", asr_handler)
    app.router.add_get("/", index)
    app.router.add_static("/", STATIC_DIR, show_index=False)
    return app


if __name__ == "__main__":
    web.run_app(make_app(), host="0.0.0.0", port=PORT)
