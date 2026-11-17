import { EventBus } from '../event-bus'
import { Scene } from 'phaser'
import {
  dashWithinBounds,
  moveWithinBounds,
  normalizeDirection,
} from '@arena-brawl/character-movement'

const WIDTH = 800
const HEIGHT = 600
const ARENA = { left: 24, right: 776, top: 104, bottom: 576 }

type CombatAction = 'punch' | 'kick' | 'dash' | 'special'

type ActionConfig = {
  staminaCost: number
  cooldownMs: number
  damage: number
  range: number
  minFacingDot: number
  color: number
  effectRadius: number
}

const COMBAT = {
  playerRadius: 18,
  playerSpeed: 250,
  playerHealth: 100,
  enemyHealth: 100,
  maxStamina: 100,
  staminaRegenPerSecond: 15,
  dashDistance: 150,
  barWidth: 220,
  actions: {
    punch: {
      staminaCost: 0,
      cooldownMs: 400,
      damage: 10,
      range: 86,
      minFacingDot: 0.35,
      color: 0x48e4c3,
      effectRadius: 24,
    },
    kick: {
      staminaCost: 0,
      cooldownMs: 700,
      damage: 15,
      range: 116,
      minFacingDot: 0.25,
      color: 0xffbc66,
      effectRadius: 34,
    },
    dash: {
      staminaCost: 20,
      cooldownMs: 1000,
      damage: 0,
      range: 0,
      minFacingDot: 0,
      color: 0x70a8ff,
      effectRadius: 0,
    },
    special: {
      staminaCost: 30,
      cooldownMs: 2000,
      damage: 25,
      range: 148,
      minFacingDot: 0.2,
      color: 0xc78bff,
      effectRadius: 54,
    },
  } satisfies Record<CombatAction, ActionConfig>,
} as const

const ACTION_FOR_KEY: Record<string, CombatAction> = {
  KeyJ: 'punch',
  KeyK: 'kick',
  KeyL: 'dash',
  Space: 'special',
}

export class Game extends Scene {
  private player!: Phaser.GameObjects.Arc
  private playerLabel!: Phaser.GameObjects.Text
  private facingIndicator!: Phaser.GameObjects.Arc
  private enemy!: Phaser.GameObjects.Arc
  private enemyHealthFill!: Phaser.GameObjects.Rectangle
  private enemyHealthText!: Phaser.GameObjects.Text
  private staminaFill!: Phaser.GameObjects.Rectangle
  private staminaText!: Phaser.GameObjects.Text
  private displayedStamina = -1
  private pressedKeys = new Set<string>()
  private pendingActions: CombatAction[] = []
  private cooldowns: Record<CombatAction, number> = {
    punch: 0,
    kick: 0,
    dash: 0,
    special: 0,
  }
  private facingX = 1
  private facingY = 0
  private stamina: number = COMBAT.maxStamina
  private enemyHealth: number = COMBAT.enemyHealth
  private hasWon = false

  private readonly handleKeyDown = (event: KeyboardEvent) => {
    if (event.repeat) return

    if (
      ![
        'KeyW',
        'KeyA',
        'KeyS',
        'KeyD',
        ...Object.keys(ACTION_FOR_KEY),
      ].includes(event.code)
    ) {
      return
    }

    event.preventDefault()

    const action = ACTION_FOR_KEY[event.code]
    if (action && !this.pressedKeys.has(event.code)) {
      this.pendingActions.push(action)
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
    this.pendingActions = []
  }

  constructor() {
    super('Game')
  }

  create() {
    this.enemyHealth = COMBAT.enemyHealth
    this.hasWon = false
    this.stamina = COMBAT.maxStamina
    this.displayedStamina = -1
    this.facingX = 1
    this.facingY = 0
    this.pressedKeys.clear()
    this.pendingActions = []
    this.cooldowns = { punch: 0, kick: 0, dash: 0, special: 0 }

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

  update(time: number, delta: number) {
    if (this.hasWon) return

    this.stamina = Math.min(
      COMBAT.maxStamina,
      this.stamina + COMBAT.staminaRegenPerSecond * (delta / 1000),
    )
    this.updateStaminaHud()
    this.movePlayer(delta)
    this.playerLabel.setPosition(this.player.x, this.player.y + 30)
    this.facingIndicator.setPosition(
      this.player.x + this.facingX * 10,
      this.player.y + this.facingY * 10,
    )

    for (const action of this.pendingActions.splice(0)) {
      if (this.hasWon) break
      this.performAction(action, time)
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
      .text(
        WIDTH / 2,
        584,
        'WASD MOVE  •  J PUNCH  •  K KICK  •  L DASH  •  SPACE SPECIAL',
        {
          fontFamily: 'Arial, sans-serif',
          fontSize: '11px',
          color: '#91a8bd',
          letterSpacing: 1,
        },
      )
      .setOrigin(0.5)
  }

  private createHud() {
    this.add.text(28, 14, 'PLAYER', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '13px',
      fontStyle: 'bold',
      color: '#48e4c3',
      letterSpacing: 2,
    })
    this.add.text(548, 14, 'ARENA BOT', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '13px',
      fontStyle: 'bold',
      color: '#ff8b70',
      letterSpacing: 2,
    })
    this.add
      .text(248, 14, `${COMBAT.playerHealth} / ${COMBAT.playerHealth}`, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '12px',
        color: '#dbe7f3',
        align: 'right',
      })
      .setOrigin(1, 0)

    this.add.rectangle(28, 38, COMBAT.barWidth, 10, 0x26364a).setOrigin(0, 0.5)
    this.add.rectangle(548, 38, COMBAT.barWidth, 10, 0x26364a).setOrigin(0, 0.5)
    this.add
      .rectangle(28, 38, COMBAT.barWidth, 10, 0x48e4c3)
      .setOrigin(0, 0.5)
      .setDepth(1)
    this.enemyHealthFill = this.add
      .rectangle(548, 38, COMBAT.barWidth, 10, 0xff755f)
      .setOrigin(0, 0.5)
      .setDepth(1)
    this.enemyHealthText = this.add
      .text(768, 14, `${COMBAT.enemyHealth} / ${COMBAT.enemyHealth}`, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '12px',
        color: '#dbe7f3',
        align: 'right',
      })
      .setOrigin(1, 0)

    this.add.text(28, 55, 'STAMINA', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '10px',
      fontStyle: 'bold',
      color: '#8fb9ff',
      letterSpacing: 1,
    })
    this.staminaText = this.add
      .text(248, 55, `${COMBAT.maxStamina} / ${COMBAT.maxStamina}`, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '10px',
        color: '#dbe7f3',
        align: 'right',
      })
      .setOrigin(1, 0)
    this.add.rectangle(28, 78, COMBAT.barWidth, 7, 0x26364a).setOrigin(0, 0.5)
    this.staminaFill = this.add
      .rectangle(28, 78, COMBAT.barWidth, 7, 0x70a8ff)
      .setOrigin(0, 0.5)
      .setDepth(1)
  }

  private createFighters() {
    this.player = this.add
      .circle(190, 334, COMBAT.playerRadius, 0x48e4c3)
      .setStrokeStyle(3, 0xd8fff6)
      .setDepth(2)
    this.facingIndicator = this.add
      .circle(this.player.x + 10, this.player.y, 4, 0xeafffa)
      .setDepth(3)
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
    const direction = normalizeDirection({
      x:
        Number(this.pressedKeys.has('KeyD')) -
        Number(this.pressedKeys.has('KeyA')),
      y:
        Number(this.pressedKeys.has('KeyS')) -
        Number(this.pressedKeys.has('KeyW')),
    })

    if (direction.x === 0 && direction.y === 0) return

    this.facingX = direction.x
    this.facingY = direction.y

    const position = moveWithinBounds(
      { x: this.player.x, y: this.player.y },
      direction,
      COMBAT.playerSpeed,
      delta,
      ARENA,
      COMBAT.playerRadius,
    )
    this.player.setPosition(position.x, position.y)
  }

  private updateStaminaHud() {
    const stamina = Math.floor(this.stamina)
    this.staminaFill.width =
      COMBAT.barWidth * (this.stamina / COMBAT.maxStamina)
    if (stamina !== this.displayedStamina) {
      this.staminaText.setText(`${stamina} / ${COMBAT.maxStamina}`)
      this.displayedStamina = stamina
    }
  }

  private performAction(action: CombatAction, time: number) {
    const config = COMBAT.actions[action]
    if (
      time < this.cooldowns[action] ||
      this.stamina < config.staminaCost ||
      this.enemyHealth <= 0
    ) {
      return
    }

    this.cooldowns[action] = time + config.cooldownMs
    this.stamina -= config.staminaCost
    this.updateStaminaHud()

    if (action === 'dash') {
      this.dash(config)
      return
    }

    this.showAttackEffect(config)
    this.hitEnemy(config)
  }

  private hitEnemy(config: ActionConfig) {
    const dx = this.enemy.x - this.player.x
    const dy = this.enemy.y - this.player.y
    const distance = Math.hypot(dx, dy)
    const facingDot =
      distance === 0 ? 1 : (dx * this.facingX + dy * this.facingY) / distance

    if (
      distance > config.range ||
      facingDot < config.minFacingDot ||
      this.enemyHealth <= 0
    ) {
      return
    }

    this.enemyHealth = Math.max(0, this.enemyHealth - config.damage)
    this.enemyHealthFill.width =
      COMBAT.barWidth * (this.enemyHealth / COMBAT.enemyHealth)
    this.enemyHealthText.setText(`${this.enemyHealth} / ${COMBAT.enemyHealth}`)
    this.enemy.setFillStyle(0xffffff)
    this.tweens.add({
      targets: this.enemy,
      alpha: 0.35,
      duration: 70,
      yoyo: true,
      repeat: 1,
      onComplete: () => {
        this.enemy.setFillStyle(0xff755f)
        this.enemy.setAlpha(1)
      },
    })
    this.showDamageNumber(config.damage)

    if (this.enemyHealth === 0) {
      this.showVictory()
    }
  }

  private showAttackEffect(config: ActionConfig) {
    const effect = this.add
      .circle(
        this.player.x + this.facingX * (config.range * 0.55),
        this.player.y + this.facingY * (config.range * 0.55),
        config.effectRadius,
        config.color,
        0.38,
      )
      .setDepth(3)

    this.tweens.add({
      targets: effect,
      scale: 1.45,
      alpha: 0,
      duration: 180,
      onComplete: () => effect.destroy(),
    })
  }

  private showDamageNumber(damage: number) {
    const label = this.add
      .text(this.enemy.x, this.enemy.y - 36, `-${damage}`, {
        fontFamily: 'Arial Black, sans-serif',
        fontSize: '20px',
        color: '#fff4c2',
        stroke: '#442b2b',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(4)

    this.tweens.add({
      targets: label,
      y: label.y - 38,
      alpha: 0,
      duration: 650,
      onComplete: () => label.destroy(),
    })
  }

  private dash(config: ActionConfig) {
    const movingX =
      Number(this.pressedKeys.has('KeyD')) -
      Number(this.pressedKeys.has('KeyA'))
    const movingY =
      Number(this.pressedKeys.has('KeyS')) -
      Number(this.pressedKeys.has('KeyW'))
    const startX = this.player.x
    const startY = this.player.y
    const result = dashWithinBounds(
      { x: startX, y: startY },
      { x: movingX, y: movingY },
      { x: this.facingX, y: this.facingY },
      COMBAT.dashDistance,
      ARENA,
      COMBAT.playerRadius,
    )
    this.facingX = result.direction.x
    this.facingY = result.direction.y
    this.player.setPosition(result.position.x, result.position.y)

    const trail = this.add.graphics().setDepth(1)
    trail.lineStyle(10, config.color, 0.62)
    trail.lineBetween(startX, startY, this.player.x, this.player.y)
    this.tweens.add({
      targets: trail,
      alpha: 0,
      duration: 220,
      onComplete: () => trail.destroy(),
    })
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
