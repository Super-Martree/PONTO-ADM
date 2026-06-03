import Sidebar from '../Sidebar/Sidebar';
import styles from './Layout.module.css';

export default function Layout({ children, activePage, onNavigate, onLogout, user }) {
  return (
    <div className={styles.root}>
      <Sidebar activePage={activePage} onNavigate={onNavigate} onLogout={onLogout} user={user} />
      <div className={styles.main}>
        <main className={styles.content}>
          {children}
        </main>
      </div>
    </div>
  );
}
