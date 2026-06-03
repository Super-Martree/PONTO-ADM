import styles from './Sidebar.module.css';

export default function SidebarItem({ icon, label, active, onClick, collapsed }) {
  return (
    <li
      className={`${styles.item} ${active ? styles.itemActive : ''}`}
      onClick={onClick}
      title={collapsed ? label : undefined}
    >
      <span className={styles.itemIcon}>{icon}</span>
      {!collapsed && <span className={styles.itemLabel}>{label}</span>}
    </li>
  );
}
