// Publishes content to the GitHub repo in a single commit via the Git Data API
// (blobs → tree → commit → ref). The push triggers a Cloudflare Pages rebuild,
// which regenerates sitemap.xml, rss.xml and llms.txt as part of the build.
import { Env } from './types';

const API = 'https://api.github.com';

async function gh(env: Env, path: string, init: RequestInit = {}): Promise<any> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${env.GITHUB_TOKEN}`,
      accept: 'application/vnd.github+json',
      'user-agent': 'shubinvc-admin',
      'x-github-api-version': '2022-11-28',
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub ${res.status} ${path}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

export interface CommitFile {
  path: string;
  content: string;           // utf-8 text…
  encoding?: 'utf-8' | 'base64'; // …or base64 for binaries
}

// Create ONE commit containing all files on the configured branch.
export async function commitFiles(env: Env, files: CommitFile[], message: string): Promise<string> {
  const owner = env.GITHUB_OWNER;
  const repo = env.GITHUB_REPO;
  const branch = env.GITHUB_BRANCH || 'main';

  const ref = await gh(env, `/repos/${owner}/${repo}/git/ref/heads/${branch}`);
  const headSha: string = ref.object.sha;
  const head = await gh(env, `/repos/${owner}/${repo}/git/commits/${headSha}`);

  const tree = await Promise.all(files.map(async (f) => {
    const blob = await gh(env, `/repos/${owner}/${repo}/git/blobs`, {
      method: 'POST',
      body: JSON.stringify(
        f.encoding === 'base64'
          ? { content: f.content, encoding: 'base64' }
          : { content: f.content, encoding: 'utf-8' },
      ),
    });
    return { path: f.path, mode: '100644', type: 'blob', sha: blob.sha };
  }));

  const newTree = await gh(env, `/repos/${owner}/${repo}/git/trees`, {
    method: 'POST',
    body: JSON.stringify({ base_tree: head.tree.sha, tree }),
  });
  const commit = await gh(env, `/repos/${owner}/${repo}/git/commits`, {
    method: 'POST',
    body: JSON.stringify({ message, tree: newTree.sha, parents: [headSha] }),
  });
  await gh(env, `/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
    method: 'PATCH',
    body: JSON.stringify({ sha: commit.sha }),
  });
  return commit.sha;
}

export function toBase64Utf8(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
