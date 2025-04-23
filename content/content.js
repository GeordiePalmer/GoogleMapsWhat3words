// Global variables
let w3wApiKey = null;
let w3wOverlay = null;
let isExtensionActive = false;

// Initialize the extension
function initExtension() {
  // Load API key from storage
  chrome.storage.sync.get(['apiKey'], (result) => {
    if (result.apiKey) {
      w3wApiKey = result.apiKey;
      isExtensionActive = true;
      setupGoogleMapsIntegration();
      createW3WOverlay();
    }
  });

  // Listen for changes to API key
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.apiKey) {
      w3wApiKey = changes.apiKey.newValue;
      isExtensionActive = !!w3wApiKey;
      
      if (isExtensionActive && !w3wOverlay) {
        setupGoogleMapsIntegration();
        createW3WOverlay();
      }
    }
  });
}

// Set up Google Maps event listeners
function setupGoogleMapsIntegration() {
  // Wait for Google Maps to fully load
  const checkGoogleMapsReady = setInterval(() => {
    if (window.google && window.google.maps) {
      clearInterval(checkGoogleMapsReady);
      
      // Get the Google Maps instance
      const mapElements = document.querySelectorAll('[aria-label="Map"]');
      if (mapElements.length === 0) return;
      
      const mapElement = mapElements[0];
      
      // Add click listener to the map
      mapElement.addEventListener('click', handleMapClick);
      
      console.log('what3words extension initialized for Google Maps');
    }
  }, 1000);
}

// Handle map click events
function handleMapClick(event) {
  if (!isExtensionActive) return;
  
  // Get click coordinates from URL or map state
  setTimeout(() => {
    const coordinates = extractCoordinatesFromUrl();
    if (coordinates) {
      convertToWhat3Words(coordinates.lat, coordinates.lng);
    }
  }, 300); // Small delay to ensure URL is updated
}

// Extract coordinates from Google Maps URL
function extractCoordinatesFromUrl() {
  const url = window.location.href;
  const regex = /@(-?\d+\.\d+),(-?\d+\.\d+)/;
  const match = url.match(regex);
  
  if (match && match.length === 3) {
    return {
      lat: parseFloat(match[1]),
      lng: parseFloat(match[2])
    };
  }
  
  return null;
}

// Convert coordinates to what3words address
async function convertToWhat3Words(lat, lng) {
  if (!w3wApiKey) return;
  
  try {
    showW3WOverlay('Loading what3words address...');
    
    const response = await fetch(`https://api.what3words.com/v3/convert-to-3wa?coordinates=${lat},${lng}&key=${w3wApiKey}`);
    const data = await response.json();
    
    if (response.ok && data.words) {
      const w3wAddress = data.words;
      const w3wUrl = `https://what3words.com/${w3wAddress}`;
      
      showW3WOverlay(`
        <div class="w3w-result">
          <div class="w3w-address">${w3wAddress}</div>
          <div class="w3w-actions">
            <a href="${w3wUrl}" target="_blank" class="w3w-link">Open in what3words</a>
            <button class="w3w-copy" data-address="${w3wAddress}">Copy</button>
          </div>
        </div>
      `);
      
      // Add event listener to copy button
      const copyButton = w3wOverlay.querySelector('.w3w-copy');
      if (copyButton) {
        copyButton.addEventListener('click', () => {
          const address = copyButton.getAttribute('data-address');
          navigator.clipboard.writeText(address)
            .then(() => {
              copyButton.textContent = 'Copied!';
              setTimeout(() => {
                copyButton.textContent = 'Copy';
              }, 2000);
            });
        });
      }
    } else {
      showW3WOverlay(`Error: ${data.error?.message || 'Could not convert coordinates'}`);
    }
  } catch (error) {
    console.error('Error converting coordinates to what3words:', error);
    showW3WOverlay('Error connecting to what3words API');
  }
}

// Create the what3words overlay element
function createW3WOverlay() {
  if (w3wOverlay) return;
  
  w3wOverlay = document.createElement('div');
  w3wOverlay.className = 'w3w-overlay';
  w3wOverlay.innerHTML = `
    <div class="w3w-overlay-content">
      <div class="w3w-header">
        <span class="w3w-logo">what3words</span>
        <button class="w3w-close">&times;</button>
      </div>
      <div class="w3w-body"></div>
    </div>
  `;
  
  document.body.appendChild(w3wOverlay);
  
  // Add event listener to close button
  const closeButton = w3wOverlay.querySelector('.w3w-close');
  closeButton.addEventListener('click', () => {
    w3wOverlay.classList.remove('visible');
  });
}

// Show the what3words overlay with content
function showW3WOverlay(content) {
  if (!w3wOverlay) createW3WOverlay();
  
  const bodyElement = w3wOverlay.querySelector('.w3w-body');
  bodyElement.innerHTML = content;
  
  w3wOverlay.classList.add('visible');
}

// Start the extension
initExtension();
