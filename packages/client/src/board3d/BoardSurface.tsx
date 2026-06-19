import { BOARD, playerColor, t, TileKind, type GameState, type Tile } from '@monopoly/core';
import { Text } from '@react-three/drei';
import { GROUP_COLORS } from '../board/colors.js';
import {
  BOARD_THICKNESS,
  BOARD_WORLD,
  SURFACE_Y,
  tileWorld,
} from './layout3d.js';

interface BoardSurfaceProps {
  state?: GameState | undefined;
}

/** The board slab with all 40 tiles, color stripes, glyphs and buildings. */
export function BoardSurface({ state }: BoardSurfaceProps) {
  return (
    <group>
      {/* Base slab */}
      <mesh receiveShadow position={[0, 0, 0]}>
        <boxGeometry args={[BOARD_WORLD, BOARD_THICKNESS, BOARD_WORLD]} />
        <meshStandardMaterial color="#cfe6d2" roughness={0.8} />
      </mesh>

      {BOARD.map((tile) => (
        <TileMesh key={tile.index} tile={tile} />
      ))}

      {state && <Buildings3D state={state} />}
      {state && <OwnerMarkers state={state} />}
    </group>
  );
}

const TILE_TOP = SURFACE_Y + 0.001;

function TileMesh({ tile }: { tile: Tile }) {
  const w = tileWorld(tile.index);
  const isCorner = w.side === 'corner';
  const inset = 0.012;
  const tileW = w.w - inset;
  const tileD = w.d - inset;

  return (
    <group position={[w.x, 0, w.z]} rotation={[0, w.rotY, 0]}>
      {/* Tile face */}
      <mesh position={[0, TILE_TOP, 0]} receiveShadow>
        <boxGeometry args={[tileW, 0.02, tileD]} />
        <meshStandardMaterial color="#fbf8ef" roughness={0.6} />
      </mesh>

      {/* Color stripe for streets — runs along the outer edge (top of the
          tile in its local frame, i.e. toward the board interior is -z). */}
      {tile.kind === TileKind.STREET && (
        <mesh position={[0, TILE_TOP + 0.012, -tileD / 2 + (tileD * 0.16) / 2]}>
          <boxGeometry args={[tileW, 0.02, tileD * 0.16]} />
          <meshStandardMaterial color={GROUP_COLORS[tile.group]} roughness={0.5} />
        </mesh>
      )}

      <Label tile={tile} isCorner={isCorner} tileD={tileD} />
      <Glyph tile={tile} tileD={tileD} />
    </group>
  );
}

function Label({ tile, isCorner, tileD }: { tile: Tile; isCorner: boolean; tileD: number }) {
  const label = t(tile.nameKey);
  const z = isCorner ? 0 : -tileD / 2 + tileD * 0.34;
  return (
    <Text
      position={[0, TILE_TOP + 0.02, z]}
      rotation={[-Math.PI / 2, 0, 0]}
      fontSize={isCorner ? 0.11 : 0.085}
      maxWidth={isCorner ? 1.0 : 0.7}
      textAlign="center"
      color="#1a1d22"
      anchorX="center"
      anchorY="middle"
    >
      {label}
    </Text>
  );
}

function glyphFor(tile: Tile): string | null {
  switch (tile.kind) {
    case TileKind.STATION:
      return '🚂';
    case TileKind.UTILITY:
      return tile.nameKey === 'tile.electric' ? '💡' : '🚰';
    case TileKind.CHANCE:
      return '?';
    case TileKind.CHEST:
      return '📦';
    case TileKind.TAX:
      return '💰';
    case TileKind.GO:
      return '⭐';
    case TileKind.JAIL:
      return '🔒';
    case TileKind.GO_TO_JAIL:
      return '🚓';
    case TileKind.FREE_PARKING:
      return '🅿️';
    default:
      return null;
  }
}

function Glyph({ tile, tileD }: { tile: Tile; tileD: number }) {
  const glyph = glyphFor(tile);
  if (!glyph) return null;
  const isCorner = tileWorld(tile.index).side === 'corner';
  const z = isCorner ? tileD * 0.12 : tileD * 0.12;
  return (
    <Text
      position={[0, TILE_TOP + 0.02, z]}
      rotation={[-Math.PI / 2, 0, 0]}
      fontSize={tile.kind === TileKind.CHANCE ? 0.22 : 0.18}
      color={tile.kind === TileKind.CHANCE ? '#d96a1c' : '#1a1d22'}
      anchorX="center"
      anchorY="middle"
    >
      {glyph}
    </Text>
  );
}

/** Houses (green cubes) and hotels (red box) sitting on built streets. */
function Buildings3D({ state }: { state: GameState }) {
  return (
    <group>
      {Object.entries(state.buildings).map(([idxStr, level]) => {
        const index = Number(idxStr);
        if (!level) return null;
        const w = tileWorld(index);
        const isHotel = level >= 5;
        const count = isHotel ? 1 : level;
        return (
          <group key={index} position={[w.x, 0, w.z]} rotation={[0, w.rotY, 0]}>
            {Array.from({ length: count }, (_, i) => {
              const span = w.w * 0.6;
              const x = count > 1 ? -span / 2 + (span * i) / (count - 1) : 0;
              return (
                <mesh
                  key={i}
                  castShadow
                  position={[x, SURFACE_Y + 0.09, -w.d / 2 + w.d * 0.16]}
                >
                  <boxGeometry args={[0.12, 0.14, 0.12]} />
                  <meshStandardMaterial color={isHotel ? '#c0202a' : '#1fa84f'} />
                </mesh>
              );
            })}
          </group>
        );
      })}
    </group>
  );
}

/** Small colored dot marking each owned property by its owner's token color. */
function OwnerMarkers({ state }: { state: GameState }) {
  return (
    <group>
      {state.players.flatMap((p) =>
        p.ownedTiles.map((index) => {
          const w = tileWorld(index);
          const color = tokenColor(state, p.id);
          return (
            <mesh
              key={`${p.id}-${index}`}
              position={[w.x, SURFACE_Y + 0.025, w.z + (w.side === 'corner' ? 0 : w.d * 0.42 * dirSign(w.side))]}
              rotation={[0, w.rotY, 0]}
            >
              <cylinderGeometry args={[0.05, 0.05, 0.02, 16]} />
              <meshStandardMaterial color={color} />
            </mesh>
          );
        }),
      )}
    </group>
  );
}

function dirSign(side: string): number {
  return side === 'top' || side === 'left' ? -1 : 1;
}

function tokenColor(state: GameState, playerId: string): string {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return '#888';
  return playerColor(player);
}
