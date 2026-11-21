import { toMatrices } from './petriNetModel';

//Checks if transition tIndex is enabled under marking M.
 
function isTransitionEnabled(marking, pre, tIndex) {
  for (let p = 0; p < marking.length; p++) {
    if (marking[p] < pre[p][tIndex]) {
      return false;
    }
  }
  return true;
}

// Fires transition tIndex from marking M and returns the new marking M'.

function fireTransition(marking, pre, post, tIndex) {
  return marking.map((tokens, p) => tokens - pre[p][tIndex] + post[p][tIndex]);
}

// Generates the Reachability Graph (Graphe des Marquages Accessibles) using BFS.

export function generateReachabilityGraph(net, maxStates = 150) {
  const { places, transitions } = net;

  if (places.length === 0) {
    return { nodes: [], edges: [], stateCount: 0, isComplete: true, stateLimit: maxStates };
  }

  const { pre, post, m0 } = toMatrices(net);

  const visited = new Map(); // key: "1,0,2" -> value: stateId ("S0")
  const nodes = [];
  const edges = [];
  const queue = [];

  const initialKey = m0.join(',');
  visited.set(initialKey, 'S0');
  nodes.push({
    id: 'S0',
    label: `(${initialKey})`,
    marking: [...m0],
    isInitial: true,
  });
  queue.push({ id: 'S0', marking: [...m0] });

  let isComplete = true;

  while (queue.length > 0) {
    if (nodes.length >= maxStates) {
      isComplete = false;
      break;
    }

    const current = queue.shift();

    for (let t = 0; t < transitions.length; t++) {
      if (isTransitionEnabled(current.marking, pre, t)) {
        const nextMarking = fireTransition(current.marking, pre, post, t);
        const nextKey = nextMarking.join(',');

        let targetId;
        if (visited.has(nextKey)) {
          targetId = visited.get(nextKey);
        } else {
          targetId = `S${nodes.length}`;
          visited.set(nextKey, targetId);
          nodes.push({
            id: targetId,
            label: `(${nextKey})`,
            marking: nextMarking,
            isInitial: false,
          });
          queue.push({ id: targetId, marking: nextMarking });
        }

        edges.push({
          id: `edge_${current.id}_${targetId}_${transitions[t].id}`,
          source: current.id,
          target: targetId,
          label: transitions[t].label,
          transitionId: transitions[t].id,
        });
      }
    }
  }

  return {
    nodes,
    edges,
    stateCount: nodes.length,
    isComplete,
    stateLimit: maxStates,
  };
}