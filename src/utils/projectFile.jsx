import { isValidArc } from '../engine/petriNetModel'

export const PROJECT_FORMAT = 'PetriSlim'
export const PROJECT_VERSION = 1

export function parseProjectFile(contents) {
  let project
  try {
    project = JSON.parse(contents)
  } catch {
    throw new Error('Le fichier ne contient pas de JSON valide.')
  }

  if (!project || typeof project !== 'object' || project.format !== PROJECT_FORMAT) {
    throw new Error('Ce fichier n’est pas un projet PetriSlim.')
  }
  if (project.version !== PROJECT_VERSION) {
    throw new Error(`Version de fichier non prise en charge : ${project.version}.`)
  }

  const sourceNet = project.net
  if (
    !sourceNet ||
    !Array.isArray(sourceNet.places) ||
    !Array.isArray(sourceNet.transitions) ||
    !Array.isArray(sourceNet.arcs)
  ) {
    throw new Error('Le projet doit contenir les tableaux places, transitions et arcs.')
  }

  const ids = new Set()
  const registerId = (id) => {
    if (typeof id !== 'string' || !id.trim() || ids.has(id)) {
      throw new Error('Chaque élément doit avoir un identifiant unique non vide.')
    }
    ids.add(id)
  }
  const hasPosition = (element) => Number.isFinite(element.x) && Number.isFinite(element.y)

  const places = sourceNet.places.map((place) => {
    if (!place || typeof place !== 'object') {
      throw new Error('Une place du projet est invalide.')
    }
    registerId(place.id)
    if (
      typeof place.label !== 'string' ||
      !place.label.trim() ||
      !Number.isInteger(place.tokens) ||
      place.tokens < 0 ||
      !hasPosition(place)
    ) {
      throw new Error(`La place ${place.id} contient des données invalides.`)
    }
    return {
      id: place.id,
      label: place.label,
      tokens: place.tokens,
      x: place.x,
      y: place.y,
    }
  })

  const transitions = sourceNet.transitions.map((transition) => {
    if (!transition || typeof transition !== 'object') {
      throw new Error('Une transition du projet est invalide.')
    }
    registerId(transition.id)
    if (
      typeof transition.label !== 'string' ||
      !transition.label.trim() ||
      !hasPosition(transition)
    ) {
      throw new Error(`La transition ${transition.id} contient des données invalides.`)
    }
    return {
      id: transition.id,
      label: transition.label,
      x: transition.x,
      y: transition.y,
    }
  })

  const arcs = sourceNet.arcs.map((arc) => {
    if (!arc || typeof arc !== 'object') {
      throw new Error('Un arc du projet est invalide.')
    }
    registerId(arc.id)
    if (
      !Number.isInteger(arc.weight) ||
      arc.weight < 1 ||
      (arc.controlDistance !== undefined && !Number.isFinite(arc.controlDistance))
    ) {
      throw new Error(`L’arc ${arc.id} contient des données invalides.`)
    }
    return {
      id: arc.id,
      source: arc.source,
      target: arc.target,
      weight: arc.weight,
      ...(arc.controlDistance === undefined ? {} : { controlDistance: arc.controlDistance }),
    }
  })

  const net = { places, transitions, arcs }
  if (arcs.some((arc) => !isValidArc(net, arc.source, arc.target))) {
    throw new Error('Chaque arc doit relier une place à une transition.')
  }

  return net
}