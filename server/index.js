import { createServer } from "http";
import { Server } from "socket.io";

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: "*",
  },
});

const rooms = new Map();

io.on("connection", (socket) => {
  socket.on("create_room", (roomId) => {
    socket.join(roomId);
    rooms.set(roomId, { players: [socket.id], state: null });
    socket.emit("room_created", roomId);
  });

  socket.on("join_room", (roomId) => {
    const room = rooms.get(roomId) || { players: [] };
    if (room.players.length >= 2) return socket.emit("room_full");
    socket.join(roomId);
    room.players.push(socket.id);
    rooms.set(roomId, room);
    io.to(roomId).emit("player_joined", room.players);
  });

  socket.on("sync_input", ({ roomId, input }) => {
    socket.to(roomId).emit("opponent_input", { id: socket.id, input });
  });

  socket.on("sync_state", ({ roomId, state }) => {
    socket.to(roomId).emit("state_update", state);
  });

  socket.on("disconnect", () => {
    for (const [roomId, room] of rooms) {
      if (room.players.includes(socket.id)) {
        room.players = room.players.filter((p) => p !== socket.id);
        io.to(roomId).emit("player_left", socket.id);
        if (room.players.length === 0) rooms.delete(roomId);
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => console.log(`[server] listening on :${PORT}`));
