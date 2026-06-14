import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft, 
  Send, 
  MessageSquare, 
  ReceiptIndianRupee, 
  User, 
  Clock, 
  ShieldAlert,
  Utensils, 
  Plane, 
  ShoppingBag, 
  Home, 
  Film, 
  Zap, 
  FolderDot
} from 'lucide-react';
import { io } from 'socket.io-client';
import { formatAmount } from '../utils/format';

export default function ExpenseDetail({ expenseId, onBack, currentUser, currency }) {
  const [expense, setExpense] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Chat state
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [showLightbox, setShowLightbox] = useState(false);
  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Host URL helper
  const API_URL = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
    ? 'http://localhost:5000'
    : window.location.origin;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 1. Fetch Expense Details & Chat History
  useEffect(() => {
    const fetchExpenseAndChat = async () => {
      try {
        const token = localStorage.getItem('token');
        
        // Fetch expense details
        const expRes = await fetch(`${API_URL}/api/expenses/${expenseId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!expRes.ok) throw new Error('Failed to load expense details.');
        const expData = await expRes.json();
        setExpense(expData);

        // Fetch chat history
        const chatRes = await fetch(`${API_URL}/api/expenses/${expenseId}/messages`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!chatRes.ok) throw new Error('Failed to load chat history.');
        const chatData = await chatRes.json();
        setMessages(chatData);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchExpenseAndChat();
  }, [expenseId]);

  // 2. Socket.io Real-Time Connection
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    // Establish WebSocket Connection
    socketRef.current = io(API_URL, {
      auth: { token }
    });

    // Join expense chat room
    socketRef.current.emit('join_expense', { expenseId });

    // Listen for incoming messages
    socketRef.current.on('receive_message', (message) => {
      setMessages((prev) => [...prev, message]);
    });

    socketRef.current.on('error', (err) => {
      console.error('Socket error:', err);
      setError(err.message || 'Real-time sync error occurred.');
    });

    // Cleanup on unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [expenseId]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!newMessage || newMessage.trim() === '') return;

    // Emit send_message to server (it will persist and broadcast it)
    socketRef.current.emit('send_message', {
      expenseId,
      content: newMessage
    });

    setNewMessage('');
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

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '50px', color: 'var(--text-muted)' }}>Loading expense chat...</div>;
  }

  if (!expense) {
    return (
      <div className="glass-panel" style={{ padding: '30px', textAlign: 'center' }}>
        <h2>Expense details not found.</h2>
        <button onClick={onBack} className="btn btn-secondary" style={{ marginTop: '16px' }}>
          Back to Group
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Go Back button */}
      <button onClick={onBack} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '13px', display: 'flex', gap: '4px', marginBottom: '20px' }}>
        <ArrowLeft size={14} /> Back to Group
      </button>

      {error && (
        <div className="alert-banner danger" style={{ marginBottom: '20px' }}>
          <ShieldAlert size={18} />
          <span>{error}</span>
        </div>
      )}

      <div className="expense-detail-layout">
        {/* Left Card: Expense Details & Splits */}
        <section className="expense-card-detail glass-panel">
          <div className="expense-detail-header">
            <div>
              <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '1px' }}>Bill Details</span>
              <h1 style={{ marginTop: '4px', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                {expense.description}
                <span className={`category-badge ${getCategoryBadgeClass(expense.category)}`} style={{ fontSize: '10px' }}>
                  {getCategoryIcon(expense.category)} {expense.category || 'Others'}
                </span>
              </h1>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                Paid by <strong>{expense.paidBy.name}</strong> on {new Date(expense.createdAt).toLocaleDateString()}
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>TOTAL VALUE</span>
              <div className="expense-big-amount">
                {formatAmount(expense.amount, currency)}
              </div>
            </div>
          </div>

          <h3 style={{ fontSize: '14px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '14px', letterSpacing: '0.5px' }}>
            Split Breakdown ({expense.splitType.toLowerCase()} split)
          </h3>

          <div className="split-breakdown-list">
            {expense.splits.map(split => {
              const pct = (split.amount / expense.amount) * 100;
              const isPayer = expense.paidById === split.user.id;

              return (
                <div key={split.id} className="split-breakdown-item" style={{ display: 'block', padding: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', fontSize: '14px' }}>
                    <span style={{ fontWeight: '600' }}>
                      {split.user.name} {split.user.id === currentUser.id && '(You)'}
                    </span>
                    <span style={{ fontWeight: '700' }}>
                      {formatAmount(split.amount, currency)}
                    </span>
                  </div>
                  
                  {/* Progress bar visual indicator */}
                  <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.04)', borderRadius: '3px', overflow: 'hidden', display: 'flex' }}>
                    <div 
                      style={{ 
                        width: `${pct}%`, 
                        height: '100%', 
                        background: isPayer ? 'linear-gradient(90deg, #0d9488, #0f766e)' : 'linear-gradient(90deg, #3b82f6, #1d4ed8)', 
                        borderRadius: '3px' 
                      }} 
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
                    <span>
                      {split.percentage ? `${split.percentage}%` : `${pct.toFixed(1)}%`} share
                    </span>
                    <span>
                      {isPayer ? 'Paid' : 'Owes payer'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Receipt Preview Section */}
          {expense.receiptUrl && (
            <div className="receipt-section-detail">
              <h4 style={{ fontSize: '13px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '8px', letterSpacing: '0.5px' }}>
                Attached Receipt
              </h4>
              <img 
                src={`${API_URL}${expense.receiptUrl}`} 
                className="receipt-img-preview" 
                alt="Receipt Attachment" 
                onClick={() => setShowLightbox(true)}
              />
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', textAlign: 'center' }}>
                Click image to zoom
              </p>
            </div>
          )}
        </section>

        {/* Right Card: Chat Room */}
        <section className="chat-container glass-panel">
          <div className="chat-header">
            <MessageSquare size={16} className="text-primary" style={{ color: 'var(--primary)' }} />
            <h3>Live Expense Chat</h3>
            <span style={{ marginLeft: 'auto', display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)' }} title="Real-time Connected" />
          </div>

          {/* Messages Feed */}
          <div className="chat-messages">
            {messages.length === 0 ? (
              <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13.5px', padding: '20px' }}>
                <MessageSquare size={36} style={{ marginBottom: '10px', color: 'var(--text-muted)' }} />
                <p>No comments on this expense yet.</p>
                <p style={{ fontSize: '11px', marginTop: '4px' }}>Start the conversation below!</p>
              </div>
            ) : (
              messages.map((msg) => {
                const isSelf = msg.userId === currentUser.id;
                return (
                  <div 
                    key={msg.id} 
                    className={`chat-msg-bubble ${isSelf ? 'self' : 'other'}`}
                  >
                    {!isSelf && (
                      <span className="chat-msg-sender">
                        {msg.user.name}
                      </span>
                    )}
                    <div style={{ wordBreak: 'break-word' }}>{msg.content}</div>
                    <span className="chat-msg-time">
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Message input */}
          <form onSubmit={handleSendMessage} className="chat-input-area">
            <input 
              type="text" 
              className="chat-input"
              placeholder="Type a message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              required
            />
            <button type="submit" className="chat-send-btn">
              <Send size={16} />
            </button>
          </form>
        </section>
      </div>

      {/* Lightbox Modal */}
      {showLightbox && expense.receiptUrl && (
        <div className="receipt-lightbox" onClick={() => setShowLightbox(false)}>
          <img 
            src={`${API_URL}${expense.receiptUrl}`} 
            className="receipt-lightbox-img" 
            alt="Zoomed Receipt Attachment" 
          />
        </div>
      )}
    </div>
  );
}
