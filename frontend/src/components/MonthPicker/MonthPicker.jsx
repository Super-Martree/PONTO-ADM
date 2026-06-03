import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import styles from './MonthPicker.module.css';

const MONTHS = [
  ['01', 'Jan'],
  ['02', 'Fev'],
  ['03', 'Mar'],
  ['04', 'Abr'],
  ['05', 'Mai'],
  ['06', 'Jun'],
  ['07', 'Jul'],
  ['08', 'Ago'],
  ['09', 'Set'],
  ['10', 'Out'],
  ['11', 'Nov'],
  ['12', 'Dez'],
];

function parseValue(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})$/);
  const today = new Date();
  if (!match) {
    return {
      year: today.getFullYear(),
      month: String(today.getMonth() + 1).padStart(2, '0'),
    };
  }

  return {
    year: Number(match[1]),
    month: match[2],
  };
}

export default function MonthPicker({ value, onChange, disabled = false }) {
  const rootRef = useRef(null);
  const parsed = useMemo(() => parseValue(value), [value]);
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(parsed.year);
  const selectedLabel = `${MONTHS.find(([month]) => month === parsed.month)?.[1] || parsed.month}/${parsed.year}`;

  useEffect(() => {
    if (!open) {
      setViewYear(parsed.year);
    }
  }, [open, parsed.year]);

  useEffect(() => {
    if (!open) return undefined;

    function handlePointerDown(event) {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  function selectMonth(month) {
    onChange(`${viewYear}-${month}`);
    setOpen(false);
  }

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        className={styles.trigger}
        type="button"
        onClick={() => setOpen((current) => !current)}
        disabled={disabled}
        aria-expanded={open}
      >
        <CalendarDays size={14} />
        <span>{selectedLabel}</span>
      </button>

      {open && (
        <div className={styles.panel}>
          <div className={styles.header}>
            <button type="button" onClick={() => setViewYear((year) => year - 1)} title="Ano anterior">
              <ChevronLeft size={14} />
            </button>
            <strong>{viewYear}</strong>
            <button type="button" onClick={() => setViewYear((year) => year + 1)} title="Proximo ano">
              <ChevronRight size={14} />
            </button>
          </div>

          <div className={styles.monthGrid}>
            {MONTHS.map(([month, label]) => {
              const active = viewYear === parsed.year && month === parsed.month;
              return (
                <button
                  className={active ? styles.activeMonth : styles.monthButton}
                  key={month}
                  type="button"
                  onClick={() => selectMonth(month)}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
