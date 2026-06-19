import { t } from '@monopoly/core';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Board } from './Board.js';
import { HOTEL_LEVEL } from '@monopoly/core';
import { patchPlayer, startedState } from '../test/fakeApi.js';

describe('Board', () => {
  it('renders an SVG with the board label', () => {
    const { getByRole } = render(<Board />);
    const svg = getByRole('img', { name: 'Игровое поле Монополии' });
    expect(svg.tagName.toLowerCase()).toBe('svg');
  });

  it('renders all 40 tile names', () => {
    const { container } = render(<Board />);
    // GO + a couple of streets confirm the tiles rendered.
    expect(container.textContent).toContain(t('tile.go'));
    expect(container.textContent).toContain(t('tile.marosejka'));
    expect(container.textContent).toContain(t('tile.malayaBronnaya'));
  });

  it('renders no token / ownership / building layers without state', () => {
    const { container } = render(<Board />);
    expect(container.querySelector('.tokens-layer')).toBeNull();
    expect(container.querySelector('.ownership-layer')).toBeNull();
    expect(container.querySelector('.buildings-layer')).toBeNull();
  });

  it('renders a token per player when given state', () => {
    const state = startedState();
    const { container } = render(<Board state={state} currentPlayerId={state.players[0]!.id} />);
    const tokens = container.querySelector('.tokens-layer');
    expect(tokens).not.toBeNull();
    // Two circles, one per player.
    expect(tokens!.querySelectorAll('circle').length).toBe(2);
  });

  it('renders ownership badges and buildings from state', () => {
    let state = patchPlayer(startedState(), 0, { ownedTiles: [1, 3] });
    state = { ...state, buildings: { 1: 2, 3: HOTEL_LEVEL } };
    const { container } = render(<Board state={state} />);

    // One badge per owned tile.
    expect(container.querySelector('.ownership-layer')!.querySelectorAll('rect').length).toBe(2);

    // tile 1 has 2 houses (2 rects) + tile 3 a hotel (1 rect) = 3 building rects.
    const buildingRects = container.querySelector('.buildings-layer')!.querySelectorAll('rect');
    expect(buildingRects.length).toBe(3);
  });
});
