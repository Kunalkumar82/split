import { LogOut, ReceiptIndianRupee } from 'lucide-react';

export default function Navbar({ user, onLogout }) {
  // Helper to get initials from name
  const getInitials = (name) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map(n => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  return (
    <header className="navbar">
      <div className="brand">
        <ReceiptIndianRupee size={24} className="text-primary" style={{ color: 'var(--primary)' }} />
        Hisab<span>Kitab</span>
      </div>
      
      {user && (
        <div className="nav-actions">
          <div className="user-badge">
            <div className="avatar">
              {getInitials(user.name)}
            </div>
            <span style={{ fontSize: '14px', fontWeight: '500' }}>{user.name}</span>
          </div>


          <button 
            onClick={onLogout} 
            className="btn btn-secondary" 
            style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
            title="Log Out"
          >
            <LogOut size={16} />
            <span className="hide-mobile" style={{ fontSize: '13px' }}>Logout</span>
          </button>
        </div>
      )}
    </header>
  );
}
