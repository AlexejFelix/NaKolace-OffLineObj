function nadpisDna(datum: Date): string {
  const den = new Intl.DateTimeFormat('sk-SK', { weekday: 'long' }).format(datum)
  const zvysok = new Intl.DateTimeFormat('sk-SK', { day: 'numeric', month: 'long' }).format(datum)
  return `${den.charAt(0).toUpperCase()}${den.slice(1)}, ${zvysok}`
}

export default function Objednavky() {
  const dnes = new Date()

  return (
    <section>
      <p
        style={{
          margin: 0,
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
        }}
      >
        Objednávky
      </p>
      <h1 style={{ fontSize: 34, marginTop: 4 }}>{nadpisDna(dnes)}</h1>
      <div
        style={{
          marginTop: 28,
          padding: '48px 24px',
          border: '1px dashed var(--input-border)',
          borderRadius: 14,
          background: 'var(--surface)',
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: 16,
        }}
      >
        Na tento deň zatiaľ nie sú žiadne objednávky.
      </div>
    </section>
  )
}
