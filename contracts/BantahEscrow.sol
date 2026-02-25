// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20Minimal {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
}

/**
 * @title BantahEscrow
 * @notice Minimal escrow vault for testnet integration. It supports:
 *  - Native token staking via lockStakeNative()
 *  - ERC20 staking via lockStakeToken(address,uint256)
 *  - Settlement signal calls via settleChallenge() / settleChallenge(uint256,uint8)
 *  - Admin withdrawals for controlled settlement operations
 *
 * The current backend verifies tx hash/chain/contract and records outcome.
 * This contract keeps onchain custody + auditable events while the platform
 * finalizes challenge resolution logic server-side.
 */
contract BantahEscrow {
    address public owner;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event StakeLockedNative(address indexed sender, uint256 amount);
    event StakeLockedToken(address indexed sender, address indexed token, uint256 amount);
    event ChallengeSettledSignal(address indexed caller, uint256 indexed challengeId, uint8 resultCode);
    event ChallengeCreatedLogged(
        address indexed caller,
        uint256 indexed challengeId,
        bytes32 indexed metadataHash,
        string challengeType
    );
    event NativeWithdrawn(address indexed to, uint256 amount);
    event TokenWithdrawn(address indexed token, address indexed to, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    constructor(address initialOwner) {
        require(initialOwner != address(0), "Invalid owner");
        owner = initialOwner;
        emit OwnershipTransferred(address(0), initialOwner);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid owner");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    receive() external payable {
        require(msg.value > 0, "No value");
        emit StakeLockedNative(msg.sender, msg.value);
    }

    function lockStakeNative() external payable returns (bool) {
        require(msg.value > 0, "No value");
        emit StakeLockedNative(msg.sender, msg.value);
        return true;
    }

    function lockStakeToken(address token, uint256 amount) public returns (bool) {
        require(token != address(0), "Invalid token");
        require(amount > 0, "Invalid amount");
        bool ok = IERC20Minimal(token).transferFrom(msg.sender, address(this), amount);
        require(ok, "Transfer failed");
        emit StakeLockedToken(msg.sender, token, amount);
        return true;
    }

    // Backward-compatible alias.
    function depositToken(address token, uint256 amount) external returns (bool) {
        return lockStakeToken(token, amount);
    }

    function settleChallenge() public returns (bool) {
        emit ChallengeSettledSignal(msg.sender, 0, 0);
        return true;
    }

    function settleChallenge(uint256 challengeId, uint8 resultCode) public returns (bool) {
        emit ChallengeSettledSignal(msg.sender, challengeId, resultCode);
        return true;
    }

    // Backward-compatible aliases.
    function settle() external returns (bool) {
        return settleChallenge();
    }

    function settle(uint256 challengeId, uint8 resultCode) external returns (bool) {
        return settleChallenge(challengeId, resultCode);
    }

    function logChallengeCreated(
        uint256 challengeId,
        bytes32 metadataHash,
        string calldata challengeType
    ) external returns (bool) {
        emit ChallengeCreatedLogged(msg.sender, challengeId, metadataHash, challengeType);
        return true;
    }

    function withdrawNative(address payable to, uint256 amount) external onlyOwner returns (bool) {
        require(to != address(0), "Invalid recipient");
        require(amount > 0, "Invalid amount");
        require(address(this).balance >= amount, "Insufficient balance");
        (bool ok, ) = to.call{ value: amount }("");
        require(ok, "Withdraw failed");
        emit NativeWithdrawn(to, amount);
        return true;
    }

    function withdrawToken(address token, address to, uint256 amount) external onlyOwner returns (bool) {
        require(token != address(0), "Invalid token");
        require(to != address(0), "Invalid recipient");
        require(amount > 0, "Invalid amount");
        bool ok = IERC20Minimal(token).transfer(to, amount);
        require(ok, "Withdraw failed");
        emit TokenWithdrawn(token, to, amount);
        return true;
    }
}
