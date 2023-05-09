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

app.get('/uploadChunks/:userId/:docId/:doc', (req, res) => {
	var start = hrtime();
	var userId = decodeURIComponent(req.params.userId);
	var docId = decodeURIComponent(req.params.docId);
	var doc = decodeURIComponent(req.params.doc);	
	console.log("Received document chunk for redundant secure upload");
	if(!fs.existsSync(dir+"/"+port+"/"+userId)){
		fs.mkdirSync(dir+"/"+port+"/"+userId);
	}
	fs.writeFileSync(dir+"/"+port+"/"+userId+"/"+docId+".txt", doc);
	console.log("Upload successful");
	const end = hrtime();
  const elapsedTimeInNanoseconds = (end[0] - start[0]) * 1e9 + (end[1] - start[1]);
	const elapsedTimeInMilliseconds = elapsedTimeInNanoseconds / 1e6;
	console.log(`Local Upload Time ${elapsedTimeInMilliseconds} milliseconds\n`);

});

app.get('/registerOnCloud/:block', (req, res) =>{
	if(port >= 5000){
		const start = hrtime();
		console.log("\nNew Aggregate Registration Request Recevied from Fog Private Blockchain...");
		var block = JSON.parse(decodeURIComponent(req.params.block));
		var registrations = [];
		for(var i = 0; i<block.blockData.length;i++){
			registrations.push(block.blockData[i].pubKey);
		}
		var transactions = JSON.parse(fs.readFileSync(dir+"/"+port+"/transactions.txt").toString())
		transactions.push(registrations);
		console.log("Multiple nodes registered into Cloud Blockchain successfully");
		fs.writeFileSync(dir+"/"+port+"/transactions.txt", JSON.stringify(transactions));
		const end = hrtime();
	  const elapsedTimeInNanoseconds = (end[0] - start[0]) * 1e9 + (end[1] - start[1]);
		const elapsedTimeInMilliseconds = elapsedTimeInNanoseconds / 1e6;
		console.log(`Registrations Successful into Cloud Blockchain, took ${elapsedTimeInMilliseconds} milliseconds\n`);
		res.send({status: "ok"});
	}

});

app.get('/upload', (req, res) => {
	if(port >= 5000){
		const start = hrtime();
		var documentId = decodeURIComponent(req.query.docId);
		var doc = decodeURIComponent(req.query.doc);
		var fogId = decodeURIComponent(req.query.fogId);
		var userId = decodeURIComponent(req.query.userId);
		console.log("\nReceived upload request from user:"+userId+" via fog: "+fogId);
		if(utils.isAuthenticated(userId, port)){
			console.log("User is Authenticated Successfully");
			console.log("Segmenting document...\nPerforming Integrity Checks...\nSending document chunks to other cloud providers");
			utils.sendDocumentChunks(documentId, doc, userId, port, start);
			res.send({response: "uploaded"});	
		}else{
			response.send({response: "Unauthorized Device or Fog Node"});
		}
		
	}
});

app.get('/retrieve/:documentId/:userId', (req, res) => {
	if(port >= 5000){
		const start = hrtime();
		var documentId = JSON.parse(decodeURIComponent(req.params.documentId));
		var userId = JSON.parse(decodeURIComponent(req.params.userId));
		console.log("Recevied document retrieval request from userId:"+userId);
		if(utils.isAuthenticated(userId, port)){
			console.log("\nIoT Device Authenticated Successfully");
			var flag = 0;
			try{
				var doc = fs.readFileSync(dir+"/"+port+"/"+userId+"/"+documentId+".txt");
			}catch(err){
				console.log("Error while retriving document:"+ err);
				flag = 1;
			}
			if(flag == 0){
				res.send(doc);
				const end = hrtime();
			  const elapsedTimeInNanoseconds = (end[0] - start[0]) * 1e9 + (end[1] - start[1]);
				const elapsedTimeInMilliseconds = elapsedTimeInNanoseconds / 1e6;
				console.log(`Data fetch from Cloud took ${elapsedTimeInMilliseconds} milliseconds\n`);
				console.log("Sending requested document to Fog Node");
			}else{
				res.send({responseCode: 400});
			}
		}else{
			response.send({response: "Unauthorized Device or Fog Node"});
		}
	}
});

app.get('/retrieveFromCloud', (req, res) => {
	const start = hrtime();
	const {userId, docId} = req.query;
	if(utils.isAuthenticated(userId, port)){
		console.log("\nIoT Device Authenticated Successfully");
		utils.retrieveDataFromCloud(userId, docId, port, start, res);
	}else{
		res.send({ responseCode: "401", response: "Unauthorized", message: "IoT device is not Authenticated to private Blockchain"});
	}
});

app.get('/uploadToCloud', (req, res) => {
	const start = hrtime();
	const {userId, doc, docId} = req.query;
	if(utils.isAuthenticated(userId, port)){
		console.log("\nIoT Device Authenticated Successfully");
		utils.uploadDocToCloud(userId, port, doc, docId, start);
		res.send({responseCode: 200, status: "success"})
	}else{
		res.send({ responseCode: "401", response: "Unauthorized", message: "IoT device is not Authenticated to private Blockchain"});
	}
});

app.get('/register', (req, res) => {
		const start = hrtime();
		console.log("New Device Registration Request Recevied...");
    const { id, timestamp, authToken } = req.query;
    const result = utils.register(id, timestamp, authToken, port, start, res);
});

app.get("/transactionListener/:message/:sign/:publicKey", (req, res) => {
	var message = decodeURIComponent(req.params.message);
	var sign = decodeURIComponent(req.params.sign);
	var publicKey = decodeURIComponent(req.params.publicKey);
	var isVerified = utils.verifyDS(message, sign, publicKey);
	console.log("\nRecevied new transaction");
	if(isVerified){
		console.log("Transaction verified");
		var transactions = JSON.parse(fs.readFileSync(dir+"/"+port+"/transactionsMessages.txt").toString())
		var newTransaction = {
			'publicKey' : publicKey,
			'message' : message,
			'sign' : sign
		}
		transactions.push(newTransaction);
		fs.writeFileSync(dir+"/"+port+"/transactionsMessages.txt", JSON.stringify(transactions));
		res.send({response: 'ok'});
	}else{
		console.log("Transaction is invalid");
		res.send({response: 'failed'});
	}
});

app.get("/transact", (req, res) => {
	const start = hrtime();
	var {publicKey, message, sign} = req.query;
	publicKey = decodeURIComponent(publicKey);
	message = decodeURIComponent(message);
	sign = decodeURIComponent(sign);
	console.log("New transaction received")
	// console.log("publicKey: "+publicKey)
	// console.log("sign: "+ sign);
	if(utils.verifyDS(message, sign, publicKey)){
		console.log("Authnetication Successful")
		console.log("Creating transaction in private blockchain")
		//Broadcast transcation and log end to end communication time
		utils.broadcastTransaction(message, sign, publicKey, port ,start, res);
		// res.send({response: 'ok', status: 'success'});
	}else{
		res.send({responseCode: 401, status: "Unauthorized"})
	}
});

app.get("/deviceTransaction", (req, res) => {
	var {message} = req.query;
	privateKey = "-----BEGIN PRIVATE KEY-----\nMIGEAgEAMBAGByqGSM49AgEGBSuBBAAKBG0wawIBAQQgUZtslVUj1XA+BgmRdPlO\nPO94IVxhMuVEZYt8mLj9MkChRANCAATNeYA2z2BuAV+k6PB2QR1nEsK7Jdgfj3K7\nd1+hN47usWhgWSKi1u7W/qNQmjxtTCLcYz2okKX+Vqg4FSA/Ovd1\n-----END PRIVATE KEY-----\n";
	publicKey = "-----BEGIN PUBLIC KEY-----\nMFYwEAYHKoZIzj0CAQYFK4EEAAoDQgAEzXmANs9gbgFfpOjwdkEdZxLCuyXYH49y\nu3dfoTeO7rFoYFkiotbu1v6jUJo8bUwi3GM9qJCl/laoOBUgPzr3dQ==\n-----END PUBLIC KEY-----\n";
	sign = utils.createDS(message, privateKey);
	utils.makeTransactionRequest(message, sign, publicKey, res);
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

app.get('/createRBlock', (req, res) => {
	const start = hrtime();
	console.log("Registering all devices using aggregated signature and proposing a new block")
	var transactions = JSON.stringify(JSON.parse(fs.readFileSync(dir+"/"+port+"/transactions.txt").toString()));
	var newBlock = utils.createBlock(transactions, port, start, res);
	res.send({responseCode: 200, status: "success"});
});

app.get('/transactions', (req,res) => {
	fs.readFile(dir+"/"+port+"/transactions.txt", (err, data) => {
		ledger = JSON.parse(data);
		res.send(ledger);
	});
});

app.get('/exist', (req, res) => {
	console.log("\nNew peer request received, sending latest network state");
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
		fs.writeFileSync(dir+"/activeClouds.txt", JSON.stringify([]));
	}
	//check if current host (port) folder exists
	if(!fs.existsSync(dir+"/"+port)){
		fs.mkdirSync(dir+"/"+port);
		const start = hrtime();
		console.log("Starting node set up...");
		utils.genFiles(res, port, start);
		var activeNodes = [];
		if(port >= 3000 && port <=3999){
			activeNodes = JSON.parse(fs.readFileSync(dir+"/active.txt").toString());
		}else if(port >= 5000){
			activeNodes = JSON.parse(fs.readFileSync(dir+"/activeClouds.txt").toString())
		}
		activeNodes.push(port);
		if(port >= 3000 && port <= 3999){
			fs.writeFileSync(dir+"/active.txt", JSON.stringify(activeNodes));
		}else if(port >=5000){
			fs.writeFileSync(dir+"/activeClouds.txt", JSON.stringify(activeNodes));
		}
	}else{
		console.log("Node already exists, returning credentials")
		fs.readFile(dir+"/"+port+"/keys.txt", (err, data) => {
			var keys = JSON.parse(data);
			res.send(keys)
		});
	}
});


app.listen(port, () => {
	if(port >= 5000){
		console.log("Cloud Node Started");
		console.log("\nMake requests at http://localhost:"+port+" to connect via this node\n");
		console.log("Use the following paths to interact with this node:\n")
		console.log("/ - Get node status");
		console.log("/upload - Secure upload of given document");
		console.log("/retrieve - Secure retrieval of querried document");
	}else{
		console.log("Fog Node started");
		console.log("\nMake requests at http://localhost:"+port+" to connect via this node\n");
		console.log("Use the following paths to interact with this node:\n")
		console.log("/ - Get node status");
		console.log("/node - View node credentials or register if new node");
		console.log("/ledger - View the blockchain ledger instance");
		console.log("/register? - Device registrations with id, authToken and timestamp");
		console.log("/transact? - Make a transaction in the network with message, sign and public key of initiator");
		console.log("/transactions - View pending transactions")
		console.log("/proposeTBlock - Creates a new block with all pending transactions")
		console.log("/proposeRBlock - Creates a registration block with aggregated signature and sends registrations information to Cloud based Consortium blockchain")
		console.log("/blocks - Shows all blocks received which are pending for threshold validation")
		console.log("/uploadToCloud? - Any authenticated IoT device can upload data to cloud using this API");
		console.log("/retrieveFromCloud? - Any authorized IoT device can access data from the cloud using this API");
		console.log("/manageAuthz - IoT device can manager its data authorizations using this API");
}
});