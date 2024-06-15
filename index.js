import { Wallet, providers, utils, Contract } from "ethers";
import readline from "readline";
import fs from "fs";
import path from "path";
import { config } from "dotenv";

config();

const tokenContractAddresses = {
  dzook: "0xda879470d70845Da9efbD4884C8149a6Df4e50A1",
  viva: "0xf93D24c03344B5e697ad83D59cAa1c5817973365",
};
const provider = new providers.JsonRpcProvider("https://rpc1.bahamut.io");

// *** CALLING ZONE ***

// await oneToMany();
await manyToOne(["dzook", "viva"]);

// === === === === ===

async function oneToMany() {
  console.log("🏃‍♀️ One-to-Many tranfering...");

  const wallets = await getWallets();
  const signer = new Wallet(process.env.PRIVATE_KEY, provider);

  for (let index = 0; index < wallets.length; index++) {
    const wallet = wallets[index];
    const privateKey = wallet._signingKey().privateKey;
    const balance = await new Wallet(privateKey, provider).getBalance();
    const shouldTransfer = balance._hex === "0x00";

    if (!shouldTransfer) continue;

    console.log(`Transfering ${index + 1}`);

    await signer
      .sendTransaction({
        to: wallet.address,
        value: utils.parseUnits("0.001"),
      })
      .then((tx) => {
        console.log(`✅ Tranfered to ${tx?.to} - Hash: ${tx?.hash}`);
      });
  }
}

async function manyToOne(tokens) {
  console.log("🏃‍♀️ Many-to-One tranfering...");

  const destinationAddress = new Wallet(process.env.PRIVATE_KEY, provider)
    .address;
  const transferAbi = [
    // Read-Only Functions
    "function balanceOf(address owner) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)",

    // Authenticated Functions
    "function transfer(address to, uint amount) returns (bool)",

    // Events
    "event Transfer(address indexed from, address indexed to, uint amount)",
  ];
  const wallets = await getWallets();

  for (let index = 0; index < wallets.length; index++) {
    const wallet = wallets[index];

    for (let j = 0; j < tokens.length; j++) {
      const token = tokens[j];
      const privateKey = wallet._signingKey().privateKey;
      const ownerAddress = wallet.address;
      const tokenAddress = tokenContractAddresses[token];
      const signer = new Wallet(privateKey, provider);
      const contract = new Contract(tokenAddress, transferAbi, signer);
      const balance = await getTokenBalance(tokenAddress, ownerAddress);
      const shouldTransfer = balance._hex !== "0x00";

      if (!shouldTransfer) continue;

      console.log(`Transfering ${token} - ${index + 1}`);

      await contract.transfer(destinationAddress, balance).then((tx) => {
        console.log(`✅ Tranfered to ${tx.to} - Hash: ${tx.hash}`);
      });
    }
  }
}

async function getTokenBalance(tokenAddress, ownerAddress) {
  const balanceABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)",

    // Authenticated Functions
    "function transfer(address to, uint amount) returns (bool)",

    // Events
    "event Transfer(address indexed from, address indexed to, uint amount)",
  ];
  const tokenContract = new Contract(tokenAddress, balanceABI, provider);
  const balance = await tokenContract.balanceOf(ownerAddress);

  return balance;
}

async function getAllTokenBalances(ownerAddress) {
  const balances = {};

  for (const token in tokenContractAddresses) {
    const tokenAddress = tokenContractAddresses[token];
    const balance = await getTokenBalance(tokenAddress, ownerAddress);
    balances[token] = balance;
  }

  return balances;
}

async function getWallets() {
  const mnemonics = await getMnemonics();

  return mnemonics.map((mnemonic) => Wallet.fromMnemonic(mnemonic));
}

function getMnemonics() {
  const walletPath = path.resolve("wallet.txt");

  return new Promise((resolve, reject) => {
    const file = readline.createInterface({
      input: fs.createReadStream(walletPath),
    });
    const mnemonics = [];

    file.on("line", (line) => {
      mnemonics.push(line);
    });

    file.on("close", () => {
      resolve(mnemonics.filter((mne) => mne));
    });

    file.on("error", (error) => {
      reject(error);
    });
  });
}
