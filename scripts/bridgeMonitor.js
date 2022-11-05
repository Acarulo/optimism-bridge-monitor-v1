require("dotenv").config();
const {ethers} = require("ethers");
const axios = require("axios");
const fs = require("fs");

const ethereumProvider = new ethers.providers.WebSocketProvider("wss://mainnet.infura.io/ws/v3/" + process.env.INFURA_ETHEREUM_KEY);
const optimismProvider = new ethers.providers.WebSocketProvider("wss://opt-mainnet.g.alchemy.com/v2/" + process.env.ALCHEMY_OPTIMISM_KEY);

const ethereumDeployer = new ethers.Wallet(process.env.PRIVATE_KEY, ethereumProvider);
const optimismDeployer = new ethers.Wallet(process.env.PRIVATE_KEY, optimismProvider);

const bridgeL1Addr = "0x99C9fc46f92E8a1c0deC1b1747d010903E884bE1";
const bridgeL2Addr = "0x4200000000000000000000000000000000000010";
const OVM_ETH = "0xDeadDeAddeAddEAddeadDEaDDEAdDeaDDeAD0000";

const bridgeL1 = new ethers.Contract(bridgeL1Addr, JSON.parse(fs.readFileSync("abis/bridgeL1.json")), ethereumDeployer);
const bridgeL2 = new ethers.Contract(bridgeL2Addr, JSON.parse(fs.readFileSync("abis/bridgeL2.json")), optimismDeployer);

const ETHERSCAN_KEY = process.env.ETHERSCAN_API_KEY;
const OPTISCAN_KEY = process.env.OPTISCAN_API_KEY;

const EVENT_TOPICS = {
    ETH_DEPOSIT_INITIATED: "0x35d79ab81f2b2017e19afb5c5571778877782d7a8786f5907f93b0f4702f4f23",
    ERC20_DEPOSIT_INITIATED: "0x718594027abd4eaed59f95162563e0cc6d0e8d5b86b1c7be8b1b0ac3343d0396",
    WITHDRAWAL_INITIATED: "0x73d170910aba9e6d50b102db522b1dbcd796216f5128b445aa2135272886497e"
}

async function main() {
    console.log("Optimism bridge monitor starts running");

    bridgeL1.on("ETHWithdrawalFinalized", async (from, to, amount, data, event) => {
        console.log("ETH withdrawal finalized on L1");

        const topic1 = ethers.utils.hexZeroPad(ethers.constants.AddressZero, 32);
        const topic2 = ethers.utils.hexZeroPad(OVM_ETH, 32);
        const topic3 = ethers.utils.hexZeroPad(from, 32);

        const requestURL = `https://api.etherscan.io/api?module=logs&action=getLogs&fromBlock=${0}&toBlock=${currentBlock}&address=${bridgeL1Addr}&topic0=${EVENT_TOPICS.WITHDRAWAL_INITIATED}&topic1=${topic1}&topic2=${topic2}&topic3=${topic3}&topicOperator=and&page=1&offset=1000&apikey=${OPTISCAN_KEY}`;

        let response = await axios.get(requestURL);
        response = response.data.result;

        let match = false;
        if(response.length > 0) {
            match = true;
            console.log("No issues found on this bridging operation");

        } else {
            throw new Error("Optimism bridge security compromised");
        }
    });

    bridgeL1.on("ERC20WithdrawalFinalized", async (tokenAddrL1, tokenAddrL2, from, to, amount, data, event) => {
        console.log("ERC20 withdrawal finalized on L1");

        const topic1 = ethers.utils.hexZeroPad(tokenAddrL1, 32);
        const topic2 = ethers.utils.hexZeroPad(tokenAddrL2, 32);
        const topic3 = ethers.utils.hexZeroPad(from, 32);

        const requestURL = `https://api.etherscan.io/api?module=logs&action=getLogs&fromBlock=${0}&toBlock=${currentBlock}&address=${bridgeL1Addr}&topic0=${EVENT_TOPICS.WITHDRAWAL_INITIATED}&topic1=${topic1}&topic2=${topic2}&topic3=${topic3}&topicOperator=and&page=1&offset=1000&apikey=${OPTISCAN_KEY}`;

        let response = await axios.get(requestURL);
        response = response.data.result;

        let match = false;
        if(response.length > 0) {
            match = true;
            console.log("No issues found on this bridging operation");

        } else {
            throw new Error("Optimism bridge security compromised");
        }
    });
    
    bridgeL2.on("DepositFinalized", async (tokenAddrL1, tokenAddrL2, from, to, amount, data, event) => {
        let currentBlock = await ethereumProvider.getBlockNumber();
        let match = false;

        // We need to establish whether the deposit on L1 should have been made in ETH or in any ERC20.
        if(tokenAddrL2 === OVM_ETH) {
            console.log("Finalized ETH Deposit on L2");
            console.log({
                from: from,
                to: to,
                amount: amount
            });

            const topic1 = ethers.utils.hexZeroPad(from, 32);
            const topic2 = ethers.utils.hexZeroPad(to, 32);

            const requestURL = `https://api.etherscan.io/api?module=logs&action=getLogs&fromBlock=${0}&toBlock=${currentBlock}&address=${bridgeL1Addr}&topic0=${EVENT_TOPICS.ETH_DEPOSIT_INITIATED}&topic1=${topic1}&topic2=${topic2}&topicOperator=and&page=1&offset=1000&apikey=${ETHERSCAN_KEY}`;

            let response = await axios.get(requestURL);
            response = response.data.result;

            if(response.length > 0) {
                match = true;
                console.log("No issues found on this bridging operation");

            } else {
                throw new Error("Optimism bridge security compromised");
            }

        } else {
            console.log("Finalized ERC20 Deposit on L2");
            const topic1 = ethers.utils.hexZeroPad(tokenAddrL1, 32);
            const topic2 = ethers.utils.hexZeroPad(tokenAddrL2, 32);
            const topic3 = ethers.utils.hexZeroPad(from, 32);

            const requestURL = `https://api.etherscan.io/api?module=logs&action=getLogs&fromBlock=${0}&toBlock=${currentBlock}&address=${bridgeL1Addr}&topic0=${EVENT_TOPICS.ERC20_DEPOSIT_INITIATED}&topic1=${topic1}&topic2=${topic2}&topic3=${topic3}&topicOperator=and&page=1&offset=1000&apikey=${ETHERSCAN_KEY}`;

            let response = await axios.get(requestURL);
            response = response.data.result;

            if(response.length > 0) {
                match = true;
                console.log("No issues found on this bridging operation");

            } else {
                throw new Error("Optimism bridge security compromised");
            }
        }
    });

    setInterval(() => console.log("Optimism bridge operating correctly"), 10000);
}

main();