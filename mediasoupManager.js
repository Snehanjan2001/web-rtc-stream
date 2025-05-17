const mediasoup = require("mediasoup");
const { mediaCodecs } = require("./mediasoupConfig");

let worker;
let router;
let transport;

async function setupMediasoup() {
  worker = await mediasoup.createWorker();
  router = await worker.createRouter({ mediaCodecs });
  console.log("✅ Mediasoup Router created");

  transport = await router.createPlainTransport({
    listenIp: "127.0.0.1",
    rtcpMux: false,
    comedia: true,
  });
  console.log("✅ Plain RTP Transport created on port 5004");

  return { router, transport };
}

module.exports = { setupMediasoup };
