export const agreementAbi = [
  {
    type: "function",
    name: "extendCommitmentWindow",
    inputs: [{ name: "newCantChangeUntil", type: "uint256", internalType: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getDetails",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "tuple",
        internalType: "struct AgreementDetails",
        components: [
          { name: "protocolName", type: "string", internalType: "string" },
          {
            name: "contactDetails",
            type: "tuple[]",
            internalType: "struct Contact[]",
            components: [
              { name: "name", type: "string", internalType: "string" },
              { name: "contact", type: "string", internalType: "string" },
            ],
          },
          {
            name: "chains",
            type: "tuple[]",
            internalType: "struct ScopeChain[]",
            components: [
              { name: "caip2ChainId", type: "string", internalType: "string" },
              { name: "assetRecoveryAddress", type: "string", internalType: "string" },
              {
                name: "accounts",
                type: "tuple[]",
                internalType: "struct ScopeAccount[]",
                components: [
                  { name: "accountAddress", type: "string", internalType: "string" },
                  { name: "childContractScope", type: "uint8", internalType: "enum ChildContractScope" },
                ],
              },
            ],
          },
          {
            name: "bountyTerms",
            type: "tuple",
            internalType: "struct BountyTerms",
            components: [
              { name: "bountyPercentage", type: "uint256", internalType: "uint256" },
              { name: "bountyCapUsd", type: "uint256", internalType: "uint256" },
              { name: "retainable", type: "bool", internalType: "bool" },
              { name: "identity", type: "uint8", internalType: "enum IdentityRequirements" },
              { name: "diligenceRequirements", type: "string", internalType: "string" },
              { name: "aggregateBountyCapUsd", type: "uint256", internalType: "uint256" },
            ],
          },
          { name: "agreementURI", type: "string", internalType: "string" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getAssetRecoveryAddress",
    inputs: [{ name: "caip2ChainId", type: "string", internalType: "string" }],
    outputs: [{ name: "", type: "string", internalType: "string" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isContractInScope",
    inputs: [{ name: "contractAddress", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "owner",
    inputs: [],
    outputs: [{ name: "", type: "address", internalType: "address" }],
    stateMutability: "view",
  },
] as const;
