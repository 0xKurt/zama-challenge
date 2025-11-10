// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FHE, euint32, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {EthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IFHERockPaperScissors} from "./IFHERockPaperScissors.sol";

/// @title A confidential Rock-Paper-Scissors game contract using FHEVM
/// @author 0xKurt
/// @notice Enables two players to play Rock-Paper-Scissors with fully encrypted moves.
/// @notice Players submit encrypted moves that remain private throughout the game.
/// @notice Only the final result (tie, player1 wins, or player2 wins) is revealed after both moves are submitted.
/// @dev Move encoding: 0=undefined (initial state), 1=Rock, 2=Paper, 3=Scissors
/// @dev Result encoding: 0=tie, 1=player1 wins, 2=player2 wins
/// @dev Uses Fully Homomorphic Encryption (FHE) via Zama's FHEVM to perform computations on encrypted data.
/// @dev Moves are never decrypted on-chain, preserving complete privacy until the result is computed.
/// @dev The contract uses ReentrancyGuard to prevent reentrancy attacks during move submission.
contract FHERockPaperScissors is EthereumConfig, IFHERockPaperScissors, ReentrancyGuard {
    /// @notice Constant used in FHE arithmetic for result computation
    uint32 private constant THREE = 3;

    /// @notice Represents a single Rock-Paper-Scissors game between two players
    /// @dev All move and result values are encrypted using FHE to preserve privacy
    // solhint-disable-next-line gas-struct-packing
    struct Game {
        address player1; /// @dev The address of the first player (game creator)
        address player2; /// @dev The address of the second player (address(0) for single-player games)
        euint32 move1; /// @dev Encrypted move from player1 (1=Rock, 2=Paper, 3=Scissors, 0=not set)
        euint32 move2; /// @dev Encrypted move from player2 (1=Rock, 2=Paper, 3=Scissors, 0=not set)
        euint32 result; /// @dev Encrypted result value in range [1,5] before client-side modulo
        bool player1Submitted; /// @dev True if player1 has submitted their move
        bool player2Submitted; /// @dev True if player2 has submitted their move
        bool resultComputed; /// @dev True if the result has been computed (both moves submitted)
    }

    /// @notice Mapping from game ID to game data
    /// @dev Game IDs are sequential integers starting from 0
    // solhint-disable-next-line named-parameters-mapping
    mapping(uint256 gameId => Game game) public games;

    /// @notice Counter for generating unique game IDs
    /// @dev Incremented each time a new game is created
    uint256 public gameCounter;

    /// @notice Creates a new game between two players
    /// @param player2 The address of the second player (address(0) for single-player mode)
    /// @return gameId A unique identifier for the newly created game
    /// @dev The caller becomes player1 and player2 is the specified address.
    /// @dev If player2 is address(0), single-player mode is enabled and opponent's move will be auto-generated.
    /// @dev If player2 is not address(0), it cannot be the same as the caller.
    /// @dev The game is initialized with encrypted zero values for moves and result.
    /// @dev Emits a GameCreated event with the gameId, both player addresses, and timestamp.
    function createGame(address player2) external returns (uint256) {
        if (player2 != address(0) && player2 == msg.sender) revert CannotPlayAgainstYourself();

        uint256 gameId = gameCounter;
        ++gameCounter;
        games[gameId] = Game({
            player1: msg.sender,
            player2: player2,
            move1: FHE.asEuint32(0),
            move2: FHE.asEuint32(0),
            result: FHE.asEuint32(0),
            player1Submitted: false,
            player2Submitted: false,
            resultComputed: false
        });

        emit GameCreated(gameId, msg.sender, player2, block.timestamp);
        return gameId;
    }

    /// @notice Submit an encrypted move for a game
    /// @param gameId The unique identifier of the game to submit a move for
    /// @param encryptedMove The encrypted move value (1=Rock, 2=Paper, 3=Scissors)
    /// @param inputProof The zero-knowledge proof that validates the encrypted move
    /// @dev Only players participating in the game can submit moves.
    /// @dev Each player can only submit one move per game.
    /// @dev FHE.fromExternal validates the ZK proof, ensuring the move is in the valid range [1,3].
    /// @dev The ZK proof also verifies that the encrypted value was encrypted by the caller.
    /// @dev After conversion, FHE.allowThis grants the contract permission to use the encrypted value.
    /// @dev If both players have submitted their moves, the result is automatically computed.
    /// @dev This function is protected by the nonReentrant modifier to prevent reentrancy attacks.
    /// @dev Emits a MoveSubmitted event when a move is successfully submitted.
    function submitMove(
        uint256 gameId,
        externalEuint32 encryptedMove,
        bytes calldata inputProof
    ) external nonReentrant {
        // solhint-disable-next-line gas-strict-inequalities
        if (gameId >= gameCounter) revert GameDoesNotExist(gameId);

        Game storage game = games[gameId];
        address sender = msg.sender;

        if (game.player1 == address(0)) revert GameDoesNotExist(gameId);
        if (game.resultComputed) revert GameAlreadyCompleted();

        euint32 move = FHE.fromExternal(encryptedMove, inputProof);
        FHE.allowThis(move);

        _validateAndSubmitMove(gameId, game, sender, move);

        if (game.player1Submitted && game.player2Submitted) {
            _computeResult(gameId);
        }
    }

    /// @notice Validates player and submits their move
    /// @param gameId The game identifier
    /// @param game The game storage reference
    /// @param sender The address submitting the move
    /// @param move The encrypted move
    function _validateAndSubmitMove(uint256 gameId, Game storage game, address sender, euint32 move) internal {
        address player1 = game.player1;
        address player2 = game.player2;
        bool isPlayer1 = sender == player1;
        bool isPlayer2 = player2 != address(0) && sender == player2;

        if (!isPlayer1 && !isPlayer2) {
            revert NotAPlayerInThisGame();
        }

        if (isPlayer1) {
            if (game.player1Submitted) revert Player1AlreadySubmitted();
            game.move1 = move;
            game.player1Submitted = true;
            emit MoveSubmitted(gameId, sender, true, block.timestamp);

            if (player2 == address(0)) {
                _generateAndSubmitOpponentMove(gameId);
            }
        } else {
            if (game.player2Submitted) revert Player2AlreadySubmitted();
            game.move2 = move;
            game.player2Submitted = true;
            emit MoveSubmitted(gameId, sender, false, block.timestamp);
        }
    }

    /// @notice Generates and submits the opponent's move for single-player games
    /// @param gameId The unique identifier of the game
    /// @dev Uses on-chain randomness (block.prevrandao) to generate a random move (1-3).
    /// @dev The move is encrypted using FHE.asEuint32() and set as player2's move.
    /// @dev This function is called automatically when player1 submits their move in single-player mode.
    function _generateAndSubmitOpponentMove(uint256 gameId) internal {
        Game storage game = games[gameId];

        // Generate random move using block.prevrandao
        uint32 randomMove = uint32(
            (uint256(keccak256(abi.encodePacked(block.timestamp, block.prevrandao, msg.sender))) % 3) + 1
        ); // 1, 2, or 3

        // Encrypt the random move using FHE
        euint32 encryptedOpponentMove = FHE.asEuint32(randomMove);
        FHE.allowThis(encryptedOpponentMove);

        game.move2 = encryptedOpponentMove;
        game.player2Submitted = true;
        emit MoveSubmitted(gameId, address(0), false, block.timestamp);
    }

    /// @notice Computes the game result using FHE arithmetic operations
    /// @param gameId The unique identifier of the game to compute the result for
    /// @dev This function is called automatically when both players have submitted their moves.
    /// @dev The computation uses homomorphic operations: (move1 + 3 - move2).
    /// @dev This formula ensures all intermediate values are positive (avoiding underflow).
    /// @dev The result is stored as an encrypted value in the range [1,5].
    /// @dev The client must apply modulo 3 after decryption to get the final result:
    /// @dev   1 -> 1 (player1 wins), 2 -> 2 (player2 wins), 3 -> 0 (tie),
    /// @dev   4 -> 1 (player1 wins), 5 -> 2 (player2 wins)
    /// @dev After computation, decryption permissions are granted to both players.
    /// @dev Emits a ResultComputed event when the result is successfully computed.
    function _computeResult(uint256 gameId) internal {
        Game storage game = games[gameId];

        euint32 three = FHE.asEuint32(THREE);
        euint32 move1Plus3 = FHE.add(game.move1, three);
        euint32 diffPlus3 = FHE.sub(move1Plus3, game.move2);

        game.result = diffPlus3;
        game.resultComputed = true;
        emit ResultComputed(gameId, block.timestamp);

        address player1 = game.player1;
        address player2 = game.player2;

        FHE.allowThis(game.result);
        FHE.allow(game.result, player1);
        // Only grant permission to player2 if it's not a single-player game
        if (player2 != address(0)) {
            FHE.allow(game.result, player2);
        }
    }

    /// @notice Retrieves the encrypted result of a completed game
    /// @param gameId The unique identifier of the game
    /// @return The encrypted result value that can be decrypted by the game players
    /// @dev The result is an encrypted value in the range [1,5] before client-side modulo operation.
    /// @dev After decryption, the client must apply modulo 3 to get the final result:
    /// @dev   0=tie, 1=player1 wins, 2=player2 wins
    /// @dev Only players who participated in the game have permission to decrypt this value.
    /// @dev Reverts if the game does not exist or if the result has not been computed yet.
    function getResult(uint256 gameId) external view returns (euint32) {
        // solhint-disable-next-line gas-strict-inequalities
        if (gameId >= gameCounter) revert GameDoesNotExist(gameId);

        Game storage game = games[gameId];
        if (!game.resultComputed) revert ResultNotComputedYet();
        return game.result;
    }

    /// @notice Retrieves public information about a game
    /// @param gameId The unique identifier of the game
    /// @return player1 The address of the first player (game creator)
    /// @return player2 The address of the second player (address(0) for single-player games)
    /// @return player1Submitted True if player1 has submitted their move, false otherwise
    /// @return player2Submitted True if player2 has submitted their move, false otherwise
    /// @return resultComputed True if the result has been computed, false otherwise
    /// @dev This function returns only public game state information.
    /// @dev Encrypted moves and results are not included in the return values.
    /// @dev Use this function to check game status before attempting to submit moves or retrieve results.
    /// @dev Reverts if the game does not exist.
    function getGameInfo(
        uint256 gameId
    )
        external
        view
        returns (address player1, address player2, bool player1Submitted, bool player2Submitted, bool resultComputed)
    {
        // solhint-disable-next-line gas-strict-inequalities
        if (gameId >= gameCounter) revert GameDoesNotExist(gameId);

        Game storage game = games[gameId];
        if (game.player1 == address(0)) revert GameDoesNotExist(gameId);
        return (game.player1, game.player2, game.player1Submitted, game.player2Submitted, game.resultComputed);
    }
}
