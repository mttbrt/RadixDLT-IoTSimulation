const fs = require('fs')
const request = require('request')
const radixdlt = require('radixdlt')
const express = require('express')
const path = require('path')

const app = express()

const radixUniverse = radixdlt.radixUniverse
const RadixUniverse = radixdlt.RadixUniverse
const RadixIdentityManager = radixdlt.RadixIdentityManager
const RadixRemoteIdentity = radixdlt.RadixRemoteIdentity
const RadixTransactionBuilder = radixdlt.RadixTransactionBuilder
const RadixAccount = radixdlt.RadixAccount
const RadixKeyStore = radixdlt.RadixKeyStore
const RadixTokenManager = radixdlt.RadixTokenManager
const identityManager = new RadixIdentityManager()

const PORT = 8000
const KEYSTORE_PATH = 'keystore_client.json'
const KEYSTORE_PASSWORD = 'radix123'
const APPLICATION_ID = 'methk'

var radixToken
var clientIdentity
var clientBalance

main()
async function main() {
  radixUniverse.bootstrap(RadixUniverse.LOCALHOST_SINGLENODE)
  radixToken = radixUniverse.nativeToken

  await createServerIdentity()

  // TODO il server inoltra al client indirizzo del bus e chiave di decifratura.
  // con l'indirizzo del bus il client ottiene l'account ed effettua il subscribe ai messaggi
  // con la chiave di decifratura ci decifra il contenuto dei messaggi
  await sendMessage()
  await sendMessage()
}

async function createServerIdentity() {
  if (fs.existsSync(KEYSTORE_PATH)) {
    // Load account
    const contents = JSON.parse(fs.readFileSync(KEYSTORE_PATH, 'utf8'));
    const address = await RadixKeyStore.decryptKey(contents, KEYSTORE_PASSWORD)

    const identity = identityManager.addSimpleIdentity(address)
    await identity.account.openNodeConnection()

    clientIdentity = identity
    console.log('Loaded identity')
  } else {
    // Create new account
    const identity = identityManager.generateSimpleIdentity()
    await identity.account.openNodeConnection()
    const contents = await RadixKeyStore.encryptKey(identity.address, KEYSTORE_PASSWORD)
    await fs.writeFile(KEYSTORE_PATH, JSON.stringify(contents), 'utf8', () => {})

    clientIdentity = identity
    console.log('Generated new identity')
  }

  console.log("Address: " + clientIdentity.address.getAddress())
  await getMoney()
}

async function getMoney() {
  const faucetAccount = RadixAccount.fromAddress('JH1P8f3znbyrDj8F4RWpix7hRkgxqHjdW2fNnKpR3v6ufXnknor', true)
  const message = 'Gimme my money'
  RadixTransactionBuilder.createRadixMessageAtom(clientIdentity.account, faucetAccount, message).signAndSubmit(clientIdentity)

  clientIdentity.account.transferSystem.getTokenUnitsBalanceUpdates().subscribe(balance => {
    clientBalance = parseInt(balance[radixToken.toString()])
    console.log(balance)
  })
}

// TODO da scorporare tra server, client e simulation
async function sendMessage() {
  // Questo deve farlo il client prendendo l'account dell'autobus a partire dall'indirizzo
  const identityA = identityManager.generateSimpleIdentity()
  const accountA = identityA.account
  accountA.openNodeConnection()

  const message = 'Hello World!'

  const transactionStatus = RadixTransactionBuilder
    .createRadixMessageAtom(accountA, clientIdentity.account, message)
    .signAndSubmit(identityA)

  transactionStatus.subscribe({
    complete: () => { console.log('Transaction complete') },
    error: error => { console.error('Error submitting transaction', error) }
  })

  accountA.messagingSystem.messageSubject.subscribe(transactionUpdate => {
    console.log('Transaction:')
    console.log(transactionUpdate)
  })
}


app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname + '/GUI/index.html'));
})

app.get('/buses', (req, res) => {
  request.get({
      headers: { 'content-type': 'application/json' },
      url: 'http://localhost:3001/buses'
  },  function (error, response, body) {
        if (!error && response.statusCode == 200)
          res.json(JSON.parse(body))
        else
          res.send(error)
  })
})

app.get('/bus', (req, res) => {
  request.get({
      headers: { 'content-type': 'application/json' },
      url: 'http://localhost:3001/request-access'
  },  function (error, response, body) {
        if (!error && response.statusCode == 200) {
          const challenge = response.body
          // Construct and sign the atom
          const data = {challenge}
          const atom = RadixTransactionBuilder.createPayloadAtom(
                        clientIdentity.account,
                        [clientIdentity.account],
                        APPLICATION_ID,
                        JSON.stringify(data),
                        false)
                      .buildAtom()
          clientIdentity.signAtom(atom).then((signedAtom) => {
            request.post({
                headers: { 'content-type': 'application/json' },
                url: 'http://localhost:3001/bus',
                body: JSON.stringify({
                        busTokenUri: req.query.id,
                        atom: atom.toJSON()
                      })
            },  function (error, response, body) {
                  if (!error && response.statusCode == 200)
                    res.json(JSON.parse(response.body))
                  else
                    res.send(response.body)
            })
          })
        } else
          console.error(error)
  })
})

app.get('/subscribe', (req, res) => {
  const busAccount = RadixAccount.fromAddress('JHvbGGm3hxUaQ733ZVeqYDKhAhSEF3fZJXm3MQNWDea1ie7sVem', true)

  if(clientBalance >= 2) {
    const transactionStatus = RadixTransactionBuilder
      .createTransferAtom(clientIdentity.account, busAccount, radixToken, 2)
      .signAndSubmit(clientIdentity)

    transactionStatus.subscribe({
      complete: () => {
        console.log('Successfully paid 2 RDX')

        request.post({
            headers: { 'content-type': 'application/json' },
            url: 'http://localhost:3001/subscribe',
            body: JSON.stringify({
                    tokenUri: req.query.id,
                    address: clientIdentity.address.getAddress()
                  })
        },  function (error, response, body) {
              if (!error && response.statusCode == 200)
                res.send(response.body)
              else
                res.send(response.body)
        })
      },
      error: error => { console.error('Error submitting transaction', error) }
    })
  } else
    res.send('Insufficient funds')
})

// -------------- ADMIN --------------
app.get('/add-bus', (req, res) => {
  var bus_name = "A2"
  var bus_token_symbol = "A2"
  var bus_description = "A2"
  var bus_icon_url = "https://image.flaticon.com/icons/svg/61/61985.svg"
  var bus_pos = "secret"
  var bus_price = "1"

  request.post({
      headers: { 'content-type': 'application/json' },
      url: 'http://localhost:3001/add-bus',
      body: JSON.stringify({
              name : bus_name,
              symbol: bus_token_symbol,
              description: bus_description,
              price : bus_price,
              iconUrl : bus_icon_url,
              busPos : bus_pos
            })
  },  function (error, response, body) {
        if (!error && response.statusCode == 200)
          res.send(response.body)
        else
          res.send(response.body)
  })

  /*
  request.post({
      headers: { 'content-type': 'application/json' },
      url: 'http://localhost:3001/add-bus',
      body: JSON.stringify({
              name : req.body.bus_name,
              symbol: req.body.bus_token_symbol,
              description: req.body.bus_description,
              posterUrl : req.body.bus_icon_url,
              contentUrl : req.body.bus_url,
              price : req.body.bus_price
            })
  },  function (error, response, body) {
        if (!error && response.statusCode == 200)
          res.send(response.body)
        else
          res.send(response.body)
  })
  */
})

app.listen(PORT, () => console.log(`Client app listening on port ${PORT}!`))
