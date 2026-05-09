import type { NavFavorite } from '../../../shared/navigation.js';
import { tableIcon } from '../../../shared/navigation.js';

export interface FavoritesProps {
  favorites: NavFavorite[];
  onOpen: (fav: NavFavorite, newTab: boolean) => void;
  onUnpin: (fav: NavFavorite) => void;
}

export function Favorites({ favorites, onOpen, onUnpin }: FavoritesProps) {
  if (favorites.length === 0) {
    return (
      <div className="nv-empty">
        Pin records from the recent list to keep them here.
      </div>
    );
  }
  return (
    <ul className="nv-list">
      {favorites.map((f) => (
        <li key={`${f.table}:${f.sysId}`} className="nv-row">
          <button
            type="button"
            className="nv-row__main"
            onClick={(e) => onOpen(f, e.metaKey || e.ctrlKey)}
            title={`${f.displayValue}\n${f.table}`}
          >
            <span className="nv-row__icon" aria-hidden>{tableIcon(f.table)}</span>
            <span className="nv-row__text">
              <span className="nv-row__label">{f.displayValue}</span>
              <span className="nv-row__meta">
                <span className="nv-row__table">{f.table}</span>
              </span>
            </span>
          </button>
          <div className="nv-row__actions">
            <button
              type="button"
              className="nv-iconbtn nv-iconbtn--active"
              title="Unpin"
              onClick={() => onUnpin(f)}
            >
              ★
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
