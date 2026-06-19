import { describe, expect, it } from 'vitest';
import {
  BOARD_VIEWBOX,
  CORNER_SIZE,
  EDGE_LONG,
  EDGE_SHORT,
  STRIPE_THICKNESS,
  colorStripe,
  tileLayout,
} from './layout.js';

const FAR = BOARD_VIEWBOX - CORNER_SIZE;

describe('tileLayout — corners', () => {
  it.each([
    [0, FAR, FAR],
    [10, 0, FAR],
    [20, 0, 0],
    [30, FAR, 0],
  ])('corner %i sits at (%i, %i)', (index, x, y) => {
    const l = tileLayout(index);
    expect(l).toMatchObject({ x, y, width: CORNER_SIZE, height: CORNER_SIZE, side: 'corner' });
    expect(l.textRotation).toBe(0);
  });
});

describe('tileLayout — edges', () => {
  it('bottom edge runs right-to-left along y = FAR', () => {
    const l = tileLayout(1);
    expect(l).toMatchObject({ x: FAR - EDGE_SHORT, y: FAR, width: EDGE_SHORT, height: EDGE_LONG, side: 'bottom' });
    // tiles move left as the index grows
    expect(tileLayout(2).x).toBeLessThan(tileLayout(1).x);
  });

  it('left edge runs up along x = 0 with rotated text', () => {
    const l = tileLayout(11);
    expect(l).toMatchObject({ x: 0, width: EDGE_LONG, height: EDGE_SHORT, side: 'left', textRotation: 90 });
    expect(tileLayout(12).y).toBeLessThan(tileLayout(11).y);
  });

  it('top edge runs left-to-right along y = 0', () => {
    const l = tileLayout(21);
    expect(l).toMatchObject({ x: CORNER_SIZE, y: 0, width: EDGE_SHORT, height: EDGE_LONG, side: 'top', textRotation: 180 });
    expect(tileLayout(22).x).toBeGreaterThan(tileLayout(21).x);
  });

  it('right edge runs down along x = FAR', () => {
    const l = tileLayout(31);
    expect(l).toMatchObject({ x: FAR, y: CORNER_SIZE, width: EDGE_LONG, height: EDGE_SHORT, side: 'right', textRotation: 270 });
    expect(tileLayout(32).y).toBeGreaterThan(tileLayout(31).y);
  });
});

describe('tileLayout — bounds & errors', () => {
  it('every tile stays within the viewbox', () => {
    for (let i = 0; i < 40; i++) {
      const l = tileLayout(i);
      expect(l.x).toBeGreaterThanOrEqual(0);
      expect(l.y).toBeGreaterThanOrEqual(0);
      expect(l.x + l.width).toBeLessThanOrEqual(BOARD_VIEWBOX);
      expect(l.y + l.height).toBeLessThanOrEqual(BOARD_VIEWBOX);
    }
  });

  it('throws on an out-of-range index', () => {
    expect(() => tileLayout(40)).toThrow();
    expect(() => tileLayout(-1)).toThrow();
  });
});

describe('colorStripe', () => {
  it('returns null for corners', () => {
    expect(colorStripe(tileLayout(0))).toBeNull();
  });

  it('stripes a bottom tile across the top, full width', () => {
    const l = tileLayout(1);
    expect(colorStripe(l)).toEqual({ x: l.x, y: l.y, width: l.width, height: STRIPE_THICKNESS });
  });

  it('stripes a left tile on its inner edge', () => {
    const l = tileLayout(11);
    expect(colorStripe(l)).toEqual({
      x: l.x + l.width - STRIPE_THICKNESS,
      y: l.y,
      width: STRIPE_THICKNESS,
      height: l.height,
    });
  });

  it('stripes a top tile along its inner edge', () => {
    const l = tileLayout(21);
    expect(colorStripe(l)).toEqual({
      x: l.x,
      y: l.y + l.height - STRIPE_THICKNESS,
      width: l.width,
      height: STRIPE_THICKNESS,
    });
  });

  it('stripes a right tile on its inner edge, full height', () => {
    const l = tileLayout(31);
    expect(colorStripe(l)).toEqual({ x: l.x, y: l.y, width: STRIPE_THICKNESS, height: l.height });
  });
});
