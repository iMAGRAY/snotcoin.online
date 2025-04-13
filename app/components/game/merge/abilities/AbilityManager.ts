// AbilityManager.ts - Управление специальными способностями
import * as Phaser from 'phaser';
import { MergeGameSceneType } from '../utils/types';
import { Bull } from './Bull';
import { Bomb } from './Bomb';
import { Earthquake } from './Earthquake';

export class AbilityManager {
  private scene: MergeGameSceneType;
  private bull: Bull;
  private bomb: Bomb;
  private earthquake: Earthquake;

  constructor(scene: MergeGameSceneType) {
    this.scene = scene;
    this.bull = new Bull(scene);
    this.bomb = new Bomb(scene);
    this.earthquake = new Earthquake(scene);
  }

  // Метод активации способности
  public activateAbility(ability: string): void {
    switch (ability) {
      case 'Bull':
        this.bull.activate();
        break;
      case 'Bomb':
        this.bomb.activate();
        break;
      case 'Earthquake':
        this.earthquake.activate();
        break;
      default:
        console.warn('Неизвестная способность:', ability);
    }
  }
}
