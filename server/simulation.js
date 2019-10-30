const radixdlt = require('radixdlt')
const readlines = require('n-readlines')
const request = require('request')

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

    while (line = csvReader.next()) {
      row = line.toString('ascii').split(',')
      console.log('Waiting ' + row[0] + ' seconds for bus ' + row[1])

      await sleep(parseInt(row[0]) * 1000)
      updateBusPosition(row[1], row[2], row[3])
    }

    console.log('SIMULATION COMPLETED!')
  } catch (error) {
    console.error(error)
  }
}

async function updateBusPosition(busId, lat, lng) {
  request.post({
      headers: { 'content-type': 'application/json' },
      url: 'http://localhost:3001/update-bus',
      body: JSON.stringify({
              bus: "A2",
              lat: lat,
              lng: lng
            })
  },  function (error, response, body) {
        if (!error && response.statusCode == 200)
          console.log(response.body)
        else
          console.log(response.body)
  })
}

async function main() {
  radixUniverse.bootstrap(RadixUniverse.LOCALHOST_SINGLENODE)

  await createBusesIdentities()

  await sleep(2000)
  await runSimulation()
}
main()
