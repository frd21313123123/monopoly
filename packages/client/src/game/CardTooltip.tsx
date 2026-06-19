import { t, type GameState, type TileIndex } from '@monopoly/core';
import { getCardInfo } from './cardInfo.js';

interface CardTooltipProps {
  state: GameState;
  tileIndex: TileIndex;
  /** Render as a standalone title-deed card (full-width colored band) rather than
   *  the compact hover tooltip. Used e.g. beside the auction bidding controls. */
  asCard?: boolean;
}

/** Hover panel with the full rundown of a board tile (owner, rent, mortgage…). */
export function CardTooltip({ state, tileIndex, asCard = false }: CardTooltipProps) {
  const info = getCardInfo(state, tileIndex);

  return (
    <div className={`card-tip${asCard ? ' card-tip--deed' : ''}`}>
      {asCard ? (
        <div className="card-tip__band" style={{ background: info.groupColor ?? '#4a4f57' }}>
          {info.name}
        </div>
      ) : (
        <div className="card-tip__header">
          {info.groupColor && (
            <span className="card-tip__swatch" style={{ background: info.groupColor }} />
          )}
          <span className="card-tip__name">{info.name}</span>
        </div>
      )}

      {info.note && <div className="card-tip__note">{info.note}</div>}

      <div className="card-tip__owner">
        {info.owner ? (
          <>
            <span className="card-tip__owner-dot" style={{ background: info.owner.color }} />
            <span>{t('card.owner', { name: info.owner.name })}</span>
          </>
        ) : info.forSale ? (
          <span>{t('card.forSale')}</span>
        ) : null}
        {info.mortgaged && <span className="card-tip__mortgaged">{t('card.mortgaged')}</span>}
      </div>

      {info.rents.length > 0 && (
        <table className="card-tip__rents">
          <tbody>
            {info.rents.map((row) => (
              <tr key={row.label} className={row.active ? 'card-tip__rent--active' : ''}>
                <td className="card-tip__rent-label">{row.label}</td>
                <td className="card-tip__rent-value">₽{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <dl className="card-tip__stats">
        {info.price !== null && (
          <Stat label={t('card.price')} value={`₽${info.price}`} />
        )}
        {info.houseCost !== null && (
          <Stat label={t('card.houseCost')} value={`₽${info.houseCost}`} />
        )}
        {info.mortgageValue !== null && (
          <Stat label={t('card.mortgageValue')} value={`₽${info.mortgageValue}`} />
        )}
        {info.unmortgageCost !== null && (
          <Stat label={t('card.unmortgageCost')} value={`₽${info.unmortgageCost}`} />
        )}
      </dl>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card-tip__stat">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
