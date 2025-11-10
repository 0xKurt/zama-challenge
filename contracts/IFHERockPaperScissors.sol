// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {euint32, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";

/// @title Interface for FHERockPaperScissors contract
/// @notice Defines the public API for the confidential Rock-Paper-Scissors game
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
    event GameCreated(uint256 indexed gameId, address indexed player1, address indexed player2, uint256 timestamp);
    event MoveSubmitted(uint256 indexed gameId, address indexed player, bool isPlayer1, uint256 timestamp);
    event ResultComputed(uint256 indexed gameId, uint256 timestamp);

    // Public state variables
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
