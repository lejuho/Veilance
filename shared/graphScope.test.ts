import assert from 'node:assert/strict';
import { scopeGraph } from './graphScope.js';
const graph = {
  nodes: ['mine', 'refiner', 'batteryMfr', 'verifier'].map(id => ({ id, held: 12, consumed: 8, attestations: 3, lastActivityAt: 'private activity' })),
  edges: [
    { from: 'mine', to: 'refiner', status: 'CONSUMED', consumedTxHash: 'downstream-secret', consumedBlockHeight: 3 },
    { from: 'refiner', to: 'batteryMfr', status: 'DELIVERED' },
  ],
  attestations: [{ holder: 'refiner' }, { holder: 'batteryMfr' }],
  activeJob: { party: 'mine' }, queue: [{ party: 'refiner' }, { party: 'batteryMfr' }],
};
const battery = scopeGraph(graph, 'batteryMfr');
assert.deepEqual(battery.edges, [graph.edges[1]]);
assert.equal(battery.nodes.some(n => n.id === 'mine'), false);
assert.equal(battery.nodes.find(n => n.id === 'refiner')?.held, 0);
assert.equal(battery.nodes.find(n => n.id === 'refiner')?.lastActivityAt, undefined);
assert.deepEqual(battery.attestations, [{ holder: 'batteryMfr' }]);
assert.equal(battery.activeJob, undefined);
assert.deepEqual(battery.queue, [{ party: 'batteryMfr' }]);
const buyer = scopeGraph(graph, 'verifier');
assert.deepEqual(buyer.edges, []);
assert.deepEqual(buyer.nodes.map(n => n.id), ['verifier']);
assert.deepEqual(buyer.attestations, graph.attestations);
assert.deepEqual(buyer.queue, []);
const sender = scopeGraph(graph, 'mine');
assert.equal(sender.edges[0].status, 'DELIVERED');
assert.equal(sender.edges[0].consumedTxHash, undefined);
assert.equal(sender.edges[0].consumedBlockHeight, undefined);
assert.equal(graph.edges[0].status, 'CONSUMED');
assert.equal(scopeGraph(graph, 'admin'), graph);
console.log('PASS: company scope, OEM inventory exclusion, neighboring activity exclusion, downstream consumption exclusion, no mutation');
