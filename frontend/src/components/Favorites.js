import React from 'react';
import './Favorites.css';

const Favorites = ({ favorites, onSelect, onRemove, currentLocation }) => {
  if (favorites.length === 0) {
    return (
      <div className="favorites favorites-empty">
        <h3 className="favorites-title">⭐ Favorite Locations</h3>
        <p className="no-favorites">
          No favorites yet. Search for a location and click the star to save it!
        </p>
      </div>
    );
  }

  return (
    <div className="favorites">
      <h3 className="favorites-title">⭐ Favorite Locations</h3>
      <div className="favorites-grid">
        {favorites.map((favorite) => {
          const isActive = currentLocation && 
            currentLocation.latitude === favorite.latitude && 
            currentLocation.longitude === favorite.longitude;
          
          return (
            <div 
              key={favorite.id} 
              className={`favorite-card ${isActive ? 'active' : ''}`}
              onClick={() => onSelect(favorite)}
            >
              <div className="favorite-info">
                <span className="favorite-name">{favorite.name}</span>
                {favorite.country && (
                  <span className="favorite-country">{favorite.country}</span>
                )}
              </div>
              <button
                className="remove-favorite"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(favorite.id);
                }}
                title="Remove from favorites"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Favorites;
