export default function EditNodeDialog({ editingNode, setEditingNode, onSave }) {
  if (!editingNode) return null

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-900/40 p-5">
      <form
        className="w-full max-w-[380px] rounded-[14px] border border-slate-200 bg-white p-[22px] shadow-[0_20px_60px_rgba(15,23,42,0.2)]"
        onSubmit={onSave}
      >
        <h2 className="mt-0 mb-[18px] text-[18px]">
          {editingNode.kind === 'place' ? 'Modifier la place' : 'Modifier la transition'}
        </h2>
        <label className="mb-3.5 flex flex-col gap-[7px] text-[13px] font-bold text-slate-600">
          Nom
          <input
            autoFocus
            className="h-10 w-full rounded-[7px] border border-slate-300 px-2.5 text-slate-900"
            value={editingNode.label}
            onChange={(event) =>
              setEditingNode((current) => ({ ...current, label: event.target.value }))
            }
          />
        </label>
        {editingNode.kind === 'place' && (
          <label className="mb-3.5 flex flex-col gap-[7px] text-[13px] font-bold text-slate-600">
            Jetons initiaux
            <input
              type="number"
              min="0"
              step="1"
              className="h-10 w-full rounded-[7px] border border-slate-300 px-2.5 text-slate-900"
              value={editingNode.tokens}
              onChange={(event) =>
                setEditingNode((current) => ({ ...current, tokens: event.target.value }))
              }
            />
          </label>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            className="m-0 flex h-[42px] w-auto min-w-[100px] items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-[13px] font-extrabold text-slate-700"
            onClick={() => setEditingNode(null)}
          >
            Annuler
          </button>
          <button
            type="submit"
            className="m-0 flex h-[42px] w-auto min-w-[100px] items-center justify-center gap-2 rounded-lg border border-blue-600 bg-blue-600 px-3 text-[13px] font-extrabold text-white"
          >
            Enregistrer
          </button>
        </div>
      </form>
    </div>
  )
}