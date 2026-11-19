import { toMatrices } from './petriNetModel';

/**
 * Helper to merge duplicate arcs between the exact same source and target.
 */
function normalizeArcs(arcs) {
  const map = new Map();
  for (const arc of arcs) {
    const key = `${arc.source}->${arc.target}`;
    if (map.has(key)) {
      map.get(key).weight += arc.weight;
    } else {
      map.set(key, { ...arc });
    }
  }
  return Array.from(map.values());
}

/**
 * Rule 1: Substitutable Place (Place Substituable / Fusion de transitions en série)
 */
export function reduceSubstitutablePlace(net) {
  const { places, transitions, arcs } = net;

  for (const p of places) {
    if (p.tokens !== 0) continue;

    const inArcs = arcs.filter((a) => a.target === p.id);
    const outArcs = arcs.filter((a) => a.source === p.id);

    if (inArcs.length === 1 && outArcs.length === 1 && inArcs[0].weight === 1 && outArcs[0].weight === 1) {
      const t1Id = inArcs[0].source;
      const t2Id = outArcs[0].target;

      const t2InArcs = arcs.filter((a) => a.target === t2Id);
      if (t1Id === t2Id || t2InArcs.length !== 1) continue;

      const t1 = transitions.find((t) => t.id === t1Id);
      const t2 = transitions.find((t) => t.id === t2Id);
      const mergedId = `${t1.id}_${t2.id}`;
      const mergedTransition = {
        id: mergedId,
        label: `${t1.label}${t2.label}`,
        x: Math.round((t1.x + t2.x) / 2),
        y: Math.round((t1.y + t2.y) / 2),
      };

      const newPlaces = places.filter((pl) => pl.id !== p.id);
      const newTransitions = transitions
        .filter((tr) => tr.id !== t1Id && tr.id !== t2Id)
        .concat(mergedTransition);

      const updatedArcs = arcs
        .filter((a) => a.source !== p.id && a.target !== p.id)
        .map((a) => ({
          ...a,
          source: a.source === t1Id || a.source === t2Id ? mergedId : a.source,
          target: a.target === t1Id || a.target === t2Id ? mergedId : a.target,
        }));

      return {
        applied: true,
        ruleName: 'Place Substituable (Règle 1)',
        newNet: {
          places: newPlaces,
          transitions: newTransitions,
          arcs: normalizeArcs(updatedArcs),
        },
        affectedIds: [p.id, t1Id, t2Id],
        log: `Suppression de la place intermédiaire ${p.label} et fusion de ${t1.label} + ${t2.label} → ${mergedTransition.label}.`,
      };
    }
  }

  return { applied: false, ruleName: 'Place Substituable (Règle 1)', newNet: net, affectedIds: [], log: '' };
}

/**
 * Rule 2: Identical Places (Places Identiques / Fusion de places en parallèle)
 */
export function reduceIdenticalPlaces(net) {
  const { places, transitions, arcs } = net;
  const { pre, post, m0 } = toMatrices(net);

  for (let i = 0; i < places.length; i++) {
    for (let j = i + 1; j < places.length; j++) {
      const sameMarking = m0[i] === m0[j];
      const samePre = pre[i].every((val, tIdx) => val === pre[j][tIdx]);
      const samePost = post[i].every((val, tIdx) => val === post[j][tIdx]);

      if (sameMarking && samePre && samePost) {
        const p1 = places[i];
        const p2 = places[j];

        const newPlaces = places.filter((pl) => pl.id !== p2.id);
        const newArcs = arcs.filter((a) => a.source !== p2.id && a.target !== p2.id);

        return {
          applied: true,
          ruleName: 'Places Identiques (Règle 2)',
          newNet: {
            places: newPlaces,
            transitions: [...transitions],
            arcs: newArcs,
          },
          affectedIds: [p1.id, p2.id],
          log: `Places identiques détectées (${p1.label} et ${p2.label}) : suppression du doublon ${p2.label}.`,
        };
      }
    }
  }

  return { applied: false, ruleName: 'Places Identiques (Règle 2)', newNet: net, affectedIds: [], log: '' };
}

/**
 * Rule 3: Identity Transition (Transition Identité / Suppression de transition neutre)
 */
export function reduceIdentityTransition(net) {
  const { places, transitions, arcs } = net;
  const { pre, post } = toMatrices(net);

  for (let tIdx = 0; tIdx < transitions.length; tIdx++) {
    let hasConnections = false;
    let isNeutral = true;

    for (let pIdx = 0; pIdx < places.length; pIdx++) {
      if (pre[pIdx][tIdx] > 0 || post[pIdx][tIdx] > 0) {
        hasConnections = true;
      }
      if (pre[pIdx][tIdx] !== post[pIdx][tIdx]) {
        isNeutral = false;
        break;
      }
    }

    if (hasConnections && isNeutral) {
      const targetT = transitions[tIdx];
      const newTransitions = transitions.filter((tr) => tr.id !== targetT.id);
      const newArcs = arcs.filter((a) => a.source !== targetT.id && a.target !== targetT.id);

      return {
        applied: true,
        ruleName: 'Transition Identité (Règle 3)',
        newNet: {
          places: [...places],
          transitions: newTransitions,
          arcs: newArcs,
        },
        affectedIds: [targetT.id],
        log: `Transition neutre ${targetT.label} supprimée (boucles élémentaires identiques en entrée et sortie).`,
      };
    }
  }

  return { applied: false, ruleName: 'Transition Identité (Règle 3)', newNet: net, affectedIds: [], log: '' };
}

/**
 * Rule 4: Identical Transitions (Transitions Identiques / Suppression de doublon)
 */
export function reduceIdenticalTransitions(net) {
  const { places, transitions, arcs } = net;
  const { pre, post } = toMatrices(net);

  for (let i = 0; i < transitions.length; i++) {
    for (let j = i + 1; j < transitions.length; j++) {
      let samePre = true;
      let samePost = true;

      for (let pIdx = 0; pIdx < places.length; pIdx++) {
        if (pre[pIdx][i] !== pre[pIdx][j]) samePre = false;
        if (post[pIdx][i] !== post[pIdx][j]) samePost = false;
      }

      if (samePre && samePost) {
        const t1 = transitions[i];
        const t2 = transitions[j];

        const newTransitions = transitions.filter((tr) => tr.id !== t2.id);
        const newArcs = arcs.filter((a) => a.source !== t2.id && a.target !== t2.id);

        return {
          applied: true,
          ruleName: 'Transitions Identiques (Règle 4)',
          newNet: {
            places: [...places],
            transitions: newTransitions,
            arcs: newArcs,
          },
          affectedIds: [t1.id, t2.id],
          log: `Transitions identiques détectées (${t1.label} et ${t2.label}) : suppression du doublon ${t2.label}.`,
        };
      }
    }
  }

  return { applied: false, ruleName: 'Transitions Identiques (Règle 4)', newNet: net, affectedIds: [], log: '' };
}

/**
 * Rule 5: Fusion of Series Places (Fusion de Places en Série)
 */
export function reduceSeriesPlaces(net) {
  const { places, transitions, arcs } = net;

  for (const t of transitions) {
    const inArcs = arcs.filter((a) => a.target === t.id);
    const outArcs = arcs.filter((a) => a.source === t.id);

    if (inArcs.length === 1 && outArcs.length === 1 && inArcs[0].weight === 1 && outArcs[0].weight === 1) {
      const p1Id = inArcs[0].source;
      const p2Id = outArcs[0].target;

      const p1OutArcs = arcs.filter((a) => a.source === p1Id);
      if (p1Id === p2Id || p1OutArcs.length !== 1) continue;

      const p1 = places.find((pl) => pl.id === p1Id);
      const p2 = places.find((pl) => pl.id === p2Id);
      const mergedId = `${p1.id}_${p2.id}`;
      const mergedPlace = {
        id: mergedId,
        label: `${p1.label}${p2.label}`,
        tokens: p1.tokens + p2.tokens,
        x: Math.round((p1.x + p2.x) / 2),
        y: Math.round((p1.y + p2.y) / 2),
      };

      const newTransitions = transitions.filter((tr) => tr.id !== t.id);
      const newPlaces = places
        .filter((pl) => pl.id !== p1Id && pl.id !== p2Id)
        .concat(mergedPlace);

      const updatedArcs = arcs
        .filter((a) => a.source !== t.id && a.target !== t.id)
        .map((a) => ({
          ...a,
          source: a.source === p1Id || a.source === p2Id ? mergedId : a.source,
          target: a.target === p1Id || a.target === p2Id ? mergedId : a.target,
        }));

      return {
        applied: true,
        ruleName: 'Fusion de Places en Série (Règle 5)',
        newNet: {
          places: newPlaces,
          transitions: newTransitions,
          arcs: normalizeArcs(updatedArcs),
        },
        affectedIds: [p1Id, t.id, p2Id],
        log: `Suppression de ${t.label} et fusion en série de ${p1.label} + ${p2.label} → ${mergedPlace.label} (${mergedPlace.tokens} jeton(s)).`,
      };
    }
  }

  return { applied: false, ruleName: 'Fusion de Places en Série (Règle 5)', newNet: net, affectedIds: [], log: '' };
}

/**
 * Rule 6: Identity Place (Place Identité / Suppression de place auto-bouclée)
 */
export function reduceIdentityPlace(net) {
  const { places, transitions, arcs } = net;
  const { pre, post, m0 } = toMatrices(net);

  for (let pIdx = 0; pIdx < places.length; pIdx++) {
    let hasConnections = false;
    let isSelfLoopOnly = true;
    let maxRequiredTokens = 0;

    for (let tIdx = 0; tIdx < transitions.length; tIdx++) {
      if (pre[pIdx][tIdx] > 0 || post[pIdx][tIdx] > 0) {
        hasConnections = true;
      }
      if (pre[pIdx][tIdx] !== post[pIdx][tIdx]) {
        isSelfLoopOnly = false;
        break;
      }
      if (pre[pIdx][tIdx] > maxRequiredTokens) {
        maxRequiredTokens = pre[pIdx][tIdx];
      }
    }

    if (hasConnections && isSelfLoopOnly && m0[pIdx] >= maxRequiredTokens) {
      const targetP = places[pIdx];
      const newPlaces = places.filter((pl) => pl.id !== targetP.id);
      const newArcs = arcs.filter((a) => a.source !== targetP.id && a.target !== targetP.id);

      return {
        applied: true,
        ruleName: 'Place Identité (Règle 6)',
        newNet: {
          places: newPlaces,
          transitions: [...transitions],
          arcs: newArcs,
        },
        affectedIds: [targetP.id],
        log: `Place auto-bouclée ${targetP.label} supprimée (jetons suffisants, n'affecte pas le franchissement).`,
      };
    }
  }

  return { applied: false, ruleName: 'Place Identité (Règle 6)', newNet: net, affectedIds: [], log: '' };
}

/**
 * Ordered pipeline of all 6 reduction rules.
 */
const REDUCTION_PIPELINE = [
  reduceIdentityTransition, // Rule 3 (clean neutral self-loops first)
  reduceIdentityPlace,      // Rule 6 (clean redundant self-loop places)
  reduceIdenticalPlaces,    // Rule 2 (merge parallel places)
  reduceIdenticalTransitions, // Rule 4 (merge parallel transitions)
  reduceSubstitutablePlace, // Rule 1 (merge series transitions)
  reduceSeriesPlaces,       // Rule 5 (merge series places)
];

/**
 * Applies the first matching reduction rule (for "Step Reduce" button).
 */
export function applyNextReduction(net) {
  for (const ruleFn of REDUCTION_PIPELINE) {
    const result = ruleFn(net);
    if (result.applied) {
      return result;
    }
  }

  return {
    applied: false,
    ruleName: 'Aucune',
    newNet: net,
    affectedIds: [],
    log: 'Aucune règle de réduction applicable (réseau irréductible).',
  };
}

/**
 * Repeatedly applies reduction rules until no further simplification is possible (for "Reduce All" button).
 */
export function reduceAll(net, maxIterations = 50) {
  let currentNet = net;
  const steps = [];
  let iterations = 0;

  while (iterations < maxIterations) {
    const stepResult = applyNextReduction(currentNet);
    if (!stepResult.applied) break;

    steps.push({
      step: iterations + 1,
      ruleName: stepResult.ruleName,
      affectedIds: stepResult.affectedIds,
      log: stepResult.log,
    });
    currentNet = stepResult.newNet;
    iterations++;
  }

  return {
    reducedNet: currentNet,
    steps,
    totalReductions: steps.length,
  };
}