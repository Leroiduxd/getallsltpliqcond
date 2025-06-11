const express = require('express');
const { ethers } = require('ethers');
require('dotenv').config();

const app = express();
const port = process.env.PORT;

const RPC_URL = 'https://testnet.dplabs-internal.com';
const CONTRACT_ADDRESS = '0xbb24da1f6aaa4b0cb3ff9ae971576790bb65673c';

const ABI = [
  {
    "inputs": [],
    "name": "getAllConditionalOrders",
    "outputs": [
      { "internalType": "uint256[]", "name": "orderIds", "type": "uint256[]" },
      { "internalType": "uint256[]", "name": "assetIndexes", "type": "uint256[]" },
      { "internalType": "uint256[]", "name": "targetPrices", "type": "uint256[]" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getAllLiquidationPrices",
    "outputs": [
      { "internalType": "uint256[]", "name": "positionIds", "type": "uint256[]" },
      { "internalType": "uint256[]", "name": "assetIndexes", "type": "uint256[]" },
      { "internalType": "uint256[]", "name": "prices", "type": "uint256[]" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getAllStopLosses",
    "outputs": [
      { "internalType": "uint256[]", "name": "positionIds", "type": "uint256[]" },
      { "internalType": "uint256[]", "name": "assetIndexes", "type": "uint256[]" },
      { "internalType": "uint256[]", "name": "prices", "type": "uint256[]" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getAllTakeProfits",
    "outputs": [
      { "internalType": "uint256[]", "name": "positionIds", "type": "uint256[]" },
      { "internalType": "uint256[]", "name": "assetIndexes", "type": "uint256[]" },
      { "internalType": "uint256[]", "name": "prices", "type": "uint256[]" }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

app.get('/all', async (req, res) => {
  try {
    const [
      conditionalOrders,
      liquidationPrices,
      stopLosses,
      takeProfits
    ] = await Promise.all([
      contract.getAllConditionalOrders(),
      contract.getAllLiquidationPrices(),
      contract.getAllStopLosses(),
      contract.getAllTakeProfits()
    ]);

    res.json({
      conditionalOrders: {
        orderIds: conditionalOrders[0].map(n => n.toString()),
        assetIndexes: conditionalOrders[1].map(n => n.toString()),
        targetPrices: conditionalOrders[2].map(n => n.toString())
      },
      liquidationPrices: {
        positionIds: liquidationPrices[0].map(n => n.toString()),
        assetIndexes: liquidationPrices[1].map(n => n.toString()),
        prices: liquidationPrices[2].map(n => n.toString())
      },
      stopLosses: {
        positionIds: stopLosses[0].map(n => n.toString()),
        assetIndexes: stopLosses[1].map(n => n.toString()),
        prices: stopLosses[2].map(n => n.toString())
      },
      takeProfits: {
        positionIds: takeProfits[0].map(n => n.toString()),
        assetIndexes: takeProfits[1].map(n => n.toString()),
        prices: takeProfits[2].map(n => n.toString())
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, () => {
  console.log(`🟢 Brokex API running on port ${port}`);
});

