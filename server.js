// Requirements
const fs = require('fs')
const readlines = require('n-readlines')
const csvwriter = require('csv-writer')
const radixdlt = require('radixdlt')

// Initialize the testing Universe
radixdlt.radixUniverse.bootstrap(radixdlt.RadixUniverse.ALPHANET)

const RadixIdentityManager = radixdlt.RadixIdentityManager
const RadixAccount = radixdlt.RadixAccount
const RadixTransactionBuilder = radixdlt.RadixTransactionBuilder

const csvReader = new readlines('res/dataset0.csv')
const csvWriter = csvwriter.createObjectCsvWriter
const identityManager = new RadixIdentityManager()

const BUS_IDS = [ '110', '226', '371', '422', '426', '484', '512', '639', '650', '889' ]
const BUS_IDENTITIES = []
const BUS_ACCOUNTS = []
const MASTER_IDENTITY = identityManager.generateSimpleIdentity()
const MASTER_ACCOUNT = MASTER_IDENTITY.account
const APPLICATION_ID = 'radixdlt-iotsimulation'

var statistics = []



// ------------ INIT ------------

// Connect master to the network
MASTER_ACCOUNT.openNodeConnection()

for (var i = 0; i < BUS_IDS.length; i++) {
  // Create new bus account for each bus id
  BUS_IDENTITIES.push(identityManager.generateSimpleIdentity())
  BUS_ACCOUNTS.push(BUS_IDENTITIES[i].account)
  // Connect the bus account to the network
  BUS_ACCOUNTS[i].openNodeConnection()
}

// ------------ RUN TEST ------------

const run = async () => {
  try {
    var lineCounter = 0

    csvReader.next() // get rid of header line
    while (line = csvReader.next()) {
      row = line.toString('ascii').split(',')
      console.log('Waiting ' + row[0] + ' seconds for bus ' + row[1])
      await sleep(parseInt(row[0]) * 1000)

      statistics.push({
        counter: lineCounter++,
        startTime: -1,
        powTime: -1,
        endTime: -1,
        totTime: -1,
        powExecTime: -1,
        latencyTime: -1
      })
      submitAtom(lineCounter-1, row[1], row[2], row[3])
    }

    console.log('SIMULATION COMPLETED')

    // Print out results
    await sleep(4000) // Wait for the last pending submitted atoms
    printResults()
    console.log('Test results printed out')
  } catch (error) {
    console.error(error)
  }
}
run()

function sleep(ms) {
  return new Promise(res => { setTimeout(res, ms) })
}

async function submitAtom(lineCounter, busId, lat, lon) {
  const busIndex = BUS_IDS.indexOf(row[1])

  const payload = JSON.stringify({
    message: 'Coordinates bus: ' + busId,
    data: {
      latitude: lat,
      longitude: lon,
      timestampISO: new Date().toISOString()
    }
  })

  statistics[lineCounter].startTime = Date.now()

  var transactionStatus = null
  try {
    transactionStatus = RadixTransactionBuilder
                        .createPayloadAtom([BUS_ACCOUNTS[busIndex], MASTER_ACCOUNT], APPLICATION_ID, payload)
                        .signAndSubmit(BUS_IDENTITIES[busIndex])
  } catch(error) {
    console.error('An error occured while building transaction')
  }

  transactionStatus.subscribe({
    next: status => {
      if(status == 'GENERATING_POW') statistics[lineCounter].powTime = Date.now()
    },
    complete: () => {
      console.log('SUCCESS: Transaction has been stored on the ledger')
      statistics[lineCounter].endTime = Date.now()
      statistics[lineCounter].totTime = statistics[lineCounter].endTime - statistics[lineCounter].startTime
      statistics[lineCounter].powExecTime = statistics[lineCounter].endTime - statistics[lineCounter].powTime
      statistics[lineCounter].latencyTime = statistics[lineCounter].totTime - statistics[lineCounter].powExecTime
    },
    error: error => {
      console.error('ERROR: Error submitting transaction', error)
    }
  })
}

function printResults() {
  const writer = csvWriter({
    path: 'res/output' + process.argv[2] + '.csv',
    header: [
        { id: 'counter', title: 'Counter' },
        { id: 'startTime', title: 'Start time' },
        { id: 'powTime', title: 'POW time' },
        { id: 'endTime', title: 'End time' },
        { id: 'totTime', title: 'Start to End time' },
        { id: 'powExecTime', title: 'POW execution time' },
        { id: 'latencyTime', title: 'Latency time' }
    ]
  })

  writer.writeRecords(statistics).then(() => { console.log('Statistics printed out') })
}

// List of messages sent to Master in receving order
// MASTER_ACCOUNT.dataSystem.applicationData.get(APPLICATION_ID)
