import type { TodoItem } from './todo'

const LIST = ['M9 6h11', 'M9 12h11', 'M9 18h11', 'm3.5 6 1.5 1.5L7.5 5', 'm3.5 12 1.5 1.5L7.5 11', 'm3.5 18 1.5 1.5L7.5 17']

/** The '오늘 할 일' band between the header and the scene. Nothing to do: nothing is drawn. */
export function TodayCard({ items }: { items: TodoItem[] }) {
  if (items.length === 0) return null
  return (
    <div className="gs-todo" role="status" aria-label="오늘 할 일">
      <span className="gs-todo-head">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {LIST.map((d) => (
            <path key={d} d={d} />
          ))}
        </svg>
        오늘 할 일
      </span>
      <ul className="gs-todo-list">
        {items.map((it) => (
          <li key={it.key} className={`gs-todo-item gs-todo-item--${it.kind}${it.done ? ' gs-todo-item--done' : ''}`}>
            {it.text}
          </li>
        ))}
      </ul>
    </div>
  )
}
