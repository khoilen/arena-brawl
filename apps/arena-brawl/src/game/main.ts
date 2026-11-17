import { Game as MainGame } from './scenes/game'
import { AUTO, Game } from 'phaser'

//  Find out more information about the Game Config at:
//  https://docs.phaser.io/api-documentation/typedef/types-core#gameconfig
const config: Phaser.Types.Core.GameConfig = {
  type: AUTO,
  width: 800,
  height: 600,
  parent: 'game-container',
  backgroundColor: '#09111f',
  scene: [MainGame],
}

const StartGame = (parent: string) => {
  return new Game({ ...config, parent })
}

export default StartGame
