// Requirements
const fs = require('fs')
const readlines = require('n-readlines')
const csvWriter = require('csv-writer')
const express = require('express')

const radixUniverse = require('radixdlt').radixUniverse
const ALPHANET = require('radixdlt').RadixUniverse.ALPHANET
const RadixIdentityManager = require('radixdlt').RadixIdentityManager
const RadixAccount = require('radixdlt').RadixAccount
const RadixTransactionBuilder = require('radixdlt').RadixTransactionBuilder

const app = express()
const liner = new readlines('res/datasetFAKE.csv')
// Initialize the (testing) universe
radixUniverse.bootstrap(ALPHANET)
const identityManager = new RadixIdentityManager()

const PORT = 8000
// const BUS_IDS = [ '110', '226', '371', '422', '426', '484', '512', '639', '650', '889' ]
const BUS_IDS = [ '110', '226', '371', '422', '426', '484', '512', '639', '650', '889' ]
const BUS_IDENTITIES = []
const BUS_ACCOUNTS = []
const MASTER_IDENTITY = identityManager.generateSimpleIdentity()
const MASTER_ACCOUNT = MASTER_IDENTITY.account

init()

// Create an account for each bus
function init() {
  // Connect master to the network
  MASTER_ACCOUNT.openNodeConnection()

  for (var i = 0; i < BUS_IDS.length; i++) {
    // Create new bus account
    BUS_IDENTITIES.push(identityManager.generateSimpleIdentity())
    BUS_ACCOUNTS.push(BUS_IDENTITIES[i].account)
    // Connect account to the network
    BUS_ACCOUNTS[i].openNodeConnection()
  }
}

function sleep(ms) {
  return new Promise(resolve => { setTimeout(resolve,ms) })
}



app.get('/run', (req, res) => {
  try {
    while (line = liner.next()) {
      row = line.toString('ascii').split(',')
      console.log('Waiting ' + row[0] + ' seconds for bus ' + row[1])
      //await sleep(parseInt(row[0]) * 1000)
    }

    console.log('Simulation completed')
  } catch (error) {
    console.log(error)
  }
})

// TODO: inviare messaggi (atomi customizzati?) al master da parte dei bus

/*
Atomo generico

const applicationId = 'my-test-app'

const payload = JSON.stringify({
  message: 'Hello World!',
  otherData: 123
})

const transactionStatus = RadixTransactionBuilder
  .createPayloadAtom([myAccount, toAccount], applicationId, payload)
  .signAndSubmit(myIdentity)
*/






/*const radixUniverse = require('radixdlt').radixUniverse
const ALPHANET = require('radixdlt').RadixUniverse.ALPHANET
const RadixIdentityManager = require('radixdlt').RadixIdentityManager
const RadixAccount = require('radixdlt').RadixAccount
const RadixTransactionBuilder = require('radixdlt').RadixTransactionBuilder

// Initialize the (testing) universe
radixUniverse.bootstrap(ALPHANET)
const identityManager = new RadixIdentityManager()

// Create Alice account
const aliceIdentity = identityManager.generateSimpleIdentity()
const aliceAccount = aliceIdentity.account
// Connect the account to the network
aliceAccount.openNodeConnection()

// Create Alice account
const bobIdentity = identityManager.generateSimpleIdentity()
const bobAccount = bobIdentity.account
// Connect the account to the network
bobAccount.openNodeConnection()

console.log('Alice\'s address: ', aliceAccount.getAddress())
console.log('Bob\'s address: ', bobAccount.getAddress())

// Subscribe for any new incoming message
aliceAccount.messagingSystem.getAllMessages().subscribe(messageUpdate => {
  console.log(messageUpdate)
})

bobAccount.messagingSystem.getAllMessages().subscribe(messageUpdate => {
  console.log(messageUpdate)
})



app.get('/', (req, res) => {
  const data = 'Alice\'s address is ' + aliceAccount.getAddress() +
  '<br/>Bob\'s address is ' + bobAccount.getAddress()

  res.send(data)
})

// Send messages
app.get('/AtoB', (req, res) => {
  const message = 'Hi, I\'m Alice!'

  console.log(Date.now())
  const messageStatus = RadixTransactionBuilder
                            .createRadixMessageAtom(aliceAccount, bobAccount, message)
                            .signAndSubmit(aliceIdentity)

  messageStatus.subscribe({
    next: status => {
      // console.log(status)
      // For a valid transaction, this will print, 'FINDING_NODE', 'GENERATING_POW', 'SIGNING', 'STORE', 'STORED'
    },
    complete: () => {
      console.log('SUCCESS: Transaction has been stored on the ledger')
      console.log(Date.now())
    },
    error: error => { console.error('Error submitting transaction', error) }
  })
})

app.get('/BtoA', (req, res) => {
  const message = 'Hi, I\'m Bob!'

  console.log(Date.now())
  const messageStatus = RadixTransactionBuilder
                            .createRadixMessageAtom(bobAccount, aliceAccount, message)
                            .signAndSubmit(bobIdentity)

  messageStatus.subscribe({
    next: status => {
      // console.log(status)
      // For a valid transaction, this will print, 'FINDING_NODE', 'GENERATING_POW', 'SIGNING', 'STORE', 'STORED'
    },
    complete: () => {
      console.log('SUCCESS: Transaction has been stored on the ledger')
      console.log(Date.now())
    },
    error: error => { console.error('Error submitting transaction', error) }
  })
})

// Radix chat messages grouped by the other address
app.get('/chats', (req, res) => {
  res.send(aliceAccount.messagingSystem.chats)
})

// A list of Radix chat messages in the order of receivng them
app.get('/messages', (req, res) => {
  res.send(aliceAccount.messagingSystem.messages)
})*/


app.listen(PORT, () => console.log(`Example app listening on port ${PORT}!`))
