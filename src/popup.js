import { getPublicKey, SimplePool, nip19, nip04, relayInit, nip44, getEventHash, getSignature } from 'nostr-tools';

const RELAY_URL = 'wss://relay.damus.io';
const pool = new SimplePool();

let contacts = [];

document.getElementById('loginButton').addEventListener('click', function() {
  const nsecInput = document.getElementById('nsec');
  const nsecValue = nsecInput.getAttribute('data-nsec') || nsecInput.value;
  login(nsecValue);
});

function obfuscateNsec(input) {
  input.addEventListener('input', function() {
    const realValue = this.value;
    this.setAttribute('data-nsec', realValue);
    this.value = '*'.repeat(realValue.length);
  });

  input.addEventListener('focus', function() {
    this.value = this.getAttribute('data-nsec') || '';
  });

  input.addEventListener('blur', function() {
    const realValue = this.getAttribute('data-nsec') || '';
    this.value = '*'.repeat(realValue.length);
  });
}

document.addEventListener('DOMContentLoaded', maskNsecInput);

async function connectToRelay() {
  let retries = 3;
  while (retries > 0) {
    try {
      await pool.ensureRelay(RELAY_URL);
      console.log('Connected to relay');
      return;
    } catch (error) {
      console.error('Connection attempt failed:', error);
      retries--;
      if (retries > 0) {
        console.log(`Retrying connection... (${retries} attempts left)`);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retrying
      }
    }
  }
  throw new Error('Failed to connect after multiple attempts');
}

async function login() {
  const nsecInput = document.getElementById('nsec').value;
  if (!nsecInput) {
    displayError('Please enter your nsec.');
    return;
  }

  displayStatus('Connecting to relay...', 'connection');
  try {
    let privateKey;
    if (nsecInput.startsWith('nsec')) {
      try {
        const { type, data } = nip19.decode(nsecInput);
        if (type !== 'nsec') throw new Error('Invalid nsec format');
        privateKey = data;
      } catch (error) {
        throw new Error('Invalid nsec format: ' + error.message);
      }
    } else {
      privateKey = nsecInput;
    }

    // Ensure privateKey is stored as a hex string
    const privateKeyHex = typeof privateKey === 'string' ? privateKey : Buffer.from(privateKey).toString('hex');

    await connectToRelay();
    displayStatus('Connected to relay.', 'connection');
    const pubkey = getPublicKey(privateKeyHex);
    displayStatus(`Connected as: ${pubkey.slice(0, 8)}...`, 'connection');
    
    // Store the private key securely as a hex string
    await new Promise((resolve, reject) => {
      chrome.storage.local.set({ nsec: privateKeyHex, pubkey: pubkey }, function() {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          console.log('Private key and public key stored securely');
          resolve();
        }
      });
    });

    // Fetch and display contacts
    displayStatus('Fetching contacts...', 'contact');
    const fetchedContacts = await getContacts(pubkey);
    contacts = fetchedContacts;
    displayContacts(contacts);
    displayStatus('Contacts loaded.', 'contact');
    
    // Show message input and send button
    document.getElementById('messageSection').style.display = 'block';
    
    // Set up subscription for incoming messages
    const sub = pool.sub([RELAY_URL], [
      {
        kinds: [4],
        '#p': [pubkey]
      }
    ]);

    sub.on('event', (event) => {
      handleIncomingMessage(event);
    });

    // Create or show chat container
    let chatContainer = document.getElementById('chatContainer');
    if (!chatContainer) {
      chatContainer = document.createElement('div');
      chatContainer.id = 'chatContainer';
      document.body.appendChild(chatContainer);
    }
    chatContainer.style.display = 'block';

    // Load existing messages from storage
    await displayAllMessages();
  } catch (error) {
    displayError(`Connection failed: ${error.message}`);
  }
}

async function getContacts(pubkey) {
  const filter = { kinds: [3], authors: [pubkey], limit: 1 };
  const events = await pool.list([RELAY_URL], [filter]);
  if (events.length === 0) return [];

  const contacts = events[0].tags
    .filter(tag => tag[0] === 'p')
    .map(tag => ({ pubkey: tag[1], petname: tag[2] || '' }));

  // Fetch metadata for contacts in batches
  const batchSize = 50;
  const contactsWithMetadata = [];
  for (let i = 0; i < contacts.length; i += batchSize) {
    const batch = contacts.slice(i, i + batchSize);
    const metadataFilter = { kinds: [0], authors: batch.map(c => c.pubkey) };
    const metadataEvents = await pool.list([RELAY_URL], [metadataFilter]);
    const metadataMap = new Map(metadataEvents.map(event => [event.pubkey, JSON.parse(event.content)]));
    
    const batchWithMetadata = batch.map(contact => ({
      ...contact,
      name: contact.petname || metadataMap.get(contact.pubkey)?.name || contact.pubkey.slice(0, 8) + '...'
    }));
    
    contactsWithMetadata.push(...batchWithMetadata);
  }

  return contactsWithMetadata;
}

function displayError(message) {
  const errorDiv = document.getElementById('error');
  errorDiv.textContent = message;
  errorDiv.className = 'error';
  errorDiv.style.display = 'block';
  setTimeout(() => {
    errorDiv.style.display = 'none';
  }, 5000); // Hide after 5 seconds
}

function displayStatus(message, type) {
  const statusElement = document.getElementById(type === 'connection' ? 'connectionStatus' : 'contactStatus');
  statusElement.textContent = message;
  statusElement.className = 'status';
  setTimeout(() => {
    statusElement.textContent = '';
    statusElement.className = '';
  }, 5000); // Hide after 5 seconds
}

function displayContacts(contacts) {
  const contactSelect = document.getElementById('contactSelect');
  contactSelect.innerHTML = '<option value="">Select a contact</option>';
  contacts.forEach(contact => {
    const option = document.createElement('option');
    option.value = contact.pubkey;
    option.textContent = contact.name;
    contactSelect.appendChild(option);
  });
  document.getElementById('contactSection').style.display = 'block';
}

document.getElementById('contactSelect').addEventListener('change', () => {
  const recipientPubkey = document.getElementById('contactSelect').value;
  if (recipientPubkey) {
    document.getElementById('messageInput').focus();
  }
});

document.getElementById('sendButton').addEventListener('click', sendMessage);

async function sendMessage() {
  const recipientPubkey = document.getElementById('contactSelect').value;
  const messageInput = document.getElementById('messageInput');
  const message = messageInput.value;
  if (!recipientPubkey || !message) {
    displayError('Please select a contact and enter a message.');
    return;
  }
  
  try {
    const result = await new Promise((resolve, reject) => {
      chrome.storage.local.get(['nsec'], function(result) {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(result);
        }
      });
    });

    if (!result.nsec) {
      throw new Error('No private key found. Please log in again.');
    }

    const sendButton = document.getElementById('sendButton');
    sendButton.disabled = true;
    sendButton.textContent = 'Sending...';
    
    const encryptedContent = await nip04.encrypt(result.nsec, recipientPubkey, message);
    const event = {
      kind: 4,
      pubkey: getPublicKey(result.nsec),
      created_at: Math.floor(Date.now() / 1000),
      tags: [['p', recipientPubkey]],
      content: encryptedContent
    };
    event.id = getEventHash(event);
    event.sig = await getSignature(event, result.nsec);
    
    const pub = pool.publish([RELAY_URL], event);
    pub.on('ok', () => {
      displayStatus('Message sent successfully.', 'connection');
      messageInput.value = '';
      displayMessage(event.pubkey, message, Date.now());
      sendButton.disabled = false;
      sendButton.textContent = 'Send';
    });
    pub.on('failed', (reason) => {
      throw new Error(`Failed to send message: ${reason}`);
    });
  } catch (error) {
    displayError(`Failed to send message: ${error.message}`);
    const sendButton = document.getElementById('sendButton');
    sendButton.disabled = false;
    sendButton.textContent = 'Send';
  }
}

async function handleIncomingMessage(event) {
  try {
    const result = await new Promise((resolve, reject) => {
      chrome.storage.local.get(['nsec'], function(result) {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(result);
        }
      });
    });

    if (!result.nsec) {
      console.error('No private key found. Please log in again.');
      return;
    }

    const privateKeyHex = result.nsec;
    const decryptedContent = await nip04.decrypt(privateKeyHex, event.pubkey, event.content);

    // Store the new message
    const messages = await new Promise((resolve, reject) => {
      chrome.storage.local.get(['messages'], function(result) {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(result.messages || []);
        }
      });
    });

    messages.push({
      senderPubkey: event.pubkey,
      content: decryptedContent,
      timestamp: event.created_at * 1000, // Convert to milliseconds if it's in seconds
      id: event.id // Make sure to include a unique id for each message
    });

    await new Promise((resolve, reject) => {
      chrome.storage.local.set({ messages: messages }, function() {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });

    console.log('Message stored successfully');
  } catch (error) {
    console.error('Failed to handle message:', error);
  }
}

// Ensure this is defined at the top of your file
let displayedMessageIds = new Set();

async function fetchMessages(pubkey) {
  const filter = {
    kinds: [4],
    '#p': [pubkey],
    limit: 100
  };
  try {
    const events = await pool.list([RELAY_URL], [filter]);
    console.log('Fetched events:', events);
    return events.sort((a, b) => a.created_at - b.created_at);
  } catch (error) {
    console.error('Error fetching messages:', error);
    return [];
  }
}

async function displayAllMessages() {
  try {
    const result = await new Promise((resolve, reject) => {
      chrome.storage.local.get(['messages', 'nsec'], function(result) {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(result);
        }
      });
    });

    const messages = result.messages || [];
    const nsec = result.nsec;

    if (!nsec) {
      displayError('No private key found. Please log in again.');
      return;
    }

    console.log(`Displaying ${messages.length} messages`);

    const messagesBySender = {};
    const seenMessageIds = new Set();

    messages.forEach(msg => {
      if (!seenMessageIds.has(msg.id)) {
        if (!messagesBySender[msg.senderPubkey]) {
          messagesBySender[msg.senderPubkey] = [];
        }
        messagesBySender[msg.senderPubkey].push(msg);
        seenMessageIds.add(msg.id);
      }
    });

    displayGroupedMessages(messagesBySender);
  } catch (error) {
    console.error('Error displaying messages:', error);
    displayError(`Failed to display messages: ${error.message}`);
  }
}

function createMessageElement(content, timestamp) {
  const messageElement = document.createElement('div');
  messageElement.className = 'message';

  const timeElement = document.createElement('div');
  timeElement.className = 'message-time';
  
  // Convert the timestamp to a Date object
  let date;
  if (typeof timestamp === 'number') {
    date = new Date(timestamp * (timestamp < 10000000000 ? 1000 : 1));
  } else if (typeof timestamp === 'string') {
    date = new Date(timestamp);
  }

  // Format the date
  if (date && !isNaN(date.getTime())) {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear().toString().slice(-2);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    timeElement.textContent = `${day}.${month}.${year} ${hours}:${minutes}`;
  } else {
    timeElement.textContent = 'Unknown Date';
    console.error('Invalid timestamp:', timestamp);
  }
  
  messageElement.appendChild(timeElement);

  const contentElement = document.createElement('div');
  contentElement.className = 'message-content';

  if (typeof content === 'string') {
    try {
      const jsonContent = JSON.parse(content);
      contentElement.appendChild(createStructuredContent(jsonContent));
    } catch (e) {
      contentElement.textContent = content;
    }
  } else if (typeof content === 'object' && content !== null) {
    contentElement.appendChild(createStructuredContent(content));
  } else {
    contentElement.textContent = 'Unable to display message content';
  }

  messageElement.appendChild(contentElement);
  return messageElement;
}

function createStructuredContent(content) {
  const container = document.createElement('div');
  
  if (content.message) {
    const messagePara = document.createElement('p');
    messagePara.innerHTML = `<strong>Message:</strong> ${escapeHtml(content.message)}`;
    container.appendChild(messagePara);
  }
  
  if (content.items && content.items.length > 0) {
    const itemsHeader = document.createElement('p');
    itemsHeader.innerHTML = '<strong>Items:</strong>';
    container.appendChild(itemsHeader);
    
    const itemsList = document.createElement('ul');
    content.items.forEach(item => {
      const itemLi = document.createElement('li');
      itemLi.textContent = `Product ID: ${item.product_id}, Quantity: ${item.quantity}`;
      itemsList.appendChild(itemLi);
    });
    container.appendChild(itemsList);
  }
  
  if (content.shipping_id) {
    const shippingPara = document.createElement('p');
    shippingPara.innerHTML = `<strong>Shipping ID:</strong> ${escapeHtml(content.shipping_id)}`;
    container.appendChild(shippingPara);
  }
  
  if (content.type !== undefined) {
    const typePara = document.createElement('p');
    typePara.innerHTML = `<strong>Type:</strong> ${content.type}`;
    container.appendChild(typePara);
  }
  
  if (content.id) {
    const idPara = document.createElement('p');
    idPara.innerHTML = `<strong>ID:</strong> ${escapeHtml(content.id)}`;
    container.appendChild(idPara);
  }
  
  return container;
}

function displayGroupedMessages(messagesBySender) {
  let chatContainer = document.getElementById('chatContainer');
  if (!chatContainer) {
    chatContainer = document.createElement('div');
    chatContainer.id = 'chatContainer';
    document.body.appendChild(chatContainer);
  }
  chatContainer.innerHTML = ''; // Clear existing messages

  for (const [senderPubkey, messages] of Object.entries(messagesBySender)) {
    const senderGroup = document.createElement('div');
    senderGroup.className = 'sender-group';
    
    const header = document.createElement('h3');
    header.className = 'sender-header';
    header.innerHTML = `<span class="toggle-icon">▶</span> ${senderPubkey.slice(0, 8)}... (${messages.length} messages)`;
    senderGroup.appendChild(header);

    const messagesContainer = document.createElement('div');
    messagesContainer.className = 'messages';
    messagesContainer.style.display = 'none';
    
    messages.forEach(msg => {
      const messageElement = createMessageElement(msg.content, msg.timestamp);
      messagesContainer.appendChild(messageElement);
    });

    senderGroup.appendChild(messagesContainer);

    header.addEventListener('click', () => {
      const toggleIcon = header.querySelector('.toggle-icon');
      if (messagesContainer.style.display === 'none') {
        messagesContainer.style.display = 'block';
        toggleIcon.textContent = '▼';
      } else {
        messagesContainer.style.display = 'none';
        toggleIcon.textContent = '▶';
      }
    });

    chatContainer.appendChild(senderGroup);
  }
}

function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

document.addEventListener('DOMContentLoaded', function() {
  autoLogin();
});

async function autoLogin() {
  try {
    const result = await new Promise((resolve, reject) => {
      chrome.storage.local.get(['nsec', 'pubkey'], function(result) {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(result);
        }
      });
    });

    if (result.nsec && result.pubkey) {
      await connectToRelay();
      displayStatus(`Connected as: ${result.pubkey.slice(0, 8)}...`, 'connection');
      // Set up subscription for incoming messages
      setupSubscription(result.pubkey);
      // Fetch and display contacts
      const fetchedContacts = await getContacts(result.pubkey);
      contacts = fetchedContacts;
      displayContacts(contacts);
      // Display all messages
      await displayAllMessages();
    } else {
      console.log('No stored credentials found. Please log in.');
    }
  } catch (error) {
    displayError(`Auto-login failed: ${error.message}`);
  }
}

function displayMessage(senderPubkey, content, timestamp) {
  let chatContainer = document.getElementById('chatContainer');
  if (!chatContainer) {
    chatContainer = document.createElement('div');
    chatContainer.id = 'chatContainer';
    document.body.appendChild(chatContainer);
  }

  let senderGroup = document.getElementById(`sender-${senderPubkey}`);
  if (!senderGroup) {
    const senderContact = contacts.find(contact => contact.pubkey === senderPubkey);
    const senderName = senderContact ? senderContact.name : senderPubkey.slice(0, 8) + '...';

    senderGroup = document.createElement('div');
    senderGroup.id = `sender-${senderPubkey}`;
    senderGroup.className = 'sender-group';
    senderGroup.innerHTML = `
      <h3 class="sender-header">
        <span class="toggle-icon">▶</span>
        ${senderName}
      </h3>
      <div class="messages" style="display: none;"></div>
    `;
    chatContainer.appendChild(senderGroup);

    senderGroup.querySelector('.sender-header').addEventListener('click', () => {
      const messagesDiv = senderGroup.querySelector('.messages');
      const toggleIcon = senderGroup.querySelector('.toggle-icon');
      if (messagesDiv.style.display === 'none') {
        messagesDiv.style.display = 'block';
        toggleIcon.textContent = '▼';
      } else {
        messagesDiv.style.display = 'none';
        toggleIcon.textContent = '▶';
      }
    });
  }

  const messageElement = createMessageElement(content, timestamp);
  senderGroup.querySelector('.messages').appendChild(messageElement);

  // Update message count
  const headerElement = senderGroup.querySelector('.sender-header');
  const messageCount = senderGroup.querySelectorAll('.message').length;
  headerElement.textContent = headerElement.textContent.replace(/\(\d+ messages\)/, '') + ` (${messageCount} messages)`;

  // Save message to storage
  const existingMessages = JSON.parse(localStorage.getItem('chatMessages') || '[]');
  existingMessages.push({ senderPubkey, content, timestamp });
  if (existingMessages.length > 100) {
    existingMessages.shift(); // Remove oldest message if we have more than 100
  }
  localStorage.setItem('chatMessages', JSON.stringify(existingMessages));

  // Scroll to bottom
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Call this function after login
displayAllMessages();