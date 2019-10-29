const fs = require('fs')
const request = require('request')
const radixdlt = require('radixdlt')
const express = require('express')

const app = express()
const radixUniverse = radixdlt.radixUniverse
const RadixUniverse = radixdlt.RadixUniverse
const RadixIdentityManager = radixdlt.RadixIdentityManager
const RadixRemoteIdentity = radixdlt.RadixRemoteIdentity
const RadixTransactionBuilder = radixdlt.RadixTransactionBuilder
const RadixKeyStore = radixdlt.RadixKeyStore
const identityManager = new RadixIdentityManager()

const PORT = 8000
const KEYSTORE_PATH = 'keystore_client.json'
const KEYSTORE_PASSWORD = 'radix123'
const APPLICATION_ID = 'methk'
var clientIdentity


async function createNewIdentity() {
  radixUniverse.bootstrap(RadixUniverse.LOCALHOST_SINGLENODE)

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

  console.log("Address: " + clientIdentity.address.getAddress());
}
await createNewIdentity()

app.get('/movies', (req, res) => {
  request.get({
      headers: { 'content-type': 'application/json' },
      url: 'http://localhost:3001/movies'
  },  function (error, response, body) {
        if (!error && response.statusCode == 200)
          res.json(JSON.parse(body))
        else
          res.send(error)
  })
})

app.get('/movie', (req, res) => {
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
                url: 'http://localhost:3001/movie',
                body: JSON.stringify({
                        movieTokenUri: req.query.id,
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

app.get('/buy-movie', (req, res) => {
  request.post({
      headers: { 'content-type': 'application/json' },
      url: 'http://localhost:3001/admin/buy-movie',
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
})

app.post('/add-movie', (req, res) => {
  request.post({
      headers: { 'content-type': 'application/json' },
      url: 'http://localhost:3001/admin/movie',
      body: JSON.stringify({
              name : req.body.movie_name,
              symbol: req.body.movie_token_symbol,
              description: req.body.movie_description,
              posterUrl : req.body.movie_poster_url,
              contentUrl : req.body.movie_url,
              price : req.body.movie_price
            })
  },  function (error, response, body) {
        if (!error && response.statusCode == 200)
          res.send(response.body)
        else
          res.send(response.body)
  })
})

app.listen(PORT, () => console.log(`Client app listening on port ${PORT}!`))
