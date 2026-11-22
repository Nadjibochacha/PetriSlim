import {
  Activity,
  Braces,
  CircleDot,
  FolderOpen,
  GitBranch,
  RotateCcw,
} from 'lucide-react'
import { PRESET_NETS } from '../data/presets'

export default function Navbar({
  activeView,
  onSelectView,
  onLoadPreset,
  fileMenuRef,
  fileInputRef,
  fileName,
  hasUnsavedChanges,
  fileError,
  onNewDocument,
  onOpenJsonFile,
  onSaveJsonFile,
  onResetNet,
}) {
  const navItems = [
    { id: 'graph', label: 'Graph', Icon: CircleDot },
    { id: 'matrix', label: 'Matrix', Icon: Braces },
    { id: 'reachability', label: 'Reachability', Icon: Activity },
  ]

  return (
    <header className="grid h-[72px] grid-cols-[260px_minmax(280px,1fr)_260px] items-center gap-5 border-b border-slate-200 bg-white px-6 max-[1100px]:grid-cols-[220px_1fr_220px] max-[820px]:h-auto max-[820px]:grid-cols-[1fr_auto] max-[820px]:px-3 max-[820px]:py-2.5">
      <div className="flex items-center gap-2.5">
        <div className="flex h-[38px] w-[38px] items-center justify-center rounded-[10px] bg-blue-600 text-white">
          <GitBranch size={20} />
        </div>
        <div>
          <strong className="block text-[16px]">PetriSlim</strong>
          <span className="mt-[1px] block text-[12px] text-slate-500">Petri Net Analyzer</span>
        </div>
      </div>

      <nav
        className="flex items-center justify-self-center gap-1 rounded-[10px] bg-slate-100 p-1 max-[820px]:col-span-full max-[820px]:row-start-2"
        aria-label="Main views"
      >
        {navItems.map(({ id, label, Icon }) => {
          const isActive = activeView === id
          return (
            <button
              key={id}
              className={`flex h-[38px] items-center gap-[7px] rounded-lg border-0 px-3.5 text-[13px] font-bold ${
                isActive
                  ? 'bg-white text-blue-700 shadow-[0_1px_3px_rgba(15,23,42,0.12)]'
                  : 'bg-transparent text-slate-500'
              }`}
              onClick={() => onSelectView(id)}
            >
              <Icon size={16} /> {label}
            </button>
          )
        })}
      </nav>

      <div className="flex items-center justify-end gap-2">
        <select
          aria-label="Preset"
          defaultValue=""
          className="h-[38px] min-w-0 max-w-[150px] rounded-lg border border-slate-300 bg-white pl-2.5 pr-[34px] text-[13px] text-slate-700"
          onChange={(event) => onLoadPreset(event.target.value)}
        >
          <option value="" disabled>Preset...</option>
          {PRESET_NETS.map((preset) => (
            <option key={preset.id} value={preset.id}>{preset.name}</option>
          ))}
        </select>

        <details className="group relative" ref={fileMenuRef}>
          <summary
            title="Fichier"
            aria-label="Menu fichier"
            className="flex h-[38px] w-[38px] cursor-pointer list-none items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 [&::-webkit-details-marker]:hidden group-open:border-blue-200 group-open:bg-blue-50 group-open:text-blue-700"
          >
            <FolderOpen size={17} />
          </summary>
          <div className="absolute right-0 top-[calc(100%+8px)] z-[80] flex w-[220px] flex-col gap-[5px] rounded-[10px] border border-slate-200 bg-white p-2 shadow-[0_12px_30px_rgba(15,23,42,0.16)]">
            <p className="mx-1.5 mt-[3px] mb-1.5 truncate text-[11px] text-slate-500">
              {fileName || 'Preset / sans fichier'}{hasUnsavedChanges ? ' · Modifié' : ''}
            </p>
            <button
              type="button"
              className="min-h-[36px] rounded-md border-0 bg-transparent px-[9px] text-left text-[13px] text-slate-700 hover:bg-blue-50 hover:text-blue-700"
              onClick={onNewDocument}
            >
              New
            </button>
            <button
              type="button"
              className="min-h-[36px] rounded-md border-0 bg-transparent px-[9px] text-left text-[13px] text-slate-700 hover:bg-blue-50 hover:text-blue-700"
              onClick={() => fileInputRef.current?.click()}
            >
              Open JSON…
            </button>
            <button
              type="button"
              className="min-h-[36px] rounded-md border-0 bg-transparent px-[9px] text-left text-[13px] text-slate-700 hover:bg-blue-50 hover:text-blue-700"
              onClick={onSaveJsonFile}
            >
              Save JSON
            </button>
            {fileError && (
              <p className="mx-1.5 my-[5px] whitespace-normal text-[12px] leading-[1.4] text-red-700" role="alert">
                {fileError}
              </p>
            )}
          </div>
        </details>

        <button
          className="flex h-[38px] w-[38px] items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700"
          title="Réinitialiser"
          onClick={onResetNet}
        >
          <RotateCcw size={17} />
        </button>
      </div>

      <input
        ref={fileInputRef}
        className="hidden"
        type="file"
        accept=".json,application/json"
        onChange={onOpenJsonFile}
        aria-label="Ouvrir un fichier PetriSlim JSON"
      />
    </header>
  )
}