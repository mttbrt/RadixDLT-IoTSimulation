import express from 'express';
import models, { connectDb } from './models';
import uuidv4 from 'uuid';
import {RadixSerializer, RadixAtom, RadixMessageParticle, RadixAccount, RadixKeyStore, RadixIdentityManager, RadixIdentity, RadixTransactionBuilder, RRI, radixUniverse, RadixUniverse} from 'radixdlt'
import fs from 'fs-extra'
import BN from 'bn.js'
import cors from 'cors'
import bodyParser from 'body-parser'

const app: express.Application = express();
const port: number = Number(process.env.PORT) || 3001;
app.use(cors())
app.use(bodyParser.json())

let identity: RadixIdentity

radixUniverse.bootstrap(RadixUniverse.LOCALHOST_SINGLENODE)

connectDb()
.then(() => {
  return loadIdentity()
}).then(_identity => {
  identity = _identity
  subscribeForPurchases()

  app.listen(port, (err: Error) => {
    if (err) {
      console.error(err);
    } else {
      console.log('NODE_ENV =', process.env.NODE_ENV)
    }
  });
})

// Store and recover account
const identityManager = new RadixIdentityManager()
const keystorePath = 'keystore_server.json'
const keystorePassword = 'radix123'
const accounts: {[address: string]: RadixAccount} = {}

// Load identity
async function loadIdentity() {
  if (fs.existsSync(keystorePath)) {
    // Load account
    const contents = await fs.readJSON(keystorePath)
    const address = await RadixKeyStore.decryptKey(contents, keystorePassword)

    const identity = identityManager.addSimpleIdentity(address)
    await identity.account.openNodeConnection()

    console.log('Loaded identity: ' + identity.address.getAddress())

    return identity
  } else {
    const identity = identityManager.generateSimpleIdentity()
    await identity.account.openNodeConnection()
    const contents = await RadixKeyStore.encryptKey(identity.address, keystorePassword)
    await fs.writeJSON(keystorePath, contents)

    console.log('Generated new identity: ' + identity.address.getAddress())

    return identity
  }
}

// Buying a bus
function subscribeForPurchases() {
  identity.account.transferSystem.getAllTransactions().subscribe(async (txUpdate) => {
    if (!txUpdate.transaction) {
      return
    }

    if (!(radixUniverse.nativeToken.toString() in txUpdate.transaction.balance)) {
      return
    }

    models.Purchase.findOne({aid: txUpdate.aid.toString()}, async (err, res) => {
      if(res) { // Already processed
        return
      }
      if (!txUpdate.transaction) {
        return
      }

      const tokenUri = txUpdate.transaction.message
      const purchaser = Object.values(txUpdate.transaction.participants)[0]
      const bus = await models.Bus.findOne({
        tokenUri
      }).exec()

      if (!bus) {
        throw new Error(`Bus doesn't exist`)
        // TODO: return money
      }

      const moneySent = txUpdate.transaction.tokenUnitsBalance[radixUniverse.nativeToken.toString()]
      if (moneySent.lessThan(bus.get('price'))) {
        throw new Error('Insufficent patment')
        // TODO: return money
      }

      // Mint a new bus token
      RadixTransactionBuilder.createMintAtom(identity.account, tokenUri, 1)
        .signAndSubmit(identity)
        .subscribe({complete: () => {
          // Send the bus token
          RadixTransactionBuilder.createTransferAtom(identity.account, purchaser, tokenUri, 1)
            .signAndSubmit(identity)
            .subscribe({
              complete: () => {
                console.log('Bus was purchased')
                new models.Purchase({
                  aid: txUpdate.aid
                }).save()
              }
            })
        }})
    })
  })
}

// Get an account
const getAccount = async function(address: string) {
  let account: RadixAccount
  if (address in accounts) {
    account = accounts[address]
  } else {
    account = RadixAccount.fromAddress(address)
    accounts[address] = account
    await account.openNodeConnection()
  }

  console.log('got account')

  // Wait for the account to be synced
  await account.isSynced()
    .filter(val => {
      console.log('synced', val)
      return val
    })
    // .take(1)
    // .toPromise()
    // ^^^ EDITED

  return account
}



app.get('/', (req, res) => res.send(`Radibus`))

// -------------- ROUTES --------------
// Get all buses
app.get('/buses', async (req, res) => {
  models.Bus.find({}, '-busPos', (err, buses) => {
    if (err) {
      res.status(400).send(err)
      return
    }

    res.send(buses)
  })
})

// Access Request
app.get('/request-access', async (req, res) => {
  const id = uuidv4()
  const request = new models.AccessRequest({
    id,
    consumed: false,
  })

  await request.save()

  res.send(id)
})

// Access a resource (signed(address, challenge), tokenId)
app.post('/bus', async (req, res) => {
  console.log('Requesting access to bus line')
  const serializedAtom = req.body.atom
  const busTokenUri = new RRI(identity.address, req.body.busTokenUri)

  const atom = RadixSerializer.fromJSON(serializedAtom) as RadixAtom
  const particle = atom.getFirstParticleOfType(RadixMessageParticle)
  const from = particle.from
  const data = particle.getData().asJSON()

  // Check signature
  if (!from.verify(atom.getHash(), atom.signatures[from.getUID().toString()])) {
    res.status(400).send('Signature verification failed')
    throw new Error('Signature verification failed')
  }

  console.log('Signature ok')

  const query = {
    id: data.challenge
  }

  // Check challenge
  const document = await models.AccessRequest.findOne(query).exec()
  if (!document || document.get('consumed')) {
    res.status(400).send('Invalid challenge')
    throw new Error('Invalid challenge')
  }

  console.log('challenge ok')

  document.set('consumed', true)
  await document.save()

  // Check ownership
  const account = await getAccount(from.toString())
  console.log('got synced account')
  const balance = account.transferSystem.balance
  console.log(balance)

  // If don't have any bus tokens
  if(!(busTokenUri.toString() in balance) || balance[busTokenUri.toString()].ltn(1)) {
    res.status(400).send(`Don't own the subscription`)
    throw new Error(`Don't own the subscription`)
  }

  console.log('Subscription owned')

  const bus = await models.Bus.findOne({
    tokenUri: busTokenUri.toString()
  }).exec()

  if(!bus) {
    res.status(400).send(`Bus line doesn't exist`)
    throw new Error(`Bus line doesn't exist`)
  }

  res.send(bus)
})

// -------------- ADMIN --------------
// Subscribe to bus line
app.post('/subscribe', (req, res) => {
  // Create token
  const tokenUri = req.body.tokenUri
  const address = req.body.address

  const purchaser = RadixAccount.fromAddress(address)

  const tokenRRI = new RRI(identity.address, tokenUri)

  // Mint a new bus token
  RadixTransactionBuilder.createMintAtom(identity.account, tokenRRI, 1)
  .signAndSubmit(identity)
  .subscribe({complete: () => {
    // Send the bus token
    RadixTransactionBuilder.createTransferAtom(identity.account, purchaser, tokenRRI, 1)
      .signAndSubmit(identity)
      .subscribe({
        complete: () => {
          console.log('Bus was purchased')
          res.send('Done')
        }
      })
  }})
})

// Add a bus
app.post('/add-bus', async (req, res) => {
  // Create token
  const name = req.body['name']
  const symbol = req.body['symbol']
  const description = req.body['description']
  const iconUrl = req.body['iconUrl']
  const busPos = req.body['busPos']
  const price = req.body['price'] ? parseFloat(req.body['price']) : 1

  const uri = new RRI(identity.address, symbol)

  try {
    new RadixTransactionBuilder().createTokenMultiIssuance(
      identity.account,
      name,
      symbol,
      description,
      1,
      1,
      iconUrl,
    ).signAndSubmit(identity)
    .subscribe({
      next: status => {
        console.log(status)
      },
      complete:  async () => {
        // Create DB entry
        const bus = new models.Bus({
          tokenUri: uri.toString(),
          name,
          description,
          price,
          iconUrl,
          busPos
        })

        await bus.save()

        res.send(uri)
      }, error: (e) => {
        console.log(e)
        res.status(400).send(e)
      }
    })
  } catch(e) {
    res.status(400).send(e.message)
  }
})

// Update bus position
app.post('/update-bus', async (req, res) => {
  const bus = req.body['bus']
  const lat = req.body['lat']
  const lng = req.body['lng']

  models.Bus.findOneAndUpdate({ name: bus }, { busPos: JSON.stringify({lat: lat, lng: lng}) }, function(err, doc) {
    if (err) return res.status(500).send({ error: err })
    return res.send("Updated bus position")
  })
})
