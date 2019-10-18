// Requirements
const fs = require('fs')
const readlines = require('n-readlines')
const csvwriter = require('csv-writer')
const express = require('express')
const radixdlt = require('radixdlt')

const radixUniverse = radixdlt.radixUniverse
const ALPHANET = radixdlt.RadixUniverse.ALPHANET
const RadixIdentityManager = radixdlt.RadixIdentityManager
const RadixAccount = radixdlt.RadixAccount
const RadixTransactionBuilder = radixdlt.RadixTransactionBuilder

const app = express()
const liner = new readlines('res/dataset.csv')
const csvWriter = csvwriter.createObjectCsvWriter;
// Initialize the (testing) universe
radixUniverse.bootstrap(ALPHANET)
const identityManager = new RadixIdentityManager()

const PORT = 8000
const BUS_IDS = [ '110', '226', '371', '422', '426', '484', '512', '639', '650', '889' ]
const BUS_IDENTITIES = []
const BUS_ACCOUNTS = []
const MASTER_IDENTITY = identityManager.generateSimpleIdentity()
const MASTER_ACCOUNT = MASTER_IDENTITY.account
const APPLICATION_ID = 'radixdlt-iotsimulation'

var statistics = []
var submissionIndex = 0; // index of the last submitted atom to Radix
var submittedIndex = 0; // index of the last successfully atom stored on Radix

init()

// Create an account for each bus
function init() {
  // Connect master to the network
  MASTER_ACCOUNT.openNodeConnection()

  for (var i = 0; i < BUS_IDS.length; i++) {
    // Create new bus account for each bus id
    BUS_IDENTITIES.push(identityManager.generateSimpleIdentity())
    BUS_ACCOUNTS.push(BUS_IDENTITIES[i].account)
    // Connect account to the network
    BUS_ACCOUNTS[i].openNodeConnection()
  }
}

function sleep(ms) {
  return new Promise(resolve => { setTimeout(resolve,ms) })
}

function submitAtom(busId, lat, lon) {
  const busIndex = BUS_IDS.indexOf(row[1])

  const payload = JSON.stringify({
    message: 'Coordinates bus: ' + busId,
    data: {
      latitude: lat,
      longitude: lon,
      timestampISO: new Date().toISOString()
    }
  })

  statistics[submissionIndex++].startTime = Date.now()

  var transactionStatus
  try {
    transactionStatus = RadixTransactionBuilder
                              .createPayloadAtom([BUS_ACCOUNTS[busIndex], MASTER_ACCOUNT], APPLICATION_ID, payload)
                              .signAndSubmit(BUS_IDENTITIES[busIndex])
  } catch(error) {
    // TODO Far stampare -1 nell'output
  }

  // TODO gestire anche la callback per il tempo di inizio del PoW
  transactionStatus.subscribe({
    next: status => {},
    complete: () => {
      console.log('SUCCESS: Transaction has been stored on the ledger')
      var si = submittedIndex++
      statistics[si].endTime = Date.now()
      statistics[si].totTime = statistics[si].endTime - statistics[si].startTime
    },
    error: error => {
      console.error('ERROR: Error submitting transaction', error)
      var si = submittedIndex++
      statistics[si].endTime = "ERROR"
      statistics[si].totTime = "ERROR"
    }
  })
}


app.get('/run', (req, res) => {
  runTest()

  async function runTest() {
    try {
      var lineCounter = 0

      liner.next() // get rid of header line
      while (line = liner.next()) {
        row = line.toString('ascii').split(',')
        console.log('Waiting ' + row[0] + ' seconds for bus ' + row[1])
        await sleep(parseInt(row[0]) * 1000)

        statistics.push({
          counter: lineCounter++,
          startTime: -1,
          endTime: -1,
          totTime: -1
        })
        submitAtom(row[1], row[2], row[3])
      }

      res.send('Simulation completed')
    } catch (error) {
      console.error(error)
    }
  }
})

app.get('/', (req, res) => {
  const busAddresses = 'MASTER address: ' + MASTER_ACCOUNT.getAddress() + '<br/><br/>'
  for (var i = 0; i < BUS_ACCOUNTS.length; i++)
    busAddresses += 'Bus ID: ' + BUS_IDS[i] + ' - Address: ' + BUS_ACCOUNTS[i].getAddress() + '<br/>'

  res.send(busAddresses)
})

// List of messages to Master in receving order
app.get('/getData', (req, res) => {
  res.send(MASTER_ACCOUNT.dataSystem.applicationData.get(APPLICATION_ID))
})

// List of messages to Master in receving order
app.get('/stats', (req, res) => {
  var slowest = -1;
  var fastest = 100000000;

  var stats = '<table style="width:30%" cellpadding="10"><tr> <th>Id</th> <th>Start time</th> <th>End time</th> <th>Total time</th> </tr>'
  for (var i = 0; i < statistics.length; i++) {
    stats +=  '<tr> ' +
              '<td>' + statistics[i].counter + '</td> ' +
              '<td>' + statistics[i].startTime + '</td> ' +
              '<td>' + statistics[i].endTime + '</td> ' +
              '<td>' + statistics[i].totTime + '</td> </tr>'
    if(statistics[i].totTime > slowest)
      slowest = statistics[i].totTime
    if(statistics[i].totTime < fastest)
      fastest = statistics[i].totTime
  }

  stats += '</table>'

  stats += '<br/><br/> <table style="width:30%"><tr> <th>Fastest time</th> <th>Slowest time</th> </tr>'
  stats += '<tr> <td>' + fastest + '</td> <td>' + slowest + '</td> </tr>'

  // Print out CVS file with statistics results
  const writer = csvWriter({
    path: 'res/output.csv',
    header: [
        { id: 'counter', title: 'Counter' },
        { id: 'startTime', title: 'Start time' },
        { id: 'endTime', title: 'End time' },
        { id: 'totTime', title: 'Total time' }
    ]
  })

  writer.writeRecords(statistics).then(() => { res.send(stats) })
})

app.listen(PORT, () => console.log(`Example app listening on port ${PORT}!`))
