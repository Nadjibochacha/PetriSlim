import { useEffect, useMemo, useRef, useState } from 'react'
import cytoscape from 'cytoscape'
import {
  Activity,
  ArrowLeftRight,
  Braces,
  CircleDot,
  FolderOpen,
  GitBranch,
  RotateCcw,
  Trash2,
  WandSparkles,
} from 'lucide-react'
import './App.css'
import { PRESET_NETS } from './data/presets'
import { fromMatrices, isValidArc, toMatrices } from './engine/petriNetModel'
import { generateReachabilityGraph } from './engine/reachabilityGraph'
import { applyNextReduction, reduceAll } from './engine/reductionRules'

const cloneNet = (net) => JSON.parse(JSON.stringify(net))
const PROJECT_FORMAT = 'PetriSlim'
const PROJECT_VERSION = 1

function parseProjectFile(contents) {
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

function findNodeAtPosition(cy, x, y) {
  return cy.nodes().filter((node) => {
    const bounds = node.renderedBoundingBox()
    return x >= bounds.x1 && x <= bounds.x2 && y >= bounds.y1 && y <= bounds.y2
  })[0]
}

function getControlPoint(source, target, distance) {
  const dx = target.x - source.x
  const dy = target.y - source.y
  const length = Math.sqrt(dx * dx + dy * dy) || 1
  const offset = Number(distance) || 0

  return {
    x: (source.x + target.x) / 2 - (dy / length) * offset,
    y: (source.y + target.y) / 2 + (dx / length) * offset,
  }
}

function App() {
  const [net, setNet] = useState(() => cloneNet(PRESET_NETS[0].net))
  const [activeView, setActiveView] = useState('graph')
  const [tool, setTool] = useState('select')
  const [selected, setSelected] = useState(null)
  const [selectedArcControl, setSelectedArcControl] = useState(null)
  const [pendingSource, setPendingSource] = useState(null)
  const [pendingPoint, setPendingPoint] = useState(null)
  const [reachability, setReachability] = useState(null)
  const [reducedNet, setReducedNet] = useState(null)
  const [logs, setLogs] = useState([])
  const [editingNode, setEditingNode] = useState(null)
  const [interactionMessage, setInteractionMessage] = useState('')
  const [fileName, setFileName] = useState(null)
  const [fileError, setFileError] = useState('')
  const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify(PRESET_NETS[0].net))
  const [pendingDocument, setPendingDocument] = useState(null)
  const graphRef = useRef(null)
  const fileInputRef = useRef(null)
  const fileMenuRef = useRef(null)
  const arcDragRef = useRef(null)
  const controlDragRef = useRef(null)
  const selectedRef = useRef(selected)
  const hasUnsavedChanges = JSON.stringify(net) !== savedSnapshot

  useEffect(() => {
    if (activeView !== 'graph' || !graphRef.current) return

    const elements = [
      ...net.places.map((place) => ({
        data: {
          id: place.id,
          label: `${place.label}\n● ${place.tokens}`,
          kind: 'place',
          tokens: place.tokens,
        },
        position: {
          x: Number.isFinite(place.x) ? place.x : 100,
          y: Number.isFinite(place.y) ? place.y : 100,
        },
      })),
      ...net.transitions.map((transition) => ({
        data: {
          id: transition.id,
          label: transition.label,
          kind: 'transition',
        },
        position: {
          x: Number.isFinite(transition.x) ? transition.x : 100,
          y: Number.isFinite(transition.y) ? transition.y : 100,
        },
      })),
      ...net.arcs.map((arc) => ({
        data: {
          id: arc.id,
          source: arc.source,
          target: arc.target,
          label: arc.weight > 1 ? String(arc.weight) : '',
          weight: arc.weight,
          controlDistance: Number(arc.controlDistance) || 0,
        },
      })),
    ]

    const cy = cytoscape({
      container: graphRef.current,
      elements,
      style: [
        {
          selector: 'node[kind="place"]',
          style: {
            shape: 'ellipse',
            width: 62,
            height: 62,
            'background-color': '#fff',
            'border-width': 3,
            'border-color': '#334155',
            label: 'data(label)',
            'text-valign': 'center',
            'text-halign': 'center',
            'text-wrap': 'wrap',
            'text-max-width': 56,
            'font-size': 11,
            'font-weight': 700,
            color: '#0f172a',
          },
        },
        {
          selector: 'node[kind="transition"]',
          style: {
            shape: 'rectangle',
            width: 24,
            height: 62,
            'background-color': '#1e293b',
            'border-width': 2,
            'border-color': '#0f172a',
            label: 'data(label)',
            'text-valign': 'top',
            'text-halign': 'center',
            'text-margin-y': -8,
            'font-size': 13,
            'font-weight': 700,
            color: '#0f172a',
          },
        },
        {
          selector: 'edge',
          style: {
            width: 2,
            'line-color': '#64748b',
            'target-arrow-color': '#64748b',
            'target-arrow-shape': 'triangle',
            'curve-style': 'unbundled-bezier',
            'control-point-distances': 'data(controlDistance)',
            'control-point-weights': 0.5,
            label: 'data(label)',
            'font-size': 12,
            'font-weight': 700,
            'text-background-opacity': 1,
            'text-background-color': '#ffffff',
            'text-background-padding': 3,
          },
        },
        {
          selector: 'edge:selected',
          style: {
            width: 3,
            'line-color': '#2563eb',
            'target-arrow-color': '#2563eb',
          },
        },
        {
          selector: 'node:selected',
          style: {
            'border-color': '#2563eb',
            'border-width': 5,
          },
        },
      ],
      layout: { name: 'preset' },
      minZoom: 0.35,
      maxZoom: 3,
      wheelSensitivity: 0.15,
      autoungrabify: tool === 'arc',
    })

    cy.on('tap', 'node', (event) => {
      const node = event.target
      const id = node.id()
      if (tool === 'arc') return
      cy.elements().unselect()
      node.select()
      setSelectedArcControl(null)
      setSelected(id)
    })

    cy.on('tapstart', 'node', (event) => {
      if (tool !== 'arc') return
      const node = event.target
      const position = node.renderedPosition()
      arcDragRef.current = {
        sourceId: node.id(),
        startX: position.x,
        startY: position.y,
      }
      setPendingSource(position)
      setPendingPoint(position)
    })

    cy.on('tap', 'edge', (event) => {
      if (tool !== 'select') return
      const edge = event.target
      cy.elements().unselect()
      edge.select()
      setSelected(edge.id())
      const source = edge.source().renderedPosition()
      const target = edge.target().renderedPosition()
      const distance = edge.data('controlDistance') || 0
      setSelectedArcControl({
        id: edge.id(),
        source,
        target,
        distance,
        zoom: cy.zoom(),
        point: getControlPoint(source, target, distance * cy.zoom()),
      })
    })

    const container = cy.container()
    const handlePointerMove = (event) => {
      const bounds = container.getBoundingClientRect()
      const x = event.clientX - bounds.left
      const y = event.clientY - bounds.top

      if (arcDragRef.current) {
        setPendingPoint({ x, y })
      }

      if (controlDragRef.current) {
        const drag = controlDragRef.current
        const distance = ((x - drag.midX) * drag.normalX + (y - drag.midY) * drag.normalY)
        drag.distance = distance
        setSelectedArcControl((current) => current && ({
          ...current,
          distance,
          point: { x, y },
        }))
      }
    }
    const handlePointerUp = (event) => {
      const bounds = container.getBoundingClientRect()
      const x = event.clientX - bounds.left
      const y = event.clientY - bounds.top
      const drag = arcDragRef.current

      if (drag) {
        const target = findNodeAtPosition(cy, x, y)
        if (target && target.id() !== drag.sourceId) {
          const sourcePlace = net.places.some((place) => place.id === drag.sourceId)
          const targetPlace = net.places.some((place) => place.id === target.id())
          const sourceTransition = net.transitions.some((transition) => transition.id === drag.sourceId)
          const targetTransition = net.transitions.some((transition) => transition.id === target.id())
          const valid = (sourcePlace && targetTransition) || (sourceTransition && targetPlace)

          if (valid) {
            setInteractionMessage('')
            setNet((current) => ({
              ...current,
              arcs: [
                ...current.arcs,
                { id: `arc_${Date.now()}`, source: drag.sourceId, target: target.id(), weight: 1 },
              ],
            }))
          } else {
            setInteractionMessage('Un arc doit relier une place à une transition.')
          }
        }

        arcDragRef.current = null
        setPendingSource(null)
        setPendingPoint(null)
      }

      if (controlDragRef.current) {
        const { id, zoom, distance } = controlDragRef.current
        const controlDistance = distance / zoom
        setNet((current) => ({
          ...current,
          arcs: current.arcs.map((arc) =>
            arc.id === id ? { ...arc, controlDistance } : arc,
          ),
        }))
        setSelectedArcControl((current) => current && ({
          ...current,
          distance: controlDistance,
          point: getControlPoint(current.source, current.target, controlDistance * zoom),
        }))
        controlDragRef.current = null
      }
    }

    const handleDoubleClick = (event) => {
      const bounds = container.getBoundingClientRect()
      const node = findNodeAtPosition(cy, event.clientX - bounds.left, event.clientY - bounds.top)
      if (!node) return
      const id = node.id()
      const place = net.places.find((item) => item.id === id)
      if (place) {
        setEditingNode({ id, label: place.label, tokens: String(place.tokens), kind: 'place' })
      } else {
        const transition = net.transitions.find((item) => item.id === id)
        if (!transition) return
        setEditingNode({ id, label: transition.label, kind: 'transition' })
      }
    }

    const handleCanvasTap = (event) => {
      if (event.target !== cy) return
      cy.elements().unselect()
      setSelected(null)
      setSelectedArcControl(null)
      if (tool !== 'place' && tool !== 'transition') return

      const position = event.position
      if (tool === 'place') {
        const id = `p${net.places.length + 1}_${Date.now()}`
        setNet((current) => ({
          ...current,
          places: [
            ...current.places,
            { id, label: `P${current.places.length + 1}`, tokens: 0, x: position.x, y: position.y },
          ],
        }))
      } else {
        const id = `t${net.transitions.length + 1}_${Date.now()}`
        setNet((current) => ({
          ...current,
          transitions: [
            ...current.transitions,
            { id, label: `T${current.transitions.length + 1}`, x: position.x, y: position.y },
          ],
        }))
      }
    }

    const handleWindowPointerUp = (event) => handlePointerUp(event)
    window.addEventListener('pointermove', handlePointerMove)
    container?.addEventListener('dblclick', handleDoubleClick)
    window.addEventListener('pointerup', handleWindowPointerUp)
    cy.ready(() => {
      cy.fit(undefined, 40)
      if (!selectedRef.current) return
      const selectedElement = cy.$id(selectedRef.current)
      if (!selectedElement.length) return
      selectedElement.select()
      if (selectedElement.isEdge()) {
        const source = selectedElement.source().renderedPosition()
        const target = selectedElement.target().renderedPosition()
        const distance = selectedElement.data('controlDistance') || 0
        setSelectedArcControl({
          id: selectedElement.id(),
          source,
          target,
          distance,
          zoom: cy.zoom(),
          point: getControlPoint(source, target, distance * cy.zoom()),
        })
      }
    })

    cy.on('tap', handleCanvasTap)
    cy.on('zoom pan', () => {
      const selectedId = selectedRef.current
      if (!selectedId) return
      const edge = cy.$id(selectedId)
      if (!edge.length || !edge.isEdge()) return
      const source = edge.source().renderedPosition()
      const target = edge.target().renderedPosition()
      const distance = edge.data('controlDistance') || 0
      setSelectedArcControl({
        id: edge.id(),
        source,
        target,
        distance,
        zoom: cy.zoom(),
        point: getControlPoint(source, target, distance * cy.zoom()),
      })
    })

    cy.on('dragfree', 'node', (event) => {
      const node = event.target
      const id = node.id()
      const position = node.position()
      setNet((current) => ({
        ...current,
        places: current.places.map((place) =>
          place.id === id ? { ...place, x: position.x, y: position.y } : place,
        ),
        transitions: current.transitions.map((transition) =>
          transition.id === id ? { ...transition, x: position.x, y: position.y } : transition,
        ),
      }))
    })

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      container?.removeEventListener('dblclick', handleDoubleClick)
      window.removeEventListener('pointerup', handleWindowPointerUp)
      cy.destroy()
    }
  }, [activeView, net, tool])

  useEffect(() => {
    selectedRef.current = selected
  }, [selected])

  const applyDocument = (document) => {
    const nextNet = cloneNet(document.net)
    setNet(nextNet)
    setFileName(document.fileName)
    setSavedSnapshot(JSON.stringify(nextNet))
    setSelected(null)
    setSelectedArcControl(null)
    arcDragRef.current = null
    controlDragRef.current = null
    setPendingSource(null)
    setPendingPoint(null)
    setReachability(null)
    setReducedNet(null)
    setLogs([])
    setEditingNode(null)
    setInteractionMessage('')
    setFileError('')
    setPendingDocument(null)
    if (fileMenuRef.current) fileMenuRef.current.open = false
  }

  const requestDocument = (document) => {
    setFileError('')
    if (fileMenuRef.current) fileMenuRef.current.open = false
    if (hasUnsavedChanges) {
      setPendingDocument(document)
      return
    }
    applyDocument(document)
  }

  const loadPreset = (presetId) => {
    const preset = PRESET_NETS.find((item) => item.id === presetId)
    if (!preset) return
    requestDocument({ net: preset.net, fileName: null })
  }

  const openJsonFile = async (event) => {
    const input = event.currentTarget
    const file = input.files?.[0]
    if (!file) return

    try {
      const contents = await file.text()
      const openedNet = parseProjectFile(contents)
      requestDocument({ net: openedNet, fileName: file.name })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur inconnue.'
      setFileError(`Impossible d’ouvrir le fichier : ${message}`)
      if (fileMenuRef.current) fileMenuRef.current.open = true
    } finally {
      input.value = ''
    }
  }

  const saveJsonFile = () => {
    const name = fileName && fileName.toLowerCase().endsWith('.json')
      ? fileName
      : 'petrislim-net.json'

    try {
      const project = {
        format: PROJECT_FORMAT,
        version: PROJECT_VERSION,
        net,
      }
      const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = name
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 0)
      setFileName(name)
      setSavedSnapshot(JSON.stringify(net))
      setFileError('')
      if (fileMenuRef.current) fileMenuRef.current.open = false
      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur inconnue.'
      setFileError(`Impossible d’enregistrer le fichier : ${message}`)
      if (fileMenuRef.current) fileMenuRef.current.open = true
      return false
    }
  }

  const createNewDocument = () => {
    requestDocument({
      net: { places: [], transitions: [], arcs: [] },
      fileName: null,
    })
  }

  const continueWithoutSaving = () => {
    if (pendingDocument) applyDocument(pendingDocument)
  }

  const saveAndContinue = () => {
    const document = pendingDocument
    if (!document) return
    if (!saveJsonFile()) return
    applyDocument(document)
  }

  const chooseTool = (nextTool) => {
    arcDragRef.current = null
    setPendingSource(null)
    setPendingPoint(null)
    if (nextTool !== 'select') setSelectedArcControl(null)
    setInteractionMessage('')
    setTool(nextTool)
  }

  const deleteSelected = () => {
    if (!selected) return
    setNet((current) => ({
      places: current.places.filter((place) => place.id !== selected),
      transitions: current.transitions.filter((transition) => transition.id !== selected),
      arcs: current.arcs.filter((arc) =>
        arc.id !== selected && arc.source !== selected && arc.target !== selected,
      ),
    }))
    setSelected(null)
    setSelectedArcControl(null)
  }

  const saveNodeEdits = (event) => {
    event.preventDefault()
    if (!editingNode) return
    const label = editingNode.label.trim()
    if (!label) return

    if (editingNode.kind === 'place') {
      const tokens = Math.floor(Math.max(0, Number(editingNode.tokens) || 0))
      setNet((current) => ({
        ...current,
        places: current.places.map((place) =>
          place.id === editingNode.id ? { ...place, label, tokens } : place,
        ),
      }))
    } else {
      setNet((current) => ({
        ...current,
        transitions: current.transitions.map((transition) =>
          transition.id === editingNode.id ? { ...transition, label } : transition,
        ),
      }))
    }

    setEditingNode(null)
  }

  useEffect(() => {
    if (!selected) return undefined

    const handleKeyDown = (event) => {
      const activeElement = document.activeElement
      const isEditingText =
        activeElement instanceof HTMLElement &&
        (activeElement.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeElement.tagName))
      if ((event.key === 'Delete' || event.key === 'Backspace') && !isEditingText) {
        event.preventDefault()
        setNet((current) => ({
          places: current.places.filter((place) => place.id !== selected),
          transitions: current.transitions.filter((transition) => transition.id !== selected),
          arcs: current.arcs.filter((arc) =>
            arc.id !== selected && arc.source !== selected && arc.target !== selected,
          ),
        }))
        setSelected(null)
        setSelectedArcControl(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selected])

  const resetNet = () => {
    createNewDocument()
  }

  const updateMatrix = (kind, row, column, value) => {
    const { pre, post, m0 } = toMatrices(net)
    if (kind === 'm0') m0[row] = Math.max(0, Number(value) || 0)
    if (kind === 'pre') pre[row][column] = Math.max(0, Number(value) || 0)
    if (kind === 'post') post[row][column] = Math.max(0, Number(value) || 0)
    setNet(fromMatrices(net.places, net.transitions, pre, post, m0))
  }

  const analyze = () => {
    setReachability(generateReachabilityGraph(net))
  }

  const runStepReduction = () => {
    const result = applyNextReduction(net)
    setLogs((current) => [result.log, ...current].filter(Boolean))
    if (result.applied) {
      setNet(cloneNet(result.newNet))
      setReducedNet(cloneNet(result.newNet))
    }
  }

  const runFullReduction = () => {
    const result = reduceAll(net)
    setNet(cloneNet(result.reducedNet))
    setReducedNet(cloneNet(result.reducedNet))
    setLogs(result.steps.map((step) => step.log).reverse())
  }

  const matrices = toMatrices(net)
  const selectedArc = net.arcs.find((arc) => arc.id === selected)
  const startArcControlDrag = (event) => {
    if (!selectedArcControl || !graphRef.current) return
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)

    const { source, target } = selectedArcControl
    const dx = target.x - source.x
    const dy = target.y - source.y
    const length = Math.sqrt(dx * dx + dy * dy) || 1
    controlDragRef.current = {
      id: selectedArcControl.id,
      zoom: selectedArcControl.zoom,
      distance: selectedArcControl.distance * selectedArcControl.zoom,
      midX: (source.x + target.x) / 2,
      midY: (source.y + target.y) / 2,
      normalX: -dy / length,
      normalY: dx / length,
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark"><GitBranch size={20} /></div>
          <div>
            <strong>PetriSlim</strong>
            <span>Petri Net Analyzer</span>
          </div>
        </div>

        <nav className="view-tabs" aria-label="Main views">
          <button className={activeView === 'graph' ? 'active' : ''} onClick={() => setActiveView('graph')}>
            <CircleDot size={16} /> Graph
          </button>
          <button className={activeView === 'matrix' ? 'active' : ''} onClick={() => setActiveView('matrix')}>
            <Braces size={16} /> Matrice
          </button>
          <button className={activeView === 'reachability' ? 'active' : ''} onClick={() => setActiveView('reachability')}>
            <Activity size={16} /> Accessibilité
          </button>
        </nav>

        <div className="header-actions">
          <select aria-label="Preset" defaultValue="" onChange={(event) => loadPreset(event.target.value)}>
            <option value="" disabled>Preset...</option>
            {PRESET_NETS.map((preset) => (
              <option key={preset.id} value={preset.id}>{preset.name}</option>
            ))}
          </select>
          <details className="file-menu" ref={fileMenuRef}>
            <summary title="Fichier" aria-label="Menu fichier">
              <FolderOpen size={17} />
            </summary>
            <div className="file-menu-content">
              <p className="file-menu-name">
                {fileName || 'Preset / sans fichier'}{hasUnsavedChanges ? ' · Modifié' : ''}
              </p>
              <button type="button" onClick={createNewDocument}>Nouveau</button>
              <button type="button" onClick={() => fileInputRef.current?.click()}>Ouvrir JSON…</button>
              <button type="button" onClick={saveJsonFile}>Enregistrer JSON</button>
              {fileError && <p className="file-error" role="alert">{fileError}</p>}
            </div>
          </details>
          <button className="icon-button" title="Réinitialiser" onClick={resetNet}>
            <RotateCcw size={17} />
          </button>
        </div>
        <input
          ref={fileInputRef}
          className="hidden-file-input"
          type="file"
          accept=".json,application/json"
          onChange={openJsonFile}
          aria-label="Ouvrir un fichier PetriSlim JSON"
        />
      </header>

      <main className="workspace">
        {activeView === 'graph' && (
          <>
            <aside className="toolbox">
              <button className={tool === 'select' ? 'active' : ''} onClick={() => chooseTool('select')}>
                <ArrowLeftRight size={17} /> Sélection
              </button>
              <button className={tool === 'place' ? 'active' : ''} onClick={() => chooseTool('place')}>
                <span className="place-icon" /> Place
              </button>
              <button className={tool === 'transition' ? 'active' : ''} onClick={() => chooseTool('transition')}>
                <span className="transition-icon" /> Transition
              </button>
              <button className={tool === 'arc' ? 'active' : ''} onClick={() => chooseTool('arc')}>
                <GitBranch size={17} /> Arc
              </button>
              <button className="danger" disabled={!selected} onClick={deleteSelected}>
                <Trash2 size={17} /> Supprimer
              </button>
            </aside>

            <section className="canvas-panel">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">Modèle actif</span>
                  <h1>Réseau de Petri</h1>
                </div>
                <div className="stats">
                  <span>{net.places.length} places</span>
                  <span>{net.transitions.length} transitions</span>
                  <span>{net.arcs.length} arcs</span>
                </div>
              </div>
              <div className="graph-stage">
                <div className="graph-canvas" ref={graphRef} />
                <div className="graph-overlay">
                  {(tool === 'arc' || interactionMessage) && (
                    <div className={`canvas-hint${interactionMessage ? ' error' : ''}`} role="status">
                      {interactionMessage || 'Glissez d’un nœud à un autre pour créer un arc.'}
                    </div>
                  )}
                  {(pendingSource || selectedArcControl) && (
                    <svg className="arc-preview">
                      <defs>
                        <marker id="arc-preview-arrow" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto">
                          <path d="M0,0 L9,4.5 L0,9 z" fill="#2563eb" />
                        </marker>
                      </defs>
                      {pendingSource && (
                        <line
                          x1={pendingSource.x}
                          y1={pendingSource.y}
                          x2={pendingPoint?.x ?? pendingSource.x}
                          y2={pendingPoint?.y ?? pendingSource.y}
                          stroke="#2563eb"
                          strokeWidth="3"
                          markerEnd="url(#arc-preview-arrow)"
                        />
                      )}
                      {selectedArcControl && (
                        <>
                          <line
                            x1={(selectedArcControl.source.x + selectedArcControl.target.x) / 2}
                            y1={(selectedArcControl.source.y + selectedArcControl.target.y) / 2}
                            x2={selectedArcControl.point.x}
                            y2={selectedArcControl.point.y}
                            stroke="#2563eb"
                            strokeDasharray="4 4"
                            strokeWidth="1.5"
                          />
                          <circle
                            className="arc-control-handle"
                            cx={selectedArcControl.point.x}
                            cy={selectedArcControl.point.y}
                            r="8"
                            fill="#ffffff"
                            stroke="#2563eb"
                            strokeWidth="3"
                            aria-label="Drag to bend the selected arc"
                            tabIndex="0"
                            onPointerDown={startArcControlDrag}
                          />
                        </>
                      )}
                    </svg>
                  )}
                </div>
              </div>
            </section>

            <aside className="action-panel">
              <div className="panel-heading compact">
                <div>
                  <span className="eyebrow">Analyse</span>
                  <h2>Réductions</h2>
                </div>
              </div>
              <button className="primary-button" onClick={analyze}>
                <Activity size={17} /> Générer les états
              </button>
              <button className="secondary-button" onClick={runStepReduction}>
                <WandSparkles size={17} /> Réduire une étape
              </button>
              <button className="secondary-button" onClick={runFullReduction}>
                <WandSparkles size={17} /> Réduire tout
              </button>

              {selectedArc && (
                <div className="arc-properties">
                  <h3>Arc sélectionné</h3>
                  <label>
                    Poids
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={selectedArc.weight}
                      onChange={(event) => {
                        const weight = Math.max(1, Math.floor(Number(event.target.value) || 1))
                        setNet((current) => ({
                          ...current,
                          arcs: current.arcs.map((arc) =>
                            arc.id === selectedArc.id ? { ...arc, weight } : arc,
                          ),
                        }))
                      }}
                    />
                  </label>
                  <p>Glissez le point bleu pour courber l’arc.</p>
                </div>
              )}

              <div className="log">
                <h3>Journal</h3>
                {logs.length === 0 ? (
                  <p>Aucune réduction appliquée.</p>
                ) : logs.map((log, index) => (
                  <div className="log-item" key={`${log}-${index}`}>{log}</div>
                ))}
              </div>
            </aside>
          </>
        )}

        {activeView === 'matrix' && (
          <section className="matrix-panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">Synchronisation directe</span>
                <h1>Matrices d’incidence</h1>
              </div>
            </div>
            <div className="matrix-grid">
              {[
                { title: 'Pre', kind: 'pre', values: matrices.pre },
                { title: 'Post', kind: 'post', values: matrices.post },
              ].map((matrix) => (
                <div className="matrix-card" key={matrix.kind}>
                  <h2>{matrix.title}</h2>
                  {net.places.length === 0 || net.transitions.length === 0 ? (
                    <p className="empty-message">Ajoutez des places et des transitions.</p>
                  ) : (
                    <table>
                      <thead>
                        <tr>
                          <th />
                          {net.transitions.map((transition) => (
                            <th key={transition.id}>{transition.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {net.places.map((place, row) => (
                          <tr key={place.id}>
                            <th>{place.label}</th>
                            {net.transitions.map((transition, column) => (
                              <td key={transition.id}>
                                <input
                                  type="number"
                                  min="0"
                                  value={matrix.values[row][column]}
                                  onChange={(event) =>
                                    updateMatrix(matrix.kind, row, column, event.target.value)
                                  }
                                />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              ))}

              <div className="matrix-card marking-card">
                <h2>M0 — Marquage initial</h2>
                {net.places.length === 0 ? (
                  <p className="empty-message">Aucune place.</p>
                ) : (
                  net.places.map((place, index) => (
                    <label key={place.id}>
                      <span>{place.label}</span>
                      <input
                        type="number"
                        min="0"
                        value={matrices.m0[index]}
                        onChange={(event) => updateMatrix('m0', index, 0, event.target.value)}
                      />
                    </label>
                  ))
                )}
              </div>
            </div>
          </section>
        )}

        {activeView === 'reachability' && (
          <section className="reachability-panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">Graphe des marquages</span>
                <h1>États accessibles</h1>
              </div>
              <button className="primary-button" onClick={analyze}>
                <Activity size={17} /> Calculer
              </button>
            </div>

            {!reachability ? (
              <div className="empty-state">
                <Activity size={34} />
                <h2>Aucune analyse disponible</h2>
                <p>Calculez le graphe pour afficher tous les marquages accessibles.</p>
              </div>
            ) : (
              <div className="reachability-content">
                <div className="reachability-stats">
                  <div><span>États</span><strong>{reachability.stateCount}</strong></div>
                  <div><span>Arcs</span><strong>{reachability.edges.length}</strong></div>
                  <div>
                    <span>Exploration</span>
                    <strong>
                      {reachability.isComplete
                        ? 'Complète'
                        : `Limite de ${reachability.stateLimit} états atteinte`}
                    </strong>
                  </div>
                  {reducedNet && (
                    <div>
                      <span>Après réduction</span>
                      <strong>
                        {generateReachabilityGraph(reducedNet).stateCount} états
                      </strong>
                    </div>
                  )}
                </div>
                <ReachabilityCanvas graph={reachability} />
              </div>
            )}
          </section>
        )}
      </main>
      {editingNode && (
        <div className="dialog-backdrop">
          <form className="edit-dialog" onSubmit={saveNodeEdits}>
            <h2>{editingNode.kind === 'place' ? 'Modifier la place' : 'Modifier la transition'}</h2>
            <label>
              Nom
              <input
                autoFocus
                value={editingNode.label}
                onChange={(event) =>
                  setEditingNode((current) => ({ ...current, label: event.target.value }))
                }
              />
            </label>
            {editingNode.kind === 'place' && (
              <label>
                Jetons initiaux
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={editingNode.tokens}
                  onChange={(event) =>
                    setEditingNode((current) => ({ ...current, tokens: event.target.value }))
                  }
                />
              </label>
            )}
            <div className="dialog-actions">
              <button type="button" className="secondary-button" onClick={() => setEditingNode(null)}>
                Annuler
              </button>
              <button type="submit" className="primary-button">Enregistrer</button>
            </div>
          </form>
        </div>
      )}
      {pendingDocument && (
        <div className="dialog-backdrop">
          <section className="edit-dialog" role="alertdialog" aria-modal="true">
            <h2>Modifications non enregistrées</h2>
            <p>Enregistrez le réseau actuel avant de continuer ?</p>
            {fileError && <p className="file-error" role="alert">{fileError}</p>}
            <div className="dialog-actions file-dialog-actions">
              <button type="button" className="secondary-button" onClick={() => setPendingDocument(null)}>
                Annuler
              </button>
              <button type="button" className="secondary-button" onClick={continueWithoutSaving}>
                Abandonner
              </button>
              <button type="button" className="primary-button" onClick={saveAndContinue}>
                Enregistrer
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

function layoutReachabilityGraph(graph) {
  const root = graph.nodes.find((node) => node.isInitial) || graph.nodes[0]
  if (!root) return { positions: new Map(), width: 360, height: 260 }

  const outgoing = new Map(graph.nodes.map((node) => [node.id, []]))
  const incoming = new Map(graph.nodes.map((node) => [node.id, []]))
  graph.edges.forEach((edge) => {
    outgoing.get(edge.source)?.push(edge.target)
    incoming.get(edge.target)?.push(edge.source)
  })

  const depths = new Map([[root.id, 0]])
  const queue = [root.id]
  while (queue.length > 0) {
    const sourceId = queue.shift()
    const nextDepth = depths.get(sourceId) + 1
    for (const targetId of outgoing.get(sourceId) || []) {
      if (depths.has(targetId)) continue
      depths.set(targetId, nextDepth)
      queue.push(targetId)
    }
  }

  graph.nodes.forEach((node) => {
    if (!depths.has(node.id)) depths.set(node.id, 0)
  })

  const layers = new Map()
  graph.nodes.forEach((node) => {
    const depth = depths.get(node.id)
    if (!layers.has(depth)) layers.set(depth, [])
    layers.get(depth).push(node.id)
  })

  const maxDepth = Math.max(...layers.keys())
  for (let depth = 1; depth <= maxDepth; depth++) {
    const layer = layers.get(depth) || []
    const previousLayer = layers.get(depth - 1) || []
    const previousOrder = new Map(previousLayer.map((id, index) => [id, index]))
    layer.sort((firstId, secondId) => {
      const averageParentPosition = (id) => {
        const parents = (incoming.get(id) || []).filter((parentId) => depths.get(parentId) === depth - 1)
        if (parents.length === 0) return previousLayer.length
        return parents.reduce((sum, parentId) => sum + previousOrder.get(parentId), 0) / parents.length
      }
      return averageParentPosition(firstId) - averageParentPosition(secondId)
    })
  }

  const maxLayerSize = Math.max(...Array.from(layers.values(), (layer) => layer.length))
  const padding = 72
  const layerGap = 230
  const nodeGap = 132
  const positions = new Map()

  layers.forEach((layer, depth) => {
    const firstY = padding + ((maxLayerSize - layer.length) * nodeGap) / 2
    layer.forEach((id, index) => {
      positions.set(id, {
        x: padding + depth * layerGap + 36,
        y: firstY + index * nodeGap + 36,
      })
    })
  })

  return {
    positions,
    width: padding * 2 + maxDepth * layerGap + 108,
    height: padding * 2 + (maxLayerSize - 1) * nodeGap + 112,
  }
}

function ReachabilityCanvas({ graph }) {
  const viewportRef = useRef(null)
  const fitZoomRef = useRef(1)
  const [zoom, setZoom] = useState(1)
  const layout = useMemo(() => layoutReachabilityGraph(graph), [graph])
  const edgeGroups = useMemo(() => {
    const groups = new Map()
    graph.edges.forEach((edge) => {
      const key = `${edge.source}\u0000${edge.target}`
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push(edge.id)
    })
    return groups
  }, [graph])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return undefined

    const updateFitZoom = () => {
      const availableWidth = Math.max(1, viewport.clientWidth - 32)
      const availableHeight = Math.max(1, viewport.clientHeight - 32)
      fitZoomRef.current = Math.min(1, availableWidth / layout.width, availableHeight / layout.height)
      setZoom(Math.min(1, Math.max(fitZoomRef.current, 0.72)))
    }

    const observer = new ResizeObserver(updateFitZoom)
    observer.observe(viewport.parentElement || viewport)
    updateFitZoom()
    return () => observer.disconnect()
  }, [layout.height, layout.width])

  const fitToView = () => {
    setZoom(fitZoomRef.current)
    viewportRef.current?.scrollTo({ left: 0, top: 0, behavior: 'smooth' })
  }

  const adjustZoom = (factor) => {
    setZoom((current) => Math.max(0.06, Math.min(3, current * factor)))
  }

  return (
    <div className="reachability-visualization">
      <div className="reachability-toolbar">
        <p>Couches depuis S0 · faites défiler pour explorer, ou ajustez pour tout voir</p>
        <div className="zoom-controls" aria-label="Contrôles du graphe">
          <button type="button" aria-label="Zoom arrière" onClick={() => adjustZoom(0.8)}>−</button>
          <span>{Math.round(zoom * 100)}%</span>
          <button type="button" aria-label="Zoom avant" onClick={() => adjustZoom(1.25)}>+</button>
          <button type="button" className="fit-button" onClick={fitToView}>Ajuster</button>
        </div>
      </div>
      <div className="reachability-canvas" ref={viewportRef}>
        <svg
          width={layout.width * zoom}
          height={layout.height * zoom}
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          role="img"
          aria-label="Graphe des marquages accessibles, organisé en couches depuis S0"
        >
          <defs>
            <marker id="reachability-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
              <path d="M0,0 L8,4 L0,8 z" fill="#94a3b8" />
            </marker>
          </defs>
          {graph.edges.map((edge) => {
            const source = layout.positions.get(edge.source)
            const target = layout.positions.get(edge.target)
            if (!source || !target) return null

            if (edge.source === edge.target) {
              const d = `M ${source.x - 16} ${source.y - 28} C ${source.x - 72} ${source.y - 96}, ${source.x + 72} ${source.y - 96}, ${source.x + 16} ${source.y - 28}`
              return (
                <g key={edge.id}>
                  <path d={d} markerEnd="url(#reachability-arrow)" />
                  <text x={source.x} y={source.y - 82} textAnchor="middle">{edge.label}</text>
                </g>
              )
            }

            const dx = target.x - source.x
            const dy = target.y - source.y
            const length = Math.sqrt(dx * dx + dy * dy) || 1
            const start = { x: source.x + (dx / length) * 36, y: source.y + (dy / length) * 36 }
            const end = { x: target.x - (dx / length) * 36, y: target.y - (dy / length) * 36 }
            const parallelEdges = edgeGroups.get(`${edge.source}\u0000${edge.target}`) || []
            const edgeIndex = parallelEdges.indexOf(edge.id)
            const offset = (edgeIndex - (parallelEdges.length - 1) / 2) * 26
            const control = {
              x: (start.x + end.x) / 2 - (dy / length) * offset,
              y: (start.y + end.y) / 2 + (dx / length) * offset,
            }
            const labelPoint = {
              x: (start.x + 2 * control.x + end.x) / 4,
              y: (start.y + 2 * control.y + end.y) / 4 - 7,
            }

            return (
              <g key={edge.id}>
                <path
                  d={`M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`}
                  markerEnd="url(#reachability-arrow)"
                />
                <text x={labelPoint.x} y={labelPoint.y} textAnchor="middle">{edge.label}</text>
              </g>
            )
          })}
          {graph.nodes.map((node) => {
            const position = layout.positions.get(node.id)
            if (!position) return null
            return (
              <g key={node.id} transform={`translate(${position.x}, ${position.y})`}>
                <circle
                  r="34"
                  className={node.isInitial ? 'initial-state' : ''}
                />
                <text className="state-id" textAnchor="middle" dominantBaseline="middle">{node.id}</text>
                <text className="marking-label" y="50" textAnchor="middle">{node.label}</text>
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}

export default App
