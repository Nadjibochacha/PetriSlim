import { Activity, WandSparkles } from 'lucide-react'

export default function ActionPanel({
  onAnalyze,
  onRunStepReduction,
  onRunFullReduction,
  selectedArc,
  onUpdateArcWeight,
  logs,
}) {
  return (
    <aside className="min-w-0 border-l border-slate-200 bg-white p-5 max-[820px]:border-t max-[820px]:border-l-0">
      <div className="-mx-5 -mt-5 mb-4 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
        <div>
          <span className="block text-[11px] font-extrabold uppercase tracking-[0.08em] text-slate-500">
            Analyse
          </span>
          <h2 className="mt-0.5 mb-0 text-[18px]">Réductions</h2>
        </div>
      </div>

      <button
        className="mb-2 flex h-[42px] w-full items-center justify-center gap-2 rounded-lg border border-blue-600 bg-blue-600 text-[13px] font-extrabold text-white"
        onClick={onAnalyze}
      >
        <Activity size={17} /> Générer les états
      </button>
      <button
        className="mb-2 flex h-[42px] w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white text-[13px] font-extrabold text-slate-700"
        onClick={onRunStepReduction}
      >
        <WandSparkles size={17} /> Réduire une étape
      </button>
      <button
        className="mb-2 flex h-[42px] w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white text-[13px] font-extrabold text-slate-700"
        onClick={onRunFullReduction}
      >
        <WandSparkles size={17} /> Réduire tout
      </button>

      {selectedArc && (
        <div className="my-3.5 rounded-[9px] border border-blue-200 bg-blue-50 p-3">
          <h3 className="mt-0 mb-2.5 text-[13px]">Arc sélectionné</h3>
          <label className="flex items-center justify-between gap-3 text-[12px] font-bold text-slate-600">
            Poids
            <input
              type="number"
              min="1"
              step="1"
              className="h-[34px] w-[76px] rounded-md border border-slate-300 bg-white text-center"
              value={selectedArc.weight}
              onChange={(event) => {
                const weight = Math.max(1, Math.floor(Number(event.target.value) || 1))
                onUpdateArcWeight(selectedArc.id, weight)
              }}
            />
          </label>
          <p className="mt-2 mb-0 text-[11px] leading-[1.4] text-slate-500">
            Glissez le point bleu pour courber l’arc.
          </p>
        </div>
      )}

      <div className="mt-5 max-h-[380px] overflow-y-auto">
        <h3 className="mt-0 mb-2 text-[13px]">Journal</h3>
        {logs.length === 0 ? (
          <p className="text-[12px] leading-[1.5] text-slate-500">Aucune réduction appliquée.</p>
        ) : (
          logs.map((log, index) => (
            <div
              className="mb-[7px] border-l-[3px] border-blue-300 bg-slate-50 p-[9px] text-[12px] leading-[1.5] text-slate-500"
              key={`${log}-${index}`}
            >
              {log}
            </div>
          ))
        )}
      </div>
    </aside>
  )
}