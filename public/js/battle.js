// public/js/battle.js
const socket = io();
let currentArray = [];
let accessCount = 0;
let startTime;
let isBattleActive = false;
let animationFrameId;
let codeExecutionTime = 0;

// Initialize p5.js canvas
function setup() {
  const canvas = createCanvas(windowWidth, windowHeight * 0.8);
  canvas.parent('canvasContainer');
  frameRate(60);
  textFont('Courier New');
  textSize(16);

  // Get room ID from URL
  const pathParts = window.location.pathname.split('/');
  const roomId = pathParts[pathParts.length - 1];
  
  // Join battle room
  socket.emit('joinRoom', roomId, `Gladiator-${Math.floor(Math.random() * 1000)}`);
  
  // Socket event listeners
  socket.on('codeUpdate', handleCodeUpdate);
  socket.on('battleStart', handleBattleStart);
  socket.on('executionResult', handleExecutionResult);
  socket.on('battleResults', showBattleResults);
}

// Main drawing loop
function draw() {
  background(0);
  drawArrayVisualization();
  updateHUD();
  addVisualEffects();
}

// Handle code updates from editor
function handleCodeUpdate(newCode) {
  try {
    // Validate code contains sort function
    if (!newCode.includes('function sort')) {
      throw new Error('No sort function found!');
    }
    // Create test version of the sort function
    new Function('arr', `${newCode}\nreturn sort(arr);`);
  } catch (error) {
    console.error('Invalid code:', error);
    return;
  }
}

// Start battle sequence
function handleBattleStart(testArray) {
  currentArray = [...testArray];
  accessCount = 0;
  startTime = Date.now();
  isBattleActive = true;
  
  // Run user code through server
  socket.emit('runCode', getInstrumentedCode());
}

// Handle code execution results from server
function handleExecutionResult(result) {
  isBattleActive = false;
  
  if (result.success) {
    currentArray = result.array;
    codeExecutionTime = result.time;
    checkArraySorting();
  } else {
    showError(result.error);
  }
}

// Get code with array access instrumentation
function getInstrumentedCode() {
  const originalCode = monaco.editor.getModels()[0].getValue();
  
  // Instrument array accesses
  return originalCode
    .replace(/(\w+)\[(\d+)\]/g, (match, arrayName, index) => {
      accessCount++;
      return `${arrayName}[${index}]/*ACCESS*/`;
    })
    .replace(/for\s*\(.*?;.*?;.*?\)/gs, match => {
      return match.replace(/\)$/, '; accessCount++; )');
    });
}

// Visualize array state
function drawArrayVisualization() {
  const w = width / currentArray.length;
  const maxVal = Math.max(...currentArray);
  
  for (let i = 0; i < currentArray.length; i++) {
    const val = currentArray[i];
    const hue = map(val, 0, maxVal, 0, 360);
    const h = map(val, 0, maxVal, 10, height - 50);
    
    fill(hue, 80, 80);
    rect(i * w, height - h, w - 1, h);
    
    // Add glitch effect
    if (isBattleActive && random() > 0.9) {
      fill(360 - hue, 80, 80);
      rect(i * w + random(-2, 2), height - h, w - 1, h);
    }
  }
}

// Update heads-up display
function updateHUD() {
  const timerElement = document.getElementById('timer');
  const accessElement = document.getElementById('arrayAccess');
  
  if (timerElement && accessElement) {
    const elapsed = isBattleActive ? 
      ((Date.now() - startTime) / 1000).toFixed(2) : 
      (codeExecutionTime / 1000).toFixed(2);
    
    timerElement.innerHTML = `TIME: <span class="hud-value">${elapsed}s</span>`;
    accessElement.innerHTML = `ACCESSES: <span class="hud-value">${accessCount}</span>`;
  }
}

// Check if array is properly sorted
function checkArraySorting() {
  const isSorted = currentArray.every((val, i, arr) => 
    i === 0 || val >= arr[i - 1]
  );
  
  if (!isSorted) {
    showError('Array not sorted correctly!');
    triggerGlitchEffect();
  }
}

// Visual effects
function addVisualEffects() {
  if (isBattleActive) {
    // Screen shake
    if (accessCount % 100 === 0) {
      translate(random(-2, 2), random(-2, 2));
    }
    
    // Scanline effect
    stroke(0, 50);
    for (let y = 0; y < height; y += 2) {
      line(0, y, width, y);
    }
  }
}

function triggerGlitchEffect() {
  const glitchDiv = document.createElement('div');
  glitchDiv.className = 'glitch-overlay';
  document.body.appendChild(glitchDiv);
  
  setTimeout(() => {
    glitchDiv.remove();
  }, 500);
}

// Show battle results
function showBattleResults(results) {
  const resultsHTML = results.map(res => `
    <div class="result-item ${res.correct ? 'victory' : 'defeat'}">
      <span class="player-name">${res.name}</span>
      <span class="result-time">${res.time}ms</span>
      <span class="result-status">${res.correct ? '✓' : '✗'}</span>
    </div>
  `).join('');

  const container = document.createElement('div');
  container.id = 'battle-results';
  container.innerHTML = `
    <h2>COMBAT RESULTS</h2>
    ${resultsHTML}
    <button onclick="window.location.reload()" class="rematch-btn">
      LAUNCH REMATCH
    </button>
  `;

  document.body.appendChild(container);
}

// Error handling
function showError(message) {
  const errorDiv = document.createElement('div');
  errorDiv.className = 'battle-error';
  errorDiv.innerHTML = `
    <h3>EXECUTION FAILURE</h3>
    <p>${message}</p>
    <button onclick="this.parentElement.remove()">ACKNOWLEDGE</button>
  `;
  document.body.appendChild(errorDiv);
}

// Cleanup on window close
window.addEventListener('beforeunload', () => {
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  socket.disconnect();
});