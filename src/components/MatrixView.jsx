export default function MatrixView({ net, matrices, onUpdateMatrix }) {
  const incidenceMatrices = [
    { title: 'Pre', kind: 'pre', values: matrices.pre },
    { title: 'Post', kind: 'post', values: matrices.post },
  ]

  return (
    <section className="col-span-full min-w-0 bg-slate-50">
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-[22px] py-4">
        <div>
          <span className="block text-[11px] font-extrabold uppercase tracking-[0.08em] text-slate-500">
            Synchronisation directe
          </span>
          <h1 className="mt-0.5 mb-0 text-[18px]">Matrices d’incidence</h1>
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_220px] gap-4 p-5 max-[1100px]:grid-cols-[1fr_220px] max-[820px]:grid-cols-1">
        {incidenceMatrices.map((matrix, idx) => (
          <div
            className={`min-w-0 overflow-x-auto rounded-xl border border-slate-200 bg-white p-4 shadow-[0_4px_16px_rgba(15,23,42,0.04)] ${
              idx === 1 ? 'max-[1100px]:col-start-1' : ''
            }`}
            key={matrix.kind}
          >
            <h2 className="mt-0 mb-3.5 text-[15px]">{matrix.title}</h2>
            {net.places.length === 0 || net.transitions.length === 0 ? (
              <p className="text-[13px] text-slate-400">Ajoutez des places et des transitions.</p>
            ) : (
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="border border-slate-200 bg-slate-50 p-[5px] text-center text-[12px]" />
                    {net.transitions.map((transition) => (
                      <th
                        className="border border-slate-200 bg-slate-50 p-[5px] text-center text-[12px]"
                        key={transition.id}
                      >
                        {transition.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {net.places.map((place, row) => (
                    <tr key={place.id}>
                      <th className="border border-slate-200 bg-slate-50 p-[5px] text-center text-[12px]">
                        {place.label}
                      </th>
                      {net.transitions.map((transition, column) => (
                        <td
                          className="border border-slate-200 p-[5px] text-center text-[12px]"
                          key={transition.id}
                        >
                          <input
                            type="number"
                            min="0"
                            className="h-[34px] w-[58px] rounded-md border border-slate-300 text-center"
                            value={matrix.values[row][column]}
                            onChange={(event) =>
                              onUpdateMatrix(matrix.kind, row, column, event.target.value)
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

        <div className="min-w-0 overflow-x-auto rounded-xl border border-slate-200 bg-white p-4 shadow-[0_4px_16px_rgba(15,23,42,0.04)] max-[1100px]:col-start-2 max-[1100px]:row-span-2 max-[1100px]:row-start-1 max-[820px]:col-start-1 max-[820px]:row-span-1 max-[820px]:row-start-auto">
          <h2 className="mt-0 mb-3.5 text-[15px]">M0 — Marquage initial</h2>
          {net.places.length === 0 ? (
            <p className="text-[13px] text-slate-400">Aucune place.</p>
          ) : (
            net.places.map((place, index) => (
              <label
                className="mb-2 flex items-center justify-between gap-3 text-[13px] font-bold"
                key={place.id}
              >
                <span>{place.label}</span>
                <input
                  type="number"
                  min="0"
                  className="h-[34px] w-[58px] rounded-md border border-slate-300 text-center"
                  value={matrices.m0[index]}
                  onChange={(event) => onUpdateMatrix('m0', index, 0, event.target.value)}
                />
              </label>
            ))
          )}
        </div>
      </div>
    </section>
  )
}