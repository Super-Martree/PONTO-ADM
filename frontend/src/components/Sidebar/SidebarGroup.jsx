import { ChevronDown } from 'lucide-react';
import styles from './Sidebar.module.css';

export default function SidebarGroup({ icon, label, children, collapsed, hasActive, open, onToggle }) {
  return (
    <li className={styles.group}>
      <button
        className={`${styles.groupHead} ${hasActive ? styles.groupHeadActive : ''}`}
        onClick={() => !collapsed && onToggle()}
        title={collapsed ? label : undefined}
        type="button"
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
