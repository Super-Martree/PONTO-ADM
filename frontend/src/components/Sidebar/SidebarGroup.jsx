import { useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import styles from './Sidebar.module.css';

export default function SidebarGroup({ icon, label, children, collapsed, defaultOpen = false, hasActive }) {
  const [open, setOpen] = useState(defaultOpen || hasActive);

  // auto-open if child is active
  useEffect(() => { if (hasActive) setOpen(true); }, [hasActive]);

  return (
    <li className={styles.group}>
      <button
        className={`${styles.groupHead} ${hasActive ? styles.groupHeadActive : ''}`}
        onClick={() => !collapsed && setOpen(v => !v)}
        title={collapsed ? label : undefined}
      >
        <span className={styles.itemIcon}>{icon}</span>
        {!collapsed && (
          <>
            <span className={styles.itemLabel}>{label}</span>
            <ChevronDown
              size={13}
              className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}
            />
          </>
        )}
      </button>

      {!collapsed && (
        <ul
          className={styles.submenu}
          style={{
            maxHeight: open ? '360px' : '0',
            overflow: 'hidden',
            transition: 'max-height 0.22s ease',
          }}
        >
          {children}
        </ul>
      )}
    </li>
  );
}
