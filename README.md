# nICQ: A Nostr-based ICQ Clone

nICQ is a modern, decentralized messaging application that brings the nostalgic feel of ICQ to the Nostr protocol. This Chrome extension allows users to communicate securely and privately using Nostr's decentralized network.

<p float="left">
  <img src="https://github.com/user-attachments/assets/d3315542-283a-4e9c-8a16-6e9833470703" width="24%" />
  <img src="https://github.com/user-attachments/assets/f8b3b029-d88d-4c8c-8c86-49a31e5d481c" width="24%" />
  <img src="https://github.com/user-attachments/assets/e2321e1f-8101-4eaf-a9f6-8d99080a9bdd" width="24%" />
  <img src="https://github.com/user-attachments/assets/6422e7ec-3b8a-46b4-b900-d05ea60f029b" width="24%" />
</p>


## Features

- Secure login using Nostr private keys (nsec)
- Real-time messaging with end-to-end encryption
- Contact list management
- Multi-relay support for improved reliability and performance
- Familiar ICQ-inspired user interface

## Installation

1. Clone this repository:
   ```
   git clone https://github.com/arbadacarbaYK/nICQ.git
   ```
2. Navigate to the project directory:
   ```
   cd nICQ
   ```
3. Install dependencies:
   ```
   npm install
   ```
4. Build the extension:
   ```
   npm run build
   ```
5. Load the extension in Chrome:
   - Open Chrome and go to `chrome://extensions`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the `dist` folder in the nICQ directory

## Usage

1. Click on the nICQ icon in your Chrome toolbar
2. Enter your Nostr private key (nsec) to log in
3. Start messaging!

## Development

To set up the development environment:

1. Follow the installation steps above
2. Make changes to the code in the `src` directory
3. Rebuild the extension:
   ```
   npm run build
   ```
4. Reinstall the extension in Chrome (Reload ist not enough)

## Contributing

We welcome contributions to nICQ! Please feel free to submit issues, fork the repository and send pull requests.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Inspired by the classic ICQ messenger
- Built on the [Nostr protocol](https://github.com/nostr-protocol/nostr)
- Uses [nostr-tools](https://github.com/nbd-wtf/nostr-tools) for Nostr interactions

ISSUES : 
- DMs not working in this version
