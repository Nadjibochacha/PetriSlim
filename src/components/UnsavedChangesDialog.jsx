export default function UnsavedChangesDialog({
  pendingDocument,
  fileError,
  onCancel,
  onContinueWithoutSaving,
  onSaveAndContinue,
}) {
  if (!pendingDocument) return null

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-900/40 p-5">
      <section
        className="w-full max-w-[380px] rounded-[14px] border border-slate-200 bg-white p-[22px] shadow-[0_20px_60px_rgba(15,23,42,0.2)]"
        role="alertdialog"
        aria-modal="true"
      >
        <h2 className="mt-0 mb-[18px] text-[18px]">Modifications non enregistrées</h2>
        <p className="m-0 text-[13px] leading-[1.5] text-slate-500">
          Enregistrez le réseau actuel avant de continuer ?
        </p>
        {fileError && (
          <p className="mx-1.5 my-[5px] whitespace-normal text-[12px] leading-[1.4] text-red-700" role="alert">
            {fileError}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            className="m-0 flex h-[42px] w-auto min-w-0 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-2.5 text-[13px] font-extrabold text-slate-700"
            onClick={onCancel}
          >
            Annuler
          </button>
          <button
            type="button"
            className="m-0 flex h-[42px] w-auto min-w-0 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-2.5 text-[13px] font-extrabold text-slate-700"
            onClick={onContinueWithoutSaving}
          >
            Abandonner
          </button>
          <button
            type="button"
            className="m-0 flex h-[42px] w-auto min-w-0 items-center justify-center gap-2 rounded-lg border border-blue-600 bg-blue-600 px-2.5 text-[13px] font-extrabold text-white"
            onClick={onSaveAndContinue}
          >
            Enregistrer
          </button>
        </div>
      </section>
    </div>
  )
}