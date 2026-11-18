import { PhaserGame } from './phaser-game'

function App() {
  const toggleFullscreen = async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen()
    } else {
      await document.querySelector('.game-shell')?.requestFullscreen()
    }
  }

  return (
    <main className="game-shell">
      <PhaserGame />
      <button
        className="fullscreen-toggle"
        type="button"
        onClick={toggleFullscreen}
        aria-label="Toggle fullscreen"
        title="Toggle fullscreen"
      >
        ⛶
      </button>
    </main>
  )
}

export default App
