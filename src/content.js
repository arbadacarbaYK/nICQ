const script = document.createElement('script');
script.textContent = `
  window.nostr = {
    getPublicKey: () => chrome.runtime.sendMessage({type: 'getPublicKey'}),
    signEvent: (event) => chrome.runtime.sendMessage({type: 'signEvent', event}),
    getRelays: () => chrome.runtime.sendMessage({type: 'getRelays'}),
    nip04: {
      encrypt: (pubkey, plaintext) => chrome.runtime.sendMessage({type: 'nip04Encrypt', pubkey, plaintext}),
      decrypt: (pubkey, ciphertext) => chrome.runtime.sendMessage({type: 'nip04Decrypt', pubkey, ciphertext})
    },
    nip44: {
      encrypt: (pubkey, plaintext) => chrome.runtime.sendMessage({type: 'nip44Encrypt', pubkey, plaintext}),
      decrypt: (pubkey, ciphertext) => chrome.runtime.sendMessage({type: 'nip44Decrypt', pubkey, ciphertext})
    }
  };
`;
(document.head || document.documentElement).appendChild(script);