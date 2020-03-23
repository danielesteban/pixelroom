import Renderer from './core/renderer.js';
import Room from './scenes/room.js';

const renderer = new Renderer({
  debug: {
    fps: document.getElementById('fps'),
    support: document.getElementById('support'),
  },
  mount: document.getElementById('mount'),
});

renderer.loadScene(Room);
