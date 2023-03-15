const fs = require('fs');
const { generateKeyPair } = require('crypto');
const crypto = require('crypto');
const http = require('http');
const dir = './blockchain-network';
const path = require('path');
const difficulty = 2;
const hrtime = process.hrtime;

module.exports.createBlock = (transactions, port, start, res) => {
		var privateKey = JSON.parse(fs.readFileSync(dir+"/"+port+"/keys.txt").toString()).privateKey;
		var publicKey = JSON.parse(fs.readFileSync(dir+"/"+port+"/keys.txt").toString()).publicKey;
		var sign = signTransaction(transactions, privateKey);
		var block = {
		'type' : 'transaction',
		'blockData' : JSON.parse(transactions),
		'previousBlock' : getLastBlock(port),
		'aggregateSign' : sign,
		'validators' : [publicKey]
		}
		var blockHash = createHash(JSON.stringify(block));
		block.hash = blockHash;
		broadcastBlock(block, port, start, res);
};

getLastBlock = (port) => {
		var ledger = JSON.parse(fs.readFileSync(dir+"/"+port+"/ledger.txt").toString());
		var lastBlock = ledger[ledger.length - 1].hash;

		return lastBlock;
};

genLedgerFile = (pubKey, privKey, port) => {
	var regTransaction = {
		'pubKey' : pubKey,
		'data' : pubKey
	}
	var block = {
		'type' : 'registration',
		'blockData' : [regTransaction],
		'previousBlock' : 0,
		'aggregateSign' : signTransaction(pubKey, privKey),
		'validators' : [pubKey]
	}
	var blockHash = createHash(JSON.stringify(block));
	block.hash = blockHash;
	console.log("genesis block created successfully\n")
	console.log("Creating network files for node at port "+port);
	fs.writeFileSync(dir + "/" + port + "/ledger.txt", JSON.stringify([block]));
	fs.writeFileSync(dir + "/" + port + "/transactions.txt", "[]");
	console.log("ledger file created");
	fs.writeFileSync(dir + "/" + port + "/balance.txt", "100");
}


module.exports.register = (id, timestamp, authToken, port) => {
		const hash = crypto.createHash('sha256')
		// Read the contents of the JSON file
		const deviceId = id
		const temporaryKey = "8kKj0BvFJGlX9fCkwO8JFg==";
		if (temporaryKey) {
		  console.log(`Temporary key for device ${deviceId}: ${temporaryKey}`);
		} else {
		  console.log(`Unauthorized Access - Device ${deviceId} not found`);
		  return { success: false, message: 'Unauthorized Device - Not registered offline', deviceId: id}
		}


		const algorithm = 'secp256k1';
    
    const curve = crypto.createECDH(algorithm);
    const publicKey = curve.generateKeys();
    const secretKey = curve.computeSecret(publicKey);

    const encryptionKey = crypto.randomBytes(32);

    var registration = {
			pubKey: JSON.parse(fs.readFileSync(dir+"/"+port+"/keys.txt").toString()).publicKey,
			data: {
				devicePublicKey: publicKey,
				sharedSecretKey: encryptionKey
			}
		}

		var transactions = JSON.parse(fs.readFileSync(dir+"/"+port+"/transactions.txt").toString())

		transactions.push(registration);

		//SEND TO ALL PEERS

		console.log(registration);

		fs.writeFileSync(dir+"/"+port+"/transactions.txt", JSON.stringify(transactions));

    return { success: true, message: 'Device registered successfully', deviceId: id, publicKey: publicKey, privateKey: secretKey, encryptionKey: encryptionKey };
};

module.exports.createDS = (transaction, privateKey) => {
	return signTransaction(transaction, privateKey);
}

module.exports.verifyDS = (transaction, sign, publicKey) => {
	return verifyTransaction(transaction, sign, publicKey);
}

signTransaction = (transaction, privateKey) => {
	let signer = crypto.createSign('SHA256');
	signer.write(transaction);
	signer.end();
	let signature = signer.sign(privateKey, 'base64');
	return signature;
}

verifyTransaction = (transaction, signature, publicKey) => {
	let verifier = crypto.createVerify('SHA256');
	verifier.update(transaction);
	let ver = verifier.verify(publicKey, signature , 'base64');
	return ver;
}

module.exports.broadcastTransaction = (message, sign, publicKey, port, start, res) => {
	var peers = JSON.parse(fs.readFileSync(dir+"/active.txt").toString());
	var responses = 0;
	for(let peer in peers){
		if(peers[peer] == port){
			continue;
		}
		let url = 'http://localhost:'+peers[peer]+'/transactionListener/'+encodeURIComponent(message)+'/'+encodeURIComponent(sign)+'/'+encodeURIComponent(publicKey);
		console.log("Sending new transaction to peer at: "+peers[peer]);
		http.get(url , (res) => {
			let data = "";
			res.on('data', (chunk) => {
				data += chunk;
			});

			res.on('end', () => {
				responses = responses + 1;
				try{
					if(responses == peers.length-1){
						const end = hrtime();
					  const elapsedTimeInNanoseconds = (end[0] - start[0]) * 1e9 + (end[1] - start[1]);
						const elapsedTimeInMilliseconds = elapsedTimeInNanoseconds / 1e6;
						console.log(`Transaction is received by all peers - Transaction latency ${elapsedTimeInMilliseconds} milliseconds\n`);
					}
				}catch(err){
					// console.log("Response error:"+err);
				}
			});
		}).on('error', (err) => {
			console.log("Error: "+err);
			//PORTS NOT RUNNING WILL THROW ERROR
		})
	}
}

publishValidatedLedger = (ledger, port, start, res) => {
	var peers = JSON.parse(fs.readFileSync(dir+"/active.txt").toString());
	var responses = 0;
	for(let peer in peers){
		let url = 'http://localhost:'+peers[peer]+'/ledgerListener/'+encodeURIComponent(JSON.stringify(ledger));
		console.log("Sending latest ledger state to peer at: "+peers[peer]);
		http.get(url , (res) => {
			let data = "";
			res.on('data', (chunk) => {
				data += chunk;
			});

			res.on('end', () => {
				responses = responses + 1;
				try{
					if(responses == peers.length){
						const end = hrtime();
					  const elapsedTimeInNanoseconds = (end[0] - start[0]) * 1e9 + (end[1] - start[1]);
						const elapsedTimeInMilliseconds = elapsedTimeInNanoseconds / 1e6;
						console.log(`Consensus reached in ${elapsedTimeInMilliseconds} milliseconds\n`);
						console.log(`Ledger state updated\nBlock acceptance time: ${elapsedTimeInMilliseconds} milliseconds\n`);
						res.send(ledger);
					}
				}catch(err){
					// console.log("Response error:"+err);
				}
			});
		}).on('error', (err) => {
			console.log("Error: "+err);
			//PORTS NOT RUNNING WILL THROW ERROR
		})
	}
}

broadcastBlock = (block, port, start, res) => {
	var peers = JSON.parse(fs.readFileSync(dir+"/active.txt").toString());
	var threshold = peers.length/2;
	console.log(peers);
	var validatorsList = [];
	console.log("Minimum number of validators required to accept block: "+threshold);
	var current = 1;
	var flag = false;
	var responses = 0;
	for(let peer in peers){
		if(flag){
			break;
		}
		let url = 'http://localhost:'+peers[peer]+'/blockListener/'+encodeURIComponent(JSON.stringify(block));
		console.log("Sending block to peer at: "+peers[peer]);
		http.get(url , (res) => {
			let data = "";
			res.on('data', (chunk) => {
				data += chunk;
			});

			res.on('end', () => {
				responses = responses + 1;
				try{
					var response = JSON.parse(data);
					var validation = response.isValid;
					if(validation == "true"){
						validatorsList.push(response.publicKey);
						current = current + 1;
						if(responses == peers.length && current >= threshold){
							// console.log("Validators: "+validatorsList);
							console.log("Threashold Consensus Reached\nBlock is accepted by the network\nLedger updated with new block");
							var ledger = JSON.parse(fs.readFileSync(dir+"/"+port+"/ledger.txt").toString());
							block.validators = validatorsList;
							ledger.push(block);
							fs.writeFileSync(dir+"/"+port+"/ledger.txt", JSON.stringify(ledger));
							const end = hrtime();
						  const elapsedTimeInNanoseconds = (end[0] - start[0]) * 1e9 + (end[1] - start[1]);
							const elapsedTimeInMilliseconds = elapsedTimeInNanoseconds / 1e6;
							// console.log(`Consensus reached in ${elapsedTimeInMilliseconds} milliseconds\n`);
							fs.writeFileSync(dir+"/"+port+"/transactions.txt", "[]");
							flag = true;
							//SEND HTTP AGAIN TO ACCEPT BLOCK THEN LOG TIME THERE
							publishValidatedLedger(ledger, port, start, res);
						}
					}
				}catch(err){
					// console.log("Response error:"+err);
				}
			});
		}).on('error', (err) => {
			console.log("Error: "+err);
			//PORTS NOT RUNNING WILL THROW ERROR
		})
	}
}

sendTransaction = (transaction, port, senderPort) => {
	transaction = replaceAll(transaction,'/', '%2F');
	transactionFile = fs.readFileSync(dir+"/"+port+"/transactions.txt",{encoding:'utf8', flag:'r'}).toString();
	if(transactionFile == ""){
		fs.writeFileSync(dir+"/"+port+"/transactions.txt", transaction);
	}
	let url = 'http://localhost:'+senderPort+'/transactionlistener/'+transaction;
	http.get(url , (res) => {
		let data = "";
		res.on('data', (chunk) => {
			data += chunk;
		});

		res.on('end', () => {
			try{
				var reply = JSON.parse(data).ok;
			}catch(err){
				console.log("Neighbor at Port "+senderPort+" is offline");
			}
		});
	}).on('error', (err) => {
		//PORTS NOT RUNNING WILL THROW ERROR
	});
}

submitTransaction = (transaction, port) => {
	var data = fs.readFileSync(dir+"/"+port+"/addressbook.txt",{encoding:'utf8', flag:'r'});
	var address = data.toString().split("\n");
	transaction = replaceAll(transaction,'/', '%2F');
	for(let i=0;i<address.length;i++){
		var nport = address[i].substring(0,4);
		console.log("Sending to peer at port:"+nport);
		if(nport == ''){
			continue;
		}
		let url = 'http://localhost:'+nport+'/transactionlistener/'+transaction;
		http.get(url , (res) => {
			let data = "";
			res.on('data', (chunk) => {
				data += chunk;
			});

			res.on('end', () => {
				try{
					var reply = JSON.parse(data).ok;
				}catch(err){
					console.log("Neighbor at Port "+nport+" is offline");
				}
			});
		}).on('error', (err) => {
			//PORTS NOT RUNNING WILL THROW ERROR
			console.log("Neighbor at Port "+nport+" is offline");
		})
	}
}

module.exports.genFiles = (res, port, start) => {
	var pubKey = "";
	var privKey = "";
	console.log("Creating ECC identity");
	 generateKeyPair('ec', {
    namedCurve: 'secp256k1',
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem'
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem'
    }
  },
	(err, publicKey, privateKey) => {
		if(!err){
			pubKey = publicKey.toString('hex');
			privKey = privateKey.toString('hex');
			keys = {
				'fogId' : port,
				'publicKey' : pubKey,
				'privateKey' : privKey,
				'status' : "active"
			}
			fs.writeFileSync(dir + "/" + port + "/keys.txt", JSON.stringify(keys));
			console.log("Creating genesis block...");
			genLedgerFile(publicKey, privateKey, port);
			console.log("Sending existance message to network...");
			if(port != 3000)
				contactPeers(port,publicKey, port);
			const end = hrtime();
	    const elapsedTimeInNanoseconds = (end[0] - start[0]) * 1e9 + (end[1] - start[1]);
			const elapsedTimeInMilliseconds = elapsedTimeInNanoseconds / 1e6;
			console.log(`Node setup successful. Completed in ${elapsedTimeInMilliseconds} milliseconds\n`);
		}else{
			console.log("Crypto error");
		}
		res.send(keys);
	});
}

module.exports.hash = (transaction) => {
	return crypto.createHash('sha256').update(transaction).digest('hex');
}

createHash = (data) => {
	return crypto.createHash('sha256').update(data).digest('hex');	
}

contactPeers = (portNum, pubKey, port) => {
	var nport = 3000;
	let url = 'http://localhost:3000/exist';
		http.get(url , (res) => {
			let data = "";
			res.on('data', (chunk) => {
				data += chunk;
			});

			res.on('end', () => {
				try{
					var response = JSON.parse(data);
			  	var transactions = response.transactions;
			  	var ledger = response.ledger;
			  	fs.writeFileSync(dir+"/"+port+"/transactions.txt", transactions.toString());
			  	fs.writeFileSync(dir+"/"+port+"/ledger.txt", ledger.toString());
			  	console.log("Updated network state\n");
				}catch(err){
					console.log(err);
					console.log("Response error");
				}
			});
		}).on('error', (err) => {
			//PORTS NOT RUNNING WILL THROW ERROR
			console.log(err);
			console.log("Neighbor at Port "+nport+" is offline");
		});
}

escapeRegExp = (string)=> {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

replaceAll = (str, find, replace) => {
  return str.replace(new RegExp(escapeRegExp(find), 'g'), replace);
}
