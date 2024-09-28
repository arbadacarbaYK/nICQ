import { SimplePool, nip04, nip44, getPublicKey, getEventHash, getSignature } from 'nostr-tools';

const RELAY_URL = 'wss://relay.damus.io';
const pool = new SimplePool();

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['pubkey'], function(result) {
    if (result.pubkey) {
      setupSubscription(result.pubkey);
    }
  });
});

function setupSubscription(pubkey) {
  const sub = pool.sub([RELAY_URL], [
    {
      kinds: [4],
      '#p': [pubkey]
    }
  ]);

  sub.on('event', handleIncomingMessage);
}

async function handleIncomingMessage(event) {
  chrome.storage.local.get(['nsec'], async function(result) {
    if (chrome.runtime.lastError) {
      console.error('Error retrieving nsec:', chrome.runtime.lastError);
      return;
    }

    const nsec = result.nsec;
    if (!nsec) {
      console.error('No private key found. Please log in again.');
      return;
    }

    try {
      let decryptedContent;
      if (event.tags.some(tag => tag[0] === 'nip44')) {
        decryptedContent = await nip44Decrypt(event.pubkey, event.content);
      } else {
        decryptedContent = await nip04Decrypt(event.pubkey, event.content);
      }

      // Store the new message
      chrome.storage.local.get(['messages'], function(data) {
        const messages = data.messages || [];
        messages.push({
          senderPubkey: event.pubkey,
          content: decryptedContent,
          timestamp: event.created_at * 1000,
          id: event.id
        });
        chrome.storage.local.set({ messages: messages }, function() {
          if (chrome.runtime.lastError) {
            console.error('Error storing message:', chrome.runtime.lastError);
          } else {
            console.log('Message saved successfully');
            playNotificationSound();
          }
        });
      });
    } catch (error) {
      console.error('Failed to handle message:', error);
    }
  });
}

function playNotificationSound() {
  const audio = new Audio(chrome.runtime.getURL('sounds/icq_message.mp3'));
  audio.play();
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.type) {
    case 'getPublicKey':
      getStoredPublicKey().then(sendResponse);
      break;
    case 'signEvent':
      signEvent(request.event).then(sendResponse);
      break;
    case 'getRelays':
      getRelays().then(sendResponse);
      break;
    case 'nip04Encrypt':
      nip04Encrypt(request.pubkey, request.plaintext).then(sendResponse);
      break;
    case 'nip04Decrypt':
      nip04Decrypt(request.pubkey, request.ciphertext).then(sendResponse);
      break;
    case 'nip44Encrypt':
      nip44Encrypt(request.pubkey, request.plaintext).then(sendResponse);
      break;
    case 'nip44Decrypt':
      nip44Decrypt(request.pubkey, request.ciphertext).then(sendResponse);
      break;
  }
  return true; // Indicates that the response will be sent asynchronously
});

async function getStoredPublicKey() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['pubkey'], function(result) {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else if (result.pubkey) {
        resolve(result.pubkey);
      } else {
        reject(new Error('No public key found. Please log in.'));
      }
    });
  });
}

async function signEvent(event) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['nsec'], async function(result) {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else if (result.nsec) {
        try {
          event.pubkey = getPublicKey(result.nsec);
          event.id = getEventHash(event);
          event.sig = await getSignature(event, result.nsec);
          resolve(event);
        } catch (error) {
          reject(error);
        }
      } else {
        reject(new Error('No private key found. Please log in.'));
      }
    });
  });
}

async function getRelays() {
  return {
    'wss://relay.damus.io': { read: true, write: true },
    'wss://relay.nostr.band': { read: true, write: true },
    'wss://nos.lol': { read: true, write: true },
    'wss://relay.snort.social': { read: true, write: true }
  };
}

async function nip04Encrypt(pubkey, plaintext) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['nsec'], async function(result) {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else if (result.nsec) {
        try {
          const ciphertext = await nip04.encrypt(result.nsec, pubkey, plaintext);
          resolve(ciphertext);
        } catch (error) {
          reject(error);
        }
      } else {
        reject(new Error('No private key found. Please log in.'));
      }
    });
  });
}

async function nip04Decrypt(pubkey, ciphertext) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['nsec'], async function(result) {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else if (result.nsec) {
        try {
          const plaintext = await nip04.decrypt(result.nsec, pubkey, ciphertext);
          resolve(plaintext);
        } catch (error) {
          reject(error);
        }
      } else {
        reject(new Error('No private key found. Please log in.'));
      }
    });
  });
}

async function nip44Encrypt(pubkey, plaintext) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['nsec'], async function(result) {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else if (result.nsec) {
        try {
          const privateKey = result.nsec;
          const sharedSecret = await nip44.getSharedSecret(privateKey, pubkey);
          const ciphertext = await nip44.encrypt(sharedSecret, plaintext);
          resolve(ciphertext);
        } catch (error) {
          reject(error);
        }
      } else {
        reject(new Error('No private key found. Please log in.'));
      }
    });
  });
}

async function nip44Decrypt(pubkey, ciphertext) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['nsec'], async function(result) {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else if (result.nsec) {
        try {
          const privateKey = result.nsec;
          const sharedSecret = await nip44.getSharedSecret(privateKey, pubkey);
          const plaintext = await nip44.decrypt(sharedSecret, ciphertext);
          resolve(plaintext);
        } catch (error) {
          reject(error);
        }
      } else {
        reject(new Error('No private key found. Please log in.'));
      }
    });
  });
}