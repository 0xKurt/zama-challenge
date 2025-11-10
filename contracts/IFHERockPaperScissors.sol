// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {euint32, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";

/// @title Interface for FHERockPaperScissors contract
/// @notice Defines the public API for the confidential Rock-Paper-Scissors game
/// @author 0xKurt
interface IFHERockPaperScissors {
    // Custom errors
    error CannotPlayAgainstYourself();
    error GameDoesNotExist(uint256 gameId);
    error GameAlreadyCompleted();
    error Player1AlreadySubmitted();
    error Player2AlreadySubmitted();
    error NotAPlayerInThisGame();
    error BothMovesRequired();
    error ResultNotComputedYet();
    error InvalidMove();

    // Events
    /// @notice Emitted when a new game is created
    /// @param gameId The unique identifier of the game
    /// @param player1 The address of the first player
    /// @param player2 The address of the second player (address(0) for single-player games)
    /// @param timestamp The block timestamp when the game was created
    event GameCreated(uint256 indexed gameId, address indexed player1, address indexed player2, uint256 timestamp);

    /// @notice Emitted when a player submits their move
    /// @param gameId The unique identifier of the game
    /// @param player The address of the player who submitted the move
    /// @param isPlayer1 True if the move was submitted by player1, false if by player2
    /// @param timestamp The block timestamp when the move was submitted
    /* solhint-disable gas-indexed-events */
    event MoveSubmitted(uint256 indexed gameId, address indexed player, bool isPlayer1, uint256 timestamp);
    /* solhint-enable gas-indexed-events */

    /// @notice Emitted when the game result is computed
    /// @param gameId The unique identifier of the game
    /// @param timestamp The block timestamp when the result was computed
    /* solhint-disable gas-indexed-events */
    event ResultComputed(uint256 indexed gameId, uint256 timestamp);

    /* solhint-enable gas-indexed-events */

    // Public state variables
    /// @notice Gets the game data for a given game ID
    /// @param gameId The unique identifier of the game
    /// @return player1 The address of the first player
    /// @return player2 The address of the second player (address(0) for single-player games)
    /// @return move1 The encrypted move from player1
    /// @return move2 The encrypted move from player2
    /// @return result The encrypted result value
    /// @return player1Submitted True if player1 has submitted their move
    /// @return player2Submitted True if player2 has submitted their move
    /// @return resultComputed True if the result has been computed
    function games(
        uint256 gameId
    )
        external
        view
        returns (
            address player1,
            address player2,
            euint32 move1,
            euint32 move2,
            euint32 result,
            bool player1Submitted,
            bool player2Submitted,
            bool resultComputed
        );

    /// @notice Gets the current game counter
    /// @return The current number of games created (next game ID will be this value)
    function gameCounter() external view returns (uint256);

    /// @notice Creates a new game between two players
    /// @param player2 The address of the second player (address(0) for single-player mode)
    /// @return gameId The ID of the newly created game
    function createGame(address player2) external returns (uint256);

    /// @notice Submit an encrypted move (1=Rock, 2=Paper, 3=Scissors)
    /// @param gameId The ID of the game
    /// @param encryptedMove The encrypted move value (must be 1, 2, or 3)
    /// @param inputProof The zero-knowledge proof for the encrypted move
    function submitMove(uint256 gameId, externalEuint32 encryptedMove, bytes calldata inputProof) external;

    /// @notice Get the encrypted result of a game
    /// @param gameId The ID of the game
    /// @return The encrypted result (0=tie, 1=player1 wins, 2=player2 wins)
    function getResult(uint256 gameId) external view returns (euint32);

    /// @notice Get game information
    /// @param gameId The ID of the game
    /// @return player1 Address of player 1
    /// @return player2 Address of player 2 (address(0) for single-player games)
    /// @return player1Submitted Whether player 1 has submitted
    /// @return player2Submitted Whether player 2 has submitted
    /// @return resultComputed Whether the result has been computed
    function getGameInfo(
        uint256 gameId
    )
        external
        view
        returns (address player1, address player2, bool player1Submitted, bool player2Submitted, bool resultComputed);
}
