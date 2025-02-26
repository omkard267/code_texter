const socket = io();
let editor, roomId;

document.getElementById('createRoom').addEventListener('click', () => {
  roomId = `room-${crypto.randomUUID().slice(0, 8)}`;
  const username = document.getElementById('username').value || 'Anonymous';
  
  socket.emit('joinRoom', roomId, username);
  document.getElementById('editorContainer').classList.remove('hidden');
  initializeEditor();
});

function initializeEditor() {
  require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.36.1/min/vs' }});
  require(['vs/editor/editor.main'], () => {
    editor = monaco.editor.create(document.getElementById('editor'), {
      value: rooms.get(roomId).code,
      language: 'javascript',
      theme: 'vs-dark',
      minimap: { enabled: false }
    });

    // Real-time code sync
    editor.onDidChangeModelContent(() => {
      const code = editor.getValue();
      socket.emit('codeChange', code);
    });

    // Battle controls
    document.getElementById('startBattle').addEventListener('click', () => {
      socket.emit('startBattle');
    });

    // Player list updates
    socket.on('playerUpdate', (players) => {
      const playerList = document.getElementById('playerList');
      playerList.innerHTML = players.map(p => 
        `<div class="player-tag">${p.name}</div>`
      ).join('');
    });

    // Battle countdown handler
    socket.on('battleCountdown', (number) => {
      document.body.style.background = `hsl(${number * 100}, 100%, 5%)`;
      document.getElementById('startBattle').textContent = number;
    });

    // Battle start redirect
    socket.on('battleStart', (testArray) => {
      window.location.href = `/battle/${roomId}`;
    });
  });
}