const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const workspace = process.cwd();
const ffmpeg = path.join(workspace, 'node_modules', 'ffmpeg-static', 'ffmpeg.exe');
const assetDir = path.join(workspace, 'public', 'assets');
const bgDir = path.join(assetDir, 'backgrounds');
const gifDir = path.join(assetDir, 'gifs');
const audioDir = path.join(assetDir, 'audio');

fs.mkdirSync(bgDir, { recursive: true });
fs.mkdirSync(gifDir, { recursive: true });
fs.mkdirSync(audioDir, { recursive: true });

const bgFile = path.join(bgDir, 'bg-abstract-1.mp4');
const gifFile = path.join(gifDir, 'gif-spark.gif');
const audioFile = path.join(audioDir, 'audio-energetic.mp3');

const commands = [
  [ffmpeg, ['-y', '-f', 'lavfi', '-i', 'color=c=#180f42:s=1080x1920:d=6', '-vf', 'drawtext=text=AI+GROWTH:fontcolor=white:fontsize=54:x=(w-text_w)/2:y=h*0.7', '-pix_fmt', 'yuv420p', '-t', '6', bgFile]],
  [ffmpeg, ['-y', '-f', 'lavfi', '-i', 'color=c=#7c3aed:s=600x600:d=1', '-vf', 'fps=8,scale=600:600:flags=lanczos,split[s0][s1];[s1]palettegen=stats_mode=diff[p];[s0][p]paletteuse', '-loop', '0', gifFile]],
  [ffmpeg, ['-y', '-f', 'lavfi', '-i', 'sine=frequency=880:duration=6', '-vn', '-ar', '44100', audioFile]],
];

for (const [cmd, args] of commands) {
  execFileSync(cmd, args, { stdio: 'inherit' });
}

console.log('Generated files:', { bgFile, gifFile, audioFile });
