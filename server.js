const express = require("express");
const http = require("http");
const https = require("https"); // Use https module
const fs = require("fs"); // File system module to read cert and key
const socketIo = require("socket.io");
const path = require("path");

const app = express();
// const certsPath = path.resolve(__dirname, "../certs");

// Load SSL certificate and key
const sslOptions = {
  key: fs.readFileSync(path.resolve(__dirname, "../certs/private.key")), // Adjust path if certs is elsewhere
  cert: fs.readFileSync(path.resolve(__dirname, "../certs/certificate.crt")),
};

// Create an HTTPS server
const server = https.createServer(sslOptions, app);

// CORS middleware to set headers manually for Express
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*"); // Use local IP here
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") {
    return res.status(200).end(); // Respond with 200 on OPTIONS request
  }
  next();
});

// Socket.io CORS settings
const io = socketIo(server, {
  cors: {
    origin: "*", // Local IP address of frontend
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  },
  // transports: ["websocket"],?
});

let users = {}; // Store users' socket ids
let connectedDevices = 0; // Counter for connected devices

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Increment the connected devices counter
  connectedDevices++;
  console.log(`Connected devices: ${connectedDevices}`);

  // Register user
  socket.on("register", (userId) => {
    users[userId] = socket.id;
    io.emit("userList", Object.keys(users)); // Broadcast user list to everyone
    console.log(`User ${userId} registered with socket id ${socket.id}`);
  });
  socket.on("userList", (userList) => {
    console.log("User List:", userList); // Log user list to see IDs
    // Display the list of users in the UI
    const userListElement = document.getElementById("user-list");
    userListElement.innerHTML = userList.join("<br>");
  });

  // Handle incoming call from one user to another
  socket.on("callUser", (targetId, signal) => {
    console.log(`Call from ${socket.id} to ${targetId}`);
    if (signal && users[targetId]) {
      io.to(users[targetId]).emit("callIncoming", {
        from: socket.id,
        signal: signal,
      });
    } else {
      console.error("Signal data is missing or user not found.");
    }
  });

  // Handle acceptance of the call
  socket.on("answerCall", (to, signal) => {
    console.log(`Answering call from ${socket.id} to ${to}`);
    io.to(to).emit("callAccepted", { signal: signal });
  });

  // Handle ICE candidate exchange
  socket.on("sendCandidate", (to, candidate) => {
    console.log(`Sending ICE Candidate to ${to}`);
    io.to(to).emit("newICECandidate", candidate);
  });

  // Handle user disconnection
  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);

    // Decrement the connected devices counter
    connectedDevices--;
    console.log(`Connected devices: ${connectedDevices}`);

    // Remove user from the list
    for (const userId in users) {
      if (users[userId] === socket.id) {
        delete users[userId];
        break;
      }
    }
    io.emit("userList", Object.keys(users)); // Broadcast updated user list to all
  });
});

// Start the server
const port = 5000;
server.listen(port, () => {
  console.log(`Server running on https://localhost:${port}`);
});
