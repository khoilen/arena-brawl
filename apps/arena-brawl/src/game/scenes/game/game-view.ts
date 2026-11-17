import type { Scene } from 'phaser'
import { COMBAT, ARENA_BOUNDS, GAME_WIDTH, GAME_HEIGHT } from './game-config'
import { createBoxerVisual } from './fighter-view'

export type GameFighters = {
  player: Phaser.GameObjects.Arc
  enemy: Phaser.GameObjects.Arc
  playerVisual: Phaser.GameObjects.Container
  enemyVisual: Phaser.GameObjects.Container
  playerLabel: Phaser.GameObjects.Text
  enemyLabel: Phaser.GameObjects.Text
  facingIndicator: Phaser.GameObjects.Arc
  enemyStaminaFill: Phaser.GameObjects.Rectangle
  enemyHudStaminaFill: Phaser.GameObjects.Rectangle
  enemyHealthFill: Phaser.GameObjects.Rectangle
  enemyHealthText: Phaser.GameObjects.Text
  playerHealthFill: Phaser.GameObjects.Rectangle
  playerHealthText: Phaser.GameObjects.Text
  staminaFill: Phaser.GameObjects.Rectangle
  staminaText: Phaser.GameObjects.Text
  enemyStaminaText: Phaser.GameObjects.Text
  cooldownText: Phaser.GameObjects.Text
  timerText: Phaser.GameObjects.Text
}

export function createGameView(scene: Scene): GameFighters {
  drawArena(scene)
  const hud = createHud(scene)
  const player = scene.add.circle(190, 354, COMBAT.playerRadius, 0xffffff, 0).setDepth(3)
  const enemy = scene.add.circle(610, 354, 24, 0xffffff, 0).setDepth(3)
  // Render scale is intentionally separate from the unchanged combat circles.
  const playerVisual = createBoxerVisual(scene).setPosition(player.x, player.y).setDepth(4)
  const enemyVisual = createBoxerVisual(scene, true).setPosition(enemy.x, enemy.y).setDepth(4)
  enemyVisual.setData('isEnemy', true)
  const playerLabel = scene.add.text(player.x, player.y + 44, 'P1', tagStyle('#7fc8ff')).setOrigin(0.5).setDepth(7)
  const enemyLabel = scene.add.text(enemy.x, enemy.y - 58, 'BOT', tagStyle('#ff8174')).setOrigin(0.5).setDepth(7)
  const facingIndicator = scene.add.circle(player.x + 20, player.y, 3, 0xffd68a).setDepth(6)
  scene.add.rectangle(enemy.x - 31, enemy.y - 41, 62, 5, 0x11131a).setOrigin(0, 0.5).setDepth(6)
  const enemyStaminaFill = scene.add.rectangle(enemy.x - 31, enemy.y - 41, 62, 3, 0x37aaff).setOrigin(0, 0.5).setDepth(7)
  return { ...hud, player, enemy, playerVisual, enemyVisual, playerLabel, enemyLabel, facingIndicator, enemyStaminaFill }
}

function tagStyle(color: string): Phaser.Types.GameObjects.Text.TextStyle {
  return { fontFamily: 'Arial Black, Arial, sans-serif', fontSize: '12px', color, stroke: '#111018', strokeThickness: 4, letterSpacing: 1 }
}

function fillPolygon(graphics: Phaser.GameObjects.Graphics, points: { x: number; y: number }[]) {
  graphics.fillPoints(points as Phaser.Math.Vector2[], true)
}

function drawArena(scene: Scene) {
  const { left, right, top, bottom } = ARENA_BOUNDS
  const g = scene.add.graphics().setDepth(0)
  g.fillGradientStyle(0x25201f, 0x25201f, 0x100f14, 0x100f14, 1)
  g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)
  // soot-dark masonry with warm, irregular seams
  for (let row = 0, y = top; y < bottom; row++, y += 31) {
    const offset = row % 2 ? 28 : 0
    for (let x = left - 28 + offset; x < right; x += 56) {
      const shade = [0x332a29, 0x3a302d, 0x2e292a, 0x413632][Math.abs((row * 7 + Math.floor(x)) % 4)]
      g.fillStyle(shade, 0.82)
      g.fillRoundedRect(x + 2, y + 2, 52, 27, 3)
      g.lineStyle(1, 0x79604a, 0.13)
      g.strokeRoundedRect(x + 2, y + 2, 52, 27, 3)
    }
  }
  // central engraved dragon medallion
  const cx = GAME_WIDTH / 2, cy = 336
  // warm lantern pool lifts the combat floor while the corners stay moody
  for (let ring = 7; ring >= 1; ring--) {
    g.fillStyle(0xe49a50, 0.012 + (8 - ring) * 0.006)
    g.fillCircle(cx, cy + 15, 24 + ring * 18)
  }
  g.fillStyle(0x92704f, 0.07)
  g.fillEllipse(cx, cy + 20, 315, 235)
  g.lineStyle(3, 0xc18b58, 0.17); g.strokeCircle(cx, cy, 151)
  g.lineStyle(1, 0xe0b477, 0.23); g.strokeCircle(cx, cy, 139); g.strokeCircle(cx, cy, 126)
  g.lineStyle(7, 0x8b4432, 0.18); g.beginPath(); g.arc(cx, cy, 111, 0.2, 5.8, false); g.strokePath()
  g.fillStyle(0xb4774b, 0.13)
  fillPolygon(g,[{x:cx-8,y:cy-75},{x:cx+10,y:cy-48},{x:cx+42,y:cy-58},{x:cx+23,y:cy-32},{x:cx+64,y:cy-9},{x:cx+24,y:cy-5},{x:cx+41,y:cy+30},{x:cx+7,y:cy+17},{x:cx-7,y:cy+72},{x:cx-23,y:cy+22},{x:cx-58,y:cy+43},{x:cx-37,y:cy+8},{x:cx-71,y:cy-17},{x:cx-28,y:cy-18},{x:cx-39,y:cy-51},{x:cx-12,y:cy-38}])
  // timber rails, banners, torch bowls and amber pools
  g.fillStyle(0x100e12, 0.9); g.fillRect(0, 91, GAME_WIDTH, 14); g.fillRect(0, 585, GAME_WIDTH, 15)
  g.fillStyle(0x70412c, 1); g.fillRect(0, 103, GAME_WIDTH, 7); g.fillRect(0, 578, GAME_WIDTH, 7)
  for (const x of [70, 730]) {
    g.fillStyle(0x8a211f, 0.9); fillPolygon(g,[{x:x-18,y:112},{x:x+18,y:112},{x:x+14,y:218},{x,y:201},{x:x-13,y:218}])
    g.lineStyle(2, 0xe0a15b, 0.42); g.lineBetween(x-13, 119, x+13, 119)
    g.fillStyle(0xff8b31, 0.12); g.fillCircle(x, 135, 40); g.fillCircle(x, 135, 23)
    g.fillStyle(0x25201d, 1); g.fillRoundedRect(x-10, 114, 20, 25, 4)
    g.fillStyle(0xff9b35, 0.95); fillPolygon(g,[{x:x-7,y:119},{x:x-2,y:101},{x:x+2,y:112},{x:x+7,y:99},{x:x+8,y:119}])
  }
  // vignette frame and cinematic edge glow
  g.fillStyle(0x050509, 0.45); g.fillRect(0, 0, GAME_WIDTH, 90); g.fillRect(0, 592, GAME_WIDTH, 8)
  const vignette = scene.add.graphics().setDepth(1)
  vignette.lineStyle(20, 0x08070b, 0.38); vignette.strokeRect(9, 9, GAME_WIDTH-18, GAME_HEIGHT-18)
  // floating embers
  for (let i=0;i<22;i++) {
    const ember=scene.add.circle((i*71+29)%GAME_WIDTH, 112+(i*47)%450, i%3===0?2:1, i%2?0xff9c4b:0xf5d39a, 0.45).setDepth(2)
    scene.tweens.add({targets:ember,y:ember.y-24-(i%5)*5,alpha:0.08,duration:1500+(i%6)*240,delay:i*65,yoyo:true,repeat:-1})
  }
}

function createHud(scene: Scene): Pick<GameFighters, 'playerHealthFill'|'playerHealthText'|'enemyHealthFill'|'enemyHealthText'|'staminaFill'|'staminaText'|'enemyHudStaminaFill'|'enemyStaminaText'|'cooldownText'|'timerText'> {
  const panel = (x:number,w:number) => scene.add.rectangle(x, 43, w, 68, 0x090a0e, 0.82).setOrigin(0,0).setStrokeStyle(1,0x79563e,0.8).setDepth(20)
  panel(13, 292); panel(495,292)
  scene.add.text(29, 17, 'PLAYER', {fontFamily:'Arial Black, sans-serif',fontSize:'16px',color:'#f3eee8',fontStyle:'bold',stroke:'#1b1010',strokeThickness:3,letterSpacing:1}).setDepth(22)
  scene.add.text(770, 17, 'ARENA BOT', {fontFamily:'Arial Black, sans-serif',fontSize:'16px',color:'#f3eee8',fontStyle:'bold',stroke:'#1b1010',strokeThickness:3,letterSpacing:1}).setOrigin(1,0).setDepth(22)
  const health = (x:number,color:number) => { scene.add.rectangle(x,55,COMBAT.barWidth,17,0x17191d).setOrigin(0,.5).setDepth(21); return scene.add.rectangle(x,55,COMBAT.barWidth,13,color).setOrigin(0,.5).setDepth(22) }
  const playerHealthFill=health(29,0xc92526), enemyHealthFill=health(511,0xc92526)
  const playerHealthText=scene.add.text(281,48,'100 / 100',hudValue()).setOrigin(1,0).setDepth(23)
  const enemyHealthText=scene.add.text(763,48,'100 / 100',hudValue()).setOrigin(1,0).setDepth(23)
  scene.add.rectangle(29,80,COMBAT.barWidth,10,0x17191d).setOrigin(0,.5).setDepth(21)
  const staminaFill=scene.add.rectangle(29,80,COMBAT.barWidth,7,0x1689d5).setOrigin(0,.5).setDepth(22)
  const staminaText=scene.add.text(281,72,'100 / 100',hudSmall()).setOrigin(1,0).setDepth(23)
  scene.add.rectangle(511,80,COMBAT.barWidth,10,0x17191d).setOrigin(0,.5).setDepth(21)
  const enemyHudStaminaFill=scene.add.rectangle(511,80,COMBAT.barWidth,7,0x1689d5).setOrigin(0,.5).setDepth(22)
  const enemyStaminaText=scene.add.text(763,72,'100 / 100',hudSmall()).setOrigin(1,0).setDepth(23)
  scene.add.rectangle(400,53,142,82,0x09090c,.9).setStrokeStyle(2,0x9c6846).setDepth(20)
  scene.add.text(400,19,'ROUND 1',{fontFamily:'Arial Black, sans-serif',fontSize:'12px',color:'#e7d6bf',letterSpacing:2}).setOrigin(.5).setDepth(22)
  scene.add.rectangle(400,37,92,1,0xa77855,.7).setDepth(21)
  const timerText=scene.add.text(400,58,'01:24',{fontFamily:'Arial Black, sans-serif',fontSize:'26px',color:'#fff4e3'}).setOrigin(.5).setDepth(22)
  const hints=scene.add.rectangle(142,555,242,64,0x08090d,.76).setStrokeStyle(1,0x72533d,.75).setDepth(20)
  scene.add.text(27,535,'W A S D   MOVE     L   DODGE',{fontFamily:'Arial, sans-serif',fontSize:'11px',color:'#e4ddd6',fontStyle:'bold',letterSpacing:1}).setDepth(22)
  scene.add.text(27,558,'J  PUNCH   K  KICK   SPACE  SPECIAL',{fontFamily:'Arial, sans-serif',fontSize:'10px',color:'#c8bcb1',fontStyle:'bold',letterSpacing:.4}).setDepth(22)
  const cooldownText=scene.add.text(775,520,'J  PUNCH     READY\nK  KICK       READY\nL  DODGE     READY\nSPACE  SPECIAL  READY',{fontFamily:'Arial, sans-serif',fontSize:'11px',fontStyle:'bold',color:'#f0e5d8',align:'left',lineSpacing:5,backgroundColor:'#08090de8',padding:{x:11,y:9}}).setOrigin(1,0).setDepth(22)
  void hints
  return {playerHealthFill,playerHealthText,enemyHealthFill,enemyHealthText,staminaFill,staminaText,enemyHudStaminaFill,enemyStaminaText,cooldownText,timerText}
}
function hudValue(): Phaser.Types.GameObjects.Text.TextStyle { return {fontFamily:'Arial Black, sans-serif',fontSize:'12px',fontStyle:'bold',color:'#fff4e9',stroke:'#251412',strokeThickness:3} }
function hudSmall(): Phaser.Types.GameObjects.Text.TextStyle { return {fontFamily:'Arial, sans-serif',fontSize:'10px',fontStyle:'bold',color:'#d9e9f3',stroke:'#111',strokeThickness:2} }

export function showAttackEffect(scene:Scene, attacker:Phaser.GameObjects.Arc, facing:{x:number;y:number}, config:(typeof COMBAT.actions)[keyof typeof COMBAT.actions]) {
  const x=attacker.x+facing.x*(config.range*.55), y=attacker.y+facing.y*(config.range*.55)
  const slash=scene.add.graphics().setDepth(8)
  slash.lineStyle(config.effectRadius>40?8:5,config.color,.85)
  slash.beginPath(); slash.arc(x,y,config.effectRadius*.8,Math.atan2(facing.y,facing.x)-1.15,Math.atan2(facing.y,facing.x)+1.15,false); slash.strokePath()
  scene.tweens.add({targets:slash,alpha:0,scale:1.35,duration:170,onComplete:()=>slash.destroy()})
}
export function showSpecialEffect(scene:Scene, attacker:Phaser.GameObjects.Arc, facing:{x:number;y:number}) {
  const x=attacker.x+facing.x*48, y=attacker.y+facing.y*48
  const burst=scene.add.graphics().setDepth(10)
  burst.lineStyle(5,0xd69aff,.88); burst.strokeCircle(x,y,20)
  burst.lineStyle(2,0xffe2ff,.9); burst.strokeCircle(x,y,31)
  for(let i=0;i<10;i++) {
    const angle=(Math.PI*2*i)/10
    burst.lineBetween(x+Math.cos(angle)*34,y+Math.sin(angle)*34,x+Math.cos(angle)*50,y+Math.sin(angle)*50)
  }
  scene.tweens.add({targets:burst,scale:1.8,alpha:0,duration:300,ease:'Cubic.Out',onComplete:()=>burst.destroy()})
}

export function showDodgeAfterimage(scene:Scene, fighter:Phaser.GameObjects.Container, x:number, y:number) {
  const sprite=fighter.getByName('boxer-sprite') as Phaser.GameObjects.Sprite
  if(!sprite?.active) return
  const ghost=scene.add.image(x,y,'boxer')
    .setOrigin(sprite.originX,sprite.originY)
    .setDisplaySize(sprite.displayWidth,sprite.displayHeight)
    .setFlipX(sprite.flipX)
    .setAlpha(.34)
    .setDepth(fighter.depth-1)
  if(fighter.getData('isEnemy')) ghost.setTint(0x8fcaff)
  scene.tweens.add({targets:ghost,alpha:0,scaleX:.78,duration:190,onComplete:()=>ghost.destroy()})
}
export function showKickTrail(scene:Scene, attacker:Phaser.GameObjects.Arc, facing:{x:number;y:number}) {
  const trail=scene.add.graphics().setDepth(9)
  const length=58, x=attacker.x+facing.x*25, y=attacker.y+facing.y*25
  trail.lineStyle(7,0xffbd68,.78)
  trail.lineBetween(x-facing.y*22,y+facing.x*22,x+facing.x*length-facing.y*9,y+facing.y*length+facing.x*9)
  trail.lineStyle(2,0xfff1c8,.75)
  trail.lineBetween(x-facing.y*12,y+facing.x*12,x+facing.x*length,y+facing.y*length)
  scene.tweens.add({targets:trail,alpha:0,scale:1.18,duration:150,onComplete:()=>trail.destroy()})
}
export function showDashTrail(scene:Scene,start:{x:number;y:number},end:{x:number;y:number},color:number) {
  const trail=scene.add.graphics().setDepth(3)
  trail.lineStyle(16,0x08090e,.2); trail.lineBetween(start.x,start.y,end.x,end.y)
  trail.lineStyle(9,color,.45); trail.lineBetween(start.x,start.y,end.x,end.y)
  trail.lineStyle(2,0xc7e9ff,.55)
  for(let i=1;i<=3;i++) {
    const t=i/4, x=start.x+(end.x-start.x)*t, y=start.y+(end.y-start.y)*t
    trail.lineBetween(x-5,y+2,x+5,y-2)
  }
  scene.tweens.add({targets:trail,alpha:0,duration:230,onComplete:()=>trail.destroy()})
}
export function showDamageNumber(scene:Scene,target:Phaser.GameObjects.Arc,damage:number) {
  const label=scene.add.text(target.x,target.y-48,`-${damage}`,{fontFamily:'Arial Black, sans-serif',fontSize:'22px',fontStyle:'bold',color:'#ff3029',stroke:'#2a0909',strokeThickness:5}).setOrigin(.5).setDepth(30)
  scene.tweens.add({targets:label,y:label.y-42,alpha:0,duration:680,onComplete:()=>label.destroy()})
}
export function flashFighter(scene:Scene,target:Phaser.GameObjects.Container) {
  target.setAlpha(0.38)
  scene.tweens.add({targets:target,alpha:1,duration:90,yoyo:true,repeat:1})
}
export function showHitFeedback(scene:Scene,point:{x:number;y:number},direction:{x:number;y:number},damage:number) {
  const impact=scene.add.graphics().setDepth(12)
  impact.fillStyle(0xffebc3,.95); impact.fillCircle(point.x,point.y,Math.min(12,7+damage*.18))
  impact.lineStyle(3,0xffc46c,.85)
  for(let i=0;i<8;i++) { const a=Math.atan2(direction.y,direction.x)+(i-3.5)*.31; impact.lineBetween(point.x+Math.cos(a)*7,point.y+Math.sin(a)*7,point.x+Math.cos(a)*(17+damage*.25),point.y+Math.sin(a)*(17+damage*.25)) }
  scene.tweens.add({targets:impact,alpha:0,scale:1.45,duration:190,onComplete:()=>impact.destroy()})
  // capped, fading directional blood flecks and small ground mark
  for(let i=0;i<Math.min(9,4+Math.round(damage/5));i++) {
    const spread=(Math.random()-.5)*.95, speed=18+Math.random()*24
    const vx=direction.x*Math.cos(spread)-direction.y*Math.sin(spread)
    const vy=direction.y*Math.cos(spread)+direction.x*Math.sin(spread)
    const p=scene.add.circle(point.x,point.y,1.5+Math.random()*2,0x9d1718,.9).setDepth(11)
    scene.tweens.add({targets:p,x:p.x+vx*speed,y:p.y+vy*speed+8,alpha:0,duration:260+Math.random()*160,onComplete:()=>p.destroy()})
  }
  const decal=scene.add.ellipse(point.x,point.y+14,15+damage*.3,5,0x671416,.38).setDepth(1)
  scene.tweens.add({targets:decal,alpha:0,duration:4500,onComplete:()=>decal.destroy()})
}
