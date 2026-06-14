import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Plus, 
  IndianRupee, 
  UserPlus, 
  Users, 
  Trash2, 
  ArrowUpRight, 
  ArrowDownLeft, 
  AlertCircle, 
  HelpCircle, 
  ReceiptIndianRupee,
  FileImage,
  Utensils, 
  Plane, 
  ShoppingBag, 
  Home, 
  Film, 
  Zap, 
  FolderDot,
  Coins,
  Calendar
} from 'lucide-react';
import { formatAmount } from '../utils/format';
import { API_URL } from '../config';

export default function GroupDetail({ groupId, onBack, onSelectExpense, currentUser }) {
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  // Toggles for Modals & Views
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showSettleUp, setShowSettleUp] = useState(false);
  const [useSimplified, setUseSimplified] = useState(true);
  const [groupViewTab, setGroupViewTab] = useState('expenses'); // expenses, recurring, activities

  // Budget states
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState('');
  const [budgetLoading, setBudgetLoading] = useState(false);

  // Recurring bills state
  const [recurringRules, setRecurringRules] = useState([]);
  const [recurringLoading, setRecurringLoading] = useState(false);
  const [showAddRecurring, setShowAddRecurring] = useState(false);
  const [recDesc, setRecDesc] = useState('');
  const [recAmt, setRecAmt] = useState('');
  const [recPayer, setRecPayer] = useState(currentUser.id);
  const [recSplitType, setRecSplitType] = useState('EQUAL');
  const [recSplits, setRecSplits] = useState([]);
  const [recCategory, setRecCategory] = useState('Others');
  const [recInterval, setRecInterval] = useState('MONTHLY');
  const [recLoading, setRecLoading] = useState(false);

  // AI Scanner state
  const [isScanning, setIsScanning] = useState(false);

  // Add Expense form state
  const [expDesc, setExpDesc] = useState('');
  const [expAmt, setExpAmt] = useState('');
  const [expPayer, setExpPayer] = useState(currentUser.id);
  const [expSplitType, setExpSplitType] = useState('EQUAL');
  const [expSplits, setExpSplits] = useState([]); // Array of { userId, checked, value }
  const [expCategory, setExpCategory] = useState('Others');
  const [receiptFile, setReceiptFile] = useState(null);
  const [receiptUrl, setReceiptUrl] = useState('');
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [expLoading, setExpLoading] = useState(false);

  // Add Member form state
  const [memberEmail, setMemberEmail] = useState('');
  const [memLoading, setMemLoading] = useState(false);

  // Settle Up form state
  const [settlePayer, setSettlePayer] = useState('');
  const [settlePayee, setSettlePayee] = useState('');
  const [settleAmt, setSettleAmt] = useState('');
  const [settleLoading, setSettleLoading] = useState(false);

  // Filter & Activity Feed state
  const [activeCategoryFilter, setActiveCategoryFilter] = useState('All');
  const [activities, setActivities] = useState([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);

  const fetchGroupDetails = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/groups/${groupId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch group details.');
      }

      const data = await response.json();
      setGroup(data);
      setBudgetInput(data.budget !== null ? data.budget.toString() : '');
      
      // Auto pre-populate settle form default values
      if (data.members && data.members.length > 0) {
        const registered = data.members.filter(m => m.user !== null);
        if (registered.length > 0) {
          setSettlePayer(registered[0].user.id);
          // Set payee to someone else if possible
          if (registered.length > 1) {
            setSettlePayee(registered[1].user.id);
          } else {
            setSettlePayee(registered[0].user.id);
          }
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchActivities = async () => {
    setActivitiesLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/groups/${groupId}/activities`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Failed to load group activities.');
      const data = await response.json();
      setActivities(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setActivitiesLoading(false);
    }
  };

  const fetchRecurringRules = async () => {
    setRecurringLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/groups/${groupId}/recurring`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Failed to load recurring rules.');
      const data = await response.json();
      setRecurringRules(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setRecurringLoading(false);
    }
  };

  useEffect(() => {
    fetchGroupDetails();
    fetchRecurringRules();
  }, [groupId]);

  useEffect(() => {
    if (groupViewTab === 'activities') {
      fetchActivities();
    } else if (groupViewTab === 'recurring') {
      fetchRecurringRules();
    }
  }, [groupViewTab]);

  // Set up splits whenever group members change
  useEffect(() => {
    if (group && group.members) {
      const initialSplits = group.members
        .filter(m => m.user !== null)
        .map(m => ({
          userId: m.user.id,
          name: m.user.name,
          checked: true,
          value: ''
        }));
      setExpSplits(initialSplits);
      setExpPayer(currentUser.id);

      // Initialize recurring splits too
      const initialRecSplits = group.members
        .filter(m => m.user !== null)
        .map(m => ({
          userId: m.user.id,
          name: m.user.name,
          checked: true,
          value: ''
        }));
      setRecSplits(initialRecSplits);
      setRecPayer(currentUser.id);
    }
  }, [group]);

  const handleSaveBudget = async (e) => {
    e.preventDefault();
    setBudgetLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/groups/${groupId}/budget`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ budget: budgetInput })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to update budget.');
      setGroup(prev => ({ ...prev, budget: data.budget }));
      setIsEditingBudget(false);
      setSuccessMsg('Group budget limit updated successfully!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setBudgetLoading(false);
    }
  };

  const handleAIScan = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsScanning(true);
    setError('');
    
    const formData = new FormData();
    formData.append('receipt', file);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/scan-receipt`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to scan receipt.');
      }

      setExpDesc(data.merchantName);
      setExpAmt(data.totalAmount.toString());
      setExpCategory(data.suggestedCategory);
      
      setSuccessMsg(`AI Scan complete! Auto-filled with "${data.merchantName}" - ${formatAmount(data.totalAmount, group.currency)}`);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setError('Receipt Scanner Error: ' + err.message);
    } finally {
      setIsScanning(false);
    }
  };

  const handleToggleRecurringStatus = async (ruleId, currentStatus) => {
    try {
      const nextStatus = currentStatus === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/recurring/${ruleId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: nextStatus })
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to toggle recurring status.');
      }
      setSuccessMsg(`Recurring rule is now ${nextStatus.toLowerCase()}!`);
      setTimeout(() => setSuccessMsg(''), 3000);
      fetchRecurringRules();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteRecurringRule = async (ruleId) => {
    if (!window.confirm('Are you sure you want to delete this recurring expense rule?')) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/recurring/${ruleId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to delete recurring rule.');
      }
      setSuccessMsg('Recurring rule deleted successfully!');
      setTimeout(() => setSuccessMsg(''), 3000);
      fetchRecurringRules();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCreateRecurringRule = async (e) => {
    e.preventDefault();
    if (!recDesc || !recAmt || !recInterval) return;

    setRecLoading(true);
    setError('');

    try {
      const selectedSplits = recSplits.filter(s => s.checked);
      if (selectedSplits.length === 0) {
        throw new Error('Please select at least one split participant.');
      }

      const splitData = selectedSplits.map(s => {
        const data = { userId: s.userId };
        if (recSplitType === 'UNEQUAL') {
          data.amount = parseFloat(s.value);
          if (isNaN(data.amount) || data.amount <= 0) {
            throw new Error(`Please specify a valid amount for ${s.name}`);
          }
        }
        return data;
      });

      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/groups/${groupId}/recurring`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          description: recDesc,
          amount: parseFloat(recAmt),
          paidById: recPayer,
          splitType: recSplitType,
          category: recCategory,
          interval: recInterval,
          splits: splitData
         })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create recurring rule.');
      }

      setShowAddRecurring(false);
      setRecDesc('');
      setRecAmt('');
      setRecCategory('Others');
      setRecInterval('MONTHLY');
      setRecSplitType('EQUAL');
      
      const resetSplits = group.members
        .filter(m => m.user !== null)
        .map(m => ({
          userId: m.user.id,
          name: m.user.name,
          checked: true,
          value: ''
        }));
      setRecSplits(resetSplits);
      
      setSuccessMsg('Recurring bill rule created successfully!');
      setTimeout(() => setSuccessMsg(''), 3000);
      
      fetchRecurringRules();
      fetchGroupDetails();
    } catch (err) {
      setError(err.message);
    } finally {
      setRecLoading(false);
    }
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!memberEmail) return;

    setMemLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/groups/${groupId}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ email: memberEmail })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add member.');
      }

      setMemberEmail('');
      setShowAddMember(false);
      setSuccessMsg('Member invitation processed successfully!');
      
      // Refresh Group
      fetchGroupDetails();
    } catch (err) {
      setError(err.message);
    } finally {
      setMemLoading(false);
    }
  };

  const handleRemoveMember = async (targetUserId) => {
    if (!window.confirm('Are you sure you want to remove this member?')) return;

    setError('');
    setSuccessMsg('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/groups/${groupId}/members/${targetUserId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to remove member.');
      }

      setSuccessMsg('Member removed successfully.');
      fetchGroupDetails();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleReceiptUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate size (< 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('File size too large. Maximum allowed size is 5MB.');
      return;
    }

    // Validate type (must be image)
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setUploadError('Invalid file type. Only JPG, PNG, GIF, and WEBP image uploads are allowed.');
      return;
    }

    setUploadingReceipt(true);
    setUploadError('');

    try {
      const formData = new FormData();
      formData.append('receipt', file);

      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to upload image.');
      }

      setReceiptUrl(data.url);
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploadingReceipt(false);
    }
  };

  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (!expDesc || !expAmt || !expPayer) return;

    setExpLoading(true);
    setError('');
    setSuccessMsg('');

    // Filter split participants
    const activeSplits = expSplits.filter(s => s.checked);

    if (activeSplits.length === 0) {
      setError('Please select at least one participant to split the bill with.');
      setExpLoading(false);
      return;
    }

    // Prepare payload
    let splitArray = [];
    const amountFloat = parseFloat(expAmt);

    if (expSplitType === 'EQUAL') {
      splitArray = activeSplits.map(s => ({ userId: s.userId }));
    } else {
      // Unequal split: Validate sum of custom amounts equals total
      let sum = 0;
      for (const split of activeSplits) {
        const val = parseFloat(split.value);
        if (isNaN(val) || val < 0) {
          setError(`Please specify a valid amount for ${split.name}.`);
          setExpLoading(false);
          return;
        }
        sum += val;
        splitArray.push({ userId: split.userId, amount: val });
      }

      if (Math.abs(sum - amountFloat) > 0.01) {
        setError(`Sum of custom splits (₹${sum.toFixed(2)}) must equal the total expense amount (₹${amountFloat.toFixed(2)}).`);
        setExpLoading(false);
        return;
      }
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/groups/${groupId}/expenses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          description: expDesc,
          amount: amountFloat,
          paidById: expPayer,
          splitType: expSplitType,
          splits: splitArray,
          category: expCategory,
          receiptUrl: receiptUrl || null
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add expense.');
      }

      // Reset fields
      setExpDesc('');
      setExpAmt('');
      setExpCategory('Others');
      setReceiptUrl('');
      setShowAddExpense(false);
      setSuccessMsg('Expense added successfully!');
      
      // Refresh Group
      fetchGroupDetails();
    } catch (err) {
      setError(err.message);
    } finally {
      setExpLoading(false);
    }
  };

  const handleSettleUp = async (e) => {
    e.preventDefault();
    if (!settlePayer || !settlePayee || !settleAmt) return;

    if (settlePayer === settlePayee) {
      setError('Payer and payee cannot be the same person.');
      return;
    }

    setSettleLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/groups/${groupId}/settlements`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          payerId: settlePayer,
          payeeId: settlePayee,
          amount: parseFloat(settleAmt)
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to record settlement.');
      }

      setSettleAmt('');
      setShowSettleUp(false);
      setSuccessMsg('Debt settlement recorded successfully!');
      
      // Refresh Group
      fetchGroupDetails();
    } catch (err) {
      setError(err.message);
    } finally {
      setSettleLoading(false);
    }
  };

  const handleMarkPaid = (fromUserId, toUserId, amount) => {
    setSettlePayer(fromUserId);
    setSettlePayee(toUserId);
    setSettleAmt(amount.toString());
    setShowSettleUp(true);
  };

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'Food': return <Utensils size={12} />;
      case 'Travel': return <Plane size={12} />;
      case 'Shopping': return <ShoppingBag size={12} />;
      case 'Rent': return <Home size={12} />;
      case 'Entertainment': return <Film size={12} />;
      case 'Utilities': return <Zap size={12} />;
      default: return <FolderDot size={12} />;
    }
  };

  const getCategoryBadgeClass = (category) => {
    switch (category) {
      case 'Food': return 'food';
      case 'Travel': return 'travel';
      case 'Shopping': return 'shopping';
      case 'Rent': return 'rent';
      case 'Entertainment': return 'entertainment';
      case 'Utilities': return 'utilities';
      default: return 'others';
    }
  };

  const getActivityMarkerClass = (type) => {
    switch (type) {
      case 'GROUP_CREATE': return 'group_create';
      case 'MEMBER_ADD': return 'member_add';
      case 'MEMBER_REMOVE': return 'member_remove';
      case 'EXPENSE_CREATE': return 'expense_create';
      case 'EXPENSE_EDIT': return 'expense_edit';
      case 'EXPENSE_DELETE': return 'expense_delete';
      case 'SETTLEMENT': return 'settlement';
      default: return 'comment';
    }
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '50px', color: 'var(--text-muted)' }}>Loading group details...</div>;
  }

  if (!group) {
    return (
      <div className="glass-panel" style={{ padding: '30px', textAlign: 'center' }}>
        <h2>Group not found.</h2>
        <button onClick={onBack} className="btn btn-secondary" style={{ marginTop: '16px' }}>
          Back to Dashboard
        </button>
      </div>
    );
  }

  // Pre-calculate user overall balance in this group
  const currentUserBalance = group.balances.find(b => b.user.id === currentUser.id)?.balance || 0;

  // Split group members
  const registeredMembers = group.members.filter(m => m.user !== null);
  const pendingMembers = group.members.filter(m => m.user === null);

  // Date Formatting Helper
  const formatDate = (dateString) => {
    const d = new Date(dateString);
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    return {
      month: months[d.getMonth()],
      day: d.getDate()
    };
  };

  // Filtered expenses list
  const filteredExpenses = activeCategoryFilter === 'All'
    ? group.expenses
    : group.expenses.filter(e => e.category === activeCategoryFilter);

  const filterCategories = ['All', 'Food', 'Travel', 'Shopping', 'Rent', 'Entertainment', 'Utilities', 'Others'];

  return (
    <div>
      {/* 1. Header Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <button onClick={onBack} className="btn btn-secondary" style={{ padding: '8px 14px', fontSize: '13px', display: 'flex', gap: '4px' }}>
          <ArrowLeft size={14} /> Back
        </button>
        
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setShowAddMember(true)} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <UserPlus size={16} /> Add Member
          </button>
          <button onClick={() => setShowSettleUp(true)} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--primary)', borderColor: 'var(--primary)' }}>
            <Coins size={16} /> Settle Up
          </button>
          <button onClick={() => setShowAddExpense(true)} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Plus size={16} /> Add Expense
          </button>
        </div>
      </div>

      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '800', color: 'var(--text-primary)' }}>{group.name}</h1>
        {group.description && <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>{group.description}</p>}
      </div>

      {successMsg && (
        <div className="alert-banner success" style={{ marginBottom: '20px' }}>
          <ArrowUpRight size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* 2. Group Dashboard Summary Banner */}
      <div className="glass-panel" style={{ padding: '16px 20px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Users size={20} style={{ color: 'var(--text-secondary)' }} />
          <div>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Your Group Status:</span>
            <div style={{ fontSize: '15px', fontWeight: '700' }}>
              {currentUserBalance > 0 ? (
                <span className="balance-owed">You get back {formatAmount(currentUserBalance, group.currency)} overall</span>
              ) : currentUserBalance < 0 ? (
                <span className="balance-owes">You pay {formatAmount(Math.abs(currentUserBalance), group.currency)} overall</span>
              ) : (
                <span className="balance-settled">You are fully settled up!</span>
              )}
            </div>
          </div>
        </div>
        
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
          {registeredMembers.length} members ({pendingMembers.length} pending invites)
        </div>
      </div>

      {/* Budget Progress Indicator */}
      {(() => {
        const totalSpent = group.expenses.reduce((sum, exp) => sum + exp.amount, 0);
        const hasBudget = group.budget !== null && group.budget > 0;
        const ratio = hasBudget ? (totalSpent / group.budget) : 0;
        
        let barColorClass = 'normal';
        if (ratio >= 1.0) {
          barColorClass = 'danger';
        } else if (ratio >= 0.7) {
          barColorClass = 'warning';
        }

        return (
          <div className="glass-panel" style={{ padding: '16px 20px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.5px' }}>
                  Group Budget Tracker
                </span>
                <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Total Spent: <strong>{formatAmount(totalSpent, group.currency)}</strong>
                  {hasBudget ? (
                    <> of <strong>{formatAmount(group.budget, group.currency)}</strong> budget limit</>
                  ) : (
                    <> (No budget limit set)</>
                  )}
                </div>
              </div>

              <div>
                {isEditingBudget ? (
                  <form onSubmit={handleSaveBudget} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <input
                      type="number"
                      placeholder="e.g. 10000"
                      min="0"
                      step="0.01"
                      className="form-input"
                      style={{ padding: '6px 10px', width: '120px', height: '32px', fontSize: '13px' }}
                      value={budgetInput}
                      onChange={(e) => setBudgetInput(e.target.value)}
                    />
                    <button type="submit" className="btn btn-primary" style={{ padding: '6px 10px', fontSize: '11px', height: '32px' }} disabled={budgetLoading}>
                      Save
                    </button>
                    <button type="button" onClick={() => setIsEditingBudget(false)} className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '11px', height: '32px' }}>
                      Cancel
                    </button>
                  </form>
                ) : (
                  <button
                    onClick={() => {
                      setBudgetInput(group.budget !== null ? group.budget.toString() : '');
                      setIsEditingBudget(true);
                    }}
                    className="btn btn-secondary"
                    style={{ padding: '6px 12px', fontSize: '12px' }}
                  >
                    {hasBudget ? 'Edit Limit' : 'Set Budget Limit'}
                  </button>
                )}
              </div>
            </div>

            {hasBudget && (
              <>
                <div className="budget-progress-bar-bg">
                  <div 
                    className={`budget-progress-bar-fill ${barColorClass}`}
                    style={{ width: `${Math.min(ratio * 100, 100)}%` }}
                  />
                </div>
                {ratio >= 1.0 && (
                  <div className="budget-warning-alert">
                    <AlertCircle size={16} />
                    <span>Warning: This group has exceeded its budget limit of {formatAmount(group.budget, group.currency)}!</span>
                  </div>
                )}
              </>
            )}
          </div>
        );
      })()}

      {/* 3. Stack Layout (Single Column) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Active Debts Card */}
        <section className="sidebar-card glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)', margin: 0 }}>Active Debts</h3>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button 
                onClick={() => setUseSimplified(true)} 
                className={`btn ${useSimplified ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '4px 8px', fontSize: '10px', borderRadius: '4px' }}
              >
                Simplify Debts
              </button>
              <button 
                onClick={() => setUseSimplified(false)} 
                className={`btn ${!useSimplified ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '4px 8px', fontSize: '10px', borderRadius: '4px' }}
              >
                Direct Debts
              </button>
            </div>
          </div>

          <div className="debts-list">
            {(useSimplified ? group.simplifiedDebts : group.directDebts).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)', fontSize: '13px' }}>
                Everything is settled! No active debts.
              </div>
            ) : (
              (useSimplified ? group.simplifiedDebts : group.directDebts).map((debt, index) => (
                <div key={index} className="debt-statement" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '12px', borderBottom: '1px solid var(--border-color)' }}>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: '600' }}>{debt.from.name}</span> needs to pay <span style={{ fontWeight: '600' }}>{debt.to.name}</span>
                    <div style={{ fontWeight: '800', color: 'var(--text-primary)', marginTop: '4px', fontSize: '15px' }}>
                      {formatAmount(debt.amount, group.currency)}
                    </div>
                  </div>
                  
                  {/* Mark Paid button */}
                  {((currentUser.id === debt.from.id) || (currentUser.id === debt.to.id)) && (
                    <button 
                      onClick={() => handleMarkPaid(debt.from.id, debt.to.id, debt.amount)}
                      className="btn btn-secondary" 
                      style={{ padding: '6px 12px', fontSize: '11px' }}
                    >
                      Settle
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </section>

        {/* View Tabs Selector */}
        <div className="sub-nav-tabs" style={{ marginBottom: '12px' }}>
          <button 
            className={`sub-nav-tab ${groupViewTab === 'expenses' ? 'active' : ''}`}
            onClick={() => setGroupViewTab('expenses')}
          >
            Expenses & Logs
          </button>
          <button 
            className={`sub-nav-tab ${groupViewTab === 'recurring' ? 'active' : ''}`}
            onClick={() => setGroupViewTab('recurring')}
          >
            Recurring Bills <span className="tab-badge">{recurringRules.length}</span>
          </button>
          <button 
            className={`sub-nav-tab ${groupViewTab === 'activities' ? 'active' : ''}`}
            onClick={() => setGroupViewTab('activities')}
          >
            Group Activity timeline
          </button>
        </div>

        {/* 4. EXPENSE VIEW */}
        {groupViewTab === 'expenses' && (
          <section className="expense-section glass-panel" style={{ padding: '20px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '16px' }}>Expense Log</h2>

            {/* Category Filter Bar */}
            <div className="category-filter-bar">
              {filterCategories.map(cat => (
                <button
                  key={cat}
                  type="button"
                  className={`filter-chip ${activeCategoryFilter === cat ? 'active' : ''}`}
                  onClick={() => setActiveCategoryFilter(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="expense-card-list">
              {filteredExpenses.length === 0 ? (
                <div className="empty-state" style={{ padding: '40px 10px', textAlign: 'center' }}>
                  <ReceiptIndianRupee size={40} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
                  <h3>No expenses matching filter</h3>
                  <p style={{ fontSize: '13px', marginTop: '6px', color: 'var(--text-secondary)' }}>Click "Add Expense" to record a new bill!</p>
                </div>
              ) : (
                filteredExpenses.map(expense => {
                  const dateParts = formatDate(expense.createdAt);
                  const userSplit = expense.splits.find(s => s.userId === currentUser.id);
                  const isPayer = expense.paidById === currentUser.id;

                  return (
                    <div 
                      key={expense.id} 
                      onClick={() => onSelectExpense(expense.id, group.currency)}
                      className="expense-item"
                      style={{ padding: '16px', marginBottom: '10px' }}
                    >
                      <div className="expense-left">
                        <div className="expense-date">
                          <span className="month">{dateParts.month}</span>
                          <span className="day">{dateParts.day}</span>
                        </div>
                        <div className="expense-info">
                          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {expense.description}
                            <span className={`category-badge ${getCategoryBadgeClass(expense.category)}`}>
                              {getCategoryIcon(expense.category)} {expense.category || 'Others'}
                            </span>
                            {expense.receiptUrl && (
                              <span style={{ display: 'inline-flex', padding: '2px', borderRadius: '4px', background: 'var(--bg-surface-hover)', color: 'var(--text-secondary)' }} title="Receipt Attached">
                                <FileImage size={10} />
                              </span>
                            )}
                          </h3>
                          <p style={{ fontSize: '12px' }}>
                            Paid by <strong style={{ color: 'var(--text-primary)' }}>{expense.paidBy.name}</strong>
                          </p>
                        </div>
                      </div>

                      <div className="expense-right">
                        <div className="expense-payer-amount">
                          <div className="label">TOTAL BILL</div>
                          <div className="value" style={{ fontWeight: '700' }}>{formatAmount(expense.amount, group.currency)}</div>
                        </div>

                        <div className="expense-user-share">
                          {isPayer ? (
                            <>
                              <div className="label" style={{ color: 'var(--success)' }}>YOU LENT</div>
                              <div className="value" style={{ color: 'var(--success)', fontWeight: '700' }}>
                                {formatAmount(expense.amount - (userSplit ? userSplit.amount : 0), group.currency)}
                              </div>
                            </>
                          ) : userSplit ? (
                            <>
                              <div className="label" style={{ color: 'var(--danger)' }}>YOU OWE</div>
                              <div className="value" style={{ color: 'var(--danger)', fontWeight: '700' }}>
                                {formatAmount(userSplit.amount, group.currency)}
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="label">NOT INVOLVED</div>
                              <div className="value" style={{ color: 'var(--text-muted)', fontWeight: '700' }}>{formatAmount(0, group.currency)}</div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        )}

        {/* 6. RECURRING TAB VIEW */}
        {groupViewTab === 'recurring' && (
          <section className="recurring-section glass-panel" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '15px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)', margin: 0 }}>Recurring Bills Checklist</h2>
              <button
                onClick={() => setShowAddRecurring(true)}
                className="btn btn-primary"
                style={{ padding: '6px 12px', fontSize: '12px' }}
              >
                + Create Recurring Rule
              </button>
            </div>

            <div className="recurring-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {recurringLoading ? (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>Loading rules...</div>
              ) : recurringRules.length === 0 ? (
                <div className="empty-state" style={{ padding: '40px 10px', textAlign: 'center' }}>
                  <Calendar size={40} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
                  <h3>No recurring rules found</h3>
                  <p style={{ fontSize: '13px', marginTop: '6px', color: 'var(--text-secondary)' }}>Set up repeating bills (daily, weekly, monthly, yearly) to auto-post!</p>
                </div>
              ) : (
                recurringRules.map(rule => {
                  const isActive = rule.status === 'ACTIVE';
                  const dateOptions = { month: 'short', day: 'numeric', year: 'numeric' };
                  const nextTriggerStr = new Date(rule.nextTriggerAt).toLocaleDateString([], dateOptions);

                  return (
                    <div 
                      key={rule.id}
                      className="glass-panel" 
                      style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1.5px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}
                    >
                      <div style={{ flex: 1, paddingRight: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <strong style={{ fontSize: '14.5px', color: 'var(--text-primary)' }}>{rule.description}</strong>
                          <span className={`category-badge ${getCategoryBadgeClass(rule.category)}`}>
                            {getCategoryIcon(rule.category)} {rule.category}
                          </span>
                          <span className="badge-outline" style={{ fontSize: '10px', background: 'var(--primary-glow)', color: 'var(--primary)', borderColor: 'rgba(15, 118, 110, 0.2)' }}>
                            {rule.interval}
                          </span>
                          <span className="badge-outline" style={{ fontSize: '10px', background: isActive ? 'var(--success-bg)' : '#f5f4f0', color: isActive ? 'var(--success)' : 'var(--text-muted)', borderColor: isActive ? 'rgba(21, 128, 61, 0.2)' : 'var(--border-color)' }}>
                            {rule.status}
                          </span>
                        </div>
                        
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                          Payer: <strong>{rule.paidBy ? rule.paidBy.name : 'N/A'}</strong> | Bill Amount: <strong>{formatAmount(rule.amount, group.currency)}</strong>
                        </div>
                        <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '4px' }}>
                          Next auto-run scheduled: <strong>{nextTriggerStr}</strong>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          onClick={() => handleToggleRecurringStatus(rule.id, rule.status)}
                          className={`btn ${isActive ? 'btn-secondary' : 'btn-primary'}`}
                          style={{ padding: '6px 12px', fontSize: '12px' }}
                        >
                          {isActive ? 'Pause' : 'Resume'}
                        </button>
                        <button
                          onClick={() => handleDeleteRecurringRule(rule.id)}
                          className="btn btn-danger"
                          style={{ padding: '6px 12px', fontSize: '12px' }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        )}

        {/* 5. ACTIVITIES TIMELINE VIEW */}
        {groupViewTab === 'activities' && (
          <section className="activities-section glass-panel" style={{ padding: '20px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '16px' }}>Activity Timeline</h2>
            
            {activitiesLoading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading activities...</div>
            ) : activities.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: '13.5px' }}>
                No events recorded in this group yet.
              </div>
            ) : (
              <div className="activity-timeline">
                {activities.map(act => (
                  <div key={act.id} className="activity-timeline-item">
                    <span className={`activity-marker ${getActivityMarkerClass(act.type)}`} />
                    <div className="activity-item-content">
                      <span className="activity-item-desc">{act.description}</span>
                      <span className="activity-item-time">
                        {new Date(act.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Manage Members */}
        <section className="sidebar-card glass-panel" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '16px' }}>Manage Members</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {group.members.map(m => {
              const isCurrent = m.user && m.user.id === currentUser.id;
              const isPlaceholder = m.user === null;
              const memberName = m.user ? m.user.name : m.inviteEmail.split('@')[0];
              const targetId = m.user ? m.user.id : m.id;

              return (
                <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13.5px', padding: '6px 0' }}>
                  <span style={{ color: isCurrent ? 'var(--primary)' : 'var(--text-primary)', fontWeight: isCurrent ? '600' : '400' }}>
                    {memberName} {isCurrent && '(You)'} {!m.user && <span style={{ color: 'var(--text-muted)', fontSize: '11px', fontStyle: 'italic' }}>invited</span>}
                  </span>
                  {!isCurrent && (
                    <button
                      onClick={() => handleRemoveMember(m.user ? m.user.id : m.id)}
                      className="btn btn-secondary btn-icon"
                      style={{ padding: '4px', background: 'none', border: 'none', color: 'var(--danger)' }}
                      title="Remove member"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Add Member Modal */}
      {showAddMember && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Add Group Member</h2>
              <button onClick={() => setShowAddMember(false)} className="modal-close">&times;</button>
            </div>
            <form onSubmit={handleAddMember}>
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input 
                  type="email" 
                  className="form-input" 
                  placeholder="friend@example.com" 
                  required
                  value={memberEmail}
                  onChange={(e) => setMemberEmail(e.target.value)}
                />
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  If your friend is already registered, they will join immediately. Otherwise, they will be sent a pending invite.
                </p>
              </div>
              
              <div className="modal-footer">
                <button type="button" onClick={() => setShowAddMember(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={memLoading}>
                  {memLoading ? 'Adding...' : 'Add Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Settle Up Modal */}
      {showSettleUp && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Record a Payment</h2>
              <button onClick={() => setShowSettleUp(false)} className="modal-close">&times;</button>
            </div>
            <form onSubmit={handleSettleUp}>
              <div className="form-group">
                <label className="form-label">Who Paid?</label>
                <select 
                  className="form-select"
                  value={settlePayer}
                  onChange={(e) => setSettlePayer(e.target.value)}
                >
                  {registeredMembers.map(m => (
                    <option key={m.user.id} value={m.user.id}>{m.user.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Who Received?</label>
                <select 
                  className="form-select"
                  value={settlePayee}
                  onChange={(e) => setSettlePayee(e.target.value)}
                >
                  {registeredMembers.map(m => (
                    <option key={m.user.id} value={m.user.id}>{m.user.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Amount</label>
                <input 
                  type="number" 
                  step="0.01"
                  min="0.01"
                  className="form-input" 
                  placeholder="0.00" 
                  required
                  value={settleAmt}
                  onChange={(e) => setSettleAmt(e.target.value)}
                />
              </div>
              
              <div className="modal-footer">
                <button type="button" onClick={() => setShowSettleUp(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={settleLoading}>
                  {settleLoading ? 'Recording...' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Expense Modal */}
      {showAddExpense && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '550px' }}>
            <div className="modal-header">
              <h2>Add Group Expense</h2>
              <button onClick={() => setShowAddExpense(false)} className="modal-close">&times;</button>
            </div>
            <form onSubmit={handleAddExpense}>
              {/* AI Receipt Scanner Upload trigger */}
              <div className={`scanner-container ${isScanning ? 'scanner-active' : ''}`} onClick={() => !isScanning && document.getElementById('ai-scanner-input').click()}>
                <input 
                  type="file" 
                  id="ai-scanner-input" 
                  accept="image/*" 
                  style={{ display: 'none' }}
                  onChange={handleAIScan}
                  disabled={isScanning}
                />
                {isScanning ? (
                  <>
                    <div className="scanner-laser" />
                    <span style={{ fontWeight: '700', color: 'var(--primary)', zIndex: 12, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      🤖 AI Receipt Scanner is reading file...
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', zIndex: 12 }}>
                      Simulating OCR parser mapping details
                    </span>
                  </>
                ) : (
                  <>
                    <FileImage size={24} style={{ color: 'var(--primary)', marginBottom: '8px' }} />
                    <span style={{ fontWeight: '700', color: 'var(--text-primary)', fontSize: '13.5px' }}>✨ Auto-Fill form with AI Scanner</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Tap to upload image file (e.g. named "coffee" or "uber" for mock results)
                    </span>
                  </>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Description</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g. Dinner, Groceries, Cab" 
                  required
                  value={expDesc}
                  onChange={(e) => setExpDesc(e.target.value)}
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Amount ({group.currency})</label>
                <input 
                  type="number" 
                  step="0.01"
                  min="0.01"
                  className="form-input" 
                  placeholder="0.00" 
                  required
                  value={expAmt}
                  onChange={(e) => setExpAmt(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Category</label>
                <select 
                  className="form-select"
                  value={expCategory}
                  onChange={(e) => setExpCategory(e.target.value)}
                >
                  <option value="Food">Food</option>
                  <option value="Travel">Travel</option>
                  <option value="Shopping">Shopping</option>
                  <option value="Rent">Rent</option>
                  <option value="Entertainment">Entertainment</option>
                  <option value="Utilities">Utilities</option>
                  <option value="Others">Others</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Paid By</label>
                <select 
                  className="form-select"
                  value={expPayer}
                  onChange={(e) => setExpPayer(e.target.value)}
                >
                  {registeredMembers.map(m => (
                    <option key={m.user.id} value={m.user.id}>{m.user.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Split Strategy</label>
                <select 
                  className="form-select"
                  value={expSplitType}
                  onChange={(e) => setExpSplitType(e.target.value)}
                >
                  <option value="EQUAL">Split Equally</option>
                  <option value="UNEQUAL">Split Custom Amounts</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Split Participants</label>
                <div className="split-participant-list">
                  {expSplits.map((split, idx) => (
                    <div key={split.userId} className="split-row">
                      <label className="checkbox-label">
                        <input 
                          type="checkbox" 
                          checked={split.checked}
                          onChange={(e) => {
                            const newSplits = [...expSplits];
                            newSplits[idx].checked = e.target.checked;
                            setExpSplits(newSplits);
                          }}
                        />
                        <span>{split.name}</span>
                      </label>

                      {split.checked && expSplitType !== 'EQUAL' && (
                        <input 
                          type="number"
                          step="any"
                          required
                          className="form-input"
                          style={{ padding: '6px 10px', height: '32px' }}
                          placeholder="Amount"
                          value={split.value}
                          onChange={(e) => {
                            const newSplits = [...expSplits];
                            newSplits[idx].value = e.target.value;
                            setExpSplits(newSplits);
                          }}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Receipt File Upload */}
              {receiptUrl ? (
                <div className="receipt-preview-row">
                  <img src={`${API_URL}${receiptUrl}`} className="receipt-preview-thumbnail" alt="Receipt Preview" />
                  <span style={{ fontSize: '12.5px', fontWeight: '600' }}>Receipt image attached!</span>
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    style={{ padding: '4px 8px', fontSize: '11px', color: 'var(--danger)' }} 
                    onClick={() => setReceiptUrl('')}
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div className="form-group">
                  <label className="form-label">Receipt Image (Optional)</label>
                  <div className="receipt-upload-container" onClick={() => document.getElementById('receipt-upload-input').click()}>
                    <input 
                      type="file" 
                      id="receipt-upload-input" 
                      accept="image/*" 
                      style={{ display: 'none' }}
                      onChange={handleReceiptUpload}
                    />
                    <FileImage size={24} className="upload-icon" />
                    <span className="upload-text">
                      {uploadingReceipt ? 'Uploading image...' : 'Click to select or drag receipt image'}
                    </span>
                    <span className="upload-hint">Supports PNG, JPG, GIF, WebP up to 5MB</span>
                  </div>
                  {uploadError && <p style={{ color: 'var(--danger)', fontSize: '11px', marginTop: '4px' }}>{uploadError}</p>}
                </div>
              )}
              
              <div className="modal-footer" style={{ marginTop: '20px' }}>
                <button type="button" onClick={() => setShowAddExpense(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={expLoading || uploadingReceipt}>
                  {expLoading ? 'Adding...' : 'Add Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Recurring Modal */}
      {showAddRecurring && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '550px' }}>
            <div className="modal-header">
              <h2>Create Recurring Bill Rule</h2>
              <button onClick={() => setShowAddRecurring(false)} className="modal-close">&times;</button>
            </div>
            <form onSubmit={handleCreateRecurringRule}>
              <div className="form-group">
                <label className="form-label">Description</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g. Apartment Rent, Wifi Bill, Netflix" 
                  required
                  value={recDesc}
                  onChange={(e) => setRecDesc(e.target.value)}
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Amount ({group.currency})</label>
                <input 
                  type="number" 
                  step="0.01"
                  min="0.01"
                  className="form-input" 
                  placeholder="0.00" 
                  required
                  value={recAmt}
                  onChange={(e) => setRecAmt(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Repeat Interval</label>
                <select 
                  className="form-select"
                  value={recInterval}
                  onChange={(e) => setRecInterval(e.target.value)}
                >
                  <option value="DAILY">Daily</option>
                  <option value="WEEKLY">Weekly</option>
                  <option value="MONTHLY">Monthly</option>
                  <option value="YEARLY">Yearly</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Category</label>
                <select 
                  className="form-select"
                  value={recCategory}
                  onChange={(e) => setRecCategory(e.target.value)}
                >
                  <option value="Food">Food</option>
                  <option value="Travel">Travel</option>
                  <option value="Shopping">Shopping</option>
                  <option value="Rent">Rent</option>
                  <option value="Entertainment">Entertainment</option>
                  <option value="Utilities">Utilities</option>
                  <option value="Others">Others</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Paid By</label>
                <select 
                  className="form-select"
                  value={recPayer}
                  onChange={(e) => setRecPayer(e.target.value)}
                >
                  {registeredMembers.map(m => (
                    <option key={m.user.id} value={m.user.id}>{m.user.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Split Strategy</label>
                <select 
                  className="form-select"
                  value={recSplitType}
                  onChange={(e) => setRecSplitType(e.target.value)}
                >
                  <option value="EQUAL">Split Equally</option>
                  <option value="UNEQUAL">Split Custom Amounts</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Split Participants</label>
                <div className="split-participant-list">
                  {recSplits.map((split, idx) => (
                    <div key={split.userId} className="split-row">
                      <label className="checkbox-label">
                        <input 
                          type="checkbox" 
                          checked={split.checked}
                          onChange={(e) => {
                            const newSplits = [...recSplits];
                            newSplits[idx].checked = e.target.checked;
                            setRecSplits(newSplits);
                          }}
                        />
                        <span>{split.name}</span>
                      </label>

                      {split.checked && recSplitType !== 'EQUAL' && (
                        <input 
                          type="number"
                          step="any"
                          required
                          className="form-input"
                          style={{ padding: '6px 10px', height: '32px' }}
                          placeholder="Amount"
                          value={split.value}
                          onChange={(e) => {
                            const newSplits = [...recSplits];
                            newSplits[idx].value = e.target.value;
                            setRecSplits(newSplits);
                          }}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="modal-footer" style={{ marginTop: '20px' }}>
                <button type="button" onClick={() => setShowAddRecurring(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={recLoading}>
                  {recLoading ? 'Creating...' : 'Create Recurring Bill'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
