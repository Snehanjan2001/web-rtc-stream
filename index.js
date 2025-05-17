const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const { setupMediasoup } = require("./mediasoupManager");
const { startFfmpeg } = require("./ffmpegStreamer");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.use("/hls", express.static(path.join(__dirname, "public/hls")));

start();

async function start() {
  const { router, transport: plainTransport } = await setupMediasoup();
  startFfmpeg();

  const transports = [];
  const producers = [];

  io.on("connection", (socket) => {
    console.log(`Client connected: ${socket.id}`);

    // Provide router RTP Capabilities
    socket.on("getRouterRtpCapabilities", (callback) => {
      callback(router.rtpCapabilities);
    });

    // Create WebRTC transport for client
    socket.on("createWebRtcTransport", async (callback) => {
      try {
        const webRtcTransport = await router.createWebRtcTransport({
          listenIps: [{ ip: "127.0.0.1", announcedIp: null }],
          enableUdp: true,
          enableTcp: true,
          preferUdp: true,
        });

        transports.push(webRtcTransport);

        callback({
          id: webRtcTransport.id,
          iceParameters: webRtcTransport.iceParameters,
          iceCandidates: webRtcTransport.iceCandidates,
          dtlsParameters: webRtcTransport.dtlsParameters,
        });
      } catch (err) {
        console.error("Error creating WebRTC transport:", err);
        callback({ error: err.message });
      }
    });

    // Connect transport with DTLS parameters
    socket.on(
      "connectWebRtcTransport",
      async ({ transportId, dtlsParameters }) => {
        const transport = transports.find((t) => t.id === transportId);
        if (transport) {
          await transport.connect({ dtlsParameters });
          console.log(`Transport ${transportId} connected`);
        }
      }
    );

    // Start producing media (audio/video)
    socket.on(
      "produce",
      async ({ transportId, kind, rtpParameters }, callback) => {
        const transport = transports.find((t) => t.id === transportId);
        if (transport) {
          // Apply default codecs if client did not provide them
          if (!rtpParameters.codecs || rtpParameters.codecs.length === 0) {
            console.warn(
              "Client sent empty codecs, applying router default codecs"
            );
            rtpParameters.codecs = router.rtpCapabilities.codecs
              .filter((c) => c.kind === kind)
              .map((c) => ({
                mimeType: c.mimeType,
                payloadType: c.preferredPayloadType,
                clockRate: c.clockRate,
                channels: c.channels,
                parameters: c.parameters || {},
                rtcpFeedback: c.rtcpFeedback || [],
              }));
          }

          const producer = await transport.produce({ kind, rtpParameters });
          producers.push(producer);
          callback({ id: producer.id });
          console.log(`Producer created: ${producer.id}`);
        }
      }
    );

    socket.on("disconnect", () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });

  const PORT = 4000;
  server.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
  });
}
