/**
 * Background script for what3words Google Maps Extension
 * Handles init and cleanup operations
 */

// Log extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('what3words for Google Maps extension installed');
    
    // Open the options page on install to guide setup
    chrome.tabs.create({
      url: 'popup/popup.html'
    });
  }
});

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle any background tasks here if needed in the future
  if (message.action === 'testApiKey') {
    testApiKey(message.apiKey)
      .then(isValid => {
        sendResponse({ isValid });
      })
      .catch(error => {
        sendResponse({ isValid: false, error: error.message });
      });
    return true; // Required for async response
  }
});

/**
 * Test if the API key is valid
 * @param {string} apiKey - The API key to test
 * @returns {Promise<boolean>} - True if the API key is valid
 */
async function testApiKey(apiKey) {
  try {
    // London coordinates for test
    const testLat = 51.520847;
    const testLng = -0.195521;
    
    const response = await fetch(
      `https://api.what3words.com/v3/convert-to-3wa?coordinates=${testLat},${testLng}&key=${apiKey}`
    );
    
    const data = await response.json();
    return response.ok && data.words !== undefined;
  } catch (error) {
    console.error('Error testing what3words API key:', error);
    return false;
  }
}
