import { useEffect, useMemo, useRef, useState } from 'react'
import { Activity } from 'lucide-react'
import { generateReachabilityGraph } from '../engine/reachabilityGraph'

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
    <div className="min-w-0">
      <div className="mb-2.5 flex items-center justify-between gap-3 max-[820px]:flex-col max-[820px]:items-start">
        <p className="m-0 text-[12px] text-slate-500">
          Couches depuis S0 · faites défiler pour explorer, ou ajustez pour tout voir
        </p>
        <div className="flex flex-none items-center gap-1.5" aria-label="Contrôles du graphe">
          <button
            type="button"
            aria-label="Zoom arrière"
            className="h-[34px] min-w-[34px] rounded-[7px] border border-slate-300 bg-white px-[9px] font-extrabold text-slate-700"
            onClick={() => adjustZoom(0.8)}
          >
            −
          </button>
          <span className="min-w-[42px] text-center text-[12px] font-bold text-slate-500">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            aria-label="Zoom avant"
            className="h-[34px] min-w-[34px] rounded-[7px] border border-slate-300 bg-white px-[9px] font-extrabold text-slate-700"
            onClick={() => adjustZoom(1.25)}
          >
            +
          </button>
          <button
            type="button"
            className="h-[34px] min-w-[34px] rounded-[7px] border border-blue-200 bg-white px-3 font-extrabold text-blue-700"
            onClick={fitToView}
          >
            Ajuster
          </button>
        </div>
      </div>

      <div
        className="h-[520px] overflow-auto overscroll-contain rounded-xl border border-slate-200 bg-white bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:20px_20px] max-[820px]:h-[460px]"
        ref={viewportRef}
      >
        <svg
          className="block"
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
                  <path
                    d={d}
                    className="fill-none stroke-slate-400 stroke-[1.5]"
                    markerEnd="url(#reachability-arrow)"
                  />
                  <text
                    x={source.x}
                    y={source.y - 82}
                    textAnchor="middle"
                    className="fill-slate-700 text-[11px] font-bold [paint-order:stroke] stroke-white stroke-[4px] [stroke-linejoin:round]"
                  >
                    {edge.label}
                  </text>
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
                  className="fill-none stroke-slate-400 stroke-[1.5]"
                  markerEnd="url(#reachability-arrow)"
                />
                <text
                  x={labelPoint.x}
                  y={labelPoint.y}
                  textAnchor="middle"
                  className="fill-slate-700 text-[11px] font-bold [paint-order:stroke] stroke-white stroke-[4px] [stroke-linejoin:round]"
                >
                  {edge.label}
                </text>
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
                  className={`stroke-[3] ${
                    node.isInitial ? 'fill-blue-100 stroke-blue-600' : 'fill-white stroke-slate-700'
                  }`}
                />
                <text
                  className="fill-slate-900 text-[13px] font-bold"
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  {node.id}
                </text>
                <text
                  className="fill-slate-500 text-[10px] font-medium"
                  y="50"
                  textAnchor="middle"
                >
                  {node.label}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}

export default function ReachabilityView({ reachability, reducedNet, onAnalyze }) {
  return (
    <section className="col-span-full min-h-[calc(100vh-72px)] min-w-0 bg-slate-50">
      <div className="flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-[22px] py-4 max-[820px]:items-start">
        <div>
          <span className="block text-[11px] font-extrabold uppercase tracking-[0.08em] text-slate-500">
            Graphe des marquages
          </span>
          <h1 className="mt-0.5 mb-0 text-[18px]">États accessibles</h1>
        </div>
        <button
          className="m-0 flex h-[42px] w-auto flex-none items-center justify-center gap-2 rounded-lg border border-blue-600 bg-blue-600 px-[18px] text-[13px] font-extrabold text-white"
          onClick={onAnalyze}
        >
          <Activity size={17} /> Calculer
        </button>
      </div>

      {!reachability ? (
        <div className="flex min-h-[520px] flex-col items-center justify-center text-center text-slate-400">
          <Activity size={34} />
          <h2 className="mt-3 mb-1 text-[16px] text-slate-700">Aucune analyse disponible</h2>
          <p className="m-0 text-[13px]">
            Calculez le graphe pour afficher tous les marquages accessibles.
          </p>
        </div>
      ) : (
        <div className="p-5">
          <div className="mb-4 grid grid-cols-[repeat(auto-fit,minmax(135px,1fr))] gap-2.5">
            <div className="flex flex-col gap-1 rounded-[10px] border border-slate-200 bg-white px-3.5 py-3">
              <span className="text-[11px] font-extrabold uppercase text-slate-500">États</span>
              <strong className="text-[16px]">{reachability.stateCount}</strong>
            </div>
            <div className="flex flex-col gap-1 rounded-[10px] border border-slate-200 bg-white px-3.5 py-3">
              <span className="text-[11px] font-extrabold uppercase text-slate-500">Arcs</span>
              <strong className="text-[16px]">{reachability.edges.length}</strong>
            </div>
            <div className="flex flex-col gap-1 rounded-[10px] border border-slate-200 bg-white px-3.5 py-3">
              <span className="text-[11px] font-extrabold uppercase text-slate-500">Exploration</span>
              <strong className="text-[16px]">
                {reachability.isComplete
                  ? 'Complète'
                  : `Limite de ${reachability.stateLimit} états atteinte`}
              </strong>
            </div>
            {reducedNet && (
              <div className="flex flex-col gap-1 rounded-[10px] border border-slate-200 bg-white px-3.5 py-3">
                <span className="text-[11px] font-extrabold uppercase text-slate-500">
                  Après réduction
                </span>
                <strong className="text-[16px]">
                  {generateReachabilityGraph(reducedNet).stateCount} états
                </strong>
              </div>
            )}
          </div>
          <ReachabilityCanvas graph={reachability} />
        </div>
      )}
    </section>
  )
}