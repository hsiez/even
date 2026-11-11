import { createTraceReader } from './traces.js';
import { createRequire } from 'node:module';
import { dirname, join, relative, isAbsolute, sep } from 'node:path';
import { readFile, realpath, readdir, lstat } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export function isWithin(root, path) {
  const rel = relative(root, path);
  return rel === '' || (!rel.startsWith('..' + sep) && rel !== '..' && !isAbsolute(rel));
}

// Eve's discovery and local host APIs are internal. Add versions only after
// running the adapter contract suite against that installed version.
export const supportedEveVersions = ['1.0.0-rc.6'];

export async function loadEve(projectPath) {
  const project = await realpath(projectPath);
  const require = createRequire(join(project, 'package.json'));
  let entry;
  try {
    entry = require.resolve('eve');
  } catch {
    throw new Error('The selected project must have Eve installed. Run its package install first.');
  }
  let packageRoot = dirname(entry);
  let metadata;
  for (;;) {
    try {
      const candidate = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8'));
      if (candidate.name === 'eve') {
        metadata = candidate;
        break;
      }
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    const parent = dirname(packageRoot);
    if (parent === packageRoot) throw new Error('Cannot locate the installed Eve package.');
    packageRoot = parent;
  }
  if (!supportedEveVersions.includes(metadata.version)) {
    throw new Error('Unsupported Eve version ' + metadata.version + '. Supported: ' + supportedEveVersions.join(', '));
  }
  const internal = (path) => import(pathToFileURL(join(packageRoot, 'dist/src', path)).href);
  const [{ resolveDiscoveryProject }, { discoverAgent }] = await Promise.all([
    internal('discover/project.js'),
    internal('discover/discover-agent.js'),
  ]);

  // Bound Eve's upward root search and source reads to the selected project.
  const source = {
    kind: 'disk',
    async stat(path) {
      if (!isWithin(project, path)) return 'missing';
      try {
        const info = await lstat(path);
        if (info.isSymbolicLink()) return 'other';
        if (!isWithin(project, await realpath(path))) return 'other';
        return info.isDirectory() ? 'directory' : info.isFile() ? 'file' : 'other';
      } catch (error) {
        if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return 'missing';
        throw error;
      }
    },
    async readDirectory(path) {
      await checkPath(path);
      return readdir(path, { withFileTypes: true });
    },
    async readTextFile(path) {
      await checkPath(path);
      return readFile(path, 'utf8');
    },
  };
  async function checkPath(path) {
    if (!isWithin(project, path) || !isWithin(project, await realpath(path))) {
      throw new Error('Eve source access escaped the selected project.');
    }
  }
  const { findEveProjectContext } = await internal('internal/project-context.js');
  const context = await findEveProjectContext(project);
  const members = context?.kind === 'workspace'
    ? context.workspace.members
    : [{ name: 'root', appRoot: project }];
  const agents = new Map();
  for (const member of members) {
    const appRoot = await realpath(member.appRoot);
    if (!isWithin(project, appRoot)) throw new Error('Agent root escaped the selected project.');
    agents.set(member.name, { id: member.name, appRoot });
  }
  function selectAgent(id) {
    if (id === undefined && agents.size === 1) return agents.values().next().value;
    const agent = agents.get(id);
    if (!agent) throw Object.assign(new Error('Select an agentId from this project inventory.'), { status: 400 });
    return agent;
  }
  const readTraces = createTraceReader(internal);
  return {
    project,
    version: metadata.version,
    internal,
    selectAgent,
    environmentRoot: context?.environmentRoot ?? project,
    async traces(id, agentId, sessionId) {
      const agent = selectAgent(agentId);
      return readTraces(agent.appRoot, id, sessionId);
    },
    async inventory() {
      return { agents: await Promise.all([...agents.values()].map(async agent => {
        try {
          const roots = await resolveDiscoveryProject(agent.appRoot, { source });
          const discovered = await discoverAgent({ ...roots, source });
          return { ...agent, ...roots, ...discovered };
        } catch (error) {
          return { ...agent, diagnostics: [{ severity: 'error', message: error.message }] };
        }
      })) };
    },
  };
}
