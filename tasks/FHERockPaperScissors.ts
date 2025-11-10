import { FhevmType } from "@fhevm/hardhat-plugin";
import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";
import type { Log } from "ethers";

/**
 * Tutorial: Deploy and Play Locally (--network localhost)
 * ======================================================
 *
 * 1. From a separate terminal window:
 *
 *   npx hardhat node
 *
 * 2. Deploy the FHERockPaperScissors contract
 *
 *   npx hardhat --network localhost deploy
 *
 * 3. Play a game:
 *
 *   # Get contract address
 *   npx hardhat --network localhost task:game:address
 *
 *   # Create a game (player1 creates game with player2)
 *   npx hardhat --network localhost task:game:create --player2 <PLAYER2_ADDRESS>
 *
 *   # Player1 submits move (1=Rock, 2=Paper, 3=Scissors)
 *   npx hardhat --network localhost task:game:submit --game-id 0 --move 1
 *
 *   # Player2 submits move
 *   npx hardhat --network localhost task:game:submit --game-id 0 --move 2 --player-index 1
 *
 *   # Get game info
 *   npx hardhat --network localhost task:game:info --game-id 0
 *
 *   # Get and decrypt result
 *   npx hardhat --network localhost task:game:result --game-id 0
 *
 *   # Or play a complete game in one command
 *   npx hardhat --network localhost task:game:play --move1 1 --move2 2
 *
 *
 * Tutorial: Deploy and Play on Sepolia (--network sepolia)
 * ========================================================
 *
 * 1. Deploy the FHERockPaperScissors contract
 *
 *   npx hardhat --network sepolia deploy
 *
 * 2. Play a game (same commands as above, but with --network sepolia)
 *
 */

/**
 * Move constants
 */
const ROCK = 1;
const PAPER = 2;
const SCISSORS = 3;

/**
 * Result constants
 */
const TIE = 0;
const PLAYER1_WINS = 1;
const PLAYER2_WINS = 2;

/**
 * Helper function to compute result from decrypted value
 */
function computeResult(decryptedValue: bigint | number): number {
  const value = Number(decryptedValue);
  return value % 3;
}

/**
 * Helper function to get move name
 */
function getMoveName(move: number): string {
  switch (move) {
    case ROCK:
      return "Rock";
    case PAPER:
      return "Paper";
    case SCISSORS:
      return "Scissors";
    default:
      return `Unknown(${move})`;
  }
}

/**
 * Helper function to get result name
 */
function getResultName(result: number): string {
  switch (result) {
    case TIE:
      return "Tie";
    case PLAYER1_WINS:
      return "Player1 Wins";
    case PLAYER2_WINS:
      return "Player2 Wins";
    default:
      return `Unknown(${result})`;
  }
}

/**
 * Example:
 *   - npx hardhat --network localhost task:game:address
 *   - npx hardhat --network sepolia task:game:address
 */
task("task:game:address", "Prints the FHERockPaperScissors contract address").setAction(async function (
  _taskArguments: TaskArguments,
  hre,
) {
  const { deployments } = hre;

  const gameContract = await deployments.get("FHERockPaperScissors");

  console.log("FHERockPaperScissors address:", gameContract.address);
});

/**
 * Example:
 *   - npx hardhat --network localhost task:game:create --player2 <ADDRESS>
 *   - npx hardhat --network sepolia task:game:create --player2 <ADDRESS>
 */
task("task:game:create", "Creates a new two-player Rock-Paper-Scissors game")
  .addOptionalParam("address", "Optionally specify the contract address")
  .addParam("player2", "The address of player2")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;

    await fhevm.initializeCLIApi();

    const gameDeployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("FHERockPaperScissors");
    console.log(`FHERockPaperScissors: ${gameDeployment.address}`);

    const signers = await ethers.getSigners();
    const gameContract = await ethers.getContractAt("FHERockPaperScissors", gameDeployment.address);

    const player2 = taskArguments.player2;
    if (!ethers.isAddress(player2)) {
      throw new Error(`Invalid player2 address: ${player2}`);
    }

    console.log(`Player1 (creator): ${signers[0].address}`);
    console.log(`Player2: ${player2}`);

    const tx = await gameContract.connect(signers[0]).createGame(player2);
    console.log(`Creating game... tx: ${tx.hash}`);

    const receipt = await tx.wait();
    console.log(`Game created! tx: ${tx.hash} status=${receipt?.status}`);

    // Extract gameId from events
    const gameCreatedEvent = receipt?.logs
      .map((log: Log) => {
        try {
          return gameContract.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((log) => log?.name === "GameCreated");

    if (gameCreatedEvent) {
      const gameId = gameCreatedEvent.args[0];
      console.log(`Game ID: ${gameId}`);
      console.log(`\nNext steps:`);
      console.log(
        `  Player1 submit move: npx hardhat --network <network> task:game:submit --game-id ${gameId} --move <1|2|3>`,
      );
      console.log(
        `  Player2 submit move: npx hardhat --network <network> task:game:submit --game-id ${gameId} --move <1|2|3> --player-index 1`,
      );
    } else {
      // Fallback: get gameCounter
      const gameCounter = await gameContract.gameCounter();
      const gameId = gameCounter - 1n;
      console.log(`Game ID: ${gameId}`);
    }
  });

/**
 * Example:
 *   - npx hardhat --network localhost task:game:create-single
 *   - npx hardhat --network sepolia task:game:create-single
 */
task("task:game:create-single", "Creates a new single-player Rock-Paper-Scissors game")
  .addOptionalParam("address", "Optionally specify the contract address")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments } = hre;

    const gameDeployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("FHERockPaperScissors");
    console.log(`FHERockPaperScissors: ${gameDeployment.address}`);

    const signers = await ethers.getSigners();
    const gameContract = await ethers.getContractAt("FHERockPaperScissors", gameDeployment.address);

    console.log(`Player: ${signers[0].address}`);

    const tx = await gameContract.connect(signers[0]).createGame(ethers.ZeroAddress);
    console.log(`Creating single-player game... tx: ${tx.hash}`);

    const receipt = await tx.wait();
    console.log(`Single-player game created! tx: ${tx.hash} status=${receipt?.status}`);

    // Extract gameId from events
    const gameCreatedEvent = receipt?.logs
      .map((log: Log) => {
        try {
          return gameContract.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((log) => log?.name === "GameCreated");

    if (gameCreatedEvent) {
      const gameId = gameCreatedEvent.args[0];
      console.log(`Game ID: ${gameId}`);
      console.log(`\nNext step:`);
      console.log(
        `  Submit move (opponent move will be generated automatically): npx hardhat --network <network> task:game:submit --game-id ${gameId} --move <1|2|3>`,
      );
    } else {
      // Fallback: get gameCounter
      const gameCounter = await gameContract.gameCounter();
      const gameId = gameCounter - 1n;
      console.log(`Game ID: ${gameId}`);
    }
  });

/**
 * Example:
 *   - npx hardhat --network localhost task:game:submit --game-id 0 --move 1
 *   - npx hardhat --network sepolia task:game:submit --game-id 0 --move 2 --player-index 1
 */
task("task:game:submit", "Submits an encrypted move for a game")
  .addOptionalParam("address", "Optionally specify the contract address")
  .addParam("gameId", "The game ID")
  .addParam("move", "The move to submit (1=Rock, 2=Paper, 3=Scissors)")
  .addOptionalParam("playerIndex", "Player index (0=player1, 1=player2). Defaults to 0")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;

    await fhevm.initializeCLIApi();

    const gameDeployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("FHERockPaperScissors");
    console.log(`FHERockPaperScissors: ${gameDeployment.address}`);

    const signers = await ethers.getSigners();
    const gameContract = await ethers.getContractAt("FHERockPaperScissors", gameDeployment.address);

    const gameId = BigInt(taskArguments.gameId);
    const move = parseInt(taskArguments.move);
    const playerIndex = taskArguments.playerIndex ? parseInt(taskArguments.playerIndex) : 0;

    if (![ROCK, PAPER, SCISSORS].includes(move)) {
      throw new Error(`Invalid move: ${move}. Must be 1 (Rock), 2 (Paper), or 3 (Scissors)`);
    }

    if (playerIndex < 0 || playerIndex >= signers.length) {
      throw new Error(`Invalid player index: ${playerIndex}. Must be between 0 and ${signers.length - 1}`);
    }

    const player = signers[playerIndex];
    console.log(`Player: ${player.address} (index ${playerIndex})`);
    console.log(`Move: ${getMoveName(move)} (${move})`);
    console.log(`Game ID: ${gameId}`);

    // Get game info to verify player is part of the game
    const gameInfo = await gameContract.getGameInfo(gameId);
    console.log(`\nGame Info:`);
    console.log(`  Player1: ${gameInfo.player1}`);
    console.log(`  Player2: ${gameInfo.player2}`);
    console.log(`  Player1 Submitted: ${gameInfo.player1Submitted}`);
    console.log(`  Player2 Submitted: ${gameInfo.player2Submitted}`);
    console.log(`  Result Computed: ${gameInfo.resultComputed}`);

    if (gameInfo.player2 === ethers.ZeroAddress) {
      console.log(`  Single Player: true`);
      console.log(
        `\nNote: This is a single-player game. The opponent's move will be generated automatically when you submit.`,
      );
    }

    // Encrypt the move
    console.log(`\nEncrypting move...`);
    const encryptedMove = await fhevm
      .createEncryptedInput(gameDeployment.address, player.address)
      .add32(move)
      .encrypt();

    // Submit the move
    console.log(`Submitting move...`);
    const tx = await gameContract
      .connect(player)
      .submitMove(gameId, encryptedMove.handles[0], encryptedMove.inputProof);
    console.log(`Wait for tx: ${tx.hash}...`);

    const receipt = await tx.wait();
    console.log(`Move submitted! tx: ${tx.hash} status=${receipt?.status}`);

    // Check if result was computed
    const updatedGameInfo = await gameContract.getGameInfo(gameId);
    if (updatedGameInfo.resultComputed) {
      console.log(`\nBoth players have submitted! Result has been computed.`);
      console.log(`Get result: npx hardhat --network <network> task:game:result --game-id ${gameId}`);
    } else {
      console.log(`\nWaiting for other player to submit their move...`);
    }
  });

/**
 * Example:
 *   - npx hardhat --network localhost task:game:info --game-id 0
 *   - npx hardhat --network sepolia task:game:info --game-id 0
 */
task("task:game:info", "Gets public information about a game")
  .addOptionalParam("address", "Optionally specify the contract address")
  .addParam("gameId", "The game ID")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments } = hre;

    const gameDeployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("FHERockPaperScissors");
    console.log(`FHERockPaperScissors: ${gameDeployment.address}`);

    const gameContract = await ethers.getContractAt("FHERockPaperScissors", gameDeployment.address);

    const gameId = BigInt(taskArguments.gameId);

    const gameInfo = await gameContract.getGameInfo(gameId);

    console.log(`\nGame ID: ${gameId}`);
    console.log(`Player1: ${gameInfo.player1}`);
    console.log(`Player2: ${gameInfo.player2}`);
    console.log(`Player1 Submitted: ${gameInfo.player1Submitted}`);
    console.log(`Player2 Submitted: ${gameInfo.player2Submitted}`);
    console.log(`Result Computed: ${gameInfo.resultComputed}`);
    if (gameInfo.player2 === ethers.ZeroAddress) {
      console.log(`Single Player: true`);
    }

    if (gameInfo.resultComputed) {
      console.log(`\nGame completed! Get result: npx hardhat --network <network> task:game:result --game-id ${gameId}`);
    } else if (gameInfo.player1Submitted && gameInfo.player2Submitted) {
      console.log(`\nBoth players submitted but result not computed (should not happen)`);
    } else {
      const waitingFor = [];
      if (!gameInfo.player1Submitted) waitingFor.push("Player1");
      if (!gameInfo.player2Submitted) waitingFor.push("Player2");
      console.log(`\nWaiting for: ${waitingFor.join(", ")}`);
    }
  });

/**
 * Example:
 *   - npx hardhat --network localhost task:game:result --game-id 0
 *   - npx hardhat --network sepolia task:game:result --game-id 0
 */
task("task:game:result", "Gets and decrypts the result of a completed game")
  .addOptionalParam("address", "Optionally specify the contract address")
  .addParam("gameId", "The game ID")
  .addOptionalParam("playerIndex", "Player index to decrypt (0=player1, 1=player2). Defaults to 0")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;

    await fhevm.initializeCLIApi();

    const gameDeployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("FHERockPaperScissors");
    console.log(`FHERockPaperScissors: ${gameDeployment.address}`);

    const signers = await ethers.getSigners();
    const gameContract = await ethers.getContractAt("FHERockPaperScissors", gameDeployment.address);

    const gameId = BigInt(taskArguments.gameId);
    const playerIndex = taskArguments.playerIndex ? parseInt(taskArguments.playerIndex) : 0;

    if (playerIndex < 0 || playerIndex >= signers.length) {
      throw new Error(`Invalid player index: ${playerIndex}. Must be between 0 and ${signers.length - 1}`);
    }

    const player = signers[playerIndex];

    // Get game info
    const gameInfo = await gameContract.getGameInfo(gameId);
    console.log(`\nGame ID: ${gameId}`);
    console.log(`Player1: ${gameInfo.player1}`);
    console.log(`Player2: ${gameInfo.player2}`);

    if (!gameInfo.resultComputed) {
      throw new Error(`Result not computed yet. Both players must submit their moves first.`);
    }

    // Get encrypted result
    console.log(`\nRetrieving encrypted result...`);
    const encryptedResult = await gameContract.getResult(gameId);
    console.log(`Encrypted result: ${encryptedResult}`);

    // Decrypt result
    console.log(`Decrypting result (using ${player.address})...`);
    const decryptedResult = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encryptedResult,
      gameDeployment.address,
      player,
    );

    // Apply modulo 3
    const finalResult = computeResult(decryptedResult);

    console.log(`\nGame Result:`);
    console.log(`  Decrypted value (before modulo): ${decryptedResult}`);
    console.log(`  Final result: ${finalResult} (${getResultName(finalResult)})`);

    if (finalResult === TIE) {
      console.log(`\nIt's a tie!`);
    } else if (finalResult === PLAYER1_WINS) {
      console.log(`\nPlayer1 wins!`);
    } else {
      console.log(`\nPlayer2 wins!`);
    }
  });

/**
 * Example:
 *   - npx hardhat --network localhost task:game:play-single --move 1
 *   - npx hardhat --network sepolia task:game:play-single --move 2
 */
task("task:game:play-single", "Plays a complete single-player game")
  .addOptionalParam("address", "Optionally specify the contract address")
  .addParam("move", "Your move (1=Rock, 2=Paper, 3=Scissors)")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;

    await fhevm.initializeCLIApi();

    const gameDeployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("FHERockPaperScissors");
    console.log(`FHERockPaperScissors: ${gameDeployment.address}`);

    const signers = await ethers.getSigners();
    const gameContract = await ethers.getContractAt("FHERockPaperScissors", gameDeployment.address);

    const move = parseInt(taskArguments.move);

    if (![ROCK, PAPER, SCISSORS].includes(move)) {
      throw new Error(`Invalid move: ${move}. Must be 1 (Rock), 2 (Paper), or 3 (Scissors)`);
    }

    const player = signers[0];

    console.log(`\nStarting Single-Player Rock-Paper-Scissors Game`);
    console.log(`Player: ${player.address} -> ${getMoveName(move)}`);
    console.log(`Opponent: Random (generated on-chain)`);

    // Step 1: Create single-player game
    console.log(`\nStep 1: Creating single-player game...`);
    const createTx = await gameContract.connect(player).createGame(ethers.ZeroAddress);
    await createTx.wait();

    const gameCounter = await gameContract.gameCounter();
    const gameId = gameCounter - 1n;
    console.log(`Single-player game created! Game ID: ${gameId}`);

    // Step 2: Submit player's move (opponent move will be generated automatically)
    console.log(`\nStep 2: Submitting your move...`);
    const encryptedMove = await fhevm
      .createEncryptedInput(gameDeployment.address, player.address)
      .add32(move)
      .encrypt();

    const submitTx = await gameContract
      .connect(player)
      .submitMove(gameId, encryptedMove.handles[0], encryptedMove.inputProof);
    await submitTx.wait();
    console.log(`Move submitted! Opponent's move was generated automatically.`);

    // Step 3: Get and decrypt result
    console.log(`\nStep 3: Getting result...`);
    const encryptedResult = await gameContract.getResult(gameId);
    const decryptedResult = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encryptedResult,
      gameDeployment.address,
      player,
    );

    const finalResult = computeResult(decryptedResult);

    console.log(`\n=== Game Result ===`);
    console.log(`Your move: ${getMoveName(move)}`);
    console.log(`Opponent move: Random (encrypted, not revealed)`);
    console.log(`Result: ${finalResult} (${getResultName(finalResult)})`);

    if (finalResult === TIE) {
      console.log(`\nIt's a tie!`);
    } else if (finalResult === PLAYER1_WINS) {
      console.log(`\nYou win!`);
    } else {
      console.log(`\nOpponent wins!`);
    }
  });

/**
 * Example:
 *   - npx hardhat --network localhost task:game:play --move1 1 --move2 2
 *   - npx hardhat --network sepolia task:game:play --move1 2 --move2 3
 */
task("task:game:play", "Plays a complete two-player game from start to finish")
  .addOptionalParam("address", "Optionally specify the contract address")
  .addParam("move1", "Player1's move (1=Rock, 2=Paper, 3=Scissors)")
  .addParam("move2", "Player2's move (1=Rock, 2=Paper, 3=Scissors)")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;

    await fhevm.initializeCLIApi();

    const gameDeployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("FHERockPaperScissors");
    console.log(`FHERockPaperScissors: ${gameDeployment.address}`);

    const signers = await ethers.getSigners();
    const gameContract = await ethers.getContractAt("FHERockPaperScissors", gameDeployment.address);

    const move1 = parseInt(taskArguments.move1);
    const move2 = parseInt(taskArguments.move2);

    if (![ROCK, PAPER, SCISSORS].includes(move1)) {
      throw new Error(`Invalid move1: ${move1}. Must be 1 (Rock), 2 (Paper), or 3 (Scissors)`);
    }
    if (![ROCK, PAPER, SCISSORS].includes(move2)) {
      throw new Error(`Invalid move2: ${move2}. Must be 1 (Rock), 2 (Paper), or 3 (Scissors)`);
    }

    const player1 = signers[0];
    const player2 = signers[1];

    console.log(`\nStarting Rock-Paper-Scissors Game`);
    console.log(`Player1: ${player1.address} -> ${getMoveName(move1)}`);
    console.log(`Player2: ${player2.address} -> ${getMoveName(move2)}`);

    // Step 1: Create game
    console.log(`\nStep 1: Creating game...`);
    const createTx = await gameContract.connect(player1).createGame(player2.address);
    await createTx.wait();

    const gameCounter = await gameContract.gameCounter();
    const gameId = gameCounter - 1n;
    console.log(`Game created! Game ID: ${gameId}`);

    // Step 2: Player1 submits move
    console.log(`\nStep 2: Player1 submitting ${getMoveName(move1)}...`);
    const encryptedMove1 = await fhevm
      .createEncryptedInput(gameDeployment.address, player1.address)
      .add32(move1)
      .encrypt();

    const submit1Tx = await gameContract
      .connect(player1)
      .submitMove(gameId, encryptedMove1.handles[0], encryptedMove1.inputProof);
    await submit1Tx.wait();
    console.log(`Player1 move submitted!`);

    // Step 3: Player2 submits move
    console.log(`\nStep 3: Player2 submitting ${getMoveName(move2)}...`);
    const encryptedMove2 = await fhevm
      .createEncryptedInput(gameDeployment.address, player2.address)
      .add32(move2)
      .encrypt();

    const submit2Tx = await gameContract
      .connect(player2)
      .submitMove(gameId, encryptedMove2.handles[0], encryptedMove2.inputProof);
    await submit2Tx.wait();
    console.log(`Player2 move submitted!`);

    // Step 4: Get and decrypt result
    console.log(`\nStep 4: Computing and retrieving result...`);
    const encryptedResult = await gameContract.getResult(gameId);
    const decryptedResult = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encryptedResult,
      gameDeployment.address,
      player1,
    );
    const finalResult = computeResult(decryptedResult);

    // Display final result
    console.log(`\n${"=".repeat(50)}`);
    console.log(`FINAL RESULT`);
    console.log(`${"=".repeat(50)}`);
    console.log(`Player1: ${getMoveName(move1)}`);
    console.log(`Player2: ${getMoveName(move2)}`);
    console.log(`\nResult: ${getResultName(finalResult)}`);
    if (finalResult === TIE) {
      console.log(`It's a tie!`);
    } else if (finalResult === PLAYER1_WINS) {
      console.log(`Player1 wins!`);
    } else {
      console.log(`Player2 wins!`);
    }
    console.log(`${"=".repeat(50)}\n`);
  });
