export default function Severity({ value }) {
  if (!value) return null
  return (
    <span>
      <span className={`severity-dot sev-${value}`} />
      {value}
    </span>
  )
}
