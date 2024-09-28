import { getPublicKey, SimplePool, nip19, nip04, relayInit, nip44, getEventHash, getSignature } from 'nostr-tools';

const RELAY_URL = 'wss://nostr.noderunners.network';

const nostrTools = {
  relay: null,

  async connect() {
    if (this.relay && this.relay.connected) return;
    this.relay = relayInit(RELAY_URL);
    await this.relay.connect();
    return new Promise((resolve, reject) => {
      this.relay.on('connect', () => {
        console.log(`Connected to ${RELAY_URL}`);
        resolve();
      });
      this.relay.on('error', () => {
        reject(new Error(`Failed to connect to ${RELAY_URL}`));
      });
    });
  },

  getPublicKey(nsec) {
    return getPublicKey(nsec);
  },

  async getContacts(npub) {
    if (!this.relay || !this.relay.connected) {
      await this.connect();
    }
    const filter = { kinds: [3], authors: [npub] };
    const events = await this.relay.list([filter]);
    
    if (events.length === 0) return [];

    const latestEvent = events.reduce((latest, current) => 
      current.created_at > latest.created_at ? current : latest
    );

    return latestEvent.tags
      .filter(tag => tag[0] === 'p')
      .map(tag => ({ 
        npub: tag[1], 
        name: tag[3] || tag[1].slice(0, 8),
        relay: tag[2]
      }));
  },

  async sendMessage(nsec, recipientPubKey, message) {
    if (!this.relay || !this.relay.connected) {
      await this.connect();
    }
    const sharedSecret = nip44.getSharedSecret(nsec, recipientPubKey);
    const encryptedContent = await nip44.encrypt(sharedSecret, message);
    const event = {
      kind: 4,
      pubkey: this.getPublicKey(nsec),
      created_at: Math.floor(Date.now() / 1000),
      tags: [['p', recipientPubKey]],
      content: encryptedContent
    };
    event.id = getEventHash(event);
    event.sig = getSignature(event, nsec);
    await this.relay.publish(event);
    console.log('Message sent:', message);
  }
};

export default nostrTools;