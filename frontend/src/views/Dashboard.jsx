import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Users, 
  AlertCircle, 
  TrendingUp, 
  PieChart, 
  Calendar,
  Utensils, 
  Plane, 
  ShoppingBag, 
  Home, 
  Film, 
  Zap, 
  FolderDot,
  DollarSign,
  ArrowUpRight,
  ArrowDownLeft,
  Coins
} from 'lucide-react';
import { formatAmount } from '../utils/format';
import { API_URL } from '../config';

export default function Dashboard({ user, onSelectGroup }) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  // Create Group Form state
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [groupCurrency, setGroupCurrency] = useState('INR');
  const [createLoading, setCreateLoading] = useState(false);

  // Analytics state
  const [activeTab, setActiveTab] = useState('groups'); // groups, analytics
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const fetchGroups = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/groups`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch groups.');
      }

      const data = await response.json();
      setGroups(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    setAnalyticsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/analytics`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch analytics.');
      }

      const data = await response.json();
      setAnalytics(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  useEffect(() => {
    if (activeTab === 'analytics') {
      fetchAnalytics();
    }
  }, [activeTab]);

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!groupName) return;

    setCreateLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/groups`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: groupName,
          description: groupDesc,
          currency: groupCurrency
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create group.');
      }

      // Close modal & reset fields
      setShowCreateModal(false);
      setGroupName('');
      setGroupDesc('');
      setGroupCurrency('INR');
      
      // Refresh groups list
      fetchGroups();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreateLoading(false);
    }
  };

  // Balance aggregates for groups view
  let totalOwed = 0; // Positives sum
  let totalOwes = 0; // Negatives sum (abs)
  
  groups.forEach(g => {
    if (g.userBalance > 0) {
      totalOwed += g.userBalance;
    } else if (g.userBalance < 0) {
      totalOwes += Math.abs(g.userBalance);
    }
  });

  const netBalance = totalOwed - totalOwes;

  // Category Icon Mapping
  const getCategoryIcon = (category) => {
    switch (category) {
      case 'Food': return <Utensils size={16} />;
      case 'Travel': return <Plane size={16} />;
      case 'Shopping': return <ShoppingBag size={16} />;
      case 'Rent': return <Home size={16} />;
      case 'Entertainment': return <Film size={16} />;
      case 'Utilities': return <Zap size={16} />;
      default: return <FolderDot size={16} />;
    }
  };

  // Category Color Class Mapping
  const getCategoryColorClass = (category) => {
    switch (category) {
      case 'Food': return 'cat-color-food';
      case 'Travel': return 'cat-color-travel';
      case 'Shopping': return 'cat-color-shopping';
      case 'Rent': return 'cat-color-rent';
      case 'Entertainment': return 'cat-color-entertainment';
      case 'Utilities': return 'cat-color-utilities';
      default: return 'cat-color-others';
    }
  };

  return (
    <div className="dashboard-container">
      {/* Tab Navigation */}
      <div className="sub-nav-tabs">
        <button 
          className={`sub-nav-tab ${activeTab === 'groups' ? 'active' : ''}`}
          onClick={() => setActiveTab('groups')}
        >
          My Groups
        </button>
        <button 
          className={`sub-nav-tab ${activeTab === 'analytics' ? 'active' : ''}`}
          onClick={() => setActiveTab('analytics')}
        >
          Insights & Analytics
        </button>
      </div>

      {error && (
        <div className="alert-banner danger" style={{ marginBottom: '16px' }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* 1. GROUPS TAB CONTENT */}
      {activeTab === 'groups' && (
        <>
          {/* Balances Overview Card */}
          <section className="overview-card glass-panel" style={{ marginBottom: '24px' }}>
            <div className="overview-header">
              <h1>My Balance Summary</h1>
            </div>
            <div className="summary-stats">
              <div className="stat-box">
                <h4>Total Balance</h4>
                <p style={{ color: netBalance > 0 ? 'var(--success)' : netBalance < 0 ? 'var(--danger)' : 'var(--text-primary)' }}>
                  {netBalance > 0 ? '+' : ''}{formatAmount(netBalance, 'INR')}
                </p>
              </div>
              <div className="stat-box owed">
                <h4>You get back</h4>
                <p>{formatAmount(totalOwed, 'INR')}</p>
              </div>
              <div className="stat-box owes">
                <h4>You pay</h4>
                <p>{formatAmount(totalOwes, 'INR')}</p>
              </div>
            </div>
          </section>

          {/* My Groups Section */}
          <section className="groups-section">
            <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)' }}>My Groups</h2>
              <button 
                onClick={() => setShowCreateModal(true)} 
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Plus size={16} /> New Group
              </button>
            </div>

            <div className="group-cards-stack">
              {loading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading groups...</div>
              ) : groups.length === 0 ? (
                <div className="glass-panel empty-state" style={{ padding: '60px 20px', textAlign: 'center' }}>
                  <Users size={40} style={{ marginBottom: '12px', color: 'var(--text-muted)' }} />
                  <h3>No groups yet</h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                    Create a group above and start splitting bills with friends!
                  </p>
                </div>
              ) : (
                groups.map(group => (
                  <div 
                    key={group.id} 
                    className="group-card-item glass-panel" 
                    onClick={() => onSelectGroup(group.id)}
                    style={{ cursor: 'pointer', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}
                  >
                    <div style={{ flex: 1, paddingRight: '16px' }}>
                      <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '4px', color: 'var(--text-primary)' }}>{group.name}</h3>
                      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                        {group.description || 'No description.'}
                      </p>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', background: 'var(--bg-surface-hover)', padding: '4px 8px', borderRadius: '4px' }}>
                        {group.members.length} members
                      </span>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', minWidth: '140px' }}>
                      {group.userBalance > 0 ? (
                        <div className="balance-tag owed">
                          <span className="label">You get back</span>
                          <span className="value">{formatAmount(group.userBalance, group.currency)}</span>
                        </div>
                      ) : group.userBalance < 0 ? (
                        <div className="balance-tag owes">
                          <span className="label">You pay</span>
                          <span className="value">{formatAmount(Math.abs(group.userBalance), group.currency)}</span>
                        </div>
                      ) : (
                        <span className="balance-settled-tag">Settled</span>
                      )}
                      <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px', marginTop: '4px' }}>
                        Open Group
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </>
      )}

      {/* 2. ANALYTICS TAB CONTENT */}
      {activeTab === 'analytics' && (
        <div className="analytics-container">
          {analyticsLoading ? (
            <div style={{ textAlign: 'center', padding: '100px 0', color: 'var(--text-muted)' }}>
              <div style={{ width: '40px', height: '40px', border: '3px solid rgba(0,0,0,0.05)', borderTop: '3px solid var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
              <p>Analyzing transactions and compiling metrics...</p>
            </div>
          ) : !analytics ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No analytics data available yet.</div>
          ) : (
            <>
              {/* Aggregates Grid */}
              <div className="analytics-grid">
                <div className="analytics-card glass-panel">
                  <h4>Total Groups</h4>
                  <div className="amount" style={{ color: 'var(--text-primary)' }}>{analytics.totalGroups}</div>
                </div>
                <div className="analytics-card glass-panel">
                  <h4>My Spending Share</h4>
                  <div className="amount" style={{ color: 'var(--text-primary)' }}>{formatAmount(analytics.totalMyShare, 'INR')}</div>
                </div>
                <div className="analytics-card glass-panel">
                  <h4>Total Paid By Me</h4>
                  <div className="amount" style={{ color: 'var(--text-primary)' }}>{formatAmount(analytics.totalPaidByMe, 'INR')}</div>
                </div>
                <div className="analytics-card glass-panel owed">
                  <h4>Owed to Me</h4>
                  <div className="amount" style={{ color: 'var(--success)' }}>+{formatAmount(analytics.owedToUser, 'INR')}</div>
                </div>
                <div className="analytics-card glass-panel owes">
                  <h4>Owed by Me</h4>
                  <div className="amount" style={{ color: 'var(--danger)' }}>-{formatAmount(analytics.owedByUser, 'INR')}</div>
                </div>
                <div className="analytics-card glass-panel net-balance">
                  <h4>Net Balance</h4>
                  <div className={`amount ${analytics.netBalance >= 0 ? 'positive' : 'negative'}`}>
                    {analytics.netBalance > 0 ? '+' : ''}{formatAmount(analytics.netBalance, 'INR')}
                  </div>
                </div>
              </div>

              {/* Advanced Highlights */}
              <div className="section-header" style={{ marginTop: '24px', marginBottom: '12px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)' }}>System Highlights</h3>
              </div>
              <div className="analytics-grid" style={{ marginBottom: '24px' }}>
                <div className="analytics-card glass-panel" style={{ borderLeft: '3.5px solid var(--primary)' }}>
                  <h4>👑 Top Spender</h4>
                  <div className="amount" style={{ color: 'var(--text-primary)', fontSize: '18px', marginTop: '6px' }}>
                    {analytics.topSpender ? analytics.topSpender.name : 'N/A'}
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    Paid a total of <strong>{formatAmount(analytics.topSpender ? analytics.topSpender.total : 0, 'INR')}</strong>
                  </p>
                </div>
                <div className="analytics-card glass-panel" style={{ borderLeft: '3.5px solid #3b82f6' }}>
                  <h4>🔥 Most Active Member</h4>
                  <div className="amount" style={{ color: 'var(--text-primary)', fontSize: '18px', marginTop: '6px' }}>
                    {analytics.mostActiveMember ? analytics.mostActiveMember.name : 'N/A'}
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    Activity score: <strong>{analytics.mostActiveMember ? analytics.mostActiveMember.score : 0} points</strong>
                  </p>
                </div>
                <div className="analytics-card glass-panel" style={{ borderLeft: '3.5px solid #eab308' }}>
                  <h4>💎 Largest Expense</h4>
                  <div className="amount" style={{ color: 'var(--text-primary)', fontSize: '15px', marginTop: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={analytics.largestExpense ? analytics.largestExpense.description : 'N/A'}>
                    {analytics.largestExpense ? analytics.largestExpense.description : 'N/A'}
                  </div>
                  <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: '1.3' }}>
                    Value of <strong>{formatAmount(analytics.largestExpense ? analytics.largestExpense.amount : 0, 'INR')}</strong> paid by {analytics.largestExpense ? analytics.largestExpense.paidBy : 'N/A'} ({analytics.largestExpense ? analytics.largestExpense.group : 'N/A'})
                  </p>
                </div>
              </div>

              {/* Monthly Spending SVG Chart */}
              <div className="chart-box glass-panel">
                <h3 className="chart-title">Monthly Expense Trend (My Share)</h3>
                {analytics.monthlyExpenses.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: '13px' }}>
                    No expense data found in the last 6 months.
                  </div>
                ) : (
                  <div className="chart-svg-container">
                    <svg viewBox="0 0 500 220" width="100%" height="100%">
                      <defs>
                        <linearGradient id="barTeal" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--primary)" />
                          <stop offset="100%" stopColor="var(--primary-hover)" />
                        </linearGradient>
                      </defs>

                      {/* Grid Lines */}
                      <line x1="40" y1="30" x2="480" y2="30" className="chart-grid-line" />
                      <line x1="40" y1="80" x2="480" y2="80" className="chart-grid-line" />
                      <line x1="40" y1="130" x2="480" y2="130" className="chart-grid-line" />
                      <line x1="40" y1="180" x2="480" y2="180" className="chart-axis-line" />

                      {/* X & Y Labels */}
                      {(() => {
                        const maxVal = Math.max(...analytics.monthlyExpenses.map(m => m.amount), 100);
                        const barWidth = 40;
                        const spacing = 35;
                        const leftPadding = 55;

                        return (
                          <>
                            {/* Y axis markers */}
                            <text x="30" y="34" textAnchor="end" className="chart-text">{(maxVal).toFixed(0)}</text>
                            <text x="30" y="84" textAnchor="end" className="chart-text">{(maxVal / 2).toFixed(0)}</text>
                            <text x="30" y="134" textAnchor="end" className="chart-text">{(maxVal / 4).toFixed(0)}</text>
                            <text x="30" y="184" textAnchor="end" className="chart-text">0</text>

                            {/* Bars & X labels */}
                            {analytics.monthlyExpenses.map((data, idx) => {
                              const x = idx * (barWidth + spacing) + leftPadding;
                              const height = maxVal > 0 ? (data.amount / maxVal) * 140 : 0;
                              const y = 180 - height;

                              return (
                                <g key={idx} className="chart-bar-group">
                                  {/* Value text above bar */}
                                  <text 
                                    x={x + barWidth / 2} 
                                    y={y - 6} 
                                    textAnchor="middle" 
                                    className="chart-text"
                                    style={{ fontWeight: '700', fill: 'var(--text-primary)' }}
                                  >
                                    {data.amount > 0 ? `₹${data.amount.toFixed(0)}` : ''}
                                  </text>
                                  {/* Bar Rect */}
                                  <rect 
                                    x={x} 
                                    y={y} 
                                    width={barWidth} 
                                    height={height} 
                                    rx="5"
                                    fill="url(#barTeal)"
                                    className="chart-bar-rect"
                                  />
                                  {/* Month label */}
                                  <text 
                                    x={x + barWidth / 2} 
                                    y="202" 
                                    textAnchor="middle" 
                                    className="chart-text"
                                    style={{ fontWeight: '700' }}
                                  >
                                    {data.month}
                                  </text>
                                </g>
                              );
                            })}
                          </>
                        );
                      })()}
                    </svg>
                  </div>
                )}
              </div>

              {/* Category-wise Spending Breakdown */}
              <div className="category-breakdown-box glass-panel">
                <h3 className="chart-title">Category Spending Breakdown (My Share)</h3>
                {analytics.categoryBreakdown.length === 0 || analytics.totalMyShare === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: '13px' }}>
                    No categorized expenses recorded yet.
                  </div>
                ) : (
                  <div className="category-breakdown-list">
                    {analytics.categoryBreakdown.map((item, idx) => (
                      <div key={idx} className="category-item">
                        <div className="category-header">
                          <span className="category-name">
                            {getCategoryIcon(item.category)}
                            {item.category}
                          </span>
                          <span style={{ color: 'var(--text-primary)' }}>
                            <strong>{formatAmount(item.amount, 'INR')}</strong> ({item.percentage}%)
                          </span>
                        </div>
                        <div className="category-bar-bg">
                          <div 
                            className={`category-bar-fill ${getCategoryColorClass(item.category)}`}
                            style={{ width: `${item.percentage}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Create Group Modal */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Create New Group</h2>
              <button onClick={() => setShowCreateModal(false)} className="modal-close">&times;</button>
            </div>
            <form onSubmit={handleCreateGroup}>
              <div className="form-group">
                <label className="form-label">Group Name</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g. Roommates, Trip to Goa" 
                  required
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Description (Optional)</label>
                <textarea 
                  className="form-input" 
                  style={{ height: '80px', resize: 'none' }}
                  placeholder="What is this group for?" 
                  value={groupDesc}
                  onChange={(e) => setGroupDesc(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Default Currency</label>
                <select 
                  className="form-select"
                  value={groupCurrency}
                  onChange={(e) => setGroupCurrency(e.target.value)}
                >
                  <option value="INR">INR (₹)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                </select>
              </div>
              
              <div className="modal-footer">
                <button type="button" onClick={() => setShowCreateModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={createLoading}>
                  {createLoading ? 'Creating...' : 'Create Group'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
