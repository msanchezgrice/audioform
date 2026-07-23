import { spawnSync } from "node:child_process";
import { renameSync, rmSync } from "node:fs";
import path from "node:path";

const inputs = process.argv.slice(2);
if (!inputs.length) {
  throw new Error("Pass at least one rendered MP4 to normalize.");
}

for (const input of inputs) {
  const absoluteInput = path.resolve(process.cwd(), input);
  const extension = path.extname(absoluteInput);
  const temporaryOutput = absoluteInput.slice(0, -extension.length) + ".normalized" + extension;
  const result = spawnSync(
    "ffmpeg",
    [
      "-y",
      "-v",
      "error",
      "-i",
      absoluteInput,
      "-map",
      "0:v:0",
      "-map",
      "0:a:0",
      "-c:v",
      "copy",
      "-af",
      "loudnorm=I=-16:TP=-1.5:LRA=7",
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      "-movflags",
      "+faststart",
      temporaryOutput,
    ],
    { encoding: "utf8" },
  );

  if (result.status !== 0) {
    rmSync(temporaryOutput, { force: true });
    throw new Error(`Unable to normalize ${input}: ${result.stderr}`);
  }

  renameSync(temporaryOutput, absoluteInput);
  console.log(`Normalized ${input} to -16 LUFS / -1.5 dBTP.`);
}
