import type { Scene } from 'phaser'
import { COMBAT, ARENA_BOUNDS, GAME_WIDTH } from './game-config'

export type GameFighters = {
  player: Phaser.GameObjects.Arc
  enemy: Phaser.GameObjects.Arc
  playerLabel: Phaser.GameObjects.Text
  enemyLabel: Phaser.GameObjects.Text
  facingIndicator: Phaser.GameObjects.Arc
  enemyStaminaFill: Phaser.GameObjects.Rectangle
  enemyHealthFill: Phaser.GameObjects.Rectangle
  enemyHealthText: Phaser.GameObjects.Text
  playerHealthFill: Phaser.GameObjects.Rectangle
  playerHealthText: Phaser.GameObjects.Text
  staminaFill: Phaser.GameObjects.Rectangle
  staminaText: Phaser.GameObjects.Text
}

export function createGameView(scene: Scene): GameFighters {
  drawArena(scene)
  const hud = createHud(scene)
  const fighters = createFighters(scene)
  return { ...hud, ...fighters }
}

function drawArena(scene: Scene) {
  const arena = ARENA_BOUNDS
  scene.add
    .rectangle(
      GAME_WIDTH / 2,
      (arena.top + arena.bottom) / 2,
      arena.right - arena.left,
      arena.bottom - arena.top,
      0x122238,
    )
    .setStrokeStyle(2, 0x31516c)

  const grid = scene.add.graphics()
  grid.lineStyle(1, 0x8fb4cf, 0.08)
  for (let x = arena.left + 32; x < arena.right; x += 48) {
    grid.lineBetween(x, arena.top, x, arena.bottom)
  }
  for (let y = arena.top + 32; y < arena.bottom; y += 48) {
    grid.lineBetween(arena.left, y, arena.right, y)
  }
  scene.add
    .text(
      GAME_WIDTH / 2,
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

function createHud(
  scene: Scene,
): Pick<
  GameFighters,
  | 'playerHealthFill'
  | 'playerHealthText'
  | 'enemyHealthFill'
  | 'enemyHealthText'
  | 'staminaFill'
  | 'staminaText'
> {
  scene.add.text(28, 14, 'PLAYER', {
    fontFamily: 'Arial, sans-serif',
    fontSize: '13px',
    fontStyle: 'bold',
    color: '#48e4c3',
    letterSpacing: 2,
  })
  scene.add.text(548, 14, 'ARENA BOT', {
    fontFamily: 'Arial, sans-serif',
    fontSize: '13px',
    fontStyle: 'bold',
    color: '#ff8b70',
    letterSpacing: 2,
  })
  const playerHealthText = scene.add
    .text(248, 14, '100 / 100', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '12px',
      color: '#dbe7f3',
      align: 'right',
    })
    .setOrigin(1, 0)
  scene.add.rectangle(28, 38, COMBAT.barWidth, 10, 0x26364a).setOrigin(0, 0.5)
  scene.add.rectangle(548, 38, COMBAT.barWidth, 10, 0x26364a).setOrigin(0, 0.5)
  const playerHealthFill = scene.add
    .rectangle(28, 38, COMBAT.barWidth, 10, 0x48e4c3)
    .setOrigin(0, 0.5)
    .setDepth(1)
  const enemyHealthFill = scene.add
    .rectangle(548, 38, COMBAT.barWidth, 10, 0xff755f)
    .setOrigin(0, 0.5)
    .setDepth(1)
  const enemyHealthText = scene.add
    .text(768, 14, '100 / 100', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '12px',
      color: '#dbe7f3',
      align: 'right',
    })
    .setOrigin(1, 0)
  scene.add.text(28, 55, 'STAMINA', {
    fontFamily: 'Arial, sans-serif',
    fontSize: '10px',
    fontStyle: 'bold',
    color: '#8fb9ff',
    letterSpacing: 1,
  })
  const staminaText = scene.add
    .text(248, 55, '100 / 100', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '10px',
      color: '#dbe7f3',
      align: 'right',
    })
    .setOrigin(1, 0)
  scene.add.rectangle(28, 78, COMBAT.barWidth, 7, 0x26364a).setOrigin(0, 0.5)
  const staminaFill = scene.add
    .rectangle(28, 78, COMBAT.barWidth, 7, 0x70a8ff)
    .setOrigin(0, 0.5)
    .setDepth(1)
  return {
    playerHealthFill,
    playerHealthText,
    enemyHealthFill,
    enemyHealthText,
    staminaFill,
    staminaText,
  }
}

function createFighters(
  scene: Scene,
): Pick<
  GameFighters,
  | 'player'
  | 'enemy'
  | 'playerLabel'
  | 'enemyLabel'
  | 'facingIndicator'
  | 'enemyStaminaFill'
> {
  const player = scene.add
    .circle(190, 334, COMBAT.playerRadius, 0x48e4c3)
    .setStrokeStyle(3, 0xd8fff6)
    .setDepth(2)
  const facingIndicator = scene.add
    .circle(player.x + 10, player.y, 4, 0xeafffa)
    .setDepth(3)
  const playerLabel = scene.add
    .text(player.x, player.y + 30, 'YOU', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '11px',
      fontStyle: 'bold',
      color: '#b9fff0',
      letterSpacing: 2,
    })
    .setOrigin(0.5)
    .setDepth(2)
  const enemy = scene.add
    .circle(610, 334, 24, 0xff755f)
    .setStrokeStyle(3, 0xffd0bd)
    .setDepth(2)
  const enemyLabel = scene.add
    .text(enemy.x, enemy.y - 56, '100 HP', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '10px',
      fontStyle: 'bold',
      color: '#ffd0bd',
    })
    .setOrigin(0.5)
    .setDepth(2)
  scene.add
    .rectangle(enemy.x - 32, enemy.y - 38, 64, 4, 0x26364a)
    .setOrigin(0, 0.5)
    .setDepth(2)
  const enemyStaminaFill = scene.add
    .rectangle(enemy.x - 32, enemy.y - 38, 64, 4, 0x70a8ff)
    .setOrigin(0, 0.5)
    .setDepth(3)
  scene.add
    .text(enemy.x, enemy.y + 36, 'BOT', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '11px',
      fontStyle: 'bold',
      color: '#ffd0bd',
      letterSpacing: 2,
    })
    .setOrigin(0.5)
    .setDepth(2)
  return {
    player,
    enemy,
    playerLabel,
    enemyLabel,
    facingIndicator,
    enemyStaminaFill,
  }
}

export function showAttackEffect(
  scene: Scene,
  attacker: Phaser.GameObjects.Arc,
  facing: { x: number; y: number },
  config: (typeof COMBAT.actions)[keyof typeof COMBAT.actions],
) {
  const effect = scene.add
    .circle(
      attacker.x + facing.x * (config.range * 0.55),
      attacker.y + facing.y * (config.range * 0.55),
      config.effectRadius,
      config.color,
      0.38,
    )
    .setDepth(3)
  scene.tweens.add({
    targets: effect,
    scale: 1.45,
    alpha: 0,
    duration: 180,
    onComplete: () => effect.destroy(),
  })
}

export function showDashTrail(
  scene: Scene,
  start: { x: number; y: number },
  end: { x: number; y: number },
  color: number,
) {
  const trail = scene.add.graphics().setDepth(1)
  trail.lineStyle(10, color, 0.62)
  trail.lineBetween(start.x, start.y, end.x, end.y)
  scene.tweens.add({
    targets: trail,
    alpha: 0,
    duration: 220,
    onComplete: () => trail.destroy(),
  })
}

export function showDamageNumber(
  scene: Scene,
  target: Phaser.GameObjects.Arc,
  damage: number,
) {
  const label = scene.add
    .text(target.x, target.y - 36, `-${damage}`, {
      fontFamily: 'Arial Black, sans-serif',
      fontSize: '20px',
      color: '#fff4c2',
      stroke: '#442b2b',
      strokeThickness: 3,
    })
    .setOrigin(0.5)
    .setDepth(4)
  scene.tweens.add({
    targets: label,
    y: label.y - 38,
    alpha: 0,
    duration: 650,
    onComplete: () => label.destroy(),
  })
}

export function flashFighter(
  scene: Scene,
  target: Phaser.GameObjects.Arc,
  color: number,
) {
  target.setFillStyle(0xffffff)
  scene.tweens.add({
    targets: target,
    alpha: 0.35,
    duration: 70,
    yoyo: true,
    repeat: 1,
    onComplete: () => {
      target.setFillStyle(color)
      target.setAlpha(1)
    },
  })
}
