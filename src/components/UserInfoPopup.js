import React from 'react';
import './UserInfoPopup.css';

const UserInfoPopup = ({ user, position }) => {
  const formatLastActive = (timestamp) => {
    const now = new Date();
    const lastActive = new Date(timestamp);
    const diffInMinutes = Math.floor((now - lastActive) / 1000 / 60);

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  return (
    <div 
      className="user-info-popup"
      style={{
        left: position.x,
        top: position.y
      }}
    >
      <div className="user-info-header">
        <img 
          src={user.imageUrl || '/default-avatar.png'} 
          alt={`${user.username}'s avatar`}
          className="user-info-avatar"
        />
        <div className="user-info-main">
          <div className="user-info-username">u/{user.username}</div>
          <div className="user-info-karma">{user.karma} karma</div>
        </div>
      </div>
      <div className="user-info-details">
        <div className="user-info-section">
          <div className="user-info-label">Last active</div>
          <div className="user-info-value">{formatLastActive(user.timestamp)}</div>
        </div>
        {user.interests && (
          <div className="user-info-section">
            <div className="user-info-label">Interests</div>
            <div className="user-info-value">{user.interests}</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserInfoPopup; 