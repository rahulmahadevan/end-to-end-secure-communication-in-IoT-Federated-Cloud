const express = require('express');
const path = require('path');
const fs = require('fs');
const utils = require('./utils.js');
const app = express();
const dir = './blockchain-network';
var pubK = "";
var privK = "";
const args = process.argv.slice(2);
const port = args[0];
const hrtime = process.hrtime;


app.get('/',(req,res) => {
	response = {
		'fogId' : port,
		'connection' : "success"
	}
	res.send(response);	
});

app.get('/register', (req, res) => {
		const start = hrtime();
		console.log("New Device Registration Request Recevied...");
    const { id, timestamp, authToken } = req.query;
    const result = utils.register(id, timestamp, authToken, port);
    const end = hrtime();
    const elapsedTimeInNanoseconds = (end[0] - start[0]) * 1e9 + (end[1] - start[1]);
		const elapsedTimeInMilliseconds = elapsedTimeInNanoseconds / 1e6;
		console.log('Registration Successful')
		console.log(`Registration time: ${elapsedTimeInMilliseconds} milliseconds\n`);
    res.send(result);
});

app.get("/transactionListener/:message/:sign/:publicKey", (req, res) => {
	var message = decodeURIComponent(req.params.message);
	var sign = decodeURIComponent(req.params.sign);
	var publicKey = decodeURIComponent(req.params.publicKey);
	var isVerified = utils.verifyDS(message, sign, publicKey);
	if(isVerified){
		console.log("Transaction verified");
		var transactions = JSON.parse(fs.readFileSync(dir+"/"+port+"/transactions.txt").toString())
		var newTransaction = {
			'publicKey' : publicKey,
			'message' : message,
			'sign' : sign
		}
		transactions.push(newTransaction);
		console.log('New transaction: '+newTransaction);
		fs.writeFileSync(dir+"/"+port+"/transactions.txt", JSON.stringify(transactions));
		res.send({response: 'ok'});
	}else{
		console.log("Transaction is invalid");
		res.send({response: 'failed'});
	}
});

app.get("/transact", (req, res) => {
	const start = hrtime();
	console.log("New transaction created, broadcasting this transaction in the network")
	var {message} = req.query;
	var privateKey = JSON.parse(fs.readFileSync(dir+"/"+port+"/keys.txt").toString()).privateKey;
	var publicKey = JSON.parse(fs.readFileSync(dir+"/"+port+"/keys.txt").toString()).publicKey;
	var sign = utils.createDS(message, privateKey);
	var transactions = JSON.parse(fs.readFileSync(dir+"/"+port+"/transactions.txt").toString())
	var newTransaction = {
		'publicKey' : publicKey,
		'message' : message,
		'sign' : sign
	}
	transactions.push(newTransaction);
	console.log('New transaction: '+newTransaction);
	fs.writeFileSync(dir+"/"+port+"/transactions.txt", JSON.stringify(transactions));
	utils.broadcastTransaction(message, sign, publicKey, port, start, res);
	res.send({response: 'ok', status: 'success'});
});

app.get("/LedgerListener/:block", (req, res) => {
	var ledgerData = decodeURIComponent(req.params.block);
	var ledger = JSON.parse(ledgerData);
	fs.writeFileSync(dir+"/"+port+"/ledger.txt", JSON.stringify(ledger));
	res.send({
		statusCode: 200,
		statusMessage: "ok"
	});
});


app.get("/blockListener/:block", (req, res) => {
	var blockData = decodeURIComponent(req.params.block);
	var block = JSON.parse(blockData);
	var hash = block.hash;
	delete block.hash;
	var blockHash = utils.hash(JSON.stringify(block));
	var valid = "false";
	console.log("Recevied a new block for validation");
	if(blockHash == hash){
		valid = "true";
		console.log("Validation successful, updating aggregate signature");
		block.hash = hash;
		block.validators.push(JSON.parse(fs.readFileSync(dir+"/"+port+"/keys.txt").toString()).publicKey)
		res.send({
			isValid : "true",
			publicKey: JSON.parse(fs.readFileSync(dir+"/"+port+"/keys.txt").toString()).publicKey
		})
	}else{
		res.send({
			isValid: valid
		});
	}
});

app.get('/mineBlock', (req, res) => {
	const start = hrtime();
	console.log("Mining new block and waiting for approval")
	var transactions = JSON.stringify(JSON.parse(fs.readFileSync(dir+"/"+port+"/transactions.txt").toString()));
	var newBlock = utils.createBlock(transactions, port, start, res);
});

app.get('/transactions', (req,res) => {
	fs.readFile(dir+"/"+port+"/transactions.txt", (err, data) => {
		ledger = JSON.parse(data);
		res.send(ledger);
	});
});

app.get('/exist', (req, res) => {
	console.log("New peer request received, sending latest network state");
	var response = {
		'transactions' : fs.readFileSync(dir+"/"+port+"/transactions.txt").toString(),
		'ledger' : fs.readFileSync(dir+"/"+port+"/ledger.txt").toString()
	}
	res.send(response);
});


app.get('/ledger', (req,res) => {
	fs.readFile(dir+"/"+port+"/ledger.txt", (err, data) => {
		ledger = JSON.parse(data);
		res.send(ledger);
	});
});

app.get('/node', (req,res) => {
	if(!fs.existsSync(dir)){
		fs.mkdirSync(dir);
		fs.writeFileSync(dir+"/active.txt", JSON.stringify([]));
	}
	//check if current host (port) folder exists
	if(!fs.existsSync(dir+"/"+port)){
		fs.mkdirSync(dir+"/"+port);
		const start = hrtime();
		console.log("Starting node set up...");
		utils.genFiles(res, port, start);
		var activeNodes = JSON.parse(fs.readFileSync(dir+"/active.txt").toString());
		activeNodes.push(port);
		fs.writeFileSync(dir+"/active.txt", JSON.stringify(activeNodes));
	}else{
		console.log("Node already exists, returning credentials")
		fs.readFile(dir+"/"+port+"/keys.txt", (err, data) => {
			var keys = JSON.parse(data);
			res.send(keys)
		});
	}
});


app.listen(port, () => {
	console.log("Fog Node started");
	console.log("\nMake requests at http://localhost:"+port+" to connect via this node\n");
	console.log("Use the following paths to interact with this node:\n")
	console.log("/ - Get node status");
	console.log("/node - View node credentials or register if new node");
	console.log("/ledger - View the blockchain ledger instance");
	console.log("/register? - Device registrations with id, authToken and timestamp");
	console.log("/transact? - Make a transaction in the network with message, sign and public key of initiator");
	console.log("/transactions - View pending transactions")
	console.log("/mineBlock - Creates a new block with all pending transactions")
	console.log("/blocks - Shows all blocks received which are pending for threshold validation")
});