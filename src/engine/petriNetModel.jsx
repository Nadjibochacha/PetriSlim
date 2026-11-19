// Converts a PetriNet graph object into Pre, Post matrices and M0 vector.
 
export function toMatrices(net) {
  const { places, transitions, arcs } = net;
  const numP = places.length;
  const numT = transitions.length;

  const pIndex = new Map(places.map((p, i) => [p.id, i]));
  const tIndex = new Map(transitions.map((t, i) => [t.id, i]));

  const pre = Array.from({ length: numP }, () => Array(numT).fill(0));
  const post = Array.from({ length: numP }, () => Array(numT).fill(0));
  const m0 = places.map((p) => Number(p.tokens) || 0);

  for (const arc of arcs) {
    if (pIndex.has(arc.source) && tIndex.has(arc.target)) {
      pre[pIndex.get(arc.source)][tIndex.get(arc.target)] += Number(arc.weight) || 1;
    } else if (tIndex.has(arc.source) && pIndex.has(arc.target)) {
      post[pIndex.get(arc.target)][tIndex.get(arc.source)] += Number(arc.weight) || 1;
    }
  }

  return { pre, post, m0 };
}

//Rebuilds arcs and updated places from edited Pre, Post matrices and M0 vector.

export function fromMatrices(places, transitions, pre, post, m0) {
  const updatedPlaces = places.map((p, i) => ({
    ...p,
    tokens: Math.max(0, Number(m0[i]) || 0),
  }));

  const arcs = [];
  for (let i = 0; i < places.length; i++) {
    for (let j = 0; j < transitions.length; j++) {
      const preWeight = Number(pre[i]?.[j]) || 0;
      if (preWeight > 0) {
        arcs.push({
          id: `arc_${places[i].id}_${transitions[j].id}`,
          source: places[i].id,
          target: transitions[j].id,
          weight: preWeight,
        });
      }

      const postWeight = Number(post[i]?.[j]) || 0;
      if (postWeight > 0) {
        arcs.push({
          id: `arc_${transitions[j].id}_${places[i].id}`,
          source: transitions[j].id,
          target: places[i].id,
          weight: postWeight,
        });
      }
    }
  }

  return {
    places: updatedPlaces,
    transitions: [...transitions],
    arcs,
  };
}

/**
 * Validates that an arc connects a Place to a Transition (or vice versa).
 */
export function isValidArc(net, sourceId, targetId) {
  const isSourcePlace = net.places.some((p) => p.id === sourceId);
  const isTargetPlace = net.places.some((p) => p.id === targetId);
  const isSourceTrans = net.transitions.some((t) => t.id === sourceId);
  const isTargetTrans = net.transitions.some((t) => t.id === targetId);

  return (isSourcePlace && isTargetTrans) || (isSourceTrans && isTargetPlace);
}