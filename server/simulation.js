const radixdlt = require('radixdlt')
const readlines = require('n-readlines')

const radixUniverse = radixdlt.radixUniverse
const RadixUniverse = radixdlt.RadixUniverse
const RadixIdentityManager = radixdlt.RadixIdentityManager
const RadixTransactionBuilder = radixdlt.RadixTransactionBuilder
const identityManager = new RadixIdentityManager()
const csvReader = new readlines('data/dataset.csv')

const APPLICATION_ID = 'methk'
const BUS_IDS = [ '110', '226', '371', '422', '426', '484', '512', '639', '650', '889' ]
const BUS_IDENTITIES = [], BUS_ACCOUNTS = []

var clientIdentity

function sleep(ms) {
  return new Promise(res => { setTimeout(res, ms) })
}

async function createBusesIdentities() {
  for (var i = 0; i < BUS_IDS.length; i++) {
    // Create new bus account for each bus id
    BUS_IDENTITIES.push(identityManager.generateSimpleIdentity())
    BUS_ACCOUNTS.push(BUS_IDENTITIES[i].account)
    // Connect the bus account to the network
    BUS_ACCOUNTS[i].openNodeConnection()
  }
}

async function runSimulation() {
  try {
    csvReader.next() // get rid of header line

    BUS_ACCOUNTS[3].dataSystem.getApplicationData(APPLICATION_ID).subscribe((payload) => {
      console.log(payload)
    })

    while (line = csvReader.next()) {
      row = line.toString('ascii').split(',')
      console.log('Waiting ' + row[0] + ' seconds for bus ' + row[1])

      await sleep(parseInt(row[0]) * 1000)
      storeBusUpdate(row[4], row[1], row[2], row[3])
    }

    console.log('SIMULATION COMPLETED!')
  } catch (error) {
    console.error(error)
  }
}

async function storeBusUpdate(counter, busId, lat, lon) {
  const busIndex = BUS_IDS.indexOf(row[1])

  const payload = JSON.stringify({
    message: 'Coordinates bus: ' + busId,
    data: {
      latitude: lat,
      longitude: lon,
      timestampISO: new Date().toISOString()
    }
  })

  var transactionStatus = null
  try {
    transactionStatus = RadixTransactionBuilder
                          .createPayloadAtom(
                              BUS_ACCOUNTS[busIndex],
                              [BUS_ACCOUNTS[busIndex]],
                              APPLICATION_ID,
                              payload,
                              true
                          ).signAndSubmit(BUS_IDENTITIES[busIndex])
  } catch(error) {
    console.error('ERROR: Error occured while building transaction')
    console.error(error)
  }

  const subscription = transactionStatus.subscribe({
    complete: () => {
      subscription.unsubscribe()
      console.log('SUCCESS: Transaction has been stored on the ledger')
    },
    error: error => {
      subscription.unsubscribe()
      console.error('ERROR: Error submitting transaction')
    }
  })
}

async function main() {
  radixUniverse.bootstrap(RadixUniverse.LOCALHOST_SINGLENODE)

  await createBusesIdentities()

  await sleep(2000)
  await runSimulation()
}
main()
