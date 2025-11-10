# FHERockPaperScissors - Design Documentation

## Design Decisions

If I would have made something different, I would have used Foundry, but I couldn't find a template and for simplicity I
ran with Hardhat.

## Issue Triage Process

When something goes wrong, here's how to figure out what happened and fix it.

### Basic Steps

1. **Reproduce the problem**: Try to make it happen again so you can see what's wrong
2. **Check where it fails**: Is it a transaction problem, encryption problem, or contract problem?
3. **Find the cause**: Look at error messages, check contract state, review logs
4. **Test the fix**: Make sure your fix actually works

### Example: Transaction Nonce Error

#### The Problem

Transactions fail with "nonce too low" error when playing multiple games quickly.

**What you see:**

- Transaction fails
- Game state doesn't update
- Happens more when doing things fast

#### How to Find the Problem

1. **Check the game state**:

   ```bash
   npx hardhat --network <network> task:game:info --game-id <gameId>
   ```

2. **Check transaction status**: Look at the transaction hash to see if it went through

3. **Check if other transactions are pending**: Maybe an earlier transaction is still waiting

4. **Try again slowly**: Submit moves one at a time and wait for each to complete

#### What's Probably Wrong

- Sending transactions too fast before the previous one finishes
- Not waiting for transactions to confirm
- Network is slow

#### How to Fix It

1. **Wait for transactions**: Always wait for a transaction to finish before sending the next one

2. **Check before sending**: Make sure previous transactions completed

3. **Test it**: Try playing multiple games and make sure it works

### Example: Decryption Permission Error

#### The Problem

After both players submit moves, you can't decrypt the result. You get a "permission" error.

**What you see:**

- `getResult` works and returns encrypted value
- Decryption fails with permission error
- Game shows result is computed

#### How to Find the Problem

1. **Check if result was computed**:

   ```bash
   npx hardhat --network <network> task:game:info --game-id <gameId>
   ```

   Make sure `resultComputed` is true.

2. **Check you're using the right address**: Make sure you're using the correct contract address

3. **Check you're the right player**: Only players in the game can decrypt

4. **Wait a bit**: Sometimes permissions take a moment to set up

#### What's Probably Wrong

- Permissions weren't granted properly
- Using wrong contract address
- Trying to decrypt before permissions are ready
- Not one of the game players

#### How to Fix It

1. **Make sure both players submitted**: Check game info first

2. **Wait a moment**: Try again after a few seconds

3. **Double-check addresses**: Make sure you're using the right contract and player address

4. **Test it**: Create a test game and verify decryption works for both players

### Example: Single-Player Mode Issues

#### The Problem

In single-player mode, the opponent's move should be generated automatically, but it's not happening.

**What you see:**

- Game created with `address(0)` as player2
- Player submits move
- Result not computed
- Game shows player2 hasn't submitted

#### How to Find the Problem

1. **Check if it's actually single-player**:

   ```bash
   npx hardhat --network <network> task:game:info --game-id <gameId>
   ```

   Make sure `player2` is `0x0000...` (zero address).

2. **Check transaction logs**: Look for `MoveSubmitted` events to see if opponent move was generated

3. **Verify randomness**: The opponent move uses `block.prevrandao` for randomness - make sure you're on a network that
   supports it

#### What's Probably Wrong

- Not using `address(0)` when creating the game
- Network doesn't support `block.prevrandao` (use a compatible network)
- Transaction failed silently

#### How to Fix It

1. **Create game correctly**: Use `createGame(address(0))` or `task:game:create-single`

2. **Check network compatibility**: Make sure your network supports the randomness source

3. **Test it**: Try creating a single-player game and verify the result is computed immediately

### Debugging Tips

#### Check Game State

```bash
# See game information
npx hardhat --network <network> task:game:info --game-id <gameId>
```

#### Check Events

The contract emits events when things happen:

- `GameCreated`: Game was created (player2 will be address(0) for single-player)
- `MoveSubmitted`: Move was submitted (opponent move shows address(0) in single-player)
- `ResultComputed`: Result was calculated

#### Run Tests

```bash
npm test
```

Tests check that everything works correctly, including single-player mode.
