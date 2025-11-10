import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { FHERockPaperScissors, FHERockPaperScissors__factory } from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

/**
 * Test signers for the Rock-Paper-Scissors game tests
 */
type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

/**
 * Move constants matching the contract encoding
 * 0=undefined (initial state), 1=Rock, 2=Paper, 3=Scissors
 */
const ROCK = 1;
const PAPER = 2;
const SCISSORS = 3;

/**
 * Result constants for game outcomes
 * 0=tie, 1=player1 wins, 2=player2 wins
 */
const TIE = 0;
const PLAYER1_WINS = 1;
const PLAYER2_WINS = 2;

/**
 * Deploys a fresh instance of the FHERockPaperScissors contract for testing
 * @returns The deployed contract instance and its address
 */
async function deployFixture() {
  const factory = (await ethers.getContractFactory("FHERockPaperScissors")) as FHERockPaperScissors__factory;
  const contract = (await factory.deploy()) as FHERockPaperScissors;
  const contractAddress = await contract.getAddress();

  return { contract, contractAddress };
}

/**
 * Computes the game result from the decrypted contract value
 * @param decryptedValue The decrypted value from the contract (range [1,5])
 * @returns The game result: 0=tie, 1=player1 wins, 2=player2 wins
 * @dev The contract stores (move1 + 3 - move2) which gives values in [1,5]
 * @dev Client-side modulo 3 is required: 1->1, 2->2, 3->0, 4->1, 5->2
 */
function computeResult(decryptedValue: bigint | number): number {
  const value = Number(decryptedValue);
  return value % 3;
}

describe("FHERockPaperScissors", function () {
  let signers: Signers;
  let contract: FHERockPaperScissors;
  let contractAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1], bob: ethSigners[2] };
  });

  beforeEach(async function () {
    // Check whether the tests are running against an FHEVM mock environment
    if (!fhevm.isMock) {
      console.warn(`This hardhat test suite cannot run on Sepolia Testnet`);
      this.skip();
    }

    ({ contract, contractAddress } = await deployFixture());
  });

  describe("Game Creation", function () {
    it("should create a new game", async function () {
      // Test that a game can be created between two players
      const tx = await contract.connect(signers.alice).createGame(signers.bob.address);
      await tx.wait();

      const gameInfo = await contract.getGameInfo(0);
      expect(gameInfo.player1).to.eq(signers.alice.address);
      expect(gameInfo.player2).to.eq(signers.bob.address);
      expect(gameInfo.player1Submitted).to.be.false;
      expect(gameInfo.player2Submitted).to.be.false;
      expect(gameInfo.resultComputed).to.be.false;
    });

    it("should allow creating game with zero address for single-player mode", async function () {
      // Test that creating a game with address(0) as player2 is allowed (single-player mode)
      const tx = await contract.connect(signers.alice).createGame(ethers.ZeroAddress);
      await tx.wait();

      const gameInfo = await contract.getGameInfo(0);
      expect(gameInfo.player1).to.eq(signers.alice.address);
      expect(gameInfo.player2).to.eq(ethers.ZeroAddress);
    });

    it("should reject creating game with self", async function () {
      // Test that a player cannot create a game against themselves
      await expect(contract.connect(signers.alice).createGame(signers.alice.address)).to.be.revertedWithCustomError(
        contract,
        "CannotPlayAgainstYourself",
      );
    });
  });

  describe("Move Submission", function () {
    let gameId: number;

    beforeEach(async function () {
      const tx = await contract.connect(signers.alice).createGame(signers.bob.address);
      await tx.wait();
      gameId = 0;
    });

    it("should allow player1 to submit a move", async function () {
      // Encrypt player1's move (Rock) using FHEVM
      const encryptedMove = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add32(ROCK)
        .encrypt();

      // Submit the encrypted move
      const tx = await contract
        .connect(signers.alice)
        .submitMove(gameId, encryptedMove.handles[0], encryptedMove.inputProof);
      await tx.wait();

      // Verify that player1's move was recorded
      const gameInfo = await contract.getGameInfo(gameId);
      expect(gameInfo.player1Submitted).to.be.true;
      expect(gameInfo.player2Submitted).to.be.false;
    });

    it("should allow player2 to submit a move", async function () {
      // Encrypt player2's move (Paper) using FHEVM
      const encryptedMove = await fhevm
        .createEncryptedInput(contractAddress, signers.bob.address)
        .add32(PAPER)
        .encrypt();

      // Submit the encrypted move
      const tx = await contract
        .connect(signers.bob)
        .submitMove(gameId, encryptedMove.handles[0], encryptedMove.inputProof);
      await tx.wait();

      // Verify that player2's move was recorded
      const gameInfo = await contract.getGameInfo(gameId);
      expect(gameInfo.player1Submitted).to.be.false;
      expect(gameInfo.player2Submitted).to.be.true;
    });

    it("should reject move submission from non-player", async function () {
      // Test that only players in the game can submit moves
      const encryptedMove = await fhevm
        .createEncryptedInput(contractAddress, signers.deployer.address)
        .add32(ROCK)
        .encrypt();

      await expect(
        contract.connect(signers.deployer).submitMove(gameId, encryptedMove.handles[0], encryptedMove.inputProof),
      ).to.be.revertedWithCustomError(contract, "NotAPlayerInThisGame");
    });

    it("should reject duplicate move submission", async function () {
      // Test that a player cannot submit a move twice
      const encryptedMove = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add32(ROCK)
        .encrypt();

      // First submission should succeed
      await contract.connect(signers.alice).submitMove(gameId, encryptedMove.handles[0], encryptedMove.inputProof);

      // Second submission should be rejected
      await expect(
        contract.connect(signers.alice).submitMove(gameId, encryptedMove.handles[0], encryptedMove.inputProof),
      ).to.be.revertedWithCustomError(contract, "Player1AlreadySubmitted");
    });
  });

  describe("Game Results", function () {
    /**
     * Helper function to play a complete game and return the result
     * @param player1Move The move for player1 (1=Rock, 2=Paper, 3=Scissors)
     * @param player2Move The move for player2 (1=Rock, 2=Paper, 3=Scissors)
     * @returns The game result: 0=tie, 1=player1 wins, 2=player2 wins
     */
    async function playGame(player1Move: number, player2Move: number): Promise<number> {
      // Create a new game
      const tx = await contract.connect(signers.alice).createGame(signers.bob.address);
      await tx.wait();
      const gameId = 0;

      // Player1 submits their encrypted move
      const encryptedMove1 = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add32(player1Move)
        .encrypt();
      await contract.connect(signers.alice).submitMove(gameId, encryptedMove1.handles[0], encryptedMove1.inputProof);

      // Player2 submits their encrypted move (triggers automatic result computation)
      const encryptedMove2 = await fhevm
        .createEncryptedInput(contractAddress, signers.bob.address)
        .add32(player2Move)
        .encrypt();
      await contract.connect(signers.bob).submitMove(gameId, encryptedMove2.handles[0], encryptedMove2.inputProof);

      // Retrieve and decrypt the result
      const encryptedResult = await contract.getResult(gameId);
      const decryptedResult = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        encryptedResult,
        contractAddress,
        signers.alice,
      );

      // Apply client-side modulo 3 to get final result
      return computeResult(decryptedResult);
    }

    it("Rock vs Rock should result in tie", async function () {
      const result = await playGame(ROCK, ROCK);
      expect(result).to.eq(TIE);
    });

    it("Paper vs Paper should result in tie", async function () {
      const result = await playGame(PAPER, PAPER);
      expect(result).to.eq(TIE);
    });

    it("Scissors vs Scissors should result in tie", async function () {
      const result = await playGame(SCISSORS, SCISSORS);
      expect(result).to.eq(TIE);
    });

    it("Rock vs Paper should result in player2 wins", async function () {
      const result = await playGame(ROCK, PAPER);
      expect(result).to.eq(PLAYER2_WINS);
    });

    it("Rock vs Scissors should result in player1 wins", async function () {
      const result = await playGame(ROCK, SCISSORS);
      expect(result).to.eq(PLAYER1_WINS);
    });

    it("Paper vs Rock should result in player1 wins", async function () {
      const result = await playGame(PAPER, ROCK);
      expect(result).to.eq(PLAYER1_WINS);
    });

    it("Paper vs Scissors should result in player2 wins", async function () {
      const result = await playGame(PAPER, SCISSORS);
      expect(result).to.eq(PLAYER2_WINS);
    });

    it("Scissors vs Rock should result in player2 wins", async function () {
      const result = await playGame(SCISSORS, ROCK);
      expect(result).to.eq(PLAYER2_WINS);
    });

    it("Scissors vs Paper should result in player1 wins", async function () {
      const result = await playGame(SCISSORS, PAPER);
      expect(result).to.eq(PLAYER1_WINS);
    });
  });

  describe("Result Computation", function () {
    it("should compute result automatically when both players submit", async function () {
      // Test that result is computed automatically when both players have submitted
      const tx = await contract.connect(signers.alice).createGame(signers.bob.address);
      await tx.wait();
      const gameId = 0;

      // Player1 submits their move
      const encryptedMove1 = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add32(ROCK)
        .encrypt();
      await contract.connect(signers.alice).submitMove(gameId, encryptedMove1.handles[0], encryptedMove1.inputProof);

      // Player2 submits their move - this should trigger automatic result computation
      const encryptedMove2 = await fhevm
        .createEncryptedInput(contractAddress, signers.bob.address)
        .add32(PAPER)
        .encrypt();
      await contract.connect(signers.bob).submitMove(gameId, encryptedMove2.handles[0], encryptedMove2.inputProof);

      // Verify that the result was computed
      const gameInfo = await contract.getGameInfo(gameId);
      expect(gameInfo.resultComputed).to.be.true;
    });

    it("should reject move submission after result is computed", async function () {
      // Test that no moves can be submitted after the game result is computed
      const tx = await contract.connect(signers.alice).createGame(signers.bob.address);
      await tx.wait();
      const gameId = 0;

      // Both players submit their moves (completes the game)
      const encryptedMove1 = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add32(ROCK)
        .encrypt();
      await contract.connect(signers.alice).submitMove(gameId, encryptedMove1.handles[0], encryptedMove1.inputProof);

      const encryptedMove2 = await fhevm
        .createEncryptedInput(contractAddress, signers.bob.address)
        .add32(PAPER)
        .encrypt();
      await contract.connect(signers.bob).submitMove(gameId, encryptedMove2.handles[0], encryptedMove2.inputProof);

      // Attempt to submit another move should be rejected
      await expect(
        contract.connect(signers.alice).submitMove(gameId, encryptedMove1.handles[0], encryptedMove1.inputProof),
      ).to.be.revertedWithCustomError(contract, "GameAlreadyCompleted");
    });
  });

  describe("Single-Player Mode", function () {
    it("should create a single-player game", async function () {
      const tx = await contract.connect(signers.alice).createGame(ethers.ZeroAddress);
      await tx.wait();

      const gameInfo = await contract.getGameInfo(0);
      expect(gameInfo.player1).to.eq(signers.alice.address);
      expect(gameInfo.player2).to.eq(ethers.ZeroAddress);
      expect(gameInfo.player1Submitted).to.be.false;
      expect(gameInfo.player2Submitted).to.be.false;
      expect(gameInfo.resultComputed).to.be.false;
    });

    it("should automatically generate opponent move when player submits", async function () {
      const tx = await contract.connect(signers.alice).createGame(ethers.ZeroAddress);
      await tx.wait();
      const gameId = 0;

      // Player1 submits their move
      const encryptedMove = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add32(ROCK)
        .encrypt();
      await contract.connect(signers.alice).submitMove(gameId, encryptedMove.handles[0], encryptedMove.inputProof);

      // Verify that both moves were submitted and result was computed
      const gameInfo = await contract.getGameInfo(gameId);
      expect(gameInfo.player1Submitted).to.be.true;
      expect(gameInfo.player2Submitted).to.be.true;
      expect(gameInfo.resultComputed).to.be.true;
    });

    it("should compute valid result in single-player mode", async function () {
      const tx = await contract.connect(signers.alice).createGame(ethers.ZeroAddress);
      await tx.wait();
      const gameId = 0;

      // Player1 submits their move
      const encryptedMove = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add32(ROCK)
        .encrypt();
      await contract.connect(signers.alice).submitMove(gameId, encryptedMove.handles[0], encryptedMove.inputProof);

      // Get and decrypt the result
      const encryptedResult = await contract.getResult(gameId);
      const decryptedResult = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        encryptedResult,
        contractAddress,
        signers.alice,
      );

      // Result should be valid (0, 1, or 2 after modulo 3)
      const finalResult = computeResult(decryptedResult);
      expect(finalResult).to.be.at.least(0);
      expect(finalResult).to.be.at.most(2);
    });

    it("should reject player2 move submission in single-player mode", async function () {
      const tx = await contract.connect(signers.alice).createGame(ethers.ZeroAddress);
      await tx.wait();
      const gameId = 0;

      // Try to submit as player2 (should fail)
      const encryptedMove = await fhevm
        .createEncryptedInput(contractAddress, signers.bob.address)
        .add32(PAPER)
        .encrypt();

      await expect(
        contract.connect(signers.bob).submitMove(gameId, encryptedMove.handles[0], encryptedMove.inputProof),
      ).to.be.revertedWithCustomError(contract, "NotAPlayerInThisGame");
    });

    it("should play multiple single-player games", async function () {
      // Create and play first game
      let tx = await contract.connect(signers.alice).createGame(ethers.ZeroAddress);
      await tx.wait();
      let gameId = 0;

      const encryptedMove1 = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add32(ROCK)
        .encrypt();
      await contract.connect(signers.alice).submitMove(gameId, encryptedMove1.handles[0], encryptedMove1.inputProof);

      let gameInfo = await contract.getGameInfo(gameId);
      expect(gameInfo.resultComputed).to.be.true;

      // Create and play second game
      tx = await contract.connect(signers.alice).createGame(ethers.ZeroAddress);
      await tx.wait();
      gameId = 1;

      const encryptedMove2 = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add32(PAPER)
        .encrypt();
      await contract.connect(signers.alice).submitMove(gameId, encryptedMove2.handles[0], encryptedMove2.inputProof);

      gameInfo = await contract.getGameInfo(gameId);
      expect(gameInfo.resultComputed).to.be.true;
    });
  });
});
