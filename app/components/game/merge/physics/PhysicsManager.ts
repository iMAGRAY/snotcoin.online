// PhysicsManager.ts - Управление физикой в игре
import * as Phaser from 'phaser';
import * as planck from 'planck';
import { GameBody, SCALE } from '../utils/types';
import * as gameUtils from '../utils/utils';

export class PhysicsManager {
  private scene: Phaser.Scene;
  private world: planck.World;
  private nextId: number = 1;
  private bodies: { [key: string]: GameBody } = {};

  constructor(scene: Phaser.Scene, world: planck.World) {
    this.scene = scene;
    this.world = world;
  }

  public getBodies(): { [key: string]: GameBody } {
    return this.bodies;
  }

  public getBody(id: string): GameBody | undefined {
    return this.bodies[id];
  }

  public addBody(body: GameBody, id?: string): string {
    const bodyId = id || String(this.nextId++);
    this.bodies[bodyId] = body;
    return bodyId;
  }

  public removeBody(id: string): void {
    if (this.bodies[id]) {
      if (this.bodies[id].sprite) {
        this.bodies[id].sprite.destroy();
      }
      if (this.bodies[id].body) {
        this.world.destroyBody(this.bodies[id].body);
      }
      delete this.bodies[id];
    }
  }

  createBoundary(x1: number, y1: number, x2: number, y2: number, userData?: string) {
    const body = this.world.createBody({
      type: 'static',
      position: planck.Vec2(0, 0)
    });

    // Создаем форму для границы
    body.createFixture({
      shape: planck.Edge(planck.Vec2(x1, y1), planck.Vec2(x2, y2)),
      friction: 0.3,
      restitution: 0.5,
      userData: userData || 'boundary'
    });

    return body;
  }

  createCircle(x: number, y: number, radius: number, level: number = 1) {
    // Создаем физическое тело с улучшенными параметрами
    const body = this.world.createBody({
      type: 'dynamic',
      position: planck.Vec2(x, y),
      angularDamping: 0.1,
      linearDamping: 0.1,
      bullet: true, // Включаем улучшенное обнаружение столкновений для быстрых объектов
      fixedRotation: false // Разрешаем вращение для реалистичной физики
    });

    // Добавляем круглую форму с оптимизированными параметрами
    body.createFixture({
      shape: planck.Circle(radius),
      density: 1.0,
      friction: 0.3,
      restitution: 0.6, // Коэффициент упругости при столкновениях
      userData: { level, type: 'ball' }
    });

    // Определяем размер спрайта (в пикселях)
    const ballSize = radius * 2 * SCALE;

    // Создаем спрайт шара с изображением, соответствующим уровню
    const sprite = this.scene.add.sprite(x * SCALE, y * SCALE, `ball${level}`);
    sprite.setDisplaySize(ballSize, ballSize);
    sprite.setData('level', level);

    // Создаем тело и добавляем его в список тел
    const gameBody: GameBody = { body, sprite };
    const id = this.addBody(gameBody);

    // Устанавливаем данные для определения столкновений
    body.setUserData({ id, level, type: 'ball' });

    return { id, body, sprite };
  }

  createSpecialCircle(x: number, y: number, radius: number, type: string) {
    // Создаем физическое тело
    const body = this.world.createBody({
      type: 'dynamic',
      position: planck.Vec2(x, y),
      angularDamping: 0.1,
      linearDamping: 0.1,
      bullet: true // Улучшенное обнаружение коллизий для быстрых объектов
    });

    // Добавляем круглую форму
    body.createFixture({
      shape: planck.Circle(radius),
      density: 1.0,
      friction: 0.3,
      restitution: 0.6,
      userData: { type }
    });

    // Определяем размер спрайта (в пикселях)
    const ballSize = radius * 2 * SCALE;

    // Создаем спрайт шара с соответствующим изображением
    const sprite = this.scene.add.sprite(x * SCALE, y * SCALE, type.toLowerCase());
    sprite.setDisplaySize(ballSize, ballSize);
    sprite.setData('type', type);

    // Создаем тело и добавляем его в список тел
    const gameBody: GameBody = { body, sprite };
    const id = this.addBody(gameBody);

    // Устанавливаем данные для определения столкновений
    body.setUserData({ id, type });

    return { id, body, sprite };
  }

  public update(): void {
    // Обновляем позиции спрайтов на основе физических позиций
    for (const id in this.bodies) {
      const bodyData = this.bodies[id];
      if (bodyData && bodyData.body && bodyData.sprite) {
        const position = bodyData.body.getPosition();
        bodyData.sprite.x = position.x * SCALE;
        bodyData.sprite.y = position.y * SCALE;
        
        // Обновляем угол поворота, если тело вращается
        const angle = bodyData.body.getAngle();
        bodyData.sprite.rotation = angle;
      }
    }
  }
}
