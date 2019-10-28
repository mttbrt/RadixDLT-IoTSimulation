const fs = require('fs')
const request = require('request')
const radixdlt = require('radixdlt')

const radixUniverse = radixdlt.radixUniverse
const RadixUniverse = radixdlt.RadixUniverse
const RadixIdentityManager = radixdlt.RadixIdentityManager
const RadixRemoteIdentity = radixdlt.RadixRemoteIdentity
const RadixTransactionBuilder = radixdlt.RadixTransactionBuilder
const RadixKeyStore = radixdlt.RadixKeyStore

const APPLICATION_ID = 'methk_testing'
var remoteIdentity
var loaded = false
var movie = ''

const identityManager = new RadixIdentityManager()

function createNewMovie(movie_name, movie_token_symbol, movie_description, movie_poster_url, movie_url, movie_price) {
  request.post({
      headers: { 'content-type': 'application/json' },
      url: 'http://localhost:3001/admin/movie',
      body: JSON.stringify({
              name : movie_name,
              symbol: movie_token_symbol,
              description: movie_description,
              posterUrl : movie_poster_url,
              contentUrl : movie_url,
              price : movie_price
            })
  },  function (error, response, body) {
        if (!error && response.statusCode == 200)
          console.log(body)
        else
          console.error(error)
  })
}

async function createNewIdentity() {
  radixUniverse.bootstrap(RadixUniverse.LOCALHOST_SINGLENODE)

  const keystorePath = 'keystore_client.json'
  const keystorePassword = `radix123`

  if (fs.existsSync(keystorePath)) {
    // Load account
    const contents = JSON.parse(fs.readFileSync(keystorePath, 'utf8'));
    const address = await RadixKeyStore.decryptKey(contents, keystorePassword)

    const identity = identityManager.addSimpleIdentity(address)
    await identity.account.openNodeConnection()

    console.log('Loaded identity')

    remoteIdentity = identity
    tryWatching()
  } else {
    const identity = identityManager.generateSimpleIdentity()
    await identity.account.openNodeConnection()
    const contents = await RadixKeyStore.encryptKey(identity.address, keystorePassword)
    await fs.writeFile(keystorePath, JSON.stringify(contents), 'utf8', () => {})

    console.log('Generated new identity')

    remoteIdentity = identity
  }

  console.log("Address: " + remoteIdentity.address.getAddress());

  // // This request needs to be approved in the wallet
  // RadixRemoteIdentity.createNew(APPLICATION_ID, 'Testing Radix tokens').then((newIdentity) => {
  //   newIdentity.account.openNodeConnection()
  //   remoteIdentity = newIdentity
  // })
  // .then(() => { // TODO eliminare
  //   tryWatching()
  // })
}

function getMovies() {
  request.get({
      headers: { 'content-type': 'application/json' },
      url: 'http://localhost:3001/movies'
  },  function (error, response, body) {
        if (!error && response.statusCode == 200)
          console.log(body)
        else
          console.error(error)
  })
}

function tryWatching() {
  request.get({
      headers: { 'content-type': 'application/json' },
      url: 'http://localhost:3001/request-access'
  },  function (error, response, body) {
        if (!error && response.statusCode == 200) {
          const challenge = response.body
          // Construct and sign the atom
          const data = {challenge}
          const atom = RadixTransactionBuilder.createPayloadAtom(
                        remoteIdentity.account,
                        [remoteIdentity.account],
                        APPLICATION_ID,
                        JSON.stringify(data),
                        false)
                      .buildAtom()
          remoteIdentity.signAtom(atom).then((signedAtom) => {
            request.post({
                headers: { 'content-type': 'application/json' },
                url: 'http://localhost:3001/movie',
                body: JSON.stringify({
                        movieTokenUri: '/JHbWGWHChGjiBRDgBhnUSBCi96Vv6qR3aVT6JYokfN8WKuwB6Qn/A2',
                        atom: atom.toJSON()
                      })
            },  function (error, response, body) {
                  if (!error && response.statusCode == 200) {
                    loaded = true
                    movie = response.body
                    console.log(movie)
                  } else {
                    loaded = true
                    console.log(body)

                    //buyMovie()
                  }
            })
          })
        } else
          console.error(error)
  })
}

function buyMovie() {
  request.post({
      headers: { 'content-type': 'application/json' },
      url: 'http://localhost:3001/admin/buy-movie',
      body: JSON.stringify({
              tokenUri: '/JHbWGWHChGjiBRDgBhnUSBCi96Vv6qR3aVT6JYokfN8WKuwB6Qn/A2',
              address: remoteIdentity.address.getAddress()
            })
  },  function (error, response, body) {
        if (!error && response.statusCode == 200)
          console.log(body)
        else
          console.error(error)
  })
}

/*
NOTE:
L'admin che iniserisce un nuovo film ne è automaticamente già proprietario (come se l'avesse comprato)
*/

/*
createNewMovie( 'Prova A',
                'A3',
                'Questa è una prova',
                'https://www.clipartwiki.com/clipimg/detail/49-498796_rick-clipart-portal-rick-and-morty-png-portal.png',
                'https://www.youtube.com/watch?v=Rw6BrzB1drs',
                '1'
              )
*/

createNewIdentity()
getMovies()
