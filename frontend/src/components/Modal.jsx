import React from 'react';

function Modal({ isOpen, onClose, title, children }) {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.85)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: '#1e293b',
        border: '1px solid rgba(56, 189, 248, 0.3)',
        boxShadow: '0 0 30px rgba(0, 0, 0, 0.5), 0 0 15px rgba(56, 189, 248, 0.1)',
        borderRadius: '12px',
        width: '90%',
        maxWidth: '800px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        <div style={{
          padding: '1.5rem',
          borderBottom: '1px solid rgba(51, 65, 85, 0.5)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: 'rgba(15, 23, 42, 0.5)'
        }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#f8fafc', fontWeight: 600 }}>{title}</h2>
          <button 
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              fontSize: '1.5rem',
              padding: '0 0.5rem',
              transition: 'color 0.2s',
            }}
            onMouseOver={(e) => e.target.style.color = '#f8fafc'}
            onMouseOut={(e) => e.target.style.color = '#94a3b8'}
          >
            ×
          </button>
        </div>
        
        <div style={{ padding: '2rem', overflowY: 'auto', flex: 1, color: '#e2e8f0' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

export default Modal;
