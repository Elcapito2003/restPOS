// Base URL of the restPOS server.
// HTTP used because prod still has a self-signed cert and React Native
// rejects those. Swap to https once a trusted cert is in place.
export const SERVER_URL = 'http://165.227.121.235';
export const API_URL = `${SERVER_URL}/api`;
