import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Logger } from 'pino';

export interface ReelFrame {
  data: Uint8Array;
  contentType: string;
}

/**
 * Assembles a vertical (9:16) MP4 reel from ordered panel images using ffmpeg —
 * each panel is shown for a fixed duration with a Ken-Burns-free simple cut and
 * letterbox padding. Requires ffmpeg on PATH (installed in the worker image).
 */
export class ReelAssembler {
  constructor(
    private readonly logger: Logger,
    private readonly secondsPerFrame = 2.5,
    private readonly ffmpegPath = process.env.FFMPEG_PATH ?? 'ffmpeg',
  ) {}

  async assemble(frames: ReelFrame[]): Promise<Uint8Array> {
    if (frames.length === 0) throw new Error('No frames to assemble into a reel');
    const dir = await mkdtemp(join(tmpdir(), 'storyme-reel-'));
    try {
      for (let i = 0; i < frames.length; i++) {
        const ext = frames[i]!.contentType.split('/')[1] ?? 'png';
        await writeFile(join(dir, `frame-${String(i).padStart(3, '0')}.${ext}`), frames[i]!.data);
      }
      const firstExt = frames[0]!.contentType.split('/')[1] ?? 'png';
      const outPath = join(dir, 'reel.mp4');

      const args = [
        '-y',
        '-framerate',
        `1/${this.secondsPerFrame}`,
        '-i',
        join(dir, `frame-%03d.${firstExt}`),
        '-vf',
        'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black,format=yuv420p',
        '-r',
        '30',
        '-c:v',
        'libx264',
        '-pix_fmt',
        'yuv420p',
        '-movflags',
        '+faststart',
        outPath,
      ];

      await this.run(args);
      return await readFile(outPath);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  private run(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn(this.ffmpegPath, args);
      let stderr = '';
      proc.stderr.on('data', (d) => (stderr += d.toString()));
      proc.on('error', reject);
      proc.on('close', (code) => {
        if (code === 0) resolve();
        else {
          this.logger.error({ code, stderr: stderr.slice(-500) }, 'ffmpeg failed');
          reject(new Error(`ffmpeg exited with code ${code}`));
        }
      });
    });
  }
}
