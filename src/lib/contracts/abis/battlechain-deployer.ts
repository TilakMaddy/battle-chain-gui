export const battleChainDeployerAbi = [
  {
    type: "function",
    name: "deployCreate2",
    inputs: [
      { name: "salt", type: "bytes32", internalType: "bytes32" },
      { name: "bytecode", type: "bytes", internalType: "bytes" },
    ],
    outputs: [{ name: "", type: "address", internalType: "address" }],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "deployCreate3",
    inputs: [
      { name: "salt", type: "bytes32", internalType: "bytes32" },
      { name: "bytecode", type: "bytes", internalType: "bytes" },
    ],
    outputs: [{ name: "", type: "address", internalType: "address" }],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "deployCreate",
    inputs: [{ name: "bytecode", type: "bytes", internalType: "bytes" }],
    outputs: [{ name: "", type: "address", internalType: "address" }],
    stateMutability: "payable",
  },
  // --- New entries from generated ABI ---
  {
    type: "function",
    name: "computeCreateAddress",
    inputs: [{ name: "nonce", type: "uint256", internalType: "uint256" }],
    outputs: [{ name: "computedAddress", type: "address", internalType: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "computeCreate2Address",
    inputs: [
      { name: "salt", type: "bytes32", internalType: "bytes32" },
      { name: "initCodeHash", type: "bytes32", internalType: "bytes32" },
    ],
    outputs: [{ name: "computedAddress", type: "address", internalType: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "computeCreate3Address",
    inputs: [{ name: "salt", type: "bytes32", internalType: "bytes32" }],
    outputs: [{ name: "computedAddress", type: "address", internalType: "address" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "ContractCreation",
    inputs: [
      { name: "newContract", type: "address", indexed: true, internalType: "address" },
      { name: "salt", type: "bytes32", indexed: true, internalType: "bytes32" },
    ],
    anonymous: false,
  },
] as const;
