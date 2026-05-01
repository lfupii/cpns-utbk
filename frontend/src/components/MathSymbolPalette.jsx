import React from 'react';

const SYMBOL_GROUPS = [
  {
    title: 'Pecahan',
    items: [
      { label: '()/()', value: '()/()', cursorOffset: -4 },
      { label: '½', value: '½' },
      { label: '⅓', value: '⅓' },
      { label: '⅔', value: '⅔' },
      { label: '¼', value: '¼' },
      { label: '¾', value: '¾' },
    ],
  },
  {
    title: 'Pangkat & akar',
    items: [
      { label: '²', value: '²' },
      { label: '³', value: '³' },
      { label: '⁴', value: '⁴' },
      { label: '⁵', value: '⁵' },
      { label: 'ⁿ', value: 'ⁿ' },
      { label: '√()', value: '√()', cursorOffset: -1 },
    ],
  },
  {
    title: 'Operator',
    items: [
      { label: '×', value: '×' },
      { label: '÷', value: '÷' },
      { label: '±', value: '±' },
      { label: '≤', value: '≤' },
      { label: '≥', value: '≥' },
      { label: '≠', value: '≠' },
      { label: '≈', value: '≈' },
      { label: 'π', value: 'π' },
      { label: '∞', value: '∞' },
    ],
  },
];

export default function MathSymbolPalette({ activeFieldLabel, onInsert }) {
  return (
    <section className="admin-math-symbol-palette" aria-label="Keyboard simbol matematika untuk TIU">
      <div className="admin-math-symbol-palette-head">
        <div>
          <span className="admin-preview-eyebrow">Khusus TIU</span>
          <h3>Keyboard Simbol Matematika</h3>
        </div>
        <p className="admin-math-symbol-palette-status text-muted">
          {activeFieldLabel
            ? `Simbol akan disisipkan ke ${activeFieldLabel.toLowerCase()}.`
            : 'Klik dulu kolom pertanyaan, pembahasan, atau opsi jawaban, lalu pilih simbol.'}
        </p>
      </div>

      <div className="admin-math-symbol-group-list">
        {SYMBOL_GROUPS.map((group) => (
          <div key={group.title} className="admin-math-symbol-group">
            <span>{group.title}</span>
            <div className="admin-math-symbol-buttons">
              {group.items.map((item) => (
                <button
                  key={`${group.title}-${item.label}`}
                  type="button"
                  className="admin-math-symbol-button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => onInsert(item)}
                  aria-label={`Sisipkan simbol ${item.label}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <p className="admin-math-symbol-palette-footer text-muted">
        Gunakan `()/()` untuk pecahan bebas, lalu isi pembilang dan penyebut di dalam tanda kurung.
      </p>
    </section>
  );
}
