import { ArrowLeftRight, GitBranch, Trash2 } from 'lucide-react'

export default function Toolbox({ tool, onChooseTool, hasSelection, onDeleteSelected }) {
  const baseButtonClass =
    'flex h-[42px] w-full items-center gap-[9px] rounded-lg border px-3 text-left text-[13px] font-bold max-[820px]:w-auto max-[820px]:min-w-[110px]'

  const getToolClass = (name) =>
    `${baseButtonClass} ${
      tool === name
        ? 'border-blue-200 bg-blue-50 text-blue-700'
        : 'border-transparent bg-transparent text-slate-600'
    }`

  return (
    <aside className="flex flex-col gap-[7px] border-r border-slate-200 bg-white px-3 py-4 max-[820px]:flex-row max-[820px]:overflow-x-auto max-[820px]:border-r-0 max-[820px]:border-b">
      <button className={getToolClass('select')} onClick={() => onChooseTool('select')}>
        <ArrowLeftRight size={17} /> Select
      </button>
      <button className={getToolClass('place')} onClick={() => onChooseTool('place')}>
        <span className="inline-block h-5 w-5 shrink-0 rounded-full border-2 border-current" /> Place
      </button>
      <button className={getToolClass('transition')} onClick={() => onChooseTool('transition')}>
        <span className="inline-block h-[22px] w-2 shrink-0 bg-current" /> Transition
      </button>
      <button className={getToolClass('arc')} onClick={() => onChooseTool('arc')}>
        <GitBranch size={17} /> Arc
      </button>
      <button
        className={`${baseButtonClass} mt-auto border-transparent bg-transparent text-red-600 disabled:cursor-not-allowed disabled:opacity-35 max-[820px]:mt-0`}
        disabled={!hasSelection}
        onClick={onDeleteSelected}
      >
        <Trash2 size={17} /> Delete
      </button>
    </aside>
  )
}