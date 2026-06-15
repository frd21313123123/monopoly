import {
  canBuyHouse,
  canMortgage,
  canSellHouse,
  canUnmortgage,
  getBuildingLevel,
  getTile,
  HOTEL_LEVEL,
  HOUSE_COST,
  isMortgaged,
  ownsFullGroup,
  t,
  TileKind,
  tilesInGroup,
  type ColorGroup,
  type Player,
  type TileIndex,
} from '@monopoly/core';
import { GROUP_COLORS } from '../board/colors.js';
import type { GameApi } from './useGame.js';

interface PropertiesProps {
  api: GameApi;
  player: Player;
}

export function Properties({ api, player }: PropertiesProps) {
  const groups = ownedGroups(player);
  if (groups.length === 0 && player.ownedTiles.length === 0) {
    return (
      <section className="sidebar__section">
        <h3 className="sidebar__heading">{t('game.properties')}</h3>
        <p className="sidebar__empty">{t('game.noMonopolies')}</p>
      </section>
    );
  }
  return (
    <section className="sidebar__section">
      <h3 className="sidebar__heading">{t('game.properties')}</h3>
      {groups.map((group) => (
        <GroupBlock key={group} api={api} player={player} group={group} />
      ))}
      <SingleTiles api={api} player={player} excludeGroups={groups} />
    </section>
  );
}

function ownedGroups(player: Player): readonly ColorGroup[] {
  const seen = new Set<ColorGroup>();
  for (const tileIndex of player.ownedTiles) {
    const tile = getTile(tileIndex);
    if (tile.kind !== TileKind.STREET) continue;
    seen.add(tile.group);
  }
  return [...seen];
}

interface GroupBlockProps {
  api: GameApi;
  player: Player;
  group: ColorGroup;
}

function GroupBlock({ api, player, group }: GroupBlockProps) {
  const tiles = tilesInGroup(group).filter((t) => player.ownedTiles.includes(t));
  const color = GROUP_COLORS[group];
  const isMono = tiles.length > 0 && ownsFullGroup(player, tiles[0]!);
  return (
    <div className="properties__group">
      <div className="properties__group-header" style={{ background: color }}>
        {isMono ? `₽${HOUSE_COST[group]} / дом` : 'не полная группа'}
      </div>
      {tiles.map((tileIndex) => (
        <TileRow key={tileIndex} api={api} player={player} tileIndex={tileIndex} />
      ))}
    </div>
  );
}

interface SingleTilesProps {
  api: GameApi;
  player: Player;
  excludeGroups: readonly ColorGroup[];
}

function SingleTiles({ api, player, excludeGroups }: SingleTilesProps) {
  const stationsAndUtils = player.ownedTiles.filter((idx) => {
    const tile = getTile(idx);
    return tile.kind === TileKind.STATION || tile.kind === TileKind.UTILITY;
  });
  if (stationsAndUtils.length === 0) return null;
  void excludeGroups;
  return (
    <div className="properties__group">
      <div className="properties__group-header" style={{ background: '#4a4f57' }}>
        Вокзалы и коммунальные
      </div>
      {stationsAndUtils.map((tileIndex) => (
        <TileRow key={tileIndex} api={api} player={player} tileIndex={tileIndex} canBuild={false} />
      ))}
    </div>
  );
}

interface TileRowProps {
  api: GameApi;
  player: Player;
  tileIndex: TileIndex;
  canBuild?: boolean;
}

function TileRow({ api, player, tileIndex, canBuild = true }: TileRowProps) {
  const tile = getTile(tileIndex);
  const level = getBuildingLevel(api.state, tileIndex);
  const mortgaged = isMortgaged(api.state, tileIndex);
  const buyCheck = canBuild ? canBuyHouse(api.state, player, tileIndex) : { ok: false as const, reason: 'n/a' };
  const sellCheck = canBuild ? canSellHouse(api.state, player, tileIndex) : { ok: false as const, reason: 'n/a' };
  const mortgageCheck = canMortgage(api.state, player, tileIndex);
  const unmortgageCheck = canUnmortgage(api.state, player, tileIndex);

  return (
    <div className={`properties__row ${mortgaged ? 'properties__row--mortgaged' : ''}`}>
      <span className="properties__name">{t(tile.nameKey)}</span>
      <span className="properties__level">
        {mortgaged ? t('game.mortgaged') : level === HOTEL_LEVEL ? '🏨' : '🏠'.repeat(level)}
      </span>
      {canBuild && (
        <>
          <button
            type="button"
            className="properties__btn"
            onClick={() => api.dispatch({ type: 'manage/buyHouse', tileIndex })}
            disabled={!buyCheck.ok}
            title={buyCheck.ok ? '' : reasonRu(buyCheck.reason)}
          >
            +
          </button>
          <button
            type="button"
            className="properties__btn properties__btn--sell"
            onClick={() => api.dispatch({ type: 'manage/sellHouse', tileIndex })}
            disabled={!sellCheck.ok}
          >
            −
          </button>
        </>
      )}
      {!canBuild && <span /> }
      {!canBuild && <span /> }
      {mortgaged ? (
        <button
          type="button"
          className="properties__btn properties__btn--money"
          onClick={() => api.dispatch({ type: 'manage/unmortgage', tileIndex })}
          disabled={!unmortgageCheck.ok}
          title={unmortgageCheck.ok ? t('game.unmortgage', { cost: unmortgageCheck.cost }) : ''}
        >
          🔓
        </button>
      ) : (
        <button
          type="button"
          className="properties__btn properties__btn--money"
          onClick={() => api.dispatch({ type: 'manage/mortgage', tileIndex })}
          disabled={!mortgageCheck.ok}
          title={mortgageCheck.ok ? t('game.mortgage', { refund: mortgageCheck.refund }) : reasonRu(mortgageCheck.reason)}
        >
          🔒
        </button>
      )}
    </div>
  );
}

function reasonRu(reason: string): string {
  const map: Record<string, string> = {
    'no monopoly': 'нет монополии',
    'must build evenly': 'застройка должна быть равномерной',
    'must sell evenly': 'продажа должна быть равномерной',
    'hotel already': 'уже отель',
    'insufficient funds': 'недостаточно средств',
    'not owned': 'не ваше',
    'not a street': 'не улица',
    'nothing to sell': 'нечего продавать',
    'already mortgaged': 'уже заложено',
    'not mortgaged': 'не заложено',
    'has buildings in group': 'есть постройки в группе — продайте их сначала',
    'not mortgageable': 'нельзя заложить',
  };
  return map[reason] ?? reason;
}
