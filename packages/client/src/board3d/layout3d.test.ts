import { describe, expect, it } from 'vitest';
import {
  BOARD_THICKNESS,
  BOARD_WORLD,
  HALF,
  SCALE,
  SURFACE_Y,
  tileWorld,
  tokenSlotWorld,
} from './layout3d.js';
import { BOARD_VIEWBOX } from '../board/layout.js';

describe('constants', () => {
  it('derives scale and half from the board size', () => {
    expect(BOARD_WORLD).toBe(11);
    expect(HALF).toBe(BOARD_WORLD / 2);
    expect(SCALE).toBe(BOARD_WORLD / BOARD_VIEWBOX);
    expect(SURFACE_Y).toBe(BOARD_THICKNESS / 2);
  });
});

describe('tileWorld', () => {
  it('keeps every tile centre inside the board footprint', () => {
    for (let i = 0; i < 40; i++) {
      const w = tileWorld(i);
      expect(Math.abs(w.x)).toBeLessThanOrEqual(HALF + 1e-9);
      expect(Math.abs(w.z)).toBeLessThanOrEqual(HALF + 1e-9);
      expect(w.w).toBeGreaterThan(0);
      expect(w.d).toBeGreaterThan(0);
    }
  });

  it('assigns the right side and rotation per edge', () => {
    expect(tileWorld(0).side).toBe('corner');
    expect(tileWorld(1).side).toBe('bottom');
    expect(tileWorld(1).rotY).toBe(0);
    expect(tileWorld(11).rotY).toBeCloseTo(Math.PI / 2);
    expect(tileWorld(21).rotY).toBeCloseTo(Math.PI);
    expect(tileWorld(31).rotY).toBeCloseTo(-Math.PI / 2);
  });

  it('places GO (tile 0) in a corner of the board', () => {
    const go = tileWorld(0);
    // GO is at the far/far SVG corner -> positive x and positive z in world space.
    expect(go.x).toBeGreaterThan(0);
    expect(go.z).toBeGreaterThan(0);
  });
});

describe('tokenSlotWorld', () => {
  it('a single token sits at the tile centre (non-corner)', () => {
    const tile = tileWorld(1);
    const slot = tokenSlotWorld(1, 0, 1);
    expect(slot.x).toBeCloseTo(tile.x);
    expect(slot.z).toBeCloseTo(tile.z);
  });

  it('spreads multiple tokens along the edge run direction (bottom: along x)', () => {
    const tile = tileWorld(1);
    const a = tokenSlotWorld(1, 0, 2);
    const b = tokenSlotWorld(1, 1, 2);
    expect(a.x).not.toBeCloseTo(b.x);
    expect(a.z).toBeCloseTo(tile.z);
    expect(b.z).toBeCloseTo(tile.z);
  });

  it('spreads multiple tokens along z on a side edge (left)', () => {
    const tile = tileWorld(11);
    const a = tokenSlotWorld(11, 0, 2);
    const b = tokenSlotWorld(11, 1, 2);
    expect(a.z).not.toBeCloseTo(b.z);
    expect(a.x).toBeCloseTo(tile.x);
  });

  it('uses a grid layout on corner tiles', () => {
    const a = tokenSlotWorld(0, 0, 4);
    const b = tokenSlotWorld(0, 1, 4);
    const c = tokenSlotWorld(0, 2, 4);
    // slot 0 and 1 differ in column (x), slot 0 and 2 differ in row (z)
    expect(a.x).not.toBeCloseTo(b.x);
    expect(a.z).not.toBeCloseTo(c.z);
  });
});
