import { execFile } from 'child_process';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';

const HOME = os.homedir();
const RUSTC = path.join(HOME, '.cargo/bin/rustc');
const JAVAC = path.join(HOME, 'jdk/bin/javac');
const JAVA = path.join(HOME, 'jdk/bin/java');

function exec(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    const child = execFile(
      cmd,
      args,
      { timeout: opts.timeout ?? 20000, maxBuffer: 8e6, cwd: opts.cwd },
      (err, stdout, stderr) => {
        resolve({
          code: err ? (err.code ?? 1) : 0,
          stdout: stdout || '',
          stderr: stderr || '',
          killed: !!(err && err.killed),
        });
      }
    );
    child.stdin.on('error', () => {});
    try {
      if (opts.stdin) child.stdin.write(opts.stdin);
      child.stdin.end();
    } catch {
      /* process already exited */
    }
  });
}

export async function runLocal(lang, code, stdin = '') {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'nl-'));
  try {
    if (lang === 'python') {
      const f = path.join(dir, 'main.py');
      await fs.writeFile(f, code);
      const r = await exec('python3', [f], { stdin, cwd: dir });
      return { stdout: r.stdout, stderr: r.stderr, compile: '', timeout: r.killed };
    }
    if (lang === 'c' || lang === 'cpp') {
      const ext = lang === 'c' ? 'c' : 'cpp';
      const cc = lang === 'c' ? 'gcc' : 'g++';
      const std = lang === 'c' ? '-std=c11' : '-std=c++17';
      const src = path.join(dir, `main.${ext}`);
      const bin = path.join(dir, 'a.out');
      await fs.writeFile(src, code);
      const c = await exec(cc, [std, '-O0', '-w', src, '-o', bin, '-lm'], { cwd: dir, timeout: 30000 });
      if (c.code !== 0) return { stdout: '', stderr: '', compile: c.stderr || c.stdout || 'compile failed', timeout: false };
      const r = await exec(bin, [], { stdin, cwd: dir });
      return { stdout: r.stdout, stderr: r.stderr, compile: '', timeout: r.killed };
    }
    if (lang === 'java') {
      const src = path.join(dir, 'Main.java');
      await fs.writeFile(src, code);
      const c = await exec(JAVAC, ['-nowarn', '-d', dir, src], { cwd: dir, timeout: 60000 });
      if (c.code !== 0) return { stdout: '', stderr: '', compile: c.stderr || c.stdout || 'compile failed', timeout: false };
      const r = await exec(JAVA, ['-XX:+UseSerialGC', '-Xshare:auto', '-cp', dir, 'Main'], { stdin, cwd: dir, timeout: 30000 });
      return { stdout: r.stdout, stderr: r.stderr, compile: '', timeout: r.killed };
    }
    if (lang === 'rust') {
      const src = path.join(dir, 'main.rs');
      const bin = path.join(dir, 'main_bin');
      await fs.writeFile(src, code);
      const c = await exec(RUSTC, ['--edition', '2021', '-A', 'warnings', '-o', bin, src], {
        cwd: dir,
        timeout: 60000,
      });
      if (c.code !== 0) return { stdout: '', stderr: '', compile: c.stderr || c.stdout || 'compile failed', timeout: false };
      const r = await exec(bin, [], { stdin, cwd: dir });
      return { stdout: r.stdout, stderr: r.stderr, compile: '', timeout: r.killed };
    }
    throw new Error('unknown lang ' + lang);
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

export const norm = (s) =>
  (s || '').replace(/\r\n/g, '\n').split('\n').map((l) => l.replace(/[ \t]+$/, '')).join('\n').replace(/\n+$/, '').trim();

export function hash(s) { return crypto.createHash('sha1').update(s).digest('hex').slice(0, 8); }
