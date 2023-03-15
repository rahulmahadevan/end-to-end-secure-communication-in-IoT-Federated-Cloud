# end-to-end-secure-communication-in-IoT-Federated-Cloud

To install this project in your local machine, perform the following steps:
1. Clone the repository
2. Goto the code location and run >npm init
3. To start the blockchain network, create a new node using the command >npm start 300. This will create a new node at port 3000.
4. Similarily, create few more nodes with different port numbers

Use the following APIs from a port to interact with the blockchain network:

/ - Get node status
/node - View node credentials or register if new node
/ledger - View the blockchain ledger instance
/register? - Device registrations with id, authToken and timestamp
/transact? - Make a transaction in the network with message, sign and public key of initiator
/transactions - View pending transactions
/mineBlock - Creates a new block with all pending transactions
/blocks - Shows all blocks received which are pending for threshold validation

This project simulates a private blockchain environment in any local machine. This is used for research purposes and was carried out to study end-to-end communication in IoT systems as part of Master's Thesis at National Institute of Technology, Warangal, Telangana, IN. 

Developed by:  R S Rahul Mahadevan,
Under the Guidance of: Dr. E Suresh Babu, Assistant Professor, Dept. of Computer Science and Engineering, National Instutute of Technology Warangal
