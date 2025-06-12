const express = require('express');
const { ethers } = require('ethers');
const WebSocket = require('ws');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
const port = process.env.PORT;

const RPC_URL = 'https://testnet.dplabs-internal.com';
const CONTRACT_ADDRESS = '0xbb24da1f6aaa4b0cb3ff9ae971576790bb65673c';
const API_KEY = process.env.API_KEY;

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

function withinTolerance(wsPrice, targetPrice) {
  const diff = Math.abs(wsPrice - targetPrice);
  return diff / targetPrice <= 0.001;
}

async function triggerAction(type, id, index) {
  try {
    if (type === 3) {
      await fetch('https://limitexecuteur-production.up.railway.app/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY
        },
        body: JSON.stringify({ orderId: parseInt(id), index: parseInt(index) })
      });
    } else {
      await fetch('http://closeontarget-production.up.railway.app/close-position', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY
        },
        body: JSON.stringify({ positionId: parseInt(id), assetIndex: parseInt(index), closeType: type })
      });
    }
  } catch (error) {
    console.error("Erreur d'appel API externe:", error.message);
  }
}

app.get('/check-prices', async (req, res) => {
  try {
    const [
      conditional,
      liquidation,
      stopLoss,
      takeProfit
    ] = await Promise.all([
      contract.getAllConditionalOrders(),
      contract.getAllLiquidationPrices(),
      contract.getAllStopLosses(),
      contract.getAllTakeProfits()
    ]);

    const indexes = new Set([
      ...conditional[1],
      ...liquidation[1],
      ...stopLoss[1],
      ...takeProfit[1]
    ].map(x => x.toString()));

    const socket = new WebSocket("wss://wss-production-9302.up.railway.app");

    socket.onmessage = async (event) => {
      const data = JSON.parse(event.data);
      const matched = [];

      for (const [_, payload] of Object.entries(data)) {
        const item = payload?.instruments?.[0];
        const assetIndex = payload?.id?.toString();
        if (!item || !indexes.has(assetIndex)) continue;

        const wsPrice = parseFloat(item.currentPrice) * 1e18;

        stopLoss[0].forEach((id, i) => {
          if (stopLoss[1][i].toString() === assetIndex && withinTolerance(wsPrice, stopLoss[2][i].toString())) {
            matched.push({ positionId: id.toString(), assetIndex, type: 0 });
            triggerAction(0, id.toString(), assetIndex);
          }
        });
        takeProfit[0].forEach((id, i) => {
          if (takeProfit[1][i].toString() === assetIndex && withinTolerance(wsPrice, takeProfit[2][i].toString())) {
            matched.push({ positionId: id.toString(), assetIndex, type: 1 });
            triggerAction(1, id.toString(), assetIndex);
          }
        });
        liquidation[0].forEach((id, i) => {
          if (liquidation[1][i].toString() === assetIndex && withinTolerance(wsPrice, liquidation[2][i].toString())) {
            matched.push({ positionId: id.toString(), assetIndex, type: 2 });
            triggerAction(2, id.toString(), assetIndex);
          }
        });
        conditional[0].forEach((id, i) => {
          if (conditional[1][i].toString() === assetIndex && withinTolerance(wsPrice, conditional[2][i].toString())) {
            matched.push({ positionId: id.toString(), assetIndex, type: 3 });
            triggerAction(3, id.toString(), assetIndex);
          }
        });
      }

      socket.close();
      res.json({ matched });
    };

    socket.onerror = (err) => {
      res.status(500).json({ error: 'WebSocket error', detail: err.message });
    };

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, () => {
  console.log(`🟢 Brokex AutoChecker API live on port ${port}`);
});
