import { useEffect, useRef, useState } from 'react'
import './App.css'
import ActionPanel from './components/ActionPanel'
import EditNodeDialog from './components/EditNodeDialog'
import MatrixView from './components/MatrixView'
import Navbar from './components/Navbar'
import PetriCanvas from './components/PetriCanvas'
import ReachabilityView from './components/ReachabilityView'
import Toolbox from './components/Toolbox'
import UnsavedChangesDialog from './components/UnsavedChangesDialog'
import { PRESET_NETS } from './data/presets'
import { fromMatrices, toMatrices } from './engine/petriNetModel'
import { generateReachabilityGraph } from './engine/reachabilityGraph'
import { applyNextReduction, reduceAll } from './engine/reductionRules'
import { PROJECT_FORMAT, PROJECT_VERSION, parseProjectFile } from './utils/projectFile'

const cloneNet = (net) => JSON.parse(JSON.stringify(net))

function App() {
  const [net, setNet] = useState(() => cloneNet(PRESET_NETS[0].net))
  const [activeView, setActiveView] = useState('graph')
  const [tool, setTool] = useState('select')
  const [selected, setSelected] = useState(null)
  const [selectedArcControl, setSelectedArcControl] = useState(null)
  const [reachability, setReachability] = useState(null)
  const [reducedNet, setReducedNet] = useState(null)
  const [logs, setLogs] = useState([])
  const [editingNode, setEditingNode] = useState(null)
  const [interactionMessage, setInteractionMessage] = useState('')
  const [fileName, setFileName] = useState(null)
  const [fileError, setFileError] = useState('')
  const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify(PRESET_NETS[0].net))
  const [pendingDocument, setPendingDocument] = useState(null)

  const fileInputRef = useRef(null)
  const fileMenuRef = useRef(null)
  const hasUnsavedChanges = JSON.stringify(net) !== savedSnapshot

  const applyDocument = (document) => {
    const nextNet = cloneNet(document.net)
    setNet(nextNet)
    setFileName(document.fileName)
    setSavedSnapshot(JSON.stringify(nextNet))
    setSelected(null)
    setSelectedArcControl(null)
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

  const updateMatrix = (kind, row, column, value) => {
    const { pre, post, m0 } = toMatrices(net)
    if (kind === 'm0') m0[row] = Math.max(0, Number(value) || 0)
    if (kind === 'pre') pre[row][column] = Math.max(0, Number(value) || 0)
    if (kind === 'post') post[row][column] = Math.max(0, Number(value) || 0)
    setNet(fromMatrices(net.places, net.transitions, pre, post, m0))
  }

  const updateArcWeight = (arcId, weight) => {
    setNet((current) => ({
      ...current,
      arcs: current.arcs.map((arc) => (arc.id === arcId ? { ...arc, weight } : arc)),
    }))
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

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar
        activeView={activeView}
        onSelectView={setActiveView}
        onLoadPreset={loadPreset}
        fileMenuRef={fileMenuRef}
        fileInputRef={fileInputRef}
        fileName={fileName}
        hasUnsavedChanges={hasUnsavedChanges}
        fileError={fileError}
        onNewDocument={createNewDocument}
        onOpenJsonFile={openJsonFile}
        onSaveJsonFile={saveJsonFile}
        onResetNet={createNewDocument}
      />

      <main className="grid min-h-[calc(100vh-72px)] grid-cols-[150px_minmax(480px,1fr)_250px] max-[1100px]:grid-cols-[130px_minmax(400px,1fr)_220px] max-[820px]:grid-cols-1">
        {activeView === 'graph' && (
          <>
            <Toolbox
              tool={tool}
              onChooseTool={chooseTool}
              hasSelection={Boolean(selected)}
              onDeleteSelected={deleteSelected}
            />

            <PetriCanvas
              net={net}
              setNet={setNet}
              tool={tool}
              selected={selected}
              setSelected={setSelected}
              selectedArcControl={selectedArcControl}
              setSelectedArcControl={setSelectedArcControl}
              interactionMessage={interactionMessage}
              setInteractionMessage={setInteractionMessage}
              onEditNode={setEditingNode}
            />

            <ActionPanel
              onAnalyze={analyze}
              onRunStepReduction={runStepReduction}
              onRunFullReduction={runFullReduction}
              selectedArc={selectedArc}
              onUpdateArcWeight={updateArcWeight}
              logs={logs}
            />
          </>
        )}

        {activeView === 'matrix' && (
          <MatrixView net={net} matrices={matrices} onUpdateMatrix={updateMatrix} />
        )}

        {activeView === 'reachability' && (
          <ReachabilityView
            reachability={reachability}
            reducedNet={reducedNet}
            onAnalyze={analyze}
          />
        )}
      </main>

      <EditNodeDialog
        editingNode={editingNode}
        setEditingNode={setEditingNode}
        onSave={saveNodeEdits}
      />

      <UnsavedChangesDialog
        pendingDocument={pendingDocument}
        fileError={fileError}
        onCancel={() => setPendingDocument(null)}
        onContinueWithoutSaving={continueWithoutSaving}
        onSaveAndContinue={saveAndContinue}
      />
    </div>
  )
}

export default App