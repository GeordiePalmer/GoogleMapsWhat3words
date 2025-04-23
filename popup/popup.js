document.addEventListener('DOMContentLoaded', () => {
  const apiKeyInput = document.getElementById('api-key');
  const saveButton = document.getElementById('save-button');
  const statusMessage = document.getElementById('status-message');

  // Load the saved API key from storage
  chrome.storage.sync.get(['apiKey'], (result) => {
    if (result.apiKey) {
      apiKeyInput.value = result.apiKey;
      showStatus('API key loaded', 'success');
    }
  });

  // Save API key when the save button is clicked
  saveButton.addEventListener('click', () => {
    const apiKey = apiKeyInput.value.trim();
    
    if (!apiKey) {
      showStatus('Please enter an API key', 'error');
      return;
    }

    // Validate the API key by making a test API call
    testApiKey(apiKey)
      .then(isValid => {
        if (isValid) {
          // Save API key to Chrome storage
          chrome.storage.sync.set({ apiKey }, () => {
            showStatus('API key saved successfully!', 'success');
          });
        } else {
          showStatus('Invalid API key. Please check and try again.', 'error');
        }
      })
      .catch(error => {
        showStatus(`Error: ${error.message}`, 'error');
      });
  });

  /**
   * Test if the API key is valid by making a test request to what3words API
   * @param {string} apiKey - The API key to test
   * @returns {Promise<boolean>} - True if the API key is valid, false otherwise
   */
  async function testApiKey(apiKey) {
    try {
      // Test coordinates (London)
      const testLat = 51.520847;
      const testLng = -0.195521;
      
      const response = await fetch(`https://api.what3words.com/v3/convert-to-3wa?coordinates=${testLat},${testLng}&key=${apiKey}`);
      const data = await response.json();
      
      return response.ok && data.words !== undefined;
    } catch (error) {
      console.error('Error testing API key:', error);
      return false;
    }
  }

  /**
   * Display a status message
   * @param {string} message - The message to display
   * @param {string} type - The type of message ('success' or 'error')
   */
  function showStatus(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = type;
    
    // Clear the message after a few seconds if it's a success message
    if (type === 'success') {
      setTimeout(() => {
        statusMessage.textContent = '';
        statusMessage.className = '';
      }, 3000);
    }
  }
});
