import { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Clock,
  Users,
  CalendarDays,
  Store,
  Layers,
  FileText,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
  ClipboardList,
  BarChart2,
  Settings,
} from 'lucide-react';
import SidebarItem from './SidebarItem';
import SidebarGroup from './SidebarGroup';
import styles from './Sidebar.module.css';

const MENU = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={15} />, section: null },
  {
    id: 'ponto',
    label: 'Ponto',
    icon: <Clock size={15} />,
    section: 'Operacional',
    children: [
      { id: 'apuracao', label: 'Registros', icon: <CalendarDays size={13} /> },
      { id: 'resumo-funcionarios', label: 'Resumo Func.', icon: <BarChart2 size={13} /> },
      { id: 'ponto-do-mes', label: 'Escala Mês', icon: <CalendarDays size={13} /> },
    ],
  },
  {
    id: 'escalas',
    label: 'Escalas',
    icon: <CalendarDays size={15} />,
    section: null,
    children: [
      { id: 'escalas-modelos', label: 'Modelos de Escala', icon: <CalendarDays size={13} /> },
      { id: 'escalas-funcionarios', label: 'Escala Func.', icon: <Users size={13} /> },
    ],
  },
  {
    id: 'cadastros',
    label: 'Cadastros',
    icon: <Layers size={15} />,
    section: 'Gestao',
    children: [
      { id: 'funcionarios', label: 'Funcionarios', icon: <Users size={13} /> },
      { id: 'lojas', label: 'Lojas', icon: <Store size={13} /> },
      { id: 'feriados', label: 'Feriados', icon: <CalendarDays size={13} /> },
    ],
  },
  {
    id: 'tratativas',
    label: 'Tratativas',
    icon: <ClipboardList size={15} />,
    section: 'Gestao',
    children: [
      { id: 'tratativas-ajustar-ponto', label: 'Ajustar Ponto', icon: <CalendarDays size={13} /> },
      { id: 'banco-horas', label: 'Banco de Horas', icon: <Clock size={13} /> },
      { id: 'tratativas-pendentes', label: 'Pendentes', icon: <ClipboardList size={13} /> },
      { id: 'tratativas-historico', label: 'Historico', icon: <FileText size={13} /> },
    ],
  },
  { id: 'configuracoes', label: 'Configuracoes', icon: <Settings size={15} />, section: null },
  { id: 'relatorios', label: 'Relatorios', icon: <FileText size={15} />, section: null },
];

export default function Sidebar({ activePage, onNavigate, onLogout, user }) {
  const [collapsed, setCollapsed] = useState(false);
  const [openGroup, setOpenGroup] = useState(null);
  const isChildActive = (group) => group.children?.some((child) => child.id === activePage);
  const firstName = String(user?.name || user?.matricula || 'Admin').trim().split(/\s+/)[0];

  useEffect(() => {
    const activeGroup = MENU.find((item) => item.children?.some((child) => child.id === activePage));
    setOpenGroup(activeGroup?.id || null);
  }, [activePage]);

  function renderChild(child) {
    return (
      <li
        key={child.id}
        className={`${styles.subItem} ${activePage === child.id ? styles.subItemActive : ''}`}
        onClick={() => onNavigate(child.id)}
      >
        <span className={styles.itemIcon}>{child.icon}</span>
        <span className={styles.itemLabel}>{child.label}</span>
      </li>
    );
  }

  return (
    <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''}`}>
      <div className={styles.brand}>
        <img src="/martri-mascote.png" alt="Martree" className={styles.brandLogo} />
        {!collapsed && (
          <div className={styles.brandText}>
            <span className={styles.brandName}>Martree</span>
            <span className={styles.brandSub}>{firstName}</span>
          </div>
        )}
        <button
          className={styles.toggleBtn}
          onClick={() => setCollapsed((value) => !value)}
          title={collapsed ? 'Expandir menu' : 'Recolher menu'}
          type="button"
        >
          {collapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
        </button>
        <button className={styles.mobileLogoutBtn} title="Sair" onClick={onLogout} type="button">
          <LogOut size={15} />
        </button>
      </div>

      <nav className={styles.nav}>
        <ul>
          {MENU.map((item, index) => {
            const prevSection = index > 0 ? MENU[index - 1].section : null;
            const showSection = item.section && item.section !== prevSection;

            if (item.children) {
              const childActive = isChildActive(item);
              return (
                <div key={item.id}>
                  {showSection && !collapsed && (
                    <div className={styles.sectionLabel}>{item.section}</div>
                  )}
                  <SidebarGroup
                    icon={item.icon}
                    label={item.label}
                    collapsed={collapsed}
                    hasActive={childActive}
                    open={openGroup === item.id}
                    onToggle={() => setOpenGroup((current) => (current === item.id ? null : item.id))}
                  >
                    {item.children.map(renderChild)}
                  </SidebarGroup>
                </div>
              );
            }

            return (
              <div key={item.id}>
                {showSection && !collapsed && (
                  <div className={styles.sectionLabel}>{item.section}</div>
                )}
                <SidebarItem
                  icon={item.icon}
                  label={item.label}
                  active={activePage === item.id}
                  onClick={() => onNavigate(item.id)}
                  collapsed={collapsed}
                />
              </div>
            );
          })}
        </ul>
      </nav>

      <div className={styles.footer}>
        <div className={styles.footerAvatar}>
          {user?.name?.[0]?.toUpperCase() || 'A'}
        </div>
        {!collapsed && (
          <div className={styles.footerInfo}>
            <div className={styles.footerName}>{user?.name || 'Administrador'}</div>
            <div className={styles.footerRole}>{user?.role || 'Admin'}</div>
          </div>
        )}
        <button className={styles.logoutBtn} title="Sair" onClick={onLogout} type="button">
          <LogOut size={14} />
        </button>
      </div>
    </aside>
  );
}
