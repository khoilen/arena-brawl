import { EventBus } from '../../event-bus'
import { Scene } from 'phaser'
import {
  dashWithinBounds,
  moveWithinBounds,
  normalizeDirection,
} from '@arena-brawl/character-movement'

import { attackHits, type PendingAttack } from './combat-utils'
import { GameAudio } from './game-audio'
import {
  flashCharacter,
  createFighterVisual,
  FighterAnimationController,
  FIGHTERS,
} from './fighter-view'
import {
  createGameView,
  flashFighter,
  showAttackEffect,
  showDamageNumber,
  showDashTrail,
  showDodgeAfterimage,
  showKickTrail,
  showSpecialEffect,
  showHitFeedback,
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

const DIFFICULTIES = [
  { label: 'EASY', description: 'Bot chậm hơn · đòn nhẹ hơn', enemySpeed: 0.56, enemyDamage: 0.7, decisionInterval: 520, dodgeProbability: 0.12 },
  { label: 'NORMAL', description: 'Nhịp đấu cân bằng', enemySpeed: 0.76, enemyDamage: 1, decisionInterval: 300, dodgeProbability: 0.25 },
  { label: 'HARD', description: 'Bot phản ứng nhanh · đòn nặng', enemySpeed: 0.94, enemyDamage: 1.25, decisionInterval: 190, dodgeProbability: 0.4 },
] as const

export class Game extends Scene {
  private player!: Phaser.GameObjects.Arc
  private playerVisual!: Phaser.GameObjects.Container
  private playerAnimator!: FighterAnimationController
  private playerLabel!: Phaser.GameObjects.Text
  private facingIndicator!: Phaser.GameObjects.Arc
  private enemyLabel!: Phaser.GameObjects.Text
  private enemyStaminaFill!: Phaser.GameObjects.Rectangle
  private enemyHudStaminaFill!: Phaser.GameObjects.Rectangle
  private enemyStaminaText!: Phaser.GameObjects.Text
  private enemy!: Phaser.GameObjects.Arc
  private enemyVisual!: Phaser.GameObjects.Container
  private enemyAnimator!: FighterAnimationController
  private enemyHealthFill!: Phaser.GameObjects.Rectangle
  private enemyHealthText!: Phaser.GameObjects.Text
  private playerHealthFill!: Phaser.GameObjects.Rectangle
  private playerHealthText!: Phaser.GameObjects.Text
  private staminaFill!: Phaser.GameObjects.Rectangle
  private staminaText!: Phaser.GameObjects.Text
  private cooldownText!: Phaser.GameObjects.Text
  private timerText!: Phaser.GameObjects.Text
  private roundStartedAt = 0
  private displayedStamina = -1
  private pressedKeys = new Set<string>()
  private pendingJump = false
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
  private playerVelocity = { x: 0, y: 0 }
  private enemyVelocity = { x: 0, y: 0 }
  private stamina: number = COMBAT.maxStamina
  private matchEnded = false
  private selectedCharacter = 0
  private selectedDifficulty = 1
  private audio = new GameAudio()
  private roundStarted = false
  private setupOverlay?: Phaser.GameObjects.Container
  private characterBorders: Phaser.GameObjects.Rectangle[] = []
  private difficultyBorders: Phaser.GameObjects.Rectangle[] = []
  private difficultyDescription?: Phaser.GameObjects.Text

  private get difficulty() {
    return DIFFICULTIES[this.selectedDifficulty]
  }

  private readonly handleKeyDown = (event: KeyboardEvent) => {
    if (event.repeat || this.matchEnded) return

    if (!this.roundStarted) {
      const fighterSlot = ['Digit1', 'Digit2', 'Digit3'].indexOf(event.code)
      if (fighterSlot >= 0) {
        event.preventDefault()
        this.selectCharacter(fighterSlot)
      } else if (event.code === 'KeyQ' || event.code === 'KeyE') {
        event.preventDefault()
        this.selectDifficulty(this.selectedDifficulty + (event.code === 'KeyE' ? 1 : -1))
      } else if (event.code === 'Enter' || event.code === 'Space') {
        event.preventDefault()
        this.startRound()
      }
      return
    }

    if (
      ![
        'KeyW',
        'KeyA',
        'KeyS',
        'KeyD',
        'KeyI',
        'KeyM',
        ...Object.keys(ACTION_FOR_KEY),
      ].includes(event.code)
    ) {
      return
    }

    event.preventDefault()

    if (event.code === 'KeyM') {
      this.audio.toggle()
      return
    }

    if (event.code === 'KeyI') this.pendingJump = true

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
    this.pendingJump = false
  }

  constructor() {
    super('Game')
  }

  preload() {
    FIGHTERS.forEach(({ texture, walkTexture }) => {
      this.load.spritesheet(
        texture,
        `${import.meta.env.BASE_URL}assets/fighters/${texture.replace('fighter-', '')}.png`,
        { frameWidth: 320, frameHeight: 240 },
      )
      this.load.spritesheet(
        walkTexture,
        `${import.meta.env.BASE_URL}assets/fighters/walk/${texture.replace('fighter-', '')}.png`,
        { frameWidth: 320, frameHeight: 240 },
      )
    })
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
    this.playerVelocity = { x: 0, y: 0 }
    this.enemyVelocity = { x: 0, y: 0 }
    this.enemyFacingX = -1
    this.enemyFacingY = 0
    this.pressedKeys.clear()
    this.pendingActions = []
    this.pendingJump = false
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
    this.selectedCharacter = 0
    this.selectedDifficulty = 1
    this.roundStarted = false
    this.characterBorders = []
    this.difficultyBorders = []
    this.roundStartedAt = this.time.now

    this.cameras.main.setBackgroundColor('#09111f')
    FIGHTERS.forEach(({ texture, walkTexture }) => {
      const makeAnimation = (stance: string, frameTexture: string, frames: number[], frameRate: number, repeat: number) => {
        const key = `${texture}-${stance}`
        if (this.anims.exists(key)) return
        this.anims.create({
          key,
          frames: frames.map((frame) => ({ key: frameTexture, frame })),
          frameRate,
          repeat,
        })
      }
      makeAnimation('walk', walkTexture, [0, 1, 2, 3], 6, -1)
      makeAnimation('punch', texture, [4, 5], 12, 0)
      makeAnimation('kick', texture, [6, 7], 8, 0)
    })
    Object.assign(this, createGameView(this, 0, 2))
    this.playerAnimator = new FighterAnimationController(this, this.playerVisual)
    this.enemyAnimator = new FighterAnimationController(this, this.enemyVisual)
    this.buildSetupOverlay()

    window.addEventListener('keydown', this.handleKeyDown)
    window.addEventListener('keyup', this.handleKeyUp)
    window.addEventListener('blur', this.clearPressedKeys)
    this.events.once('shutdown', this.removeKeyboardListeners, this)
    this.events.once('destroy', this.removeKeyboardListeners, this)

    EventBus.emit('current-scene-ready', this)
  }

  update(time: number, delta: number) {
    if (this.matchEnded || !this.roundStarted) return

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

    if (this.pendingJump) {
      this.pendingJump = false
      this.playerAnimator.play('jump', this.facingX)
      this.audio.play('jump')
    }

    for (const action of this.pendingActions.splice(0)) {
      if (this.matchEnded) break
      this.performAction(action, time)
    }

    this.updateEnemyAI(time, delta)
    this.resolvePendingAttacks(time)
    this.updateFighterLabels()
    this.updateEnemyStaminaHud()
    const seconds = Math.max(0, 84 - Math.floor((time - this.roundStartedAt) / 1000))
    this.timerText.setText(`${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`)
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

    const hasInput = direction.x !== 0 || direction.y !== 0
    if (hasInput) {
      this.facingX = direction.x || this.facingX
      this.facingY = direction.y
    }

    const targetVelocity = {
      x: direction.x * COMBAT.playerSpeed,
      y: direction.y * COMBAT.playerSpeed,
    }
    const maxChange = (hasInput ? 1850 : 2300) * (Math.min(delta, 50) / 1000)
    this.playerVelocity = approachVector(this.playerVelocity, targetVelocity, maxChange)
    const speed = Math.hypot(this.playerVelocity.x, this.playerVelocity.y)
    const position = speed > 0.5
      ? moveWithinBounds(
          { x: this.player.x, y: this.player.y },
          normalizeDirection(this.playerVelocity),
          speed,
          delta,
          ARENA,
          COMBAT.playerRadius,
        )
      : { x: this.player.x, y: this.player.y }
    this.player.setPosition(position.x, position.y)
    this.playerVisual.setPosition(position.x, position.y)
    const moving = speed > 12
    this.playerAnimator.setMovement(moving, this.facingX, speed / COMBAT.playerSpeed)
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
    this.enemyHudStaminaFill.width = COMBAT.barWidth * (this.enemyStamina / COMBAT.maxStamina)
    this.enemyStaminaFill.setPosition(this.enemy.x - 32, this.enemy.y - 38)
    this.enemyVisual.setPosition(this.enemy.x, this.enemy.y)
    if (stamina !== this.enemyStaminaDisplayed) {
      this.enemyStaminaText.setText(`${stamina} / ${COMBAT.maxStamina}`)
      this.enemyStaminaDisplayed = stamina
    }
  }

  private updateFighterLabels() {
    const bob = Math.sin(this.time.now / 125) * 1.5
    this.playerLabel.setPosition(this.player.x, this.player.y + 48)
    this.playerVisual.setPosition(this.player.x, this.player.y + bob)
    this.enemyVisual.setPosition(this.enemy.x, this.enemy.y + Math.sin(this.time.now / 145 + 1) * 1.5)
    this.playerAnimator.setFacing(this.facingX)
    this.enemyAnimator.setFacing(this.enemyFacingX)
    this.facingIndicator.setPosition(this.player.x + this.facingX * 21, this.player.y + this.facingY * 21)
    this.enemyLabel.setPosition(this.enemy.x, this.enemy.y - 56)
    this.cooldownText.setText(`J  PUNCH      ${this.cooldownHint('punch')}\nK  KICK       ${this.cooldownHint('kick')}\nL  DODGE      ${this.cooldownHint('dash')}\nSPACE  SPECIAL  ${this.cooldownHint('special')}`)
  }

  private selectCharacter(index: number) {
    index = Math.max(0, Math.min(FIGHTERS.length - 1, Math.floor(index)))
    if (index === this.selectedCharacter) return
    this.selectedCharacter = index
    this.playerAnimator.setCharacter(index)
    const enemyIndex = (index + 2) % FIGHTERS.length
    this.enemyAnimator.setCharacter(enemyIndex)
    this.playerLabel.setText(`P1 · ${FIGHTERS[index].label}`)
    this.enemyLabel.setText(`BOT · ${FIGHTERS[enemyIndex].label}`)
    this.characterBorders.forEach((border, cardIndex) =>
      border.setStrokeStyle(cardIndex === index ? 3 : 1, cardIndex === index ? 0xf2bd69 : 0x72533d, cardIndex === index ? 1 : 0.9),
    )
  }

  private selectDifficulty(index: number) {
    this.selectedDifficulty = Math.max(0, Math.min(DIFFICULTIES.length - 1, Math.floor(index)))
    this.difficultyBorders.forEach((border, cardIndex) =>
      border.setStrokeStyle(cardIndex === this.selectedDifficulty ? 3 : 1, cardIndex === this.selectedDifficulty ? 0xf2bd69 : 0x72533d, cardIndex === this.selectedDifficulty ? 1 : 0.9),
    )
    this.difficultyDescription?.setText(this.difficulty.description)
  }

  private buildSetupOverlay() {
    const overlay = this.add.container(0, 0).setDepth(100)
    this.setupOverlay = overlay
    overlay.add(this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x05060b, 0.78).setInteractive())
    overlay.add(this.add.rectangle(400, 300, 760, 570, 0x171116, 0.98).setStrokeStyle(2, 0x986944, 1))
    overlay.add(this.add.text(400, 43, 'CHOOSE YOUR FIGHTER', {
      fontFamily: 'Arial Black, Arial, sans-serif', fontSize: '30px', color: '#fff2df', letterSpacing: 2,
    }).setOrigin(0.5))
    overlay.add(this.add.text(400, 80, 'Pick a fighter and set the challenge', {
      fontFamily: 'Arial, sans-serif', fontSize: '15px', color: '#c9b8a8',
    }).setOrigin(0.5))

    const cardX = [210, 400, 590]
    FIGHTERS.forEach((fighter, index) => {
      const x = cardX[index]
      const border = this.add.rectangle(x, 214, 174, 226, 0x21191b, 0.96)
        .setStrokeStyle(index === this.selectedCharacter ? 3 : 1, index === this.selectedCharacter ? 0xf2bd69 : 0x72533d, 1)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.selectCharacter(index))
      this.characterBorders.push(border)
      overlay.add(border)

      const preview = createFighterVisual(this, index).setPosition(x, 199).setScale(0.82)
      overlay.add(preview)
      overlay.add(this.add.text(x, 309, fighter.label, {
        fontFamily: 'Arial Black, Arial, sans-serif', fontSize: '19px', color: '#fff0df', letterSpacing: 1,
      }).setOrigin(0.5))
      overlay.add(this.add.text(x, 334, `PRESS ${index + 1}`, {
        fontFamily: 'Arial, sans-serif', fontSize: '11px', color: '#c9a989',
      }).setOrigin(0.5))
    })

    overlay.add(this.add.text(400, 365, 'DIFFICULTY', {
      fontFamily: 'Arial Black, Arial, sans-serif', fontSize: '13px', color: '#e7d6bf', letterSpacing: 2,
    }).setOrigin(0.5))
    const diffX = [294, 400, 506]
    DIFFICULTIES.forEach((difficulty, index) => {
      const border = this.add.rectangle(diffX[index], 399, 106, 38, 0x21191b, 1)
        .setStrokeStyle(index === this.selectedDifficulty ? 3 : 1, index === this.selectedDifficulty ? 0xf2bd69 : 0x72533d, 1)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.selectDifficulty(index))
      this.difficultyBorders.push(border)
      overlay.add(border)
      overlay.add(this.add.text(diffX[index], 399, difficulty.label, {
        fontFamily: 'Arial Black, Arial, sans-serif', fontSize: '13px', color: '#fff0df',
      }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.selectDifficulty(index)))
    })
    this.difficultyDescription = this.add.text(400, 433, this.difficulty.description, {
      fontFamily: 'Arial, sans-serif', fontSize: '12px', color: '#c9b8a8',
    }).setOrigin(0.5)
    overlay.add(this.difficultyDescription)

    const startButton = this.add.rectangle(400, 486, 244, 52, 0x8d2b23, 1)
      .setStrokeStyle(2, 0xf2bd69, 1).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.startRound())
    overlay.add(startButton)
    overlay.add(this.add.text(400, 486, 'START FIGHT', {
      fontFamily: 'Arial Black, Arial, sans-serif', fontSize: '19px', color: '#fff2df', letterSpacing: 2,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.startRound()))
    overlay.add(this.add.text(400, 531, '1–3 fighter     Q / E difficulty     ENTER start', {
      fontFamily: 'Arial, sans-serif', fontSize: '11px', color: '#b6a497',
    }).setOrigin(0.5))
  }

  private startRound() {
    if (this.roundStarted) return
    this.roundStarted = true
    this.audio.unlock()
    this.roundStartedAt = this.time.now
    this.enemyNextDecisionAt = this.time.now + this.difficulty.decisionInterval
    this.setupOverlay?.destroy(true)
    this.setupOverlay = undefined
    this.clearPressedKeys()
  }

  private cooldownHint(action: CombatAction) {
    const remaining = Math.max(0, this.cooldowns[action] - this.time.now)
    return remaining > 0 ? `${(remaining / 1000).toFixed(1)}s` : 'READY'
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
      this.audio.play('dodge')
      this.dash(config)
      return
    }

    this.audio.play(action)

    const origin = { x: this.player.x, y: this.player.y }
    const facing = { x: this.facingX, y: this.facingY }
    showAttackEffect(this, this.player, facing, config)
    if (action === 'kick') showKickTrail(this, this.player, facing)
    if (action === 'punch') {
      this.playerAnimator.play('punch', facing.x)
    } else {
      const visualState = action === 'special' ? 'special' : 'kick'
      this.playerAnimator.play(visualState, facing.x)
    }
    if (action === 'special') showSpecialEffect(this, this.player, facing)

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

    if (this.nextDodgeRoll() < this.difficulty.dodgeProbability) {
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
      this.enemyNextDecisionAt = time + this.difficulty.decisionInterval
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
      this.moveEnemy(delta, true)
    } else if (this.enemyState === 'ATTACK') {
      this.moveEnemy(delta, false)
    }
  }

  private moveEnemy(delta: number, chasing: boolean) {
    const direction = normalizeDirection({
      x: this.player.x - this.enemy.x,
      y: this.player.y - this.enemy.y,
    })
    const distance = Math.hypot(
      this.player.x - this.enemy.x,
      this.player.y - this.enemy.y,
    )

    const shouldMove = chasing && distance > COMBAT.actions.kick.range
    const enemySpeed = COMBAT.playerSpeed * this.difficulty.enemySpeed
    const targetVelocity = shouldMove
      ? { x: direction.x * enemySpeed, y: direction.y * enemySpeed }
      : { x: 0, y: 0 }
    const maxChange = (shouldMove ? 1500 : 2100) * (Math.min(delta, 50) / 1000)
    this.enemyVelocity = approachVector(this.enemyVelocity, targetVelocity, maxChange)
    const speed = Math.hypot(this.enemyVelocity.x, this.enemyVelocity.y)
    const position = speed > 0.5
      ? moveWithinBounds(
          { x: this.enemy.x, y: this.enemy.y },
          normalizeDirection(this.enemyVelocity),
          speed,
          delta,
          ARENA,
          24,
        )
      : { x: this.enemy.x, y: this.enemy.y }
    this.enemy.setPosition(position.x, position.y)
    this.enemyAnimator.setMovement(speed > 12, this.enemyFacingX, speed / enemySpeed)
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
    this.audio.play(action)
    const origin = { x: this.enemy.x, y: this.enemy.y }
    const facing = { x: this.enemyFacingX, y: this.enemyFacingY }
    showAttackEffect(this, this.enemy, facing, config)
    if (action === 'kick') showKickTrail(this, this.enemy, facing)
    this.enemyAnimator.play(action, facing.x)
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
    this.enemyVelocity = { x: 0, y: 0 }
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
    this.audio.play('dodge')
    this.enemyDodgeUntil = time + COMBAT.normal.dodgeDurationMs
    this.pendingAttacks = this.pendingAttacks.filter(
      (attack) => attack.attacker !== 'enemy',
    )
    showDodgeAfterimage(this, this.enemyVisual, start.x, start.y)
    this.enemy.setPosition(result.position.x, result.position.y)
    this.enemyVisual.setAngle(result.direction.x < 0 ? 15 : -15)
    this.tweens.add({ targets: this.enemyVisual, angle: 0, alpha: 1, duration: 230, ease: 'Cubic.Out' })
    showDashTrail(this, start, result.position, dash.color)
    this.enemyAnimator.play('dodge', result.direction.x)
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
        this.damageEnemy(config.damage, attack.facing)
      } else if (attack.attacker === 'enemy') {
        this.damagePlayer(Math.round(config.damage * this.difficulty.enemyDamage), attack.facing)
      }
    }
  }

  private damageEnemy(damage: number, direction: { x: number; y: number }) {
    if (this.enemyState === 'DEAD') return

    this.enemyHealth = Math.max(0, this.enemyHealth - damage)
    this.audio.play('hit')
    this.enemyHealthFill.width =
      COMBAT.barWidth * (this.enemyHealth / COMBAT.enemyHealth)
    this.enemyHealthText.setText(`${this.enemyHealth} / ${COMBAT.enemyHealth}`)
    this.enemyLabel.setText(`${this.enemyHealth} HP`)
    flashFighter(this, this.enemyVisual)
    flashCharacter(this, this.enemyVisual)
    showDamageNumber(this, this.enemy, damage)
    this.hitFeedback(this.enemy, direction, damage)

    if (this.enemyHealth === 0) {
      this.enemyState = 'DEAD'
      this.enemyDodgeAt = null
      this.enemyAnimator.play('knockout', direction.x)
      this.showMatchEnd('YOU WIN', 0x48e4c3)
    }
  }

  private damagePlayer(damage: number, direction: { x: number; y: number }) {
    if (this.matchEnded) return

    this.playerHealth = Math.max(0, this.playerHealth - damage)
    this.audio.play('hit')
    this.playerHealthFill.width =
      COMBAT.barWidth * (this.playerHealth / COMBAT.playerHealth)
    this.playerHealthText.setText(
      `${this.playerHealth} / ${COMBAT.playerHealth}`,
    )
    this.playerHealthDisplayed = this.playerHealth
    flashFighter(this, this.playerVisual)
    flashCharacter(this, this.playerVisual)
    showDamageNumber(this, this.player, damage)
    this.hitFeedback(this.player, direction, damage)

    if (this.playerHealth === 0) {
      this.playerAnimator.play('knockout', direction.x)
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
    this.playerVisual.setPosition(result.position.x, result.position.y)
    this.playerVelocity = { x: 0, y: 0 }
    showDodgeAfterimage(this, this.playerVisual, startX, startY)
    this.playerAnimator.play('dodge', result.direction.x)
    this.playerVisual.setAlpha(0.68)
    this.tweens.add({ targets: this.playerVisual, alpha: 1, duration: 200, ease: 'Cubic.Out' })

    showDashTrail(this, { x: startX, y: startY }, result.position, config.color)
  }

  private hitFeedback(target: Phaser.GameObjects.Arc, direction: { x: number; y: number }, damage: number) {
    const point = { x: target.x - direction.x * 9, y: target.y - 19 - direction.y * 7 }
    showHitFeedback(this, point, direction, damage)
    this.cameras.main.shake(90, 0.0025 + damage * 0.00008, true)
    if (target === this.player) {
      this.playerAnimator.play('hurt', -direction.x)
    } else this.enemyAnimator.play('hurt', -direction.x)
    // A tiny real-time pause makes confirmed hits read without delaying combat timers.
    this.scene.pause()
    window.setTimeout(() => { if (this.scene.isPaused()) this.scene.resume() }, 38)
  }

  private showMatchEnd(title: 'YOU WIN' | 'YOU LOSE', color: number) {
    this.matchEnded = true
    this.audio.play(title === 'YOU WIN' ? 'win' : 'lose')
    this.pendingActions = []
    this.pendingAttacks = []
    this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x050507, 0.82).setDepth(100)
    const card = this.add.rectangle(WIDTH / 2, HEIGHT / 2, 410, 260, 0x151116, 0.97)
      .setStrokeStyle(2, color, 0.88)
      .setDepth(101)
    this.add.rectangle(WIDTH / 2, 214, 250, 3, color, 0.85).setDepth(102)

    this.add
      .text(WIDTH / 2, 253, title, {
        fontFamily: 'Arial Black, sans-serif',
        fontSize: '46px',
        color: `#${color.toString(16).padStart(6, '0')}`,
        stroke: '#08070a',
        strokeThickness: 7,
        letterSpacing: 4,
      })
      .setOrigin(0.5)
      .setDepth(103)

    this.add
      .text(
        WIDTH / 2,
        304,
        title === 'YOU WIN' ? 'The arena is yours.' : 'You were defeated.',
        {
          fontFamily: 'Arial, sans-serif',
          fontSize: '17px',
          color: '#c5d4e3',
        },
      )
      .setOrigin(0.5)
      .setDepth(103)

    const buttonColor = title === 'YOU WIN' ? 0xd49a52 : 0xb8433f
    const restartButton = this.add
      .rectangle(WIDTH / 2, 374, 186, 48, buttonColor)
      .setStrokeStyle(1, 0xffdfaa, 0.72)
      .setDepth(103)
      .setInteractive({ useHandCursor: true })
    const restartLabel = this.add
      .text(WIDTH / 2, 374, 'FIGHT AGAIN', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '15px',
        fontStyle: 'bold',
        color: '#160f10',
        letterSpacing: 2,
      })
      .setOrigin(0.5)
      .setDepth(104)

    restartButton.on('pointerover', () => restartButton.setFillStyle(0xffd899))
    restartButton.on('pointerout', () => restartButton.setFillStyle(buttonColor))
    restartButton.on('pointerdown', () => this.scene.restart())
    this.tweens.add({ targets: [card, restartButton, restartLabel], alpha: 1, duration: 260, ease: 'Cubic.Out' })
  }
}

function approachVector(
  current: { x: number; y: number },
  target: { x: number; y: number },
  maxChange: number,
) {
  const dx = target.x - current.x
  const dy = target.y - current.y
  const distance = Math.hypot(dx, dy)
  if (distance <= maxChange || distance === 0) return target
  const ratio = maxChange / distance
  return { x: current.x + dx * ratio, y: current.y + dy * ratio }
}
