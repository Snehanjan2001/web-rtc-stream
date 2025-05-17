const ffmpegPath = require("ffmpeg-static");
const { spawn } = require("child_process");

function startFfmpeg() {
  const ffmpeg = spawn(ffmpegPath, [
    "-protocol_whitelist",
    "file,udp,rtp",
    "-i",
    "rtp://127.0.0.1:5004",
    "-c:v",
    "libx264",
    "-preset",
    "ultrafast",
    "-f",
    "hls",
    "-hls_time",
    "1",
    "-hls_list_size",
    "3",
    "-hls_flags",
    "delete_segments",
    "./server/public/hls/stream.m3u8",
  ]);

  ffmpeg.stderr.on("data", (data) => console.error(`FFMPEG: ${data}`));
  ffmpeg.stdout.on("data", (data) => console.log(`FFMPEG: ${data}`));
}

module.exports = { startFfmpeg };
