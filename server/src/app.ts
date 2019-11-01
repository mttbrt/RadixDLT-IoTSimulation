import express from 'express';
import models, { connectDb } from './models';
import uuidv4 from 'uuid';
import {RadixSerializer, RadixAtom, RadixMessageParticle, RadixAccount, RadixKeyStore, RadixIdentityManager, RadixIdentity, RadixTransactionBuilder, RRI, radixUniverse, RadixUniverse} from 'radixdlt'
import fs from 'fs-extra'
import BN from 'bn.js'
import cors from 'cors'
import bodyParser from 'body-parser'
import crypto from 'crypto'

const app: express.Application = express();
const port: number = Number(process.env.PORT) || 3001;

let busKeys: { [bus_id: string]: string }

app.use(cors())
app.use(bodyParser.json())

let identity: RadixIdentity

radixUniverse.bootstrap(RadixUniverse.LOCALHOST_SINGLENODE)

connectDb()
.then(() => {
  return loadIdentity()
}).then(_identity => {
  identity = _identity
  busKeys = JSON.parse(fs.readFileSync('bus_keys.json', 'utf8'));
  subscribeForPurchases()
  subscribeForMessages()

  //addBuses()

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
  identity.account.transferSystem.transactionSubject.subscribe(async (txUpdate) => {
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

      const tokenRRI = new RRI(identity.address, txUpdate.transaction.message)
      const tokenUri = tokenRRI.toString()
      const purchaser = RadixAccount.fromAddress(Object.keys(txUpdate.transaction.participants)[0])
      const bus = await models.Bus.findOne({
        tokenUri
      }).exec()

      if (!bus) {
        throw new Error(`Bus doesn't exist`)
      }

      const moneySent = txUpdate.transaction.tokenUnitsBalance[radixUniverse.nativeToken.toString()]
      if (moneySent.lessThan(bus.get('price'))) {
        throw new Error('Insufficent patment')
      }

      // Mint a new bus token
      RadixTransactionBuilder.createMintAtom(identity.account, tokenRRI, 1)
        .signAndSubmit(identity)
        .subscribe({complete: () => {
          // Send the bus token
          RadixTransactionBuilder.createTransferAtom(identity.account, purchaser, tokenRRI, 1)
            .signAndSubmit(identity)
            .subscribe({complete: () => {
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

// Bus position update
function subscribeForMessages() {
  console.log(identity.account.address)
  identity.account.messagingSystem.messageSubject.subscribe(messageUpdate => {
    const busId = JSON.parse(messageUpdate.message.content).message.split(" ")[1];
    const busKey = busKeys[busId];

    /* TODO
     * Il server memorizza per ogni linea di bus l'ultima posizione aggiornata CIFRATA
     * e quando un client chiede la posizione di un bus gli ritorna il valore cifrato della posizione
     * sarà poi il client a decifrare la posizione con la chiave acquistata e memorizzare le varie posizioni
     * per ricostruire eventualmente il percorso (lo storico)
    */
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

function addBuses() {
  addBus("Bus 110", "B110", "Updates on bus line 110 position", "https://image.freepik.com/free-icon/bus_318-2038.jpg", JSON.stringify(busKeys["110"]), 1);
  addBus("Bus 226", "B226", "Updates on bus line 226 position", "https://image.freepik.com/free-icon/bus_318-2038.jpg", JSON.stringify(busKeys["226"]), 1);
  addBus("Bus 371", "B371", "Updates on bus line 371 position", "https://image.freepik.com/free-icon/bus_318-2038.jpg", JSON.stringify(busKeys["371"]), 1);
  addBus("Bus 422", "B422", "Updates on bus line 422 position", "https://image.freepik.com/free-icon/bus_318-2038.jpg", JSON.stringify(busKeys["422"]), 1);
  addBus("Bus 426", "B426", "Updates on bus line 426 position", "https://image.freepik.com/free-icon/bus_318-2038.jpg", JSON.stringify(busKeys["426"]), 1);
  addBus("Bus 484", "B484", "Updates on bus line 484 position", "https://image.freepik.com/free-icon/bus_318-2038.jpg", JSON.stringify(busKeys["484"]), 1);
  addBus("Bus 512", "B512", "Updates on bus line 512 position", "https://image.freepik.com/free-icon/bus_318-2038.jpg", JSON.stringify(busKeys["512"]), 1);
  addBus("Bus 639", "B639", "Updates on bus line 639 position", "https://image.freepik.com/free-icon/bus_318-2038.jpg", JSON.stringify(busKeys["639"]), 1);
  addBus("Bus 650", "B650", "Updates on bus line 650 position", "https://image.freepik.com/free-icon/bus_318-2038.jpg", JSON.stringify(busKeys["650"]), 1);
  addBus("Bus 889", "B889", "Updates on bus line 889 position", "https://image.freepik.com/free-icon/bus_318-2038.jpg", JSON.stringify(busKeys["889"]), 1);
}

// Create bus token
function addBus(busName: string, busSymbol: string, busDescription: string, busIcon: string, busSecret: string, busPrice: number) {
  const uri = new RRI(identity.address, busSymbol)

  try {
    new RadixTransactionBuilder().createTokenMultiIssuance(
      identity.account,
      busName,
      busSymbol,
      busDescription,
      1,
      1,
      busIcon
    ).signAndSubmit(identity)
    .subscribe({
      complete:  async () => {
        // Create DB entry
        const bus = new models.Bus({
          tokenUri: uri.toString(),
          name: busName,
          description: busDescription,
          price: busPrice,
          iconUrl: busIcon,
          busSecret: busSecret
        })

        await bus.save()
      }, error: (e) => {
        console.log(e)
        throw new Error(`Error submitting token creation transaction`)
      }
    })
  } catch(e) {
    throw new Error(`Error creating token`)
  }
}

app.get('/', (req, res) => res.send(`Radibus`))

// -------------- ROUTES --------------
// Get all buses
app.get('/buses', async (req, res) => {
  models.Bus.find({}, '-busSecret', (err, buses) => {
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
