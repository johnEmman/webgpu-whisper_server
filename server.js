const express = require("express");
const http = require("http");
const socketIo = require("socket.io");

const app = express();
const server = http.createServer(app);

// CORS middleware to set headers manually for Express
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "http://localhost:3000"); // Frontend URL
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS"); // Allowed methods
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization"); // Allowed headers
  res.setHeader("Access-Control-Allow-Credentials", "true"); // If you need credentials like cookies

  // Handle preflight (OPTIONS) request
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  next();
});

const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000", // Match frontend URL
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true, // Allow cookies if needed
  },
});

let users = {}; // Store users' socket ids

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Register user
  socket.on("register", (userId) => {
    users[userId] = socket.id;
    io.emit("userList", Object.keys(users)); // Broadcast user list to everyone
  });

  // Handle incoming calls
  // Handle incoming calls
  socket.on("callUser", (targetId, signal) => {
    console.log(`Call from ${socket.id} to ${targetId}`);
    if (signal) {
      io.to(users[targetId]).emit("callIncoming", {
        from: socket.id,
        signal: signal,
      });
    } else {
      console.error("Signal data is missing in callUser event.");
    }
  });
  // Handle call acceptance
  socket.on("answerCall", (to, signal) => {
    io.to(to).emit("callAccepted", { signal: signal });
  });

  // Handle ICE candidates
  socket.on("sendCandidate", (to, candidate) => {
    io.to(to).emit("newICECandidate", candidate);
  });

  // Handle disconnections
  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);
    // Remove user from the list
    for (const userId in users) {
      if (users[userId] === socket.id) {
        delete users[userId];
        break;
      }
    }
    io.emit("userList", Object.keys(users)); // Broadcast updated user list
  });
});

// Start the server
const port = 5000;
server.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
