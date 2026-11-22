import { useEffect, useRef, useState } from 'react'
import cytoscape from 'cytoscape'

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

export default function PetriCanvas({
  net,
  setNet,
  tool,
  selected,
  setSelected,
  selectedArcControl,
  setSelectedArcControl,
  interactionMessage,
  setInteractionMessage,
  onEditNode,
}) {
  const [pendingSource, setPendingSource] = useState(null)
  const [pendingPoint, setPendingPoint] = useState(null)
  const graphRef = useRef(null)
  const arcDragRef = useRef(null)
  const controlDragRef = useRef(null)
  const selectedRef = useRef(selected)

  useEffect(() => {
    selectedRef.current = selected
  }, [selected])

  useEffect(() => {
    arcDragRef.current = null
    setPendingSource(null)
    setPendingPoint(null)
  }, [tool, net])

  useEffect(() => {
    if (!graphRef.current) return undefined

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
        const distance = (x - drag.midX) * drag.normalX + (y - drag.midY) * drag.normalY
        drag.distance = distance
        setSelectedArcControl((current) =>
          current && {
            ...current,
            distance,
            point: { x, y },
          },
        )
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
        setSelectedArcControl((current) =>
          current && {
            ...current,
            distance: controlDistance,
            point: getControlPoint(current.source, current.target, controlDistance * zoom),
          },
        )
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
        onEditNode({ id, label: place.label, tokens: String(place.tokens), kind: 'place' })
      } else {
        const transition = net.transitions.find((item) => item.id === id)
        if (!transition) return
        onEditNode({ id, label: transition.label, kind: 'transition' })
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

    const resizeObserver = new ResizeObserver(() => {
      cy.resize()
    })
    if (graphRef.current) {
      resizeObserver.observe(graphRef.current)
    }

    cy.ready(() => {
      cy.resize()
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
      resizeObserver.disconnect()
      window.removeEventListener('pointermove', handlePointerMove)
      container?.removeEventListener('dblclick', handleDoubleClick)
      window.removeEventListener('pointerup', handleWindowPointerUp)
      cy.destroy()
    }
  }, [net, tool, setNet, setSelected, setSelectedArcControl, setInteractionMessage, onEditNode])

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
    <section className="flex min-w-0 flex-col bg-slate-50">
      <div className="flex h-[82px] shrink-0 items-center justify-between border-b border-slate-200 bg-white px-[22px] py-4">
        <div>
          <span className="block text-[11px] font-extrabold uppercase tracking-[0.08em] text-slate-500">
            Modèle actif
          </span>
          <h1 className="mt-0.5 mb-0 text-[18px]">Réseau de Petri</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-slate-200 bg-slate-50 px-[9px] py-1.5 text-[12px] font-bold text-slate-500">
            {net.places.length} places
          </span>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-[9px] py-1.5 text-[12px] font-bold text-slate-500">
            {net.transitions.length} transitions
          </span>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-[9px] py-1.5 text-[12px] font-bold text-slate-500">
            {net.arcs.length} arcs
          </span>
        </div>
      </div>

      <div className="relative min-h-[520px] w-full flex-1 overflow-hidden max-[820px]:min-h-[480px]">
        <div
          className="absolute inset-0 h-full w-full bg-white"
          style={{
            backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }}
          ref={graphRef}
        />
        <div className="pointer-events-none absolute inset-0 z-20">
          {(tool === 'arc' || interactionMessage) && (
            <div
              className={`pointer-events-none absolute top-3 left-1/2 z-[21] max-w-[calc(100%-24px)] -translate-x-1/2 whitespace-nowrap rounded-full border px-[11px] py-[7px] text-[12px] font-bold ${
                interactionMessage
                  ? 'border-red-200 bg-red-50 text-red-700'
                  : 'border-blue-200 bg-blue-50 text-blue-700'
              }`}
              role="status"
            >
              {interactionMessage || 'Glissez d’un nœud à un autre pour créer un arc.'}
            </div>
          )}

          {(pendingSource || selectedArcControl) && (
            <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
              <defs>
                <marker
                  id="arc-preview-arrow"
                  markerWidth="9"
                  markerHeight="9"
                  refX="8"
                  refY="4.5"
                  orient="auto"
                >
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
                    className="pointer-events-all cursor-grab touch-none active:cursor-grabbing"
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
  )
}