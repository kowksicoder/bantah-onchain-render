// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title BantahLaunchToken
 * @notice Minimal fixed-supply ERC20 for BantahBro token launches.
 *         The full supply is minted to the chosen owner at deployment.
 */
contract BantahLaunchToken {
    string public name;
    string public symbol;
    uint8 public immutable decimals;
    uint256 public immutable totalSupply;
    address public owner;
    address public immutable launcher;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    constructor(
        string memory tokenName,
        string memory tokenSymbol,
        uint8 tokenDecimals,
        address initialOwner,
        uint256 initialSupply
    ) {
        require(bytes(tokenName).length > 0, "Name required");
        require(bytes(tokenSymbol).length > 0, "Symbol required");
        require(initialOwner != address(0), "Invalid owner");
        require(initialSupply > 0, "Supply required");

        name = tokenName;
        symbol = tokenSymbol;
        decimals = tokenDecimals;
        owner = initialOwner;
        launcher = msg.sender;
        totalSupply = initialSupply;

        balanceOf[initialOwner] = initialSupply;
        emit OwnershipTransferred(address(0), initialOwner);
        emit Transfer(address(0), initialOwner, initialSupply);
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 currentAllowance = allowance[from][msg.sender];
        require(currentAllowance >= amount, "Insufficient allowance");
        unchecked {
            allowance[from][msg.sender] = currentAllowance - amount;
        }
        emit Approval(from, msg.sender, allowance[from][msg.sender]);
        _transfer(from, to, amount);
        return true;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid owner");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function renounceOwnership() external onlyOwner {
        emit OwnershipTransferred(owner, address(0));
        owner = address(0);
    }

    function _transfer(address from, address to, uint256 amount) internal {
        require(to != address(0), "Invalid recipient");
        uint256 fromBalance = balanceOf[from];
        require(fromBalance >= amount, "Insufficient balance");
        unchecked {
            balanceOf[from] = fromBalance - amount;
        }
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
    }
}

/**
 * @title BantahTokenFactory
 * @notice Factory called by the BantahBro AgentKit wallet to launch user-owned tokens.
 */
contract BantahTokenFactory {
    uint256 public launchCount;
    mapping(uint256 => address) public tokenByLaunchId;
    mapping(address => bool) public isBantahLaunchToken;

    event TokenLaunched(
        uint256 indexed launchId,
        address indexed token,
        address indexed owner,
        address launcher,
        string name,
        string symbol,
        uint8 decimals,
        uint256 initialSupply
    );

    function launchToken(
        string calldata tokenName,
        string calldata tokenSymbol,
        uint8 tokenDecimals,
        address initialOwner,
        uint256 initialSupply
    ) external returns (address tokenAddress) {
        require(bytes(tokenName).length <= 80, "Name too long");
        require(bytes(tokenSymbol).length <= 16, "Symbol too long");
        require(tokenDecimals <= 18, "Decimals too high");

        BantahLaunchToken token = new BantahLaunchToken(
            tokenName,
            tokenSymbol,
            tokenDecimals,
            initialOwner,
            initialSupply
        );

        launchCount += 1;
        tokenAddress = address(token);
        tokenByLaunchId[launchCount] = tokenAddress;
        isBantahLaunchToken[tokenAddress] = true;

        emit TokenLaunched(
            launchCount,
            tokenAddress,
            initialOwner,
            msg.sender,
            tokenName,
            tokenSymbol,
            tokenDecimals,
            initialSupply
        );
    }
}
