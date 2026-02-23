export const safeHarborRegistryAbi = [
  {
    type: "function",
    name: "adoptSafeHarbor",
    inputs: [{ name: "agreementAddress", type: "address", internalType: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "isAgreementValid",
    inputs: [{ name: "agreementAddress", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "view",
  },
] as const;
