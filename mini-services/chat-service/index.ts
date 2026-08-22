// ============================================================
// Servicio WebSocket para chat en tiempo real de trades P2P
// ============================================================
// Puerto: 3003 (configurado en Caddy para forwarding)
//
// Eventos:
//   - join:trade       (cliente → server): unirse a la sala de un trade
//   - leave:trade      (cliente → server): salir de la sala
//   - message:sent     (cliente → server): enviar mensaje cifrado
//   - message:new      (server → cliente): broadcast a todos en la sala
//   - user:typing      (cliente → server): indicar que está escribiendo
//   - user:typing      (server → cliente): broadcast indicación
//
// Seguridad:
//   - El servidor solo retransmite ciphertexts (no descifra nada)
//   - Salas por tradeId (aisla conversaciones)
//   - No se persisten mensajes aquí (van a la API REST)

import { Server } from "socket.io";

const PORT = 3003;

const io = new Server(PORT, {
  cors: {
    origin: "*", // En producción: restringir al dominio propio
    methods: ["GET", "POST"],
  },
  path: "/",
});

interface JoinPayload {
  tradeId: string;
  userId: string;
  alias: string;
}

interface MessagePayload {
  tradeId: string;
  messageId: string;
  senderId: string;
  senderAlias: string;
  senderAvatarSeed: string | null;
  ciphertext: string;
  nonce: string;
}

console.log(`🚀 Chat WebSocket service corriendo en puerto ${PORT}`);

io.on("connection", (socket) => {
  console.log(`✓ Cliente conectado: ${socket.id}`);

  // Unirse a la sala de un trade
  socket.on("join:trade", (payload: JoinPayload) => {
    const room = `trade:${payload.tradeId}`;
    socket.join(room);
    socket.data.userId = payload.userId;
    socket.data.alias = payload.alias;
    console.log(`→ ${payload.alias} se unió a ${room}`);
    // Notificar a los demás en la sala
    socket.to(room).emit("user:joined", {
      alias: payload.alias,
      at: Date.now(),
    });
  });

  // Salir de una sala
  socket.on("leave:trade", (payload: { tradeId: string }) => {
    const room = `trade:${payload.tradeId}`;
    socket.leave(room);
    socket.to(room).emit("user:left", {
      alias: socket.data.alias,
      at: Date.now(),
    });
  });

  // Recibir y retransmitir mensaje cifrado
  socket.on("message:sent", (payload: MessagePayload) => {
    const room = `trade:${payload.tradeId}`;
    console.log(
      `💬 ${payload.senderAlias} → ${room} (ciphertext ${payload.ciphertext.length} bytes)`
    );
    // Retransmitir a todos en la sala MENOS al emisor
    socket.to(room).emit("message:new", {
      id: payload.messageId,
      senderId: payload.senderId,
      senderAlias: payload.senderAlias,
      senderAvatarSeed: payload.senderAvatarSeed,
      ciphertext: payload.ciphertext,
      nonce: payload.nonce,
      createdAt: new Date().toISOString(),
    });
  });

  // Indicador de "escribiendo…"
  socket.on("user:typing", (payload: { tradeId: string; isTyping: boolean }) => {
    const room = `trade:${payload.tradeId}`;
    socket.to(room).emit("user:typing", {
      alias: socket.data.alias,
      isTyping: payload.isTyping,
    });
  });

  socket.on("disconnect", () => {
    console.log(`✗ Cliente desconectado: ${socket.id}`);
  });
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("Cerrando servicio de chat…");
  io.close(() => process.exit(0));
});

process.on("SIGINT", () => {
  console.log("Cerrando servicio de chat…");
  io.close(() => process.exit(0));
});
