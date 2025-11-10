# FHERockPaperScissors

A confidential Rock-Paper-Scissors game built with Fully Homomorphic Encryption (FHE) using Zama's FHEVM protocol.
Players can play against each other or against an on-chain random opponent, with moves remaining encrypted throughout
the game.

## Features

- **Two-Player Mode**: Play against another player with fully encrypted moves
- **Single-Player Mode**: Play against an on-chain random opponent
- **Privacy-Preserving**: Moves are never decrypted on-chain, only the final result is revealed
- **Zero-Knowledge Proofs**: Validates that moves are in the correct range (1-3) without revealing them

## Quick Start

For detailed instructions, see the [Quick Start Guide](docs/QUICKSTART.md).

### Prerequisites

- **Node.js**: Version 20 or higher
- **npm**: Version 7 or higher

### Installation

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Set up environment variables** (optional, for testnet deployment)

   ```bash
   npx hardhat vars set MNEMONIC
   npx hardhat vars set INFURA_API_KEY
   ```

3. **Start local node**

   ```bash
   npx hardhat node
   ```

4. **Deploy contract**

   ```bash
   npx hardhat --network localhost deploy
   ```

5. **Play a game**

   ```bash
   # Two-player mode
   npx hardhat --network localhost task:game:play --move1 1 --move2 2

   # Single-player mode
   npx hardhat --network localhost task:game:play-single --move 1
   ```

## Game Modes

### Two-Player Mode

1. Player1 creates a game with Player2's address
2. Both players encrypt and submit their moves (1=Rock, 2=Paper, 3=Scissors)
3. Result is computed automatically when both moves are submitted
4. Players decrypt the result to see who won

### Single-Player Mode

1. Player creates a game with `address(0)`
2. Player encrypts and submits their move
3. Opponent's move is automatically generated using on-chain randomness
4. Result is computed immediately
5. Player decrypts the result

## 📁 Project Structure

```
zama-challenge/
├── contracts/                    # Smart contract source files
│   ├── FHERockPaperScissors.sol  # Main game contract
│   └── IFHERockPaperScissors.sol # Contract interface
├── deploy/                       # Deployment scripts
├── tasks/                        # Hardhat custom tasks
│   └── FHERockPaperScissors.ts   # Game interaction tasks
├── test/                         # Test files
│   └── FHERockPaperScissors.ts   # Game tests
├── docs/                         # Documentation
│   ├── QUICKSTART.md             # Quick start guide
│   └── DESIGN.md                 # Design and debugging guide
├── hardhat.config.ts             # Hardhat configuration
└── package.json                  # Dependencies and scripts
```

## 📜 Available Commands

### Game Commands

```bash
# Get contract address
npx hardhat --network localhost task:game:address

# Create a two-player game
npx hardhat --network localhost task:game:create --player2 <ADDRESS>

# Create a single-player game
npx hardhat --network localhost task:game:create-single

# Submit a move
npx hardhat --network localhost task:game:submit --game-id 0 --move 1

# Check game status
npx hardhat --network localhost task:game:info --game-id 0

# Get result
npx hardhat --network localhost task:game:result --game-id 0

# Play complete two-player game
npx hardhat --network localhost task:game:play --move1 1 --move2 2

# Play complete single-player game
npx hardhat --network localhost task:game:play-single --move 1
```

### Development Commands

| Command            | Description              |
| ------------------ | ------------------------ |
| `npm run compile`  | Compile all contracts    |
| `npm test`         | Run all tests            |
| `npm run coverage` | Generate coverage report |
| `npm run lint`     | Run linting checks       |
| `npm run clean`    | Clean build artifacts    |

## 📚 Documentation

- [Quick Start Guide](docs/QUICKSTART.md) - Get started with the game
- [Design Documentation](docs/DESIGN.md) - Architecture and debugging guide
- [FHEVM Documentation](https://docs.zama.ai/fhevm) - Zama FHEVM protocol docs

## How It Works

The game uses Fully Homomorphic Encryption to perform computations on encrypted data:

1. **Encryption**: Players encrypt their moves (1-3) using FHEVM before submitting
2. **Validation**: Zero-knowledge proofs verify moves are valid without revealing them
3. **Computation**: The contract computes the result using FHE arithmetic: `(move1 + 3 - move2)`
4. **Decryption**: Players decrypt the result and apply modulo 3 to get the final outcome

Moves remain encrypted throughout the entire process, ensuring complete privacy.

## Testing

Run the test suite:

```bash
npm test
```

Tests cover:

- Game creation and validation
- Move submission
- All 9 possible game outcomes
- Single-player mode with random opponent
- Result computation and decryption

## Deploy to Testnet

```bash
# Deploy to Sepolia
npx hardhat deploy --network sepolia

# Verify contract on Etherscan
npx hardhat verify --network sepolia <CONTRACT_ADDRESS>
```

## 📄 License

This project is licensed under the BSD-3-Clause-Clear License. See the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: See [docs/QUICKSTART.md](docs/QUICKSTART.md) and [docs/DESIGN.md](docs/DESIGN.md)
- **FHEVM Docs**: [Zama FHEVM Documentation](https://docs.zama.ai)
- **Community**: [Zama Discord](https://discord.gg/zama)

---

**Built with ❤️ by Kurt using Zama's FHEVM**
