require('dotenv').config();
const axios = require('axios');

// Freshdesk Configuration
const FRESHDESK_API_KEY = process.env.FRESHDESK_API_KEY;
const FRESHDESK_DOMAIN = process.env.FRESHDESK_DOMAIN;

const freshdeskClient = axios.create({
  baseURL:  `https://${FRESHDESK_DOMAIN}.freshdesk.com/api/v2`,
  headers: {
    'Content-Type': 'application/json'
  },
  auth: {
    username: FRESHDESK_API_KEY,
    password: 'X'  // Freshdesk API requires basic auth with API key and 'X' as the password
  }
});

// Upsales Configuration
const UPSALES_API_KEY = process.env.UPSALES_API_KEY;  // Replace with your Upsales API key

const upsalesClient = axios.create({
  baseURL: 'https://integration.upsales.com/api/v2',
  headers: {
    'Content-Type': 'application/json',
  }
});

// Variable to control polling
let stopPolling = false;

// Function to fetch customers from Upsales and create or update them in Freshdesk
async function syncCustomers() {
  try {
    // Fetch customers from Upsales
    console.log('Fetching customers from Upsales...');
    const upsalesResponse = await upsalesClient.get(`/contacts/?token=${UPSALES_API_KEY}`);
    const customers = upsalesResponse.data.data;  // Access the data array directly
    
     // Check if customers is defined and is an array
     if (!Array.isArray(customers)) {
      console.error('Unexpected response format from Upsales:', upsalesResponse.data);
      return;
    }

    console.log(`Fetched ${customers.length} customers from Upsales.`);

    for (const customer of customers) {
      // Check if the customer already exists in Freshdesk
      const freshdeskResponse = await freshdeskClient.get(`/contacts?email=${customer.email}`);
      const freshdeskContacts = freshdeskResponse.data;

      if (freshdeskContacts.length === 0) {
        // Create a new contact in Freshdesk
        console.log(`Creating new Freshdesk contact for ${customer.name}`);
        await freshdeskClient.post('/contacts', {
          name: customer.name,
          email: customer.email,
          phone: customer.phone || ''
          
        });
        console.log(`Created new Freshdesk contact for ${customer.name}`);
      } else {
        // Update the existing contact in Freshdesk
        console.log(`Updating Freshdesk contact for ${customer.name}`);
        const contactId = freshdeskContacts[0].id;
        await freshdeskClient.put(`/contacts/${contactId}`, {
          name: customer.name,
          phone: customer.phone
        });
        console.log(`Updated Freshdesk contact for ${customer.name}`);
      }
    }

    console.log('Customer sync completed successfully!');
  } catch (error) {
    console.error('Error syncing customers:', error.response?.data || error.message);
  }
}
// Polling function to continuously check for updates
async function startPolling(interval) {
  while (!stopPolling) {
    console.log('Starting new polling cycle...');
    await syncCustomers();
    if (stopPolling) {
      console.log('Stopping contact sync due to rate limit.');
      break;
    }
    console.log('Polling cycle completed. Waiting for next cycle...');
    await new Promise(resolve => setTimeout(resolve, interval));  // Wait for the specified interval
  }
  console.log('Polling stopped due to rate limit.');
  process.exit(1); // Exit the process with a non-zero exit code to indicate an error
}

// Start polling every 1 hour (3,600,000 milliseconds)
startPolling(3600000);

// Example of how you might stop polling (for demonstration purposes)
function stopPollingNow() {
  stopPolling = true;
  }

// Call the function
syncCustomers();
