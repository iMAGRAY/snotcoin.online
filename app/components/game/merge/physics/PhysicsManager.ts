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

  public getWorld(): planck.World {
    return this.world;
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
      try {
        // Шаг 1: Пометить как удаляемое в userData
        if (this.bodies[id].body) {
          const userData = this.bodies[id].body.getUserData() as any;
          if (userData) {
            userData.markedForDeletion = true;
          }
        }
        
        // Шаг 2: Уничтожить спрайт и анимации
        if (this.bodies[id].sprite) {
          if (this.bodies[id].sprite.active) {
            // Остановить все твины, связанные со спрайтом
            this.scene.tweens.killTweensOf(this.bodies[id].sprite);
            // Уничтожить спрайт
            this.bodies[id].sprite.destroy();
          }
        }
        
        // Шаг 3: Уничтожить физическое тело
        if (this.bodies[id].body) {
          try {
            this.world.destroyBody(this.bodies[id].body);
          } catch (error) {
            console.error(`Ошибка при уничтожении физического тела ${id}:`, error);
          }
        }
        
        // Шаг 4: Удалить из списка тел
        delete this.bodies[id];
      } catch (error) {
        console.error(`Критическая ошибка при удалении тела ${id}:`, error);
        
        // В случае ошибки, все равно пытаемся удалить из списка
        delete this.bodies[id];
      }
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
    try {
      // Проверяем, что мир существует
      if (!this.world) {
        console.error('Ошибка: физический мир не инициализирован');
        return null;
      }
      
      // Изменяем радиус в зависимости от уровня
      let actualRadius = radius;
      if (level === 1) {
        // Шар 1-го уровня в 2 раза меньше
        actualRadius = radius / 2;
      } else if (level === 2) {
        // Шар 2-го уровня на 25% меньше
        actualRadius = radius * 0.75;
      } else if (level === 3) {
        // Шар 3-го уровня на 15% меньше
        actualRadius = radius * 0.85;
      } else if (level === 4) {
        // Шар 4-го уровня на 10% меньше
        actualRadius = radius * 0.9;
      }
      
      // Создаем физическое тело с улучшенными параметрами
      const body = this.world.createBody({
        type: 'dynamic',
        position: planck.Vec2(x, y),
        angularDamping: 0.3,
        linearDamping: 0.3,
        bullet: true,
        fixedRotation: false
      });
      
      // Добавляем небольшую случайную силу
      const randomForceX = (Math.random() - 0.5) * 0.2; // Случайная сила по X от -0.1 до 0.1
      const randomForceY = Math.random() * 0.1; // Небольшая случайная сила вниз от 0 до 0.1
      body.applyLinearImpulse(planck.Vec2(randomForceX, randomForceY), body.getWorldCenter());
      
      // Добавляем небольшое случайное вращение
      const randomTorque = (Math.random() - 0.5) * 0.1; // Случайное вращение от -0.05 до 0.05
      body.applyTorque(randomTorque);
      
      // Проверяем, что тело создано успешно
      if (!body) {
        console.error('Ошибка: не удалось создать физическое тело');
        return null;
      }

      // Важно сначала получить id, чтобы использовать его в userData
      const id = String(this.nextId++);

      // Создаем фикстуру (одним блоком для скорости)
      const fixture = body.createFixture({
        shape: planck.Circle(actualRadius),
        density: 1.0,
        friction: 0.5, // Увеличенное трение для большей стабильности
        restitution: 0.35, // Коэффициент упругости при столкновениях (уменьшен для меньшего отскока)
      });
      
      // Устанавливаем информацию о шаре в данные фикстуры
      fixture.setUserData({ id, level, type: 'ball' });

      // Определяем размер спрайта (в пикселях)
      const ballSize = actualRadius * 2 * SCALE;

      // Создаем спрайт шара с изображением, соответствующим уровню
      const sprite = this.scene.add.sprite(x * SCALE, y * SCALE, `ball${level}`);
      sprite.setDisplaySize(ballSize, ballSize);
      
      // Дополнительные настройки для сглаживания
      sprite.setInteractive();
      sprite.setPipeline('TextureTintPipeline');
      
      // Применяем линейное сглаживание к текстуре
      const texture = this.scene.textures.get(`ball${level}`);
      if (texture) {
        texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
        
        // Улучшенные настройки миньмапов при наличии
        if (texture.source && texture.source[0]) {
          // Применяем дополнительные улучшения для WebGL
          const source = texture.source[0];
          if (source.glTexture && this.scene.game.renderer.type === Phaser.WEBGL) {
            try {
              const renderer = this.scene.game.renderer as Phaser.Renderer.WebGL.WebGLRenderer;
              const gl = renderer.gl;
              gl.bindTexture(gl.TEXTURE_2D, source.glTexture);
              gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
              gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
              gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
              gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
              gl.generateMipmap(gl.TEXTURE_2D);
              gl.bindTexture(gl.TEXTURE_2D, null);
            } catch (e) {
              console.warn('Не удалось применить улучшенные WebGL-настройки к текстуре:', e);
            }
          }
        }
      }
      
      // Настройки для высокого качества рендеринга
      sprite.setScale(sprite.scaleX, sprite.scaleY);
      sprite.setOrigin(0.5, 0.5); // Устанавливаем точку вращения в центр
      sprite.setData('smoothed', true);
      
      // Дополнительные настройки для лучшего сглаживания
      if (this.scene.game.renderer.type === Phaser.WEBGL) {
        // В WebGL режиме добавляем специальный шейдер для сглаживания
        sprite.preFX?.addBlur(1, 1, 0, 0.1);
      }
      
      // Явно устанавливаем уровень как свойство спрайта
      sprite.setData('level', level);

      // Создаем тело и добавляем его в список тел
      const gameBody: GameBody = { body, sprite };
      this.addBody(gameBody, id);

      // Устанавливаем данные для определения столкновений
      body.setUserData({ id, level, type: 'ball' });

      return { id, body, sprite };
    } catch (error) {
      console.error('Критическая ошибка при создании шара:', error);
      return null;
    }
  }

  createSpecialCircle(x: number, y: number, radius: number, type: string) {
    try {
      // Проверяем, что мир существует
      if (!this.world) {
        console.error('Ошибка: физический мир не инициализирован');
        return null;
      }
      
      // Создаем физическое тело
      const body = this.world.createBody({
        type: 'dynamic',
        position: planck.Vec2(x, y),
        angularDamping: 0.3, // Увеличено для быстрого замедления вращения
        linearDamping: 0.3, // Увеличено для быстрого замедления движения
        bullet: true, // Улучшенное обнаружение коллизий для быстрых объектов
        fixedRotation: false // Разрешаем вращение для реалистичной физики
      });

      // Добавляем небольшую случайную силу
      const randomForceX = (Math.random() - 0.5) * 0.2; // Случайная сила по X от -0.1 до 0.1
      const randomForceY = Math.random() * 0.1; // Небольшая случайная сила вниз от 0 до 0.1
      body.applyLinearImpulse(planck.Vec2(randomForceX, randomForceY), body.getWorldCenter());
      
      // Добавляем небольшое случайное вращение
      const randomTorque = (Math.random() - 0.5) * 0.1; // Случайное вращение от -0.05 до 0.05
      body.applyTorque(randomTorque);
      
      // Проверяем, что тело создано успешно
      if (!body) {
        console.error('Ошибка: не удалось создать физическое тело для специального шара');
        return null;
      }

      try {
        // Добавляем круглую форму
        const fixture = body.createFixture({
          shape: planck.Circle(radius),
          density: 1.0,
          friction: 0.5, // Увеличенное трение для большей стабильности
          restitution: 0.35, // Коэффициент упругости при столкновениях (уменьшен для меньшего отскока)
          userData: { type }
        });
        
        if (!fixture) {
          console.error('Ошибка: не удалось создать фикстуру для специального шара');
          this.world.destroyBody(body);
          return null;
        }
      } catch (error) {
        console.error('Ошибка при создании фикстуры специального шара:', error);
        this.world.destroyBody(body);
        return null;
      }

      try {
        // Определяем размер спрайта (в пикселях)
        const ballSize = radius * 2 * SCALE;

        // Создаем спрайт шара с соответствующим изображением
        const sprite = this.scene.add.sprite(x * SCALE, y * SCALE, type.toLowerCase());
        sprite.setDisplaySize(ballSize, ballSize);
        
        // Дополнительные настройки для сглаживания
        sprite.setInteractive();
        sprite.setPipeline('TextureTintPipeline');
        
        // Применяем линейное сглаживание к текстуре
        const texture = this.scene.textures.get(type.toLowerCase());
        if (texture) {
          texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
          
          // Улучшенные настройки миньмапов при наличии
          if (texture.source && texture.source[0]) {
            // Применяем дополнительные улучшения для WebGL
            const source = texture.source[0];
            if (source.glTexture && this.scene.game.renderer.type === Phaser.WEBGL) {
              try {
                const renderer = this.scene.game.renderer as Phaser.Renderer.WebGL.WebGLRenderer;
                const gl = renderer.gl;
                gl.bindTexture(gl.TEXTURE_2D, source.glTexture);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                gl.generateMipmap(gl.TEXTURE_2D);
                gl.bindTexture(gl.TEXTURE_2D, null);
              } catch (e) {
                console.warn('Не удалось применить улучшенные WebGL-настройки к текстуре:', e);
              }
            }
          }
        }
        
        // Настройки для высокого качества рендеринга
        sprite.setScale(sprite.scaleX, sprite.scaleY);
        sprite.setOrigin(0.5, 0.5); // Устанавливаем точку вращения в центр
        sprite.setData('smoothed', true);
        
        // Дополнительные настройки для лучшего сглаживания
        if (this.scene.game.renderer.type === Phaser.WEBGL) {
          // В WebGL режиме добавляем специальный шейдер для сглаживания
          sprite.preFX?.addBlur(0.5, 0.5, 0, 0.1);
        }
        
        // Сохраняем тип спрайта
        sprite.setData('type', type);

        // Создаем тело и добавляем его в список тел
        const gameBody: GameBody = { body, sprite };
        const id = this.addBody(gameBody);

        // Устанавливаем данные для определения столкновений
        body.setUserData({ id, type });

        return { id, body, sprite };
      } catch (error) {
        console.error('Ошибка при создании спрайта или добавлении специального шара:', error);
        // Очищаем созданное тело при ошибке
        if (body) {
          this.world.destroyBody(body);
        }
        return null;
      }
    } catch (error) {
      console.error('Критическая ошибка при создании специального шара:', error);
      return null;
    }
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
  
  /**
   * Очищает все физические тела
   */
  public reset(): void {
    // Удаляем все спрайты и физические тела
    for (const id in this.bodies) {
      if (this.bodies[id]) {
        if (this.bodies[id].sprite) {
          this.bodies[id].sprite.destroy();
        }
        if (this.bodies[id].body) {
          this.world.destroyBody(this.bodies[id].body);
        }
      }
    }
    
    // Очищаем словарь тел
    this.bodies = {};
    
    // Сбрасываем счетчик ID
    this.nextId = 1;
  }

  /**
   * Устанавливает новый физический мир
   * @param world Новый физический мир
   */
  public setWorld(world: planck.World): void {
    // Сохраняем ссылку на новый мир
    this.world = world;
    
    // Очищаем словарь тел, так как они относились к старому миру
    this.bodies = {};
    
    // Сбрасываем счетчик ID
    this.nextId = 1;
    
    console.log('Обновлена ссылка на физический мир в PhysicsManager');
  }
}
