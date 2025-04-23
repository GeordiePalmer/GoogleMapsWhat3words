// Global variables
let w3wApiKey = null;
let w3wOverlay = null;
let isExtensionActive = false;

// Debug logging helper
function logDebug(message) {
  console.log(`%c[w3w]%c ${message}`, 'background: #e11f26; color: white; padding: 2px 5px; border-radius: 3px;', 'color: #333;');
}

// Log that content script is loading
logDebug('Content script loading on: ' + window.location.href);

// Initialize the extension
function initExtension() {
  logDebug('Initializing extension');
  
  // Add a visible indicator of loading status for debugging
  const debugOverlay = document.createElement('div');
  debugOverlay.style.position = 'fixed';
  debugOverlay.style.bottom = '10px';
  debugOverlay.style.left = '10px';
  debugOverlay.style.background = 'rgba(0,0,0,0.7)';
  debugOverlay.style.color = 'white';
  debugOverlay.style.padding = '5px 10px';
  debugOverlay.style.borderRadius = '5px';
  debugOverlay.style.zIndex = '9999';
  debugOverlay.textContent = 'what3words: Loading...';
  document.body.appendChild(debugOverlay);

  // Load API key from storage
  chrome.storage.sync.get(['apiKey'], (result) => {
    if (result.apiKey) {
      w3wApiKey = result.apiKey;
      isExtensionActive = true;
      debugOverlay.textContent = 'what3words: API key loaded';
      logDebug('API key loaded: ' + w3wApiKey.substring(0, 3) + '...');
      
      // Add general click handler to document
      setupGlobalClickHandler();
      
      // Also try the standard integration
      setupGoogleMapsIntegration();
      
      // Create the overlay
      createW3WOverlay();
      
      // Update status
      setTimeout(() => {
        debugOverlay.textContent = 'what3words: Ready (click map)';
        setTimeout(() => {
          debugOverlay.style.opacity = '0.5';
        }, 3000);
      }, 1000);
    } else {
      logDebug('No API key found in storage');
      debugOverlay.textContent = 'what3words: No API key set';
      debugOverlay.style.backgroundColor = 'rgba(200,0,0,0.7)';
    }
  });

  // Listen for changes to API key
  chrome.storage.onChanged.addListener((changes) => {
    logDebug('Storage changed');
    if (changes.apiKey) {
      w3wApiKey = changes.apiKey.newValue;
      isExtensionActive = !!w3wApiKey;
      
      if (isExtensionActive) {
        logDebug('API key updated');
        debugOverlay.textContent = 'what3words: API key updated';
        debugOverlay.style.backgroundColor = 'rgba(0,0,0,0.7)';
        
        if (!w3wOverlay) {
          setupGlobalClickHandler();
          setupGoogleMapsIntegration();
          createW3WOverlay();
        }
      } else {
        logDebug('API key removed');
        debugOverlay.textContent = 'what3words: API key removed';
        debugOverlay.style.backgroundColor = 'rgba(200,0,0,0.7)';
      }
    }
  });
}

// Set up a global click handler (more reliable)
function setupGlobalClickHandler() {
  logDebug('Setting up global click handler');
  
  document.addEventListener('click', (event) => {
    // Only process if we're on a Google Maps page and extension is active
    if (isExtensionActive && window.location.href.includes('google.com/maps')) {
      logDebug('Document clicked');
      
      // Short delay to let URL update
      setTimeout(() => {
        const coordinates = extractCoordinatesFromUrl();
        if (coordinates) {
          logDebug(`Coordinates found in URL: ${coordinates.lat}, ${coordinates.lng}`);
          convertToWhat3Words(coordinates.lat, coordinates.lng);
        } else {
          logDebug('No coordinates found in URL after click');
        }
      }, 500);
    }
  });
}

// Set up Google Maps event listeners (traditional way)
function setupGoogleMapsIntegration() {
  logDebug('Setting up Google Maps integration');
  
  // Wait for Google Maps to fully load
  const checkGoogleMapsReady = setInterval(() => {
    if (window.google && window.google.maps) {
      clearInterval(checkGoogleMapsReady);
      logDebug('Google Maps detected');
      
      // Get the Google Maps instance
      const mapElements = document.querySelectorAll('[aria-label="Map"]');
      logDebug(`Found ${mapElements.length} map elements`);
      
      if (mapElements.length === 0) {
        logDebug('No map elements found, falling back to global handler');
        return;
      }
      
      const mapElement = mapElements[0];
      
      // Add click listener to the map
      mapElement.addEventListener('click', (event) => {
        logDebug('Map element clicked');
        handleMapClick(event);
      });
      
      logDebug('Map click handler attached');
    }
  }, 1000);
}

// Handle map click events
function handleMapClick(event) {
  logDebug('handleMapClick called');
  
  if (!isExtensionActive) {
    logDebug('Extension not active, ignoring click');
    return;
  }
  
  // Get click coordinates from URL or map state
  setTimeout(() => {
    const coordinates = extractCoordinatesFromUrl();
    
    if (coordinates) {
      logDebug(`Coordinates extracted: ${coordinates.lat}, ${coordinates.lng}`);
      convertToWhat3Words(coordinates.lat, coordinates.lng);
    } else {
      logDebug('Could not extract coordinates from URL');
    }
  }, 500); // Increased delay to ensure URL is updated
}

// Extract coordinates from Google Maps URL
function extractCoordinatesFromUrl() {
  const url = window.location.href;
  logDebug(`Extracting coordinates from URL: ${url}`);
  
  // Try different regex patterns
  const patterns = [
    /@(-?\d+\.\d+),(-?\d+\.\d+)/,
    /\/\@(-?\d+\.\d+),(-?\d+\.\d+)/
  ];
  
  for (const regex of patterns) {
    const match = url.match(regex);
    if (match && match.length === 3) {
      logDebug(`Matched coordinates with pattern: ${match[1]}, ${match[2]}`);
      return {
        lat: parseFloat(match[1]),
        lng: parseFloat(match[2])
      };
    }
  }
  
  logDebug('No coordinate patterns matched in URL');
  return null;
}

// Convert coordinates to what3words address
async function convertToWhat3Words(lat, lng) {
  logDebug(`Converting coordinates to what3words: ${lat}, ${lng}`);
  
  if (!w3wApiKey) {
    logDebug('No API key available');
    return;
  }
  
  try {
    showW3WOverlay('Loading what3words address...');
    
    const apiUrl = `https://api.what3words.com/v3/convert-to-3wa?coordinates=${lat},${lng}&key=${w3wApiKey}`;
    logDebug(`Making API request to: ${apiUrl.replace(w3wApiKey, 'HIDDEN')}`);
    
    const response = await fetch(apiUrl);
    logDebug(`API response status: ${response.status}`);
    
    const data = await response.json();
    
    if (response.ok && data.words) {
      const w3wAddress = data.words;
      const w3wUrl = `https://what3words.com/${w3wAddress}`;
      
      logDebug(`what3words address: ${w3wAddress}`);
      
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
      logDebug(`API error: ${JSON.stringify(data.error || {})}`);
      showW3WOverlay(`Error: ${data.error?.message || 'Could not convert coordinates'}`);
    }
  } catch (error) {
    logDebug(`Error converting coordinates: ${error.message}`);
    console.error('Error converting coordinates to what3words:', error);
    showW3WOverlay('Error connecting to what3words API');
  }
}

// Create the what3words overlay element
function createW3WOverlay() {
  logDebug('Creating what3words overlay');
  
  if (w3wOverlay) {
    logDebug('Overlay already exists');
    return;
  }
  
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
  logDebug('Overlay added to document body');
  
  // Add event listener to close button
  const closeButton = w3wOverlay.querySelector('.w3w-close');
  closeButton.addEventListener('click', () => {
    w3wOverlay.classList.remove('visible');
  });
}

// Show the what3words overlay with content
function showW3WOverlay(content) {
  logDebug(`Showing overlay with content: ${content.substring(0, 50)}...`);
  
  if (!w3wOverlay) {
    logDebug('Creating overlay before showing');
    createW3WOverlay();
  }
  
  const bodyElement = w3wOverlay.querySelector('.w3w-body');
  bodyElement.innerHTML = content;
  
  w3wOverlay.classList.add('visible');
  logDebug('Overlay visibility class added');
}

// Start the extension
logDebug('Starting what3words extension');
window.addEventListener('load', function() {
  // Wait a bit to ensure page is fully loaded
  setTimeout(initExtension, 1000);
});
logDebug('Event listener for window load added');
