let scene, camera, renderer, sphere, innerCore;
let isSpeaking = false;
let isListening = false;

function init3D() {
  const container = document.getElementById('canvas-container');
  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.z = 4.5;

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  container.appendChild(renderer.domElement);

  const geometry = new THREE.IcosahedronGeometry(1.5, 2);
  const material = new THREE.MeshBasicMaterial({ color: 0x00b4d8, wireframe: true, transparent: true, opacity: 0.6 });
  sphere = new THREE.Mesh(geometry, material);
  scene.add(sphere);

  const coreGeo = new THREE.SphereGeometry(0.8, 24, 24);
  const coreMat = new THREE.MeshBasicMaterial({ color: 0x48cae4, wireframe: true, transparent: true, opacity: 0.3 });
  innerCore = new THREE.Mesh(coreGeo, coreMat);
  scene.add(innerCore);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
  animate();
}

function animate() {
  requestAnimationFrame(animate);
  const time = Date.now() * 0.002;
  sphere.rotation.y += 0.005;
  innerCore.rotation.y -= 0.007;

  let scale = 1.0;
  if (isSpeaking) {
    scale = 1.0 + Math.sin(time * 6) * 0.12;
    sphere.material.color.setHex(0x90e0ef);
  } else if (isListening) {
    scale = 1.0 + Math.sin(time * 3) * 0.06;
    sphere.material.color.setHex(0x00f5d4);
  } else {
    sphere.material.color.setHex(0x0077b6);
  }
  sphere.scale.set(scale, scale, scale);
  renderer.render(scene, camera);
}

function speakResponse(text, onComplete) {
  if (!('speechSynthesis' in window)) return onComplete && onComplete();

  window.speechSynthesis.cancel();
  isSpeaking = true;
  document.getElementById('status').innerText = 'SPEAKING';
  document.getElementById('jarvis-speech').innerText = text;

  const utterance = new SpeechSynthesisUtterance(text);
  const voices = window.speechSynthesis.getVoices();
  const natural = voices.find(v => (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha')) && v.lang.startsWith('en')) || voices[0];
  if (natural) utterance.voice = natural;
  utterance.rate = 1.0;

  utterance.onend = () => {
    isSpeaking = false;
    document.getElementById('status').innerText = 'LISTENING';
    if (onComplete) onComplete();
  };
  utterance.onerror = () => {
    isSpeaking = false;
    if (onComplete) onComplete();
  };

  window.speechSynthesis.speak(utterance);
}

let recognition;
let conversationActive = false;
let messageHistory = [];

function setupVoiceRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    alert("Voice recognition is only supported on Chrome or Safari.");
    return;
  }
  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  let finalTranscript = '';

  recognition.onresult = (e) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; ++i) {
      if (e.results[i].isFinal) finalTranscript += e.results[i][0].transcript;
      else interim += e.results[i][0].transcript;
    }
    document.getElementById('transcript-preview').innerText = interim || finalTranscript;

    if (finalTranscript.trim().length > 0) {
      const text = finalTranscript.trim();
      finalTranscript = '';
      recognition.stop();
      processUserInput(text);
    }
  };

  recognition.onend = () => {
    if (conversationActive && !isSpeaking) {
      try { recognition.start(); } catch (err) {}
    }
  };
}

async function processUserInput(text) {
  document.getElementById('status').innerText = 'THINKING';
  isListening = false;

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, history: messageHistory })
    });
    const data = await res.json();
    const reply = data.reply;

    messageHistory.push({ role: 'user', content: text });
    messageHistory.push({ role: 'assistant', content: reply });

    speakResponse(reply, () => {
      loadMemories();
      if (conversationActive) {
        isListening = true;
        try { recognition.start(); } catch (err) {}
      }
    });
  } catch (err) {
    document.getElementById('status').innerText = 'ERROR';
  }
}

async function loadMemories() {
  try {
    const res = await fetch('/api/memories');
    const data = await res.json();
    const list = document.getElementById('memory-list');
    list.innerHTML = '';
    data.memories.forEach(m => {
      const li = document.createElement('li');
      li.innerText = m;
      list.appendChild(li);
    });
  } catch (e) {}
}

const toggleBtn = document.getElementById('toggle-dialogue-btn');
toggleBtn.addEventListener('click', () => {
  if (!conversationActive) {
    conversationActive = true;
    toggleBtn.innerText = "STOP";
    document.getElementById('status').innerText = "LISTENING";
    isListening = true;
    recognition.start();
  } else {
    conversationActive = false;
    toggleBtn.innerText = "START CONVERSATION";
    document.getElementById('status').innerText = "STANDBY";
    isListening = false;
    window.speechSynthesis.cancel();
    recognition.stop();
  }
});

window.addEventListener('DOMContentLoaded', () => {
  init3D();
  setupVoiceRecognition();
  loadMemories();
});