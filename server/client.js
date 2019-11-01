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
var purchasedKeys = []

main()
async function main() {
  radixUniverse.bootstrap(RadixUniverse.LOCALHOST_SINGLENODE)
  radixToken = radixUniverse.nativeToken

  await createServerIdentity()
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

  // Get money from faucet
  const faucetAccount = RadixAccount.fromAddress('JH1P8f3znbyrDj8F4RWpix7hRkgxqHjdW2fNnKpR3v6ufXnknor')
  const message = 'Send me 10 RDX please'
  RadixTransactionBuilder.createRadixMessageAtom(clientIdentity.account, faucetAccount, message).signAndSubmit(clientIdentity)

  clientIdentity.account.transferSystem.getTokenUnitsBalanceUpdates().subscribe(balance => {
    clientBalance = parseInt(balance[radixToken.toString()])
    console.log(balance)
  })
}

function decrypt(text: string, key: string, iv: string) {
  let encryptedText = Buffer.from(text, 'hex');
  let decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key, 'hex'), Buffer.from(iv, 'hex'));
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted.toString();
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
                  if (!error && response.statusCode == 200) {
                    var resJson = JSON.parse(response.body)
                    var busId = resJson.name.split(" ")[1]

                    var flag = true
                    for (var i = 0; i < purchasedKeys.length; i++) {
                      if(purchasedKeys[i].busId == busId)
                        flag = false
                    }
                    if(flag)
                      purchasedKeys.push({
                        busId: busId,
                        data: JSON.parse(resJson.busSecret)
                      })

                    res.json(resJson)
                  } else
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
      .createTransferAtom(clientIdentity.account, busAccount, radixToken, 2, req.query.id)
      .signAndSubmit(clientIdentity)

    transactionStatus.subscribe({
      complete: () => {
        console.log('Successfully paid 2 RDX')
      },
      error: error => { console.error('Error submitting transaction', error) }
    })
  } else
    res.send('Insufficient funds')
})

app.listen(PORT, () => console.log(`Client app listening on port ${PORT}!`))
