import { NextRequest, NextResponse } from "next/server";

// ============================================================
// API: /api/escrow/messages — Mensajes entre comprador y vendedor
// ============================================================

interface Message {
  id: string;
  escrowId: string;
  sender: string;
  senderAlias: string;
  text: string;
  timestamp: number;
}

const MSG_FILE = "/tmp/escrow-messages.json";

function loadMsgs(): Message[] {
  try {
    const fs = require("fs");
    if (fs.existsSync(MSG_FILE)) {
      return JSON.parse(fs.readFileSync(MSG_FILE, "utf-8"));
    }
  } catch {}
  return [];
}

function saveMsgs(msgs: Message[]) {
  try {
    const fs = require("fs");
    fs.writeFileSync(MSG_FILE, JSON.stringify(msgs, null, 2));
  } catch {}
}

// GET /api/escrow/messages?escrowId=xxx
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const escrowId = searchParams.get("escrowId");
  if (!escrowId) return NextResponse.json({ error: "escrowId requerido" }, { status: 400 });

  const msgs = loadMsgs().filter(m => m.escrowId === escrowId);
  return NextResponse.json({ messages: msgs, count: msgs.length });
}

// POST /api/escrow/messages
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { escrowId, sender, senderAlias, text } = body;
  if (!escrowId || !sender || !text) {
    return NextResponse.json({ error: "Faltan campos" }, { status: 400 });
  }

  const msg: Message = {
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    escrowId,
    sender,
    senderAlias: senderAlias || "anónimo",
    text: text.slice(0, 1000), // max 1000 chars
    timestamp: Date.now(),
  };

  const msgs = loadMsgs();
  msgs.push(msg);
  saveMsgs(msgs);

  return NextResponse.json({ success: true, message: msg });
}
