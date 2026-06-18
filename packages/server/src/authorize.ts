import type { Action, GameState } from '@monopoly/core';

/**
 * Authorize an action: returns true if the given player is allowed to submit
 * this action against the current state.
 *
 * Rules:
 * - turn/*, manage/*, jail/* — only the current player.
 * - lobby/startGame — only the host (player at index 0).
 * - lobby/addPlayer, lobby/removePlayer — only host before game starts.
 * - auction/* — only the player whose turn it is in the auction; passes/bids
 *   carry their own playerId field but must match the submitter.
 * - trade/propose — only the from-player.
 * - trade/accept, trade/decline — only the to-player.
 */
export function canSubmitAction(state: GameState, playerId: string, action: Action): boolean {
  switch (action.type) {
    case 'lobby/addPlayer':
    case 'lobby/removePlayer':
    case 'lobby/startGame':
      return playerId === state.players[0]?.id;

    case 'turn/rollAndMove':
    case 'turn/buyCurrent':
    case 'turn/declinePurchase':
    case 'turn/auctionCurrent':
    case 'turn/end':
    case 'manage/buyHouse':
    case 'manage/sellHouse':
    case 'manage/mortgage':
    case 'manage/unmortgage':
    case 'jail/roll':
    case 'jail/payFine':
    case 'jail/useCard':
      return playerId === state.players[state.currentPlayerIndex]?.id;

    case 'auction/bid':
    case 'auction/pass': {
      if (!state.pendingAuction) return false;
      const turnIdx = state.pendingAuction.turnIndex;
      const expected = state.pendingAuction.activePlayerIds[turnIdx];
      return playerId === expected && playerId === action.playerId;
    }

    case 'trade/propose':
      return playerId === action.fromPlayerId;

    case 'trade/accept':
    case 'trade/decline':
      return playerId === state.pendingTrade?.toPlayerId;
  }
}
