import { som } from './format'

// Text input that shows thousand-separated digits ("4 500 000") while the
// value it reports/receives stays a plain digit string ("4500000") — plain
// type="number" inputs can't show separators at all.
export default function AmountInput({ value, onChange, style, ...props }) {
  return (
    <input
      type="text" inputMode="numeric" autoComplete="off"
      value={value ? som(Number(value)) : ''}
      onChange={e => onChange(e.target.value.replace(/\D/g, ''))}
      style={style}
      {...props}
    />
  )
}
