/** Presentation scope for the multi-party demo. This is NOT authentication. */
export type Workspace = 'mine' | 'refiner' | 'batteryMfr' | 'verifier' | 'admin';
export function isWorkspace(value: unknown): value is Workspace {
  return typeof value === 'string' && ['mine', 'refiner', 'batteryMfr', 'verifier', 'admin'].includes(value);
}
interface ScopeGraph {
  nodes: { id: string; held: number; consumed: number; attestations: number; lastActivityAt?: string }[];
  edges: { from: string; to: string; status: string; consumedTxHash?: string; consumedBlockHeight?: number }[];
  attestations: { holder: string }[];
  activeJob?: { party: string };
  queue: { party: string }[];
}
export function scopeGraph<G extends ScopeGraph>(graph: G, viewer: Workspace): G {
  if (viewer === 'admin') return graph;
  const edges = viewer === 'verifier' ? [] : graph.edges.filter(e => e.from === viewer || e.to === viewer).map(e => {
    // A sender may see their own transfer, but not the recipient's later transfers.
    if (e.to === viewer) return e;
    const { consumedTxHash: _tx, consumedBlockHeight: _block, ...rest } = e;
    return { ...rest, status: e.status === 'CONSUMED' ? 'DELIVERED' : e.status };
  });
  const attestations = viewer === 'verifier' ? graph.attestations : graph.attestations.filter(a => a.holder === viewer);
  const visible = new Set([viewer, ...edges.flatMap(e => [e.from, e.to])]);
  if (attestations.length && viewer !== 'verifier') visible.add('verifier');
  return {
    ...graph,
    nodes: graph.nodes.filter(n => visible.has(n.id)).map(n => n.id === viewer ? n : {
      ...n, held: 0, consumed: 0, attestations: 0, lastActivityAt: undefined,
    }),
    edges,
    attestations,
    activeJob: graph.activeJob?.party === viewer ? graph.activeJob : undefined,
    queue: graph.queue.filter(j => j.party === viewer),
  } as G;
}
