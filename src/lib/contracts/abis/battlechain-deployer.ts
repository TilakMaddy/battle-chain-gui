export const battleChainDeployerAbi = [
  {
    type: "function",
    name: "deployCreate2",
    inputs: [
      { name: "salt", type: "bytes32", internalType: "bytes32" },
      { name: "bytecode", type: "bytes", internalType: "bytes" },
    ],
    outputs: [{ name: "", type: "address", internalType: "address" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "deployCreate3",
    inputs: [
      { name: "salt", type: "bytes32", internalType: "bytes32" },
      { name: "bytecode", type: "bytes", internalType: "bytes" },
    ],
    outputs: [{ name: "", type: "address", internalType: "address" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "deployCreate",
    inputs: [{ name: "bytecode", type: "bytes", internalType: "bytes" }],
    outputs: [{ name: "", type: "address", internalType: "address" }],
    stateMutability: "nonpayable",
  },
] as const;
