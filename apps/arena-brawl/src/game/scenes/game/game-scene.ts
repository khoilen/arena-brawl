import { EventBus } from '../../event-bus'
import { Scene } from 'phaser'
import {
  dashWithinBounds,
  moveWithinBounds,
  normalizeDirection,
} from '@arena-brawl/character-movement'

import { attackHits, type PendingAttack } from './combat-utils'
import {
  createGameView,
  flashFighter,
  showAttackEffect,
  showDamageNumber,
  showDashTrail,
} from './game-view'
import {
  ACTION_FOR_KEY,
  ARENA_BOUNDS as ARENA,
  COMBAT,
  GAME_HEIGHT as HEIGHT,
  GAME_WIDTH as WIDTH,
  type ActionConfig,
  type CombatAction,
  type EnemyState,
} from './game-config'

export class Game extends Scene {
  private player!: Phaser.GameObjects.Arc
  private playerLabel!: Phaser.GameObjects.Text
  private facingIndicator!: Phaser.GameObjects.Arc
  private enemyLabel!: Phaser.GameObjects.Text
  private enemyStaminaFill!: Phaser.GameObjects.Rectangle
  private enemy!: Phaser.GameObjects.Arc
  private enemyHealthFill!: Phaser.GameObjects.Rectangle
  private enemyHealthText!: Phaser.GameObjects.Text
  private playerHealthFill!: Phaser.GameObjects.Rectangle
  private playerHealthText!: Phaser.GameObjects.Text
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
  private enemyCooldowns: Record<'punch' | 'kick' | 'dash', number> = {
    punch: 0,
    kick: 0,
    dash: 0,
  }
  private pendingAttacks: PendingAttack[] = []
  private enemyState: EnemyState = 'CHASE'
  private enemyHealth: number = COMBAT.enemyHealth
  private playerHealth: number = COMBAT.playerHealth
  private enemyStamina: number = COMBAT.maxStamina
  private enemyFacingX = -1
  private enemyFacingY = 0
  private enemyNextDecisionAt = 0
  private enemyDodgeAt: number | null = null
  private enemyDodgeUntil = 0
  private enemyDodgeCount = 0
  private dodgeRandomState = 0x0a11ce
  private enemyStaminaDisplayed = -1
  private playerHealthDisplayed = -1
  private facingX = 1
  private facingY = 0
  private stamina: number = COMBAT.maxStamina
  private matchEnded = false

  private readonly handleKeyDown = (event: KeyboardEvent) => {
    if (event.repeat || this.matchEnded) return

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
    this.playerHealth = COMBAT.playerHealth
    this.stamina = COMBAT.maxStamina
    this.enemyStamina = COMBAT.maxStamina
    this.displayedStamina = -1
    this.playerHealthDisplayed = -1
    this.enemyStaminaDisplayed = -1
    this.facingX = 1
    this.facingY = 0
    this.enemyFacingX = -1
    this.enemyFacingY = 0
    this.pressedKeys.clear()
    this.pendingActions = []
    this.pendingAttacks = []
    this.cooldowns = { punch: 0, kick: 0, dash: 0, special: 0 }
    this.enemyCooldowns = { punch: 0, kick: 0, dash: 0 }
    this.enemyState = 'CHASE'
    this.enemyNextDecisionAt = 0
    this.enemyDodgeAt = null
    this.enemyDodgeUntil = 0
    this.enemyDodgeCount = 0
    this.dodgeRandomState = 0x0a11ce
    this.matchEnded = false

    this.cameras.main.setBackgroundColor('#09111f')
    Object.assign(this, createGameView(this))

    window.addEventListener('keydown', this.handleKeyDown)
    window.addEventListener('keyup', this.handleKeyUp)
    window.addEventListener('blur', this.clearPressedKeys)
    this.events.once('shutdown', this.removeKeyboardListeners, this)
    this.events.once('destroy', this.removeKeyboardListeners, this)

    EventBus.emit('current-scene-ready', this)
  }

  update(time: number, delta: number) {
    if (this.matchEnded) return

    this.stamina = Math.min(
      COMBAT.maxStamina,
      this.stamina + COMBAT.staminaRegenPerSecond * (delta / 1000),
    )
    this.enemyStamina = Math.min(
      COMBAT.maxStamina,
      this.enemyStamina + COMBAT.staminaRegenPerSecond * (delta / 1000),
    )
    this.updateStaminaHud()
    this.updatePlayerHealthHud()
    this.movePlayer(delta)

    for (const action of this.pendingActions.splice(0)) {
      if (this.matchEnded) break
      this.performAction(action, time)
    }

    this.updateEnemyAI(time, delta)
    this.resolvePendingAttacks(time)
    this.updateFighterLabels()
    this.updateEnemyStaminaHud()
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

  private updatePlayerHealthHud() {
    const health = Math.floor(this.playerHealth)
    this.playerHealthFill.width =
      COMBAT.barWidth * (this.playerHealth / COMBAT.playerHealth)
    if (health !== this.playerHealthDisplayed) {
      this.playerHealthText.setText(`${health} / ${COMBAT.playerHealth}`)
      this.playerHealthDisplayed = health
    }
  }

  private updateEnemyStaminaHud() {
    const stamina = Math.floor(this.enemyStamina)
    this.enemyStaminaFill.width = 64 * (this.enemyStamina / COMBAT.maxStamina)
    this.enemyStaminaFill.setPosition(this.enemy.x - 32, this.enemy.y - 38)
    if (stamina !== this.enemyStaminaDisplayed) {
      this.enemyStaminaDisplayed = stamina
    }
  }

  private updateFighterLabels() {
    this.playerLabel.setPosition(this.player.x, this.player.y + 30)
    this.facingIndicator.setPosition(
      this.player.x + this.facingX * 10,
      this.player.y + this.facingY * 10,
    )
    this.enemyLabel.setPosition(this.enemy.x, this.enemy.y - 56)
  }

  private performAction(action: CombatAction, time: number) {
    const config = COMBAT.actions[action]
    if (
      time < this.cooldowns[action] ||
      this.stamina < config.staminaCost ||
      this.enemyState === 'DEAD' ||
      this.matchEnded
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

    const origin = { x: this.player.x, y: this.player.y }
    const facing = { x: this.facingX, y: this.facingY }
    showAttackEffect(this, this.player, facing, config)

    if (attackHits(origin, facing, this.enemy, config)) {
      this.registerEnemyThreat(time)
    }

    this.pendingAttacks.push({
      attacker: 'player',
      action,
      origin,
      facing,
      resolvesAt: time + COMBAT.normal.playerAttackWindupMs,
    })
  }

  private registerEnemyThreat(time: number) {
    if (
      this.enemyDodgeAt !== null ||
      this.enemyStamina < COMBAT.actions.dash.staminaCost ||
      time < this.enemyCooldowns.dash
    ) {
      return
    }

    if (this.nextDodgeRoll() < COMBAT.normal.dodgeProbability) {
      this.enemyDodgeAt = time + COMBAT.normal.reactionDelayMs
    }
  }

  private nextDodgeRoll() {
    this.dodgeRandomState =
      (Math.imul(this.dodgeRandomState, 1664525) + 1013904223) >>> 0
    return this.dodgeRandomState / 0x100000000
  }

  private updateEnemyAI(time: number, delta: number) {
    if (this.enemyState === 'DEAD') return

    const toPlayer = normalizeDirection({
      x: this.player.x - this.enemy.x,
      y: this.player.y - this.enemy.y,
    })
    if (toPlayer.x !== 0 || toPlayer.y !== 0) {
      this.enemyFacingX = toPlayer.x
      this.enemyFacingY = toPlayer.y
    }

    if (this.enemyDodgeAt !== null && time >= this.enemyDodgeAt) {
      this.enemyDodgeAt = null
      this.dodgeEnemy(time)
    }

    if (this.enemyState === 'DODGE' && time < this.enemyDodgeUntil) return

    if (time >= this.enemyNextDecisionAt) {
      this.enemyNextDecisionAt = time + COMBAT.normal.aiDecisionIntervalMs
      const distance = Math.hypot(
        this.player.x - this.enemy.x,
        this.player.y - this.enemy.y,
      )

      if (distance <= COMBAT.actions.kick.range) {
        this.enemyState = 'ATTACK'
        this.startEnemyAttack(distance, time)
      } else {
        this.enemyState = 'CHASE'
      }
    }

    if (this.enemyState === 'CHASE') {
      this.moveEnemy(delta)
    }
  }

  private moveEnemy(delta: number) {
    const direction = normalizeDirection({
      x: this.player.x - this.enemy.x,
      y: this.player.y - this.enemy.y,
    })
    const distance = Math.hypot(
      this.player.x - this.enemy.x,
      this.player.y - this.enemy.y,
    )

    if (distance <= COMBAT.actions.kick.range) return

    const position = moveWithinBounds(
      { x: this.enemy.x, y: this.enemy.y },
      direction,
      COMBAT.playerSpeed * COMBAT.normal.enemySpeedMultiplier,
      delta,
      ARENA,
      24,
    )
    this.enemy.setPosition(position.x, position.y)
  }

  private startEnemyAttack(distance: number, time: number) {
    const punchRange = COMBAT.actions.punch.range * 0.75
    let action: 'punch' | 'kick' | null = null
    if (distance <= punchRange && time >= this.enemyCooldowns.punch) {
      action = 'punch'
    } else if (time >= this.enemyCooldowns.kick) {
      action = 'kick'
    } else if (
      distance <= COMBAT.actions.punch.range &&
      time >= this.enemyCooldowns.punch
    ) {
      action = 'punch'
    }

    if (!action) return
    const config = COMBAT.actions[action]

    if (
      time < this.enemyCooldowns[action] ||
      !attackHits(
        { x: this.enemy.x, y: this.enemy.y },
        { x: this.enemyFacingX, y: this.enemyFacingY },
        this.player,
        config,
      )
    ) {
      return
    }

    this.enemyCooldowns[action] = time + config.cooldownMs
    const origin = { x: this.enemy.x, y: this.enemy.y }
    const facing = { x: this.enemyFacingX, y: this.enemyFacingY }
    showAttackEffect(this, this.enemy, facing, config)
    this.pendingAttacks.push({
      attacker: 'enemy',
      action,
      origin,
      facing,
      resolvesAt: time + COMBAT.normal.enemyAttackWindupMs,
    })
  }

  private dodgeEnemy(time: number) {
    const dash = COMBAT.actions.dash
    if (
      this.enemyStamina < dash.staminaCost ||
      time < this.enemyCooldowns.dash ||
      this.enemyState === 'DEAD'
    ) {
      return
    }

    this.enemyDodgeCount += 1
    const away = normalizeDirection({
      x: this.enemy.x - this.player.x,
      y: this.enemy.y - this.player.y,
    })
    const side = this.enemyDodgeCount % 2 === 0 ? 1 : -1
    const direction =
      this.enemyDodgeCount % 2 === 0
        ? away
        : { x: -away.y * side, y: away.x * side }
    const start = { x: this.enemy.x, y: this.enemy.y }
    const result = dashWithinBounds(
      start,
      direction,
      { x: this.enemyFacingX, y: this.enemyFacingY },
      COMBAT.dashDistance,
      ARENA,
      24,
    )

    this.enemyStamina -= dash.staminaCost
    this.enemyCooldowns.dash = time + dash.cooldownMs
    this.enemyState = 'DODGE'
    this.enemyDodgeUntil = time + COMBAT.normal.dodgeDurationMs
    this.pendingAttacks = this.pendingAttacks.filter(
      (attack) => attack.attacker !== 'enemy',
    )
    this.enemy.setPosition(result.position.x, result.position.y)
    showDashTrail(this, start, result.position, dash.color)
    this.updateEnemyStaminaHud()
  }

  private resolvePendingAttacks(time: number) {
    const ready = this.pendingAttacks.filter(
      (attack) => time >= attack.resolvesAt,
    )
    this.pendingAttacks = this.pendingAttacks.filter(
      (attack) => time < attack.resolvesAt,
    )

    for (const attack of ready) {
      if (this.matchEnded) return
      const config = COMBAT.actions[attack.action]
      const target = attack.attacker === 'player' ? this.enemy : this.player

      if (!attackHits(attack.origin, attack.facing, target, config)) continue

      if (attack.attacker === 'player' && this.enemyState !== 'DEAD') {
        this.damageEnemy(config.damage)
      } else if (attack.attacker === 'enemy') {
        this.damagePlayer(config.damage)
      }
    }
  }

  private damageEnemy(damage: number) {
    if (this.enemyState === 'DEAD') return

    this.enemyHealth = Math.max(0, this.enemyHealth - damage)
    this.enemyHealthFill.width =
      COMBAT.barWidth * (this.enemyHealth / COMBAT.enemyHealth)
    this.enemyHealthText.setText(`${this.enemyHealth} / ${COMBAT.enemyHealth}`)
    this.enemyLabel.setText(`${this.enemyHealth} HP`)
    flashFighter(this, this.enemy, 0xff755f)
    showDamageNumber(this, this.enemy, damage)

    if (this.enemyHealth === 0) {
      this.enemyState = 'DEAD'
      this.enemyDodgeAt = null
      this.showMatchEnd('YOU WIN', 0x48e4c3)
    }
  }

  private damagePlayer(damage: number) {
    if (this.matchEnded) return

    this.playerHealth = Math.max(0, this.playerHealth - damage)
    this.playerHealthFill.width =
      COMBAT.barWidth * (this.playerHealth / COMBAT.playerHealth)
    this.playerHealthText.setText(
      `${this.playerHealth} / ${COMBAT.playerHealth}`,
    )
    this.playerHealthDisplayed = this.playerHealth
    flashFighter(this, this.player, 0x48e4c3)
    showDamageNumber(this, this.player, damage)

    if (this.playerHealth === 0) {
      this.showMatchEnd('YOU LOSE', 0xff755f)
    }
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

    showDashTrail(this, { x: startX, y: startY }, result.position, config.color)
  }

  private showMatchEnd(title: 'YOU WIN' | 'YOU LOSE', color: number) {
    this.matchEnded = true
    this.pendingActions = []
    this.pendingAttacks = []
    this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x050a12, 0.82)

    this.add
      .text(WIDTH / 2, 245, title, {
        fontFamily: 'Arial Black, sans-serif',
        fontSize: '54px',
        color: `#${color.toString(16).padStart(6, '0')}`,
        letterSpacing: 5,
      })
      .setOrigin(0.5)

    this.add
      .text(
        WIDTH / 2,
        300,
        title === 'YOU WIN' ? 'The arena is yours.' : 'You were defeated.',
        {
          fontFamily: 'Arial, sans-serif',
          fontSize: '17px',
          color: '#c5d4e3',
        },
      )
      .setOrigin(0.5)

    const restartButton = this.add
      .rectangle(WIDTH / 2, 372, 176, 52, color)
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

    restartButton.on('pointerover', () => restartButton.setFillStyle(0xffffff))
    restartButton.on('pointerout', () => restartButton.setFillStyle(color))
    restartButton.on('pointerdown', () => this.scene.restart())
    restartLabel.setDepth(1)
  }
}
