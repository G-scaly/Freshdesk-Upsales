const axios = require('axios');

// Freshdesk Configuration
const FRESHDESK_API_KEY = 'YCBU1bl6zDFaVTKA1Hc';  // Replace with your Freshdesk API key
const FRESHDESK_DOMAIN = 'scalyab72849574309491831';  // Replace with your Freshdesk domain

const freshdeskClient = axios.create({
  baseURL: `https://${FRESHDESK_DOMAIN}.freshdesk.com/api/v2`,
  headers: {
    'Content-Type': 'application/json'
  },
  auth: {
    username: FRESHDESK_API_KEY,
    password: 'X'  // Freshdesk API requires the API key as the username and 'X' as the password for basic auth
  }
});

// Upsales Configuration
const UPSALES_API_KEY = '1bacb6780c00b2185df569ad40783d5a73b1664c6ff1e338e9fa75093886aa29';  // Replace with your Upsales API key

const upsalesClient = axios.create({
  baseURL: 'https://integration.upsales.com/api/v2',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Flag to control polling and handling rate limit
let stopPolling = false;

// Function to fetch contacts from Upsales
async function fetchContactsFromUpsales() {
  try {
    console.log('Fetching contacts from Upsales...');
    const upsalesResponse = await upsalesClient.get(`/contacts/?token=${UPSALES_API_KEY}`);
    const contacts = upsalesResponse.data.data; // Adjusted based on Upsales response structure
    
    if (!Array.isArray(contacts)) {
      console.error('Unexpected response format from Upsales:', upsalesResponse.data);
      return [];
    }

    console.log(`Fetched ${contacts.length} contacts from Upsales.`);
    return contacts;
  } catch (error) {
    if (error.response && error.response.status === 429) {
      console.error('API rate limit reached. Stopping polling.');
      stopPolling = true; // Set flag to stop polling
      return [];
    }
    console.error('Error fetching contacts from Upsales:', error.response?.data || error.message);
    return [];
  }
}

// Function to sync a single contact
async function syncContact(contact) {
  try {
    // Check if the contact already exists in Freshdesk
    const freshdeskResponse = await freshdeskClient.get(`/contacts?email=${encodeURIComponent(contact.email)}`);
    const freshdeskContacts = freshdeskResponse.data;

    if (freshdeskContacts.length === 0) {
      // Create a new contact in Freshdesk
      console.log(`Creating new Freshdesk contact for ${contact.name}`);
      await freshdeskClient.post('/contacts', {
        name: contact.name,
        email: contact.email,
        phone: contact.phone || ''
      });
      console.log(`Created new Freshdesk contact for ${contact.name}`);
    } else {
      // Update the existing contact in Freshdesk
      console.log(`Updating Freshdesk contact for ${contact.name}`);
      const contactId = freshdeskContacts[0].id;
      await freshdeskClient.put(`/contacts/${contactId}`, {
        name: contact.name,
        phone: contact.phone
      });
      console.log(`Updated Freshdesk contact for ${contact.name}`);
    }
  } catch (error) {
    if (error.response && error.response.status === 429) {
      console.error('API rate limit reached during contact sync. Stopping polling.');
      stopPolling = true; // Set flag to stop polling
    } else {
      console.error('Error syncing contact:', error.response?.data || error.message);
    }
  }
}

// Polling function to continuously check for updates
async function startPolling(interval) {
  while (!stopPolling) {
    console.log('Starting new polling cycle...');
    const contacts = await fetchContactsFromUpsales();
    for (const contact of contacts) {
      await syncContact(contact);
      if (stopPolling) {
        console.log('Stopping contact sync due to rate limit.');
        break;
      }
    }
    if (!stopPolling) {
      console.log('Polling cycle completed. Waiting for next cycle...');
      await new Promise(resolve => setTimeout(resolve, interval));  // Wait for the specified interval
    }
  }
  console.log('Polling stopped due to rate limit.');
  process.exit(1); // Exit the process with a non-zero exit code to indicate an error
}

// Start polling every 5 minutes (300,000 milliseconds)
startPolling(300000);
