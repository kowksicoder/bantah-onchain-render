// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20MinimalV2 {
    function balanceOf(address account) external view returns (uint256);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
}

/**
 * @title BantahEscrowV2
 * @notice Treasury-aware escrow contract for Bantah challenge markets.
 *
 * Backward compatibility:
 * - Keeps the legacy generic lock methods and settle signal methods from BantahEscrow.
 * - Adds challenge-aware stake tracking for future market-by-market settlement.
 *
 * New behavior:
 * - Tracks native/token stakes per challenge + participant.
 * - Settles challenge funds to winner and treasury using loser-side fee math.
 * - Protects tracked challenge balances from owner withdrawal.
 */
contract BantahEscrowV2 {
    uint256 public constant FEE_DENOMINATOR = 1_000_000; // parts per million
    uint256 public constant MAX_FEE_PPM = 100_000; // 10%

    address public owner;
    address payable public treasury;
    uint256 public feePpm;

    uint256 private trackedNativeBalance;
    mapping(address => uint256) private trackedTokenBalances;
    mapping(uint256 => mapping(address => uint256)) private nativeChallengeStakes;
    mapping(uint256 => mapping(address => mapping(address => uint256))) private tokenChallengeStakes;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event TreasuryUpdated(address indexed previousTreasury, address indexed newTreasury);
    event FeeUpdated(uint256 previousFeePpm, uint256 newFeePpm);

    event StakeLockedNative(address indexed sender, uint256 amount);
    event StakeLockedToken(address indexed sender, address indexed token, uint256 amount);
    event ChallengeStakeLockedNative(uint256 indexed challengeId, address indexed participant, uint256 amount);
    event ChallengeStakeLockedToken(
        uint256 indexed challengeId,
        address indexed token,
        address indexed participant,
        uint256 amount
    );

    event ChallengeSettledSignal(address indexed caller, uint256 indexed challengeId, uint8 resultCode);
    event ChallengeCreatedLogged(
        address indexed caller,
        uint256 indexed challengeId,
        bytes32 indexed metadataHash,
        string challengeType
    );

    event ChallengePayoutReleased(
        uint256 indexed challengeId,
        address indexed winner,
        address indexed loser,
        address token,
        uint256 winnerStake,
        uint256 loserStake,
        uint256 protocolFee,
        uint256 winnerPayout
    );
    event ChallengeRefunded(
        uint256 indexed challengeId,
        address indexed participant,
        address token,
        uint256 amount
    );

    event NativeWithdrawn(address indexed to, uint256 amount);
    event TokenWithdrawn(address indexed token, address indexed to, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    constructor(address initialOwner, address payable initialTreasury, uint256 initialFeePpm) {
        require(initialOwner != address(0), "Invalid owner");
        require(initialTreasury != address(0), "Invalid treasury");
        require(initialFeePpm <= MAX_FEE_PPM, "Fee too high");

        owner = initialOwner;
        treasury = initialTreasury;
        feePpm = initialFeePpm;

        emit OwnershipTransferred(address(0), initialOwner);
        emit TreasuryUpdated(address(0), initialTreasury);
        emit FeeUpdated(0, initialFeePpm);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid owner");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function setTreasury(address payable newTreasury) external onlyOwner {
        require(newTreasury != address(0), "Invalid treasury");
        emit TreasuryUpdated(treasury, newTreasury);
        treasury = newTreasury;
    }

    function setFeePpm(uint256 newFeePpm) external onlyOwner {
        require(newFeePpm <= MAX_FEE_PPM, "Fee too high");
        emit FeeUpdated(feePpm, newFeePpm);
        feePpm = newFeePpm;
    }

    receive() external payable {
        require(msg.value > 0, "No value");
        emit StakeLockedNative(msg.sender, msg.value);
    }

    // Legacy generic escrow methods.
    function lockStakeNative() external payable returns (bool) {
        require(msg.value > 0, "No value");
        emit StakeLockedNative(msg.sender, msg.value);
        return true;
    }

    function lockStakeToken(address token, uint256 amount) public returns (bool) {
        require(token != address(0), "Invalid token");
        require(amount > 0, "Invalid amount");
        bool ok = IERC20MinimalV2(token).transferFrom(msg.sender, address(this), amount);
        require(ok, "Transfer failed");
        emit StakeLockedToken(msg.sender, token, amount);
        return true;
    }

    function depositToken(address token, uint256 amount) external returns (bool) {
        return lockStakeToken(token, amount);
    }

    // Challenge-aware lock methods for V2 flow.
    function lockStakeNativeForChallenge(uint256 challengeId) external payable returns (bool) {
        require(challengeId > 0, "Invalid challenge");
        require(msg.value > 0, "No value");

        nativeChallengeStakes[challengeId][msg.sender] += msg.value;
        trackedNativeBalance += msg.value;

        emit ChallengeStakeLockedNative(challengeId, msg.sender, msg.value);
        return true;
    }

    function lockStakeTokenForChallenge(
        uint256 challengeId,
        address token,
        uint256 amount
    ) external returns (bool) {
        require(challengeId > 0, "Invalid challenge");
        require(token != address(0), "Invalid token");
        require(amount > 0, "Invalid amount");

        bool ok = IERC20MinimalV2(token).transferFrom(msg.sender, address(this), amount);
        require(ok, "Transfer failed");

        tokenChallengeStakes[challengeId][token][msg.sender] += amount;
        trackedTokenBalances[token] += amount;

        emit ChallengeStakeLockedToken(challengeId, token, msg.sender, amount);
        return true;
    }

    function quoteLoserSideFee(uint256 losingStakeAmount) public view returns (uint256) {
        return (losingStakeAmount * feePpm) / FEE_DENOMINATOR;
    }

    function getNativeChallengeStake(uint256 challengeId, address participant) external view returns (uint256) {
        return nativeChallengeStakes[challengeId][participant];
    }

    function getTokenChallengeStake(
        uint256 challengeId,
        address token,
        address participant
    ) external view returns (uint256) {
        return tokenChallengeStakes[challengeId][token][participant];
    }

    function getTrackedNativeBalance() external view returns (uint256) {
        return trackedNativeBalance;
    }

    function getTrackedTokenBalance(address token) external view returns (uint256) {
        return trackedTokenBalances[token];
    }

    function getAvailableNativeWithdrawBalance() public view returns (uint256) {
        uint256 contractBalance = address(this).balance;
        if (contractBalance <= trackedNativeBalance) return 0;
        return contractBalance - trackedNativeBalance;
    }

    function getAvailableTokenWithdrawBalance(address token) public view returns (uint256) {
        uint256 contractBalance = IERC20MinimalV2(token).balanceOf(address(this));
        uint256 lockedBalance = trackedTokenBalances[token];
        if (contractBalance <= lockedBalance) return 0;
        return contractBalance - lockedBalance;
    }

    function previewNativeSettlement(
        uint256 challengeId,
        address winner,
        address loser
    ) external view returns (uint256 winnerStake, uint256 loserStake, uint256 protocolFee, uint256 winnerPayout) {
        winnerStake = nativeChallengeStakes[challengeId][winner];
        loserStake = nativeChallengeStakes[challengeId][loser];
        protocolFee = quoteLoserSideFee(loserStake);
        winnerPayout = winnerStake + loserStake - protocolFee;
    }

    function previewTokenSettlement(
        uint256 challengeId,
        address token,
        address winner,
        address loser
    ) external view returns (uint256 winnerStake, uint256 loserStake, uint256 protocolFee, uint256 winnerPayout) {
        winnerStake = tokenChallengeStakes[challengeId][token][winner];
        loserStake = tokenChallengeStakes[challengeId][token][loser];
        protocolFee = quoteLoserSideFee(loserStake);
        winnerPayout = winnerStake + loserStake - protocolFee;
    }

    function settleChallengeNativePayout(
        uint256 challengeId,
        address payable winner,
        address loser
    ) external onlyOwner returns (bool) {
        require(challengeId > 0, "Invalid challenge");
        require(winner != address(0), "Invalid winner");
        require(loser != address(0), "Invalid loser");
        require(winner != loser, "Winner and loser must differ");

        uint256 winnerStake = nativeChallengeStakes[challengeId][winner];
        uint256 loserStake = nativeChallengeStakes[challengeId][loser];
        require(winnerStake > 0 || loserStake > 0, "No tracked native stake");

        nativeChallengeStakes[challengeId][winner] = 0;
        nativeChallengeStakes[challengeId][loser] = 0;
        trackedNativeBalance -= (winnerStake + loserStake);

        uint256 protocolFee = quoteLoserSideFee(loserStake);
        uint256 winnerPayout = winnerStake + loserStake - protocolFee;

        if (protocolFee > 0) {
            _transferNative(treasury, protocolFee);
        }
        if (winnerPayout > 0) {
            _transferNative(winner, winnerPayout);
        }

        emit ChallengePayoutReleased(
            challengeId,
            winner,
            loser,
            address(0),
            winnerStake,
            loserStake,
            protocolFee,
            winnerPayout
        );
        return true;
    }

    function settleChallengeTokenPayout(
        uint256 challengeId,
        address token,
        address winner,
        address loser
    ) external onlyOwner returns (bool) {
        require(challengeId > 0, "Invalid challenge");
        require(token != address(0), "Invalid token");
        require(winner != address(0), "Invalid winner");
        require(loser != address(0), "Invalid loser");
        require(winner != loser, "Winner and loser must differ");

        uint256 winnerStake = tokenChallengeStakes[challengeId][token][winner];
        uint256 loserStake = tokenChallengeStakes[challengeId][token][loser];
        require(winnerStake > 0 || loserStake > 0, "No tracked token stake");

        tokenChallengeStakes[challengeId][token][winner] = 0;
        tokenChallengeStakes[challengeId][token][loser] = 0;
        trackedTokenBalances[token] -= (winnerStake + loserStake);

        uint256 protocolFee = quoteLoserSideFee(loserStake);
        uint256 winnerPayout = winnerStake + loserStake - protocolFee;

        if (protocolFee > 0) {
            _transferToken(token, treasury, protocolFee);
        }
        if (winnerPayout > 0) {
            _transferToken(token, winner, winnerPayout);
        }

        emit ChallengePayoutReleased(
            challengeId,
            winner,
            loser,
            token,
            winnerStake,
            loserStake,
            protocolFee,
            winnerPayout
        );
        return true;
    }

    function refundChallengeNative(
        uint256 challengeId,
        address payable participantA,
        address payable participantB
    ) external onlyOwner returns (bool) {
        require(challengeId > 0, "Invalid challenge");
        require(participantA != address(0), "Invalid participant");
        require(participantB != address(0), "Invalid participant");

        uint256 amountA = nativeChallengeStakes[challengeId][participantA];
        uint256 amountB = nativeChallengeStakes[challengeId][participantB];
        require(amountA > 0 || amountB > 0, "No tracked native stake");

        nativeChallengeStakes[challengeId][participantA] = 0;
        nativeChallengeStakes[challengeId][participantB] = 0;
        trackedNativeBalance -= (amountA + amountB);

        if (amountA > 0) {
            _transferNative(participantA, amountA);
            emit ChallengeRefunded(challengeId, participantA, address(0), amountA);
        }
        if (amountB > 0) {
            _transferNative(participantB, amountB);
            emit ChallengeRefunded(challengeId, participantB, address(0), amountB);
        }
        return true;
    }

    function refundChallengeToken(
        uint256 challengeId,
        address token,
        address participantA,
        address participantB
    ) external onlyOwner returns (bool) {
        require(challengeId > 0, "Invalid challenge");
        require(token != address(0), "Invalid token");
        require(participantA != address(0), "Invalid participant");
        require(participantB != address(0), "Invalid participant");

        uint256 amountA = tokenChallengeStakes[challengeId][token][participantA];
        uint256 amountB = tokenChallengeStakes[challengeId][token][participantB];
        require(amountA > 0 || amountB > 0, "No tracked token stake");

        tokenChallengeStakes[challengeId][token][participantA] = 0;
        tokenChallengeStakes[challengeId][token][participantB] = 0;
        trackedTokenBalances[token] -= (amountA + amountB);

        if (amountA > 0) {
            _transferToken(token, participantA, amountA);
            emit ChallengeRefunded(challengeId, participantA, token, amountA);
        }
        if (amountB > 0) {
            _transferToken(token, participantB, amountB);
            emit ChallengeRefunded(challengeId, participantB, token, amountB);
        }
        return true;
    }

    // Backward-compatible settlement signal methods.
    function settleChallenge() public returns (bool) {
        emit ChallengeSettledSignal(msg.sender, 0, 0);
        return true;
    }

    function settleChallenge(uint256 challengeId, uint8 resultCode) public returns (bool) {
        emit ChallengeSettledSignal(msg.sender, challengeId, resultCode);
        return true;
    }

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
        require(getAvailableNativeWithdrawBalance() >= amount, "Amount exceeds available balance");
        _transferNative(to, amount);
        emit NativeWithdrawn(to, amount);
        return true;
    }

    function withdrawToken(address token, address to, uint256 amount) external onlyOwner returns (bool) {
        require(token != address(0), "Invalid token");
        require(to != address(0), "Invalid recipient");
        require(amount > 0, "Invalid amount");
        require(
            getAvailableTokenWithdrawBalance(token) >= amount,
            "Amount exceeds available token balance"
        );
        _transferToken(token, to, amount);
        emit TokenWithdrawn(token, to, amount);
        return true;
    }

    function _transferNative(address payable to, uint256 amount) internal {
        require(address(this).balance >= amount, "Insufficient native balance");
        (bool ok, ) = to.call{ value: amount }("");
        require(ok, "Native transfer failed");
    }

    function _transferToken(address token, address to, uint256 amount) internal {
        bool ok = IERC20MinimalV2(token).transfer(to, amount);
        require(ok, "Token transfer failed");
    }
}
