// Kubernetes manifests, read as text: which Deployments and Services exist, how many replicas a Deployment
// asks for, and which Service host names a Deployment's environment values point at. Only host names and
// numbers are kept; no other value is ever recorded.
const K8S_DIRS = /(^|\/)(k8s|kubernetes|manifests|deploy|deployment|helm|charts)(\/|$)/i;
const K8S_NAME = /(^|[-_.])(deployment|service|statefulset)s?\.ya?ml$/i;

/** True for a YAML file that is probably a Kubernetes manifest, judged by its folder or file name. */
export const isK8sFile = (name, rel = name) =>
  /\.ya?ml$/i.test(name) && (K8S_DIRS.test(rel) || K8S_NAME.test(name));

/**
 * Documents of a manifest file: [{ kind, name, line, replicas: { n, line } | null, calls: [{ host, line }] }].
 * Files that do not look like Kubernetes (no apiVersion and kind) give [].
 */
export function readK8s(text) {
  const lines = text.split(/\r?\n/);
  const docs = [];
  let cur = null;
  const flush = () => {
    if (cur && cur.kind && cur.name) docs.push(cur);
    cur = null;
  };
  const start = (line) => ({ kind: "", name: "", line, replicas: null, calls: [], inMeta: false });
  cur = start(1);
  lines.forEach((raw, i) => {
    const n = i + 1;
    if (/^---\s*$/.test(raw)) {
      flush();
      cur = start(n + 1);
      return;
    }
    const kind = /^kind:\s*(\w+)/.exec(raw);
    if (kind) cur.kind = kind[1];
    if (/^metadata:\s*$/.test(raw)) cur.inMeta = true;
    else if (/^\S/.test(raw)) cur.inMeta = cur.inMeta && /^metadata:/.test(raw);
    const name = cur.inMeta && !cur.name ? /^\s+name:\s*["']?([\w.-]+)["']?\s*$/.exec(raw) : null;
    if (name) cur.name = name[1];
    const rep = /^\s+replicas:\s*(\d+)\s*$/.exec(raw);
    if (rep && !cur.replicas) cur.replicas = { n: Number(rep[1]), line: n };
    // an environment value that is a URL: keep the host name only
    const url = /^\s*(?:-\s*)?value:\s*["']?https?:\/\/([a-z0-9][a-z0-9.-]*)/i.exec(raw);
    if (url) cur.calls.push({ host: url[1].toLowerCase(), line: n });
  });
  flush();
  return docs.filter(
    (d) => d.kind === "Deployment" || d.kind === "StatefulSet" || d.kind === "Service",
  );
}
