// Global variables
let w3wApiKey = null;
let w3wOverlay = null;
let isExtensionActive = false;
let lastProcessedUrl = '';

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
  debugOverlay.id = 'w3w-debug-overlay';
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
      
      // Setup multiple approaches to detect map interactions
      setupURLChangeDetection();
      setupClickHandlers();
      
      // Create the overlay
      createW3WOverlay();
      
      // Process initial URL (if we're already on a location)
      processCurrentUrl();
      
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
      const debugOverlay = document.getElementById('w3w-debug-overlay');
      
      if (isExtensionActive) {
        logDebug('API key updated');
        if (debugOverlay) {
          debugOverlay.textContent = 'what3words: API key updated';
          debugOverlay.style.backgroundColor = 'rgba(0,0,0,0.7)';
        }
        
        if (!w3wOverlay) {
          setupURLChangeDetection();
          setupClickHandlers();
          createW3WOverlay();
        }
        
        // Process current URL after updating the API key
        processCurrentUrl();
      } else {
        logDebug('API key removed');
        if (debugOverlay) {
          debugOverlay.textContent = 'what3words: API key removed';
          debugOverlay.style.backgroundColor = 'rgba(200,0,0,0.7)';
        }
      }
    }
  });
}

// Set up URL change detection (most reliable method)
function setupURLChangeDetection() {
  logDebug('Setting up URL change detection');
  
  // Check URL every 500ms for changes (Google Maps uses history.pushState)
  setInterval(() => {
    if (isExtensionActive) {
      processCurrentUrl();
    }
  }, 500);
}

// Process the current URL for coordinates
function processCurrentUrl() {
  const currentUrl = window.location.href;
  
  // Only process if URL has changed
  if (currentUrl !== lastProcessedUrl) {
    logDebug(`URL changed: ${currentUrl}`);
    lastProcessedUrl = currentUrl;
    
    const coordinates = extractCoordinatesFromUrl(currentUrl);
    if (coordinates) {
      logDebug(`Coordinates found in URL: ${coordinates.lat}, ${coordinates.lng}`);
      convertToWhat3Words(coordinates.lat, coordinates.lng);
    }
  }
}

// Set up various click handlers to capture map interactions
function setupClickHandlers() {
  logDebug('Setting up map click handlers');
  
  // Method 1: General document click
  document.addEventListener('click', (event) => {
    if (isExtensionActive) {
      // Don't log every click to avoid spamming the console
      setTimeout(() => processCurrentUrl(), 300);
    }
  });
  
  // Method 2: Try to find the map container
  try {
    const mapElements = document.querySelectorAll('[aria-label="Map"]');
    if (mapElements.length > 0) {
      logDebug(`Found ${mapElements.length} map elements`);
      
      mapElements.forEach(mapElement => {
        mapElement.addEventListener('click', (event) => {
          logDebug('Map element clicked');
          setTimeout(() => processCurrentUrl(), 300);
        });
      });
    }
  } catch (e) {
    logDebug(`Error finding map elements: ${e.message}`);
  }
  
  // Method 3: Try to find canvas elements (Google Maps often uses canvas)
  try {
    const setCanvasListeners = () => {
      const canvasElements = document.querySelectorAll('canvas');
      if (canvasElements.length > 0) {
        logDebug(`Found ${canvasElements.length} canvas elements, adding listeners`);
        
        canvasElements.forEach(canvas => {
          if (!canvas.hasAttribute('w3w-listener')) {
            canvas.setAttribute('w3w-listener', 'true');
            canvas.addEventListener('click', (event) => {
              logDebug('Canvas clicked');
              setTimeout(() => processCurrentUrl(), 300);
            });
          }
        });
      }
    };
    
    // Initial setup
    setCanvasListeners();
    
    // Also set up a MutationObserver to detect when new canvas elements are added
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.addedNodes.length) {
          setCanvasListeners();
        }
      }
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
  } catch (e) {
    logDebug(`Error setting up canvas listeners: ${e.message}`);
  }
}

// Extract coordinates from Google Maps URL
function extractCoordinatesFromUrl(url) {
  logDebug(`Extracting coordinates from URL: ${url}`);
  
  // Try different regex patterns for greater compatibility
  const patterns = [
    /@(-?\d+\.\d+),(-?\d+\.\d+)/,                    // Standard @lat,lng format
    /\/\@(-?\d+\.\d+),(-?\d+\.\d+)/,                 // URL path format
    /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/,               // Query parameter format
    /center=(-?\d+\.\d+)%2C(-?\d+\.\d+)/,            // center parameter format
    /destination=(-?\d+\.\d+)%2C(-?\d+\.\d+)/        // destination parameter format
  ];
  
  for (const regex of patterns) {
    const match = url.match(regex);
    if (match && match.length === 3) {
      const lat = parseFloat(match[1]);
      const lng = parseFloat(match[2]);
      
      // Validate coordinates
      if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        logDebug(`Matched coordinates with pattern: ${lat}, ${lng}`);
        return { lat, lng };
      }
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
          <div class="w3w-address">
            <a href="${w3wUrl}" target="_blank" class="w3w-address-link">/// ${w3wAddress}</a>
            <button class="w3w-copy-button" data-address="${w3wAddress}" title="Copy to clipboard">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </button>
          </div>
        </div>
      `);
      
      // Add event listener to copy button
      const copyButton = w3wOverlay.querySelector('.w3w-copy-button');
      if (copyButton) {
        copyButton.addEventListener('click', () => {
          const address = copyButton.getAttribute('data-address');
          navigator.clipboard.writeText('///' + address)
            .then(() => {
              copyButton.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              `;
              setTimeout(() => {
                copyButton.innerHTML = `
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                  </svg>
                `;
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
      <div class="w3w-search">
        <div class="w3w-search-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
        </div>
        <input type="text" class="w3w-search-input" placeholder="Enter a what3words address...">
        <div class="w3w-autosuggest-container"></div>
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
  
  // Add event listeners for search functionality
  const searchInput = w3wOverlay.querySelector('.w3w-search-input');
  
  // Handle input for autosuggest
  searchInput.addEventListener('input', debounce(() => {
    const searchTerm = searchInput.value.trim();
    if (searchTerm.length >= 3) {
      // Clean up input and get autosuggest
      const cleanTerm = searchTerm.replace(/\/{1,}/g, '');
      getAutosuggestions(cleanTerm);
    } else {
      // Clear suggestions if input is too short
      const suggestionContainer = w3wOverlay.querySelector('.w3w-autosuggest-container');
      suggestionContainer.innerHTML = '';
      suggestionContainer.classList.remove('visible');
    }
  }, 300));
  
  // Handle enter key for direct search
  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      const searchTerm = searchInput.value.trim();
      if (searchTerm) {
        // Clean up the input by removing slashes
        const cleanTerm = searchTerm.replace(/\//g, '');
        convertFromWhat3Words(cleanTerm);
      }
    }
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
/// Convert what3words address to coordinates
async function convertFromWhat3Words(words) {
  logDebug(`Converting what3words address to coordinates: ${words}`);
  
  if (!w3wApiKey) {
    logDebug('No API key available');
    return;
  }
  
  try {
    const searchInput = w3wOverlay.querySelector('.w3w-search-input');
    const searchIcon = w3wOverlay.querySelector('.w3w-search-icon');
    
    // Disable input while searching
    searchInput.disabled = true;
    
    // Show loading spinner
    const originalIconContent = searchIcon.innerHTML;
    searchIcon.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w3w-spinner">
        <circle cx="12" cy="12" r="10"></circle>
        <path d="M12 6v6l4 2"></path>
      </svg>
    `;
    
    showW3WOverlay('Searching for what3words address...');
    
    const apiUrl = `https://api.what3words.com/v3/convert-to-coordinates?words=${words}&key=${w3wApiKey}`;
    logDebug(`Making API request to: ${apiUrl.replace(w3wApiKey, 'HIDDEN')}`);
    
    const response = await fetch(apiUrl);
    logDebug(`API response status: ${response.status}`);
    
    const data = await response.json();
    
    // Re-enable input and restore icon
    searchInput.disabled = false;
    searchIcon.innerHTML = originalIconContent;
    
    if (response.ok && data.coordinates) {
      const { lat, lng } = data.coordinates;
      logDebug(`Found coordinates: ${lat}, ${lng}`);
      
      // Navigate to the location on Google Maps
      const mapUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
      window.location.href = mapUrl;
      
      // Show the what3words overlay with the found address
      showW3WOverlay(`
        <div class="w3w-result">
          <div class="w3w-address">
            <a href="https://what3words.com/${words}" target="_blank" class="w3w-address-link">/// ${words}</a>
            <button class="w3w-copy-button" data-address="${words}" title="Copy to clipboard">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </button>
          </div>
          <div class="w3w-coordinates">
            Coordinates: ${lat.toFixed(6)}, ${lng.toFixed(6)}
          </div>
        </div>
      `);
      
      // Add event listener to copy button
      const copyButton = w3wOverlay.querySelector('.w3w-copy-button');
      if (copyButton) {
        copyButton.addEventListener('click', () => {
          const address = copyButton.getAttribute('data-address');
          navigator.clipboard.writeText('///' + address)
            .then(() => {
              copyButton.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              `;
              setTimeout(() => {
                copyButton.innerHTML = `
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                  </svg>
                `;
              }, 2000);
            });
        });
      }
    } else {
      logDebug(`API error: ${JSON.stringify(data.error || {})}`);
      showW3WOverlay(`Error: ${data.error?.message || 'Invalid what3words address'}`);
    }
  } catch (error) {
    logDebug(`Error converting what3words address: ${error.message}`);
    console.error('Error converting what3words address:', error);
    showW3WOverlay('Error connecting to what3words API');
    
    // Reset UI in case of error
    const searchInput = w3wOverlay.querySelector('.w3w-search-input');
    const searchIcon = w3wOverlay.querySelector('.w3w-search-icon');
    searchInput.disabled = false;
    searchIcon.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="11" cy="11" r="8"></circle>
        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
      </svg>
    `;
  }
}
      
      // Add event listener to copy button
      const copyButton = w3wOverlay.querySelector('.w3w-copy-button');
      if (copyButton) {
        copyButton.addEventListener('click', () => {
          const address = copyButton.getAttribute('data-address');
          navigator.clipboard.writeText('///' + address)
            .then(() => {
              copyButton.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              `;
              setTimeout(() => {
                copyButton.innerHTML = `
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                  </svg>
                `;
              }, 2000);
            });
        });
      }
    } else {
      logDebug(`API error: ${JSON.stringify(data.error || {})}`);
      showW3WOverlay(`Error: ${data.error?.message || 'Invalid what3words address'}`);
    }
  } catch (error) {
    logDebug(`Error converting what3words address: ${error.message}`);
    console.error('Error converting what3words address:', error);
    showW3WOverlay('Error connecting to what3words API');
  }
}
// Debounce function to limit API calls during typing
function debounce(func, wait) {
  let timeout;
  return function() {
    const context = this;
    const args = arguments;
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      func.apply(context, args);
    }, wait);
  };
}

// Get autosuggest results from what3words API
async function getAutosuggestions(input) {
  logDebug(`Getting autosuggestions for: ${input}`);
  
  if (!w3wApiKey) {
    logDebug('No API key available');
    return;
  }
  
  try {
    const apiUrl = `https://api.what3words.com/v3/autosuggest?input=${encodeURIComponent(input)}&key=${w3wApiKey}`;
    logDebug(`Making autosuggest API request: ${apiUrl.replace(w3wApiKey, 'HIDDEN')}`);
    
    const response = await fetch(apiUrl);
    logDebug(`Autosuggest API response status: ${response.status}`);
    
    const data = await response.json();
    
    if (response.ok && data.suggestions) {
      displayAutosuggestions(data.suggestions);
    } else {
      logDebug(`API error: ${JSON.stringify(data.error || {})}`);
    }
  } catch (error) {
    logDebug(`Error getting autosuggestions: ${error.message}`);
  }
}

// Display autosuggest results in dropdown
function displayAutosuggestions(suggestions) {
  const suggestionContainer = w3wOverlay.querySelector('.w3w-autosuggest-container');
  
  // Clear previous suggestions
  suggestionContainer.innerHTML = '';
  
  if (suggestions.length === 0) {
    suggestionContainer.classList.remove('visible');
    return;
  }
  
  // Create suggestion items
  suggestions.forEach(suggestion => {
    const suggestionItem = document.createElement('div');
    suggestionItem.className = 'w3w-suggestion-item';
    suggestionItem.innerHTML = `
      <div class="w3w-suggestion-text">/// ${suggestion.words}</div>
      ${suggestion.nearestPlace ? `<div class="w3w-suggestion-place">${suggestion.nearestPlace}</div>` : ''}
    `;
    
    // Add click handler to select this suggestion
    suggestionItem.addEventListener('click', () => {
      const searchInput = w3wOverlay.querySelector('.w3w-search-input');
      searchInput.value = suggestion.words;
      
      // Hide suggestions
      suggestionContainer.classList.remove('visible');
      
      // Navigate to this location
      convertFromWhat3Words(suggestion.words);
    });
    
    suggestionContainer.appendChild(suggestionItem);
  });
  
  // Show the suggestion container
  suggestionContainer.classList.add('visible');
}
// Start the extension
logDebug('Starting what3words extension');
window.addEventListener('load', function() {
  // Wait a bit to ensure page is fully loaded
  setTimeout(initExtension, 1000);
});
logDebug('Event listener for window load added');