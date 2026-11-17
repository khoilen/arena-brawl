import { EventBus } from '../event-bus'
import { Scene } from 'phaser'

const WIDTH = 800
const HEIGHT = 600
const ARENA = { left: 24, right: 776, top: 96, bottom: 576 }
const PLAYER_RADIUS = 18
const PLAYER_SPEED = 250
const ATTACK_RANGE = 92
const ATTACK_DAMAGE = 10
const ENEMY_MAX_HEALTH = 100

export class Game extends Scene {
  private player!: Phaser.GameObjects.Arc
  private playerLabel!: Phaser.GameObjects.Text
  private enemy!: Phaser.GameObjects.Arc
  private enemyHealthFill!: Phaser.GameObjects.Rectangle
  private enemyHealthText!: Phaser.GameObjects.Text
  private pressedKeys = new Set<string>()
  private punchRequested = false
  private enemyHealth = ENEMY_MAX_HEALTH
  private hasWon = false

  private readonly handleKeyDown = (event: KeyboardEvent) => {
    if (event.repeat) return

    if (!['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyJ'].includes(event.code)) return

    event.preventDefault()

    if (event.code === 'KeyJ' && !this.pressedKeys.has('KeyJ')) {
      this.punchRequested = true
    }

    this.pressedKeys.add(event.code)
  }

  private readonly handleKeyUp = (event: KeyboardEvent) => {
    this.pressedKeys.delete(event.code)
  }

  private readonly clearPressedKeys = () => {
    this.pressedKeys.clear()
  }

  private readonly removeKeyboardListeners = () => {
    window.removeEventListener('keydown', this.handleKeyDown)
    window.removeEventListener('keyup', this.handleKeyUp)
    window.removeEventListener('blur', this.clearPressedKeys)
    this.clearPressedKeys()
    this.punchRequested = false
  }

  constructor() {
    super('Game')
  }

  create() {
    this.enemyHealth = ENEMY_MAX_HEALTH
    this.hasWon = false
    this.pressedKeys.clear()
    this.punchRequested = false

    this.cameras.main.setBackgroundColor('#09111f')
    this.drawArena()
    this.createHud()
    this.createFighters()

    window.addEventListener('keydown', this.handleKeyDown)
    window.addEventListener('keyup', this.handleKeyUp)
    window.addEventListener('blur', this.clearPressedKeys)
    this.events.once('shutdown', this.removeKeyboardListeners, this)
    this.events.once('destroy', this.removeKeyboardListeners, this)

    EventBus.emit('current-scene-ready', this)
  }

  update(_time: number, delta: number) {
    if (this.hasWon) return

    this.movePlayer(delta)
    this.playerLabel.setPosition(this.player.x, this.player.y + 30)

    if (this.punchRequested) {
      this.punchRequested = false
      this.punch()
    }
  }

  private drawArena() {
    this.add
      .rectangle(
        WIDTH / 2,
        (ARENA.top + ARENA.bottom) / 2,
        ARENA.right - ARENA.left,
        ARENA.bottom - ARENA.top,
        0x122238,
      )
      .setStrokeStyle(2, 0x31516c)

    const grid = this.add.graphics()
    grid.lineStyle(1, 0x8fb4cf, 0.08)
    for (let x = ARENA.left + 32; x < ARENA.right; x += 48) {
      grid.lineBetween(x, ARENA.top, x, ARENA.bottom)
    }
    for (let y = ARENA.top + 32; y < ARENA.bottom; y += 48) {
      grid.lineBetween(ARENA.left, y, ARENA.right, y)
    }

    this.add
      .text(WIDTH / 2, 584, 'WASD MOVE     •     J PUNCH', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '13px',
        color: '#91a8bd',
        letterSpacing: 2,
      })
      .setOrigin(0.5)
  }

  private createHud() {
    this.add.text(28, 20, 'PLAYER', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '13px',
      fontStyle: 'bold',
      color: '#48e4c3',
      letterSpacing: 2,
    })
    this.add.text(548, 20, 'ARENA BOT', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '13px',
      fontStyle: 'bold',
      color: '#ff8b70',
      letterSpacing: 2,
    })
    this.add
      .text(248, 20, '100 / 100', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '12px',
        color: '#dbe7f3',
        align: 'right',
      })
      .setOrigin(1, 0)

    this.add.rectangle(28, 48, 220, 12, 0x26364a).setOrigin(0, 0.5)
    this.add.rectangle(548, 48, 220, 12, 0x26364a).setOrigin(0, 0.5)
    this.add.rectangle(28, 48, 220, 12, 0x48e4c3).setOrigin(0, 0.5).setDepth(1)
    this.enemyHealthFill = this.add
      .rectangle(548, 48, 220, 12, 0xff755f)
      .setOrigin(0, 0.5)
      .setDepth(1)
    this.enemyHealthText = this.add
      .text(768, 20, '100 / 100', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '12px',
        color: '#dbe7f3',
        align: 'right',
      })
      .setOrigin(1, 0)
  }

  private createFighters() {
    this.player = this.add
      .circle(190, 334, PLAYER_RADIUS, 0x48e4c3)
      .setStrokeStyle(3, 0xd8fff6)
      .setDepth(2)
    this.playerLabel = this.add
      .text(this.player.x, this.player.y + 30, 'YOU', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#b9fff0',
        letterSpacing: 2,
      })
      .setOrigin(0.5)
      .setDepth(2)

    this.enemy = this.add
      .circle(610, 334, 24, 0xff755f)
      .setStrokeStyle(3, 0xffd0bd)
      .setDepth(2)
    this.add
      .text(this.enemy.x, this.enemy.y + 36, 'BOT', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#ffd0bd',
        letterSpacing: 2,
      })
      .setOrigin(0.5)
      .setDepth(2)
  }

  private movePlayer(delta: number) {
    let xDirection =
      Number(this.pressedKeys.has('KeyD')) -
      Number(this.pressedKeys.has('KeyA'))
    let yDirection =
      Number(this.pressedKeys.has('KeyS')) -
      Number(this.pressedKeys.has('KeyW'))
    const length = Math.hypot(xDirection, yDirection)

    if (length === 0) return

    xDirection /= length
    yDirection /= length

    this.player.x = Math.max(
      ARENA.left + PLAYER_RADIUS,
      Math.min(
        ARENA.right - PLAYER_RADIUS,
        this.player.x + xDirection * PLAYER_SPEED * (delta / 1000),
      ),
    )
    this.player.y = Math.max(
      ARENA.top + PLAYER_RADIUS,
      Math.min(
        ARENA.bottom - PLAYER_RADIUS,
        this.player.y + yDirection * PLAYER_SPEED * (delta / 1000),
      ),
    )
  }

  private punch() {
    const distance = Math.hypot(
      this.player.x - this.enemy.x,
      this.player.y - this.enemy.y,
    )

    if (distance > ATTACK_RANGE || this.enemyHealth <= 0) return

    this.enemyHealth = Math.max(0, this.enemyHealth - ATTACK_DAMAGE)
    this.enemyHealthFill.width = 220 * (this.enemyHealth / ENEMY_MAX_HEALTH)
    this.enemyHealthText.setText(`${this.enemyHealth} / ${ENEMY_MAX_HEALTH}`)
    this.tweens.add({
      targets: this.enemy,
      alpha: 0.35,
      duration: 70,
      yoyo: true,
      repeat: 1,
    })

    if (this.enemyHealth === 0) {
      this.showVictory()
    }
  }

  private showVictory() {
    this.hasWon = true
    this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x050a12, 0.82)

    this.add
      .text(WIDTH / 2, 245, 'VICTORY', {
        fontFamily: 'Arial Black, sans-serif',
        fontSize: '54px',
        color: '#48e4c3',
        letterSpacing: 5,
      })
      .setOrigin(0.5)

    this.add
      .text(WIDTH / 2, 300, 'The arena is yours.', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '17px',
        color: '#c5d4e3',
      })
      .setOrigin(0.5)

    const restartButton = this.add
      .rectangle(WIDTH / 2, 372, 176, 52, 0x48e4c3)
      .setInteractive({ useHandCursor: true })
    const restartLabel = this.add
      .text(WIDTH / 2, 372, 'RESTART', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '15px',
        fontStyle: 'bold',
        color: '#09111f',
        letterSpacing: 2,
      })
      .setOrigin(0.5)

    restartButton.on('pointerover', () => restartButton.setFillStyle(0x8ffff0))
    restartButton.on('pointerout', () => restartButton.setFillStyle(0x48e4c3))
    restartButton.on('pointerdown', () => this.scene.restart())
    restartLabel.setDepth(1)
  }
}
