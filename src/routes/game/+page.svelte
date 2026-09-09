<script lang="ts">
	import { onMount } from 'svelte';

	type GameStatus = 'playing' | 'dead';
	type EnemyType = 'charger' | 'sniper' | 'scatter' | 'seeker';
	type AttackState = 'aiming' | 'attacking' | 'recovering';
	type Enemy = {
		id: string;
		type: EnemyType;
		x: number;
		y: number;
		size: number;
		selected: boolean;
		alive: boolean;
		state: AttackState;
		timer: number;
		directionX: number;
		directionY: number;
		attackSpeed: number;
		targetX: number;
		targetY: number;
		hp: number;
		maxHp: number;
		breakTimer: number;
		invulnerableTimer: number;
	};
	type Particle = { x: number; y: number; vx: number; vy: number; life: number; color: string };
	type BulletKind = 'sniper' | 'scatter' | 'seeker';
	type Bullet = {
		x: number;
		y: number;
		vx: number;
		vy: number;
		speed: number;
		life: number;
		kind: BulletKind;
		color: string;
		active: boolean;
		owner: Enemy;
		ownerCleared: boolean;
	};

	let canvas: HTMLCanvasElement;
	let activeEnemies = $state(5);
	let selectedKey = $state<string | null>(null);
	let status = $state<GameStatus>('playing');
	let kills = $state(0);
	let swaps = $state(0);
	let combatNotice = $state('');
	let gameScale = $state(1.25);
	let restartGame = $state<() => void>(() => {});
	let adjustGameScale = $state<(change: number) => void>(() => {});

	onMount(() => {
		const maybeContext = canvas.getContext('2d');
		if (!maybeContext) return;
		const context: CanvasRenderingContext2D = maybeContext;
		const savedScale = Number(window.localStorage.getItem('boogie-woogie-scale'));
		if (Number.isFinite(savedScale) && savedScale >= 0.85 && savedScale <= 1.6) {
			gameScale = savedScale;
		}
		const world = { width: window.innerWidth, height: window.innerHeight };
		const player = { x: world.width / 2, y: world.height / 2, size: 32 * gameScale, speed: 290 };
		const held = new Set<string>();
		const enemies: Enemy[] = [];
		let particles: Particle[] = [];
		let bullets: Bullet[] = [];
		let swapBuffer: Enemy | null = null;
		let swapTimer: number | undefined;
		let noticeTimer = 0;
		let screenFlash = 0;
		let hitStop = 0;
		let spawnTimer = 0;
		let animationFrame = 0;
		let previousTime = performance.now();

		const enemyConfig: Record<EnemyType, { size: number; aim: number; color: string }> = {
			charger: { size: 34, aim: 1.25, color: '#e43f54' },
			sniper: { size: 30, aim: 1.45, color: '#a855f7' },
			scatter: { size: 30, aim: 1.65, color: '#f59e0b' },
			seeker: { size: 32, aim: 1.8, color: '#84cc16' }
		};
		const enemyKeys = ['J', 'K', 'L', 'I', 'O', 'U', 'H', 'N', 'M', 'P'];
		const enemyTypes: EnemyType[] = ['charger', 'sniper', 'scatter', 'seeker'];

		function createEnemy(id: string, type: EnemyType, x: number, y: number, delay: number): Enemy {
			return {
				id,
				type,
				x,
				y,
				size: enemyConfig[type].size * gameScale,
				selected: false,
				alive: true,
				state: 'aiming',
				timer: delay,
				directionX: 0,
				directionY: 0,
				attackSpeed: 0,
				targetX: player.x,
				targetY: player.y,
				hp: 2,
				maxHp: 2,
				breakTimer: 0,
				invulnerableTimer: 0
			};
		}

		function setGameScale(nextScale: number) {
			const clamped = Math.round(Math.max(0.85, Math.min(1.6, nextScale)) * 20) / 20;
			gameScale = clamped;
			player.size = 32 * clamped;
			for (const enemy of enemies) enemy.size = enemyConfig[enemy.type].size * clamped;
			window.localStorage.setItem('boogie-woogie-scale', String(clamped));
		}
		adjustGameScale = (change) => setGameScale(gameScale + change);

		function clearSelection() {
			if (swapBuffer) swapBuffer.selected = false;
			swapBuffer = null;
			selectedKey = null;
			window.clearTimeout(swapTimer);
		}

		function resetEncounter() {
			clearSelection();
			held.clear();
			particles = [];
			bullets = [];
			noticeTimer = 0;
			screenFlash = 0;
			hitStop = 0;
			spawnTimer = 0;
			player.x = world.width / 2;
			player.y = world.height / 2;
			enemies.splice(
				0,
				enemies.length,
				createEnemy('J', 'charger', world.width * 0.14, world.height * 0.24, 1.1),
				createEnemy('K', 'charger', world.width * 0.82, world.height * 0.78, 2.05),
				createEnemy('L', 'sniper', world.width * 0.84, world.height * 0.18, 1.35),
				createEnemy('I', 'scatter', world.width * 0.18, world.height * 0.78, 1.8),
				createEnemy('O', 'seeker', world.width * 0.82, world.height * 0.5, 2.35)
			);
			activeEnemies = enemies.length;
			kills = 0;
			swaps = 0;
			combatNotice = '';
			status = 'playing';
			previousTime = performance.now();
		}
		restartGame = resetEncounter;

		function resize() {
			const oldWidth = world.width;
			const oldHeight = world.height;
			world.width = window.innerWidth;
			world.height = window.innerHeight;
			const scaleX = oldWidth ? world.width / oldWidth : 1;
			const scaleY = oldHeight ? world.height / oldHeight : 1;
			player.x *= scaleX;
			player.y *= scaleY;
			for (const enemy of enemies) {
				enemy.x *= scaleX;
				enemy.y *= scaleY;
				enemy.targetX *= scaleX;
				enemy.targetY *= scaleY;
			}
			for (const bullet of bullets) {
				bullet.x *= scaleX;
				bullet.y *= scaleY;
			}
			const ratio = Math.min(window.devicePixelRatio || 1, 2);
			canvas.width = Math.round(world.width * ratio);
			canvas.height = Math.round(world.height * ratio);
			canvas.style.width = `${world.width}px`;
			canvas.style.height = `${world.height}px`;
			context.setTransform(ratio, 0, 0, ratio, 0, 0);
		}

		function burst(x: number, y: number, color: string, amount = 18) {
			for (let index = 0; index < amount; index += 1) {
				const angle = Math.random() * Math.PI * 2;
				const speed = 70 + Math.random() * 190;
				particles.push({
					x,
					y,
					vx: Math.cos(angle) * speed,
					vy: Math.sin(angle) * speed,
					life: 1,
					color
				});
			}
		}

		function showNotice(message: string, duration = 0.9) {
			combatNotice = message;
			noticeTimer = duration;
		}

		function desiredEnemyCount() {
			return Math.min(enemyKeys.length, 5 + Math.floor(kills / 5));
		}

		function randomSpawnPoint() {
			const margin = 58 * gameScale;
			const side = Math.floor(Math.random() * 4);
			if (side === 0) return { x: margin, y: margin + Math.random() * (world.height - margin * 2) };
			if (side === 1)
				return { x: world.width - margin, y: margin + Math.random() * (world.height - margin * 2) };
			if (side === 2) return { x: margin + Math.random() * (world.width - margin * 2), y: margin };
			return { x: margin + Math.random() * (world.width - margin * 2), y: world.height - margin };
		}

		function spawnEnemy() {
			const usedKeys = new Set(enemies.filter((enemy) => enemy.alive).map((enemy) => enemy.id));
			const id = enemyKeys.find((key) => !usedKeys.has(key));
			if (!id) return;
			let type = enemyTypes[Math.floor(Math.random() * enemyTypes.length)];
			const liveSeekers = enemies.filter((enemy) => enemy.alive && enemy.type === 'seeker').length;
			if (type === 'seeker' && liveSeekers >= 2) {
				type = enemyTypes[Math.floor(Math.random() * 3)];
			}
			let point = randomSpawnPoint();
			for (let attempt = 0; attempt < 6 && Math.hypot(point.x - player.x, point.y - player.y) < 210; attempt += 1) {
				point = randomSpawnPoint();
			}
			const enemy = createEnemy(id, type, point.x, point.y, 0.9 + Math.random() * 0.75);
			const reusableIndex = enemies.findIndex((candidate) => !candidate.alive);
			if (reusableIndex >= 0) enemies[reusableIndex] = enemy;
			else enemies.push(enemy);
			activeEnemies += 1;
			burst(enemy.x, enemy.y, enemyConfig[type].color, 22);
		}

		function eliminate(enemy: Enemy) {
			if (!enemy.alive) return;
			enemy.alive = false;
			burst(enemy.x, enemy.y, enemyConfig[enemy.type].color, 38);
			if (swapBuffer === enemy) clearSelection();
			activeEnemies = enemies.filter((candidate) => candidate.alive).length;
			kills += 1;
			spawnTimer = Math.min(spawnTimer || 0.75, 0.75);
			showNotice(`${kills} EXORCISED`, 0.8);
		}

		function damageEnemy(enemy: Enemy, color: string) {
			if (!enemy.alive || enemy.invulnerableTimer > 0) return false;
			enemy.hp -= 1;
			enemy.invulnerableTimer = 0.18;
			enemy.breakTimer = 3.2;
			enemy.state = 'recovering';
			enemy.timer = 0.48;
			enemy.attackSpeed = 0;
			burst(enemy.x, enemy.y, color, 25);
			hitStop = 0.045;
			screenFlash = 0.09;
			if (enemy.hp <= 0) eliminate(enemy);
			else showNotice(`${enemy.id} BROKEN — HIT AGAIN`, 1.05);
			return true;
		}

		function killPlayer() {
			if (status !== 'playing') return;
			status = 'dead';
			held.clear();
			clearSelection();
			burst(player.x, player.y, '#38bdf8', 42);
		}

		function swapPositions(first: { x: number; y: number }, second: { x: number; y: number }) {
			[first.x, second.x] = [second.x, first.x];
			[first.y, second.y] = [second.y, first.y];
			burst(first.x, first.y, '#7dd3fc');
			burst(second.x, second.y, '#fbbf24');
			screenFlash = Math.max(screenFlash, 0.1);
			swaps += 1;
		}

		function imminentDangerAt(x: number, y: number) {
			for (const bullet of bullets) {
				if (!bullet.active) continue;
				const distance = Math.hypot(bullet.x - x, bullet.y - y);
				const towardPlayer = (x - bullet.x) * bullet.vx + (y - bullet.y) * bullet.vy > 0;
				if (towardPlayer && distance < (bullet.kind === 'seeker' ? 115 : 185)) return true;
			}
			return enemies.some(
				(enemy) =>
					enemy.alive &&
					enemy.type === 'charger' &&
					enemy.state === 'attacking' &&
					Math.hypot(enemy.x - x, enemy.y - y) < 220
			);
		}

		function selfSwap(target: Enemy) {
			const oldX = player.x;
			const oldY = player.y;
			const perfect = imminentDangerAt(oldX, oldY);
			swapPositions(player, target);
			if (perfect) {
				hitStop = 0.055;
				burst(oldX, oldY, '#ffffff', 30);
				showNotice('PERFECT SWITCH', 0.8);
			}
		}

		function handleKeyDown(event: KeyboardEvent) {
			const key = event.key.toLowerCase();
			const target = enemies.find((enemy) => enemy.alive && enemy.id === event.key.toUpperCase());
			const scaleChange = key === '-' || key === '_' ? -0.05 : key === '=' || key === '+' ? 0.05 : 0;
			if (['w', 'a', 's', 'd', 'r'].includes(key) || target || scaleChange) event.preventDefault();
			if (scaleChange && !event.repeat) {
				adjustGameScale(scaleChange);
				return;
			}
			if (key === 'r' && !event.repeat) {
				resetEncounter();
				return;
			}
			if (status !== 'playing') return;
			if (['w', 'a', 's', 'd'].includes(key)) {
				held.add(key);
				return;
			}
			if (!target) return;
			held.add(key);
			if (event.repeat) return;
			window.clearTimeout(swapTimer);
			if (!swapBuffer) {
				swapBuffer = target;
				target.selected = true;
				selectedKey = target.id;
			} else if (swapBuffer === target) {
				selfSwap(target);
				clearSelection();
			} else {
				swapPositions(swapBuffer, target);
				clearSelection();
			}
		}

		function handleKeyUp(event: KeyboardEvent) {
			const key = event.key.toLowerCase();
			held.delete(key);
			if (swapBuffer?.id.toLowerCase() === key) {
				window.clearTimeout(swapTimer);
				swapTimer = window.setTimeout(clearSelection, 420);
			}
		}

		function handleBlur() {
			held.clear();
			clearSelection();
		}

		function segmentCircleHit(
			startX: number,
			startY: number,
			endX: number,
			endY: number,
			centerX: number,
			centerY: number,
			radius: number
		) {
			const dx = endX - startX;
			const dy = endY - startY;
			const lengthSquared = dx * dx + dy * dy;
			const progress = lengthSquared
				? Math.max(
						0,
						Math.min(1, ((centerX - startX) * dx + (centerY - startY) * dy) / lengthSquared)
					)
				: 0;
			const closestX = startX + dx * progress;
			const closestY = startY + dy * progress;
			return Math.hypot(centerX - closestX, centerY - closestY) <= radius;
		}

		function aimAtPlayer(enemy: Enemy) {
			enemy.targetX = player.x;
			enemy.targetY = player.y;
			const dx = player.x - enemy.x;
			const dy = player.y - enemy.y;
			const distance = Math.hypot(dx, dy) || 1;
			enemy.directionX = dx / distance;
			enemy.directionY = dy / distance;
		}

		function steerDirection(
			directionX: number,
			directionY: number,
			fromX: number,
			fromY: number,
			maxTurn: number,
			delta: number
		) {
			const currentAngle = Math.atan2(directionY, directionX);
			const desiredAngle = Math.atan2(player.y - fromY, player.x - fromX);
			let difference = ((desiredAngle - currentAngle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
			const turn = Math.max(-maxTurn * delta, Math.min(maxTurn * delta, difference));
			return {
				x: Math.cos(currentAngle + turn),
				y: Math.sin(currentAngle + turn)
			};
		}

		function updateDefense(enemy: Enemy, delta: number) {
			enemy.invulnerableTimer = Math.max(0, enemy.invulnerableTimer - delta);
			if (enemy.hp >= enemy.maxHp || enemy.breakTimer <= 0) return;
			enemy.breakTimer -= delta;
			if (enemy.breakTimer <= 0) {
				enemy.hp = enemy.maxHp;
				burst(enemy.x, enemy.y, '#64748b', 10);
			}
		}

		function updateCharger(enemy: Enemy, delta: number) {
			enemy.timer -= delta;
			if (enemy.state === 'aiming') {
				aimAtPlayer(enemy);
				if (enemy.timer <= 0) {
					enemy.state = 'attacking';
					enemy.timer = 1.2;
					enemy.attackSpeed = 280;
				}
				return;
			}
			if (enemy.state === 'recovering') {
				if (enemy.timer <= 0) {
					enemy.state = 'aiming';
					enemy.timer = enemyConfig.charger.aim;
					enemy.attackSpeed = 0;
				}
				return;
			}
			enemy.attackSpeed = Math.min(650, enemy.attackSpeed + 840 * delta);
			const speedProgress = enemy.attackSpeed / 650;
			const steering = steerDirection(
				enemy.directionX,
				enemy.directionY,
				enemy.x,
				enemy.y,
				2.15 - speedProgress * 1.62,
				delta
			);
			enemy.directionX = steering.x;
			enemy.directionY = steering.y;
			const startX = enemy.x;
			const startY = enemy.y;
			enemy.x += enemy.directionX * enemy.attackSpeed * delta;
			enemy.y += enemy.directionY * enemy.attackSpeed * delta;
			if (
				segmentCircleHit(
					startX,
					startY,
					enemy.x,
					enemy.y,
					player.x,
					player.y,
					((enemy.size + player.size) / 2) * 0.62
				)
			) {
				killPlayer();
				enemy.state = 'recovering';
				enemy.timer = 0.85;
				return;
			}
			for (const target of enemies) {
				if (target === enemy || !target.alive) continue;
				if (
					segmentCircleHit(
						startX,
						startY,
						enemy.x,
						enemy.y,
						target.x,
						target.y,
						(enemy.size + target.size) / 2
					)
				) {
					damageEnemy(target, '#fb7185');
					damageEnemy(enemy, '#fb7185');
					if (enemy.alive) {
						enemy.state = 'recovering';
						enemy.timer = 0.85;
					}
					return;
				}
			}
			const radius = enemy.size / 2;
			const hitWall =
				enemy.x <= radius ||
				enemy.x >= world.width - radius ||
				enemy.y <= radius ||
				enemy.y >= world.height - radius;
			if (hitWall) {
				enemy.x = Math.max(radius, Math.min(world.width - radius, enemy.x));
				enemy.y = Math.max(radius, Math.min(world.height - radius, enemy.y));
				damageEnemy(enemy, '#fb7185');
				if (enemy.alive) {
					enemy.state = 'recovering';
					enemy.timer = 0.9;
				}
				return;
			}
			if (enemy.timer <= 0) {
				enemy.state = 'recovering';
				enemy.timer = 0.85;
			}
		}

		function fireBullet(enemy: Enemy, angle: number, speed: number, kind: BulletKind, color: string) {
			bullets.push({
				x: enemy.x,
				y: enemy.y,
				vx: Math.cos(angle) * speed,
				vy: Math.sin(angle) * speed,
				speed,
				life: kind === 'seeker' ? 6 : 3,
				kind,
				color,
				active: true,
				owner: enemy,
				ownerCleared: false
			});
		}

		function updateShooter(enemy: Enemy, delta: number) {
			enemy.timer -= delta;
			if (enemy.state === 'recovering') {
				if (enemy.timer <= 0) {
					enemy.state = 'aiming';
					enemy.timer = enemyConfig[enemy.type].aim;
				}
				return;
			}
			aimAtPlayer(enemy);
			if (enemy.timer > 0) return;
			const angle = Math.atan2(enemy.directionY, enemy.directionX);
			if (enemy.type === 'sniper') {
				fireBullet(enemy, angle, 940, 'sniper', '#f8fafc');
				enemy.timer = 1.05;
			} else if (enemy.type === 'scatter') {
				for (const spread of [-0.18, 0, 0.18]) {
					fireBullet(enemy, angle + spread, 710, 'scatter', '#fbbf24');
				}
				enemy.timer = 1.25;
			} else {
				fireBullet(enemy, angle, 365, 'seeker', '#bef264');
				enemy.timer = 1.55;
			}
			burst(enemy.x, enemy.y, enemyConfig[enemy.type].color, enemy.type === 'scatter' ? 16 : 10);
			enemy.state = 'recovering';
		}

		function steerProjectile(bullet: Bullet, delta: number) {
			const turnRate =
				bullet.kind === 'sniper' ? 1.25 : bullet.kind === 'scatter' ? 1.65 : 2.65;
			const steering = steerDirection(
				bullet.vx / bullet.speed,
				bullet.vy / bullet.speed,
				bullet.x,
				bullet.y,
				turnRate,
				delta
			);
			bullet.vx = steering.x * bullet.speed;
			bullet.vy = steering.y * bullet.speed;
		}

		function updateBullets(delta: number) {
			for (const bullet of bullets) {
				if (!bullet.active) continue;
				bullet.life -= delta;
				steerProjectile(bullet, delta);
				const startX = bullet.x;
				const startY = bullet.y;
				bullet.x += bullet.vx * delta;
				bullet.y += bullet.vy * delta;
				if (
					!bullet.ownerCleared &&
					Math.hypot(startX - bullet.owner.x, startY - bullet.owner.y) >
						bullet.owner.size / 2 + 9 * gameScale
				) {
					bullet.ownerCleared = true;
				}
				if (
					segmentCircleHit(
						startX,
						startY,
						bullet.x,
						bullet.y,
						player.x,
						player.y,
						player.size * 0.47
					)
				) {
					bullet.active = false;
					killPlayer();
					continue;
				}
				for (const enemy of enemies) {
					if (!enemy.alive || (enemy === bullet.owner && !bullet.ownerCleared)) continue;
					if (
						segmentCircleHit(
							startX,
							startY,
							bullet.x,
							bullet.y,
							enemy.x,
							enemy.y,
							enemy.size / 2 + (bullet.kind === 'seeker' ? 7 : 3) * gameScale
						)
					) {
						bullet.active = false;
						damageEnemy(enemy, bullet.color);
						break;
					}
				}
				if (
					bullet.life <= 0 ||
					bullet.x < -50 ||
					bullet.x > world.width + 50 ||
					bullet.y < -50 ||
					bullet.y > world.height + 50
				) {
					bullet.active = false;
				}
			}
			bullets = bullets.filter((bullet) => bullet.active);
		}

		function update(delta: number) {
			if (noticeTimer > 0) {
				noticeTimer -= delta;
				if (noticeTimer <= 0) combatNotice = '';
			}
			screenFlash = Math.max(0, screenFlash - delta);
			if (hitStop > 0) {
				hitStop -= delta;
				return;
			}
			if (status === 'playing') {
				let moveX = Number(held.has('d')) - Number(held.has('a'));
				let moveY = Number(held.has('s')) - Number(held.has('w'));
				if (moveX && moveY) {
					moveX *= Math.SQRT1_2;
					moveY *= Math.SQRT1_2;
				}
				const radius = player.size / 2;
				player.x = Math.max(
					radius,
					Math.min(world.width - radius, player.x + moveX * player.speed * delta)
				);
				player.y = Math.max(
					radius,
					Math.min(world.height - radius, player.y + moveY * player.speed * delta)
				);
				for (const enemy of enemies) {
					if (!enemy.alive) continue;
					updateDefense(enemy, delta);
					if (enemy.type === 'charger') updateCharger(enemy, delta);
					else updateShooter(enemy, delta);
				}
				updateBullets(delta);
				if (activeEnemies < desiredEnemyCount()) {
					spawnTimer -= delta;
					if (spawnTimer <= 0) {
						spawnEnemy();
						spawnTimer = 0.7;
					}
				} else {
					spawnTimer = 0;
				}
			}
			for (const particle of particles) {
				particle.x += particle.vx * delta;
				particle.y += particle.vy * delta;
				particle.life -= delta * 2.2;
			}
			particles = particles.filter((particle) => particle.life > 0);
		}

		function drawGrid() {
			context.strokeStyle = 'rgba(148, 163, 184, 0.08)';
			context.lineWidth = 1;
			for (let x = 0; x < world.width; x += 48) {
				context.beginPath();
				context.moveTo(x, 0);
				context.lineTo(x, world.height);
				context.stroke();
			}
			for (let y = 0; y < world.height; y += 48) {
				context.beginPath();
				context.moveTo(0, y);
				context.lineTo(world.width, y);
				context.stroke();
			}
		}

		function drawTelegraph(enemy: Enemy) {
			if (enemy.state !== 'aiming') return;
			const urgency = Math.max(0, 1 - enemy.timer / enemyConfig[enemy.type].aim);
			const pulse = 0.5 + Math.sin(performance.now() * (0.006 + urgency * 0.018)) * 0.5;
			context.save();
			context.translate(enemy.x, enemy.y);
			context.shadowColor = enemyConfig[enemy.type].color;
			context.shadowBlur = (8 + urgency * 24) * gameScale;
			if (enemy.type === 'charger') {
				context.strokeStyle = `rgba(251, 75, 98, ${0.12 + urgency * 0.65})`;
				context.lineWidth = (2 + urgency * 3) * gameScale;
				for (let ring = 0; ring < 2; ring += 1) {
					const inset = ((1 - urgency) * 18 + ring * 10 + pulse * 3) * gameScale;
					drawPolygon(3, enemy.size / 2 + inset, Math.atan2(enemy.directionY, enemy.directionX));
					context.stroke();
				}
			} else if (enemy.type === 'sniper') {
				const distance = (38 - urgency * 18) * gameScale;
				const arm = (8 + urgency * 6) * gameScale;
				context.strokeStyle = `rgba(216, 180, 254, ${0.2 + urgency * 0.75})`;
				context.lineWidth = (1.5 + urgency * 2) * gameScale;
				for (let index = 0; index < 4; index += 1) {
					context.save();
					context.rotate((Math.PI / 2) * index);
					context.beginPath();
					context.moveTo(distance, -arm / 2);
					context.lineTo(distance, arm / 2);
					context.stroke();
					context.restore();
				}
			} else if (enemy.type === 'scatter') {
				context.rotate(performance.now() * 0.0015 * (0.35 + urgency));
				context.strokeStyle = `rgba(251, 191, 36, ${0.18 + urgency * 0.7})`;
				context.lineWidth = (2 + urgency * 2) * gameScale;
				for (let index = 0; index < 6; index += 1) {
					context.rotate(Math.PI / 3);
					context.beginPath();
					context.moveTo(enemy.size * 0.65, 0);
					context.lineTo(enemy.size * (0.85 + urgency * 0.35), 0);
					context.stroke();
				}
			} else {
				const orbit = performance.now() * 0.004;
				const radius = enemy.size * (0.8 + (1 - urgency) * 0.5);
				context.strokeStyle = `rgba(190, 242, 100, ${0.2 + urgency * 0.7})`;
				context.lineWidth = (2 + urgency * 2) * gameScale;
				context.beginPath();
				context.arc(0, 0, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * urgency);
				context.stroke();
				context.fillStyle = '#d9f99d';
				context.beginPath();
				context.arc(
					Math.cos(orbit) * radius,
					Math.sin(orbit) * radius,
					(3 + urgency * 3) * gameScale,
					0,
					Math.PI * 2
				);
				context.fill();
			}
			context.restore();
		}

		function drawPolygon(sides: number, radius: number, rotation: number) {
			context.beginPath();
			for (let index = 0; index < sides; index += 1) {
				const angle = rotation + (Math.PI * 2 * index) / sides;
				const x = Math.cos(angle) * radius;
				const y = Math.sin(angle) * radius;
				if (index === 0) context.moveTo(x, y);
				else context.lineTo(x, y);
			}
			context.closePath();
		}

		function drawEnemyShape(enemy: Enemy) {
			const sides =
				enemy.type === 'charger' ? 3 : enemy.type === 'sniper' ? 4 : enemy.type === 'scatter' ? 6 : 5;
			const rotation = enemy.type === 'charger' ? 0 : -Math.PI / 2;
			drawPolygon(sides, enemy.size / 2, rotation);
			context.fill();
		}

		function drawPlayer() {
			const pulse = 0.5 + Math.sin(performance.now() * 0.006) * 0.5;
			const radius = player.size / 2;
			context.save();
			context.translate(player.x, player.y);
			context.shadowBlur = (28 + pulse * 10) * gameScale;
			context.shadowColor = '#38bdf8';
			context.fillStyle = '#38bdf8';
			context.beginPath();
			context.arc(0, 0, radius, 0, Math.PI * 2);
			context.fill();
			context.strokeStyle = '#f8fafc';
			context.lineWidth = 3 * gameScale;
			context.stroke();
			context.shadowBlur = 0;
			context.strokeStyle = `rgba(125, 211, 252, ${0.28 + pulse * 0.22})`;
			context.lineWidth = 2 * gameScale;
			context.beginPath();
			context.arc(0, 0, radius + (7 + pulse * 2) * gameScale, 0, Math.PI * 2);
			context.stroke();
			context.fillStyle = '#ffffff';
			context.beginPath();
			context.arc(0, 0, 4 * gameScale, 0, Math.PI * 2);
			context.fill();
			context.restore();
		}

		function drawEnemy(enemy: Enemy) {
			const baseColor = enemyConfig[enemy.type].color;
			const color = enemy.selected ? '#fbbf24' : baseColor;
			const urgency =
				enemy.state === 'aiming'
					? Math.max(0, Math.min(1, 1 - enemy.timer / enemyConfig[enemy.type].aim))
					: 0;
			const pulse = Math.sin(performance.now() * (0.01 + urgency * 0.025)) * urgency;
			const chargeScale =
				enemy.type === 'charger'
					? enemy.state === 'attacking'
						? 1.08 + (enemy.attackSpeed / 650) * 0.05
						: 1 + urgency * urgency * 0.3 + pulse * 0.025
					: enemy.type === 'seeker'
						? 1 + urgency * 0.16 + pulse * 0.035
						: 1 + urgency * 0.1 + pulse * 0.025;
			context.save();
			context.translate(enemy.x, enemy.y);
			if (enemy.type === 'sniper' && urgency > 0.82) {
				const shake = (urgency - 0.82) * 10;
				context.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
			}
			context.scale(chargeScale, chargeScale);
			context.shadowBlur = (18 + urgency * 34) * gameScale;
			context.shadowColor = color;
			context.fillStyle = enemy.invulnerableTimer > 0 ? '#ffffff' : color;
			if (enemy.type === 'charger') context.rotate(Math.atan2(enemy.directionY, enemy.directionX));
			if (enemy.type === 'scatter') context.rotate(performance.now() * 0.00035 * urgency);
			drawEnemyShape(enemy);
			context.restore();
			context.fillStyle = '#ffffff';
			context.font = `700 ${15 * gameScale}px "Fira Mono", monospace`;
			context.textAlign = 'center';
			context.textBaseline = 'middle';
			context.fillText(enemy.id, enemy.x, enemy.y + 1);
			const pipY = enemy.y - enemy.size / 2 - 10 * gameScale;
			for (let pip = 0; pip < enemy.maxHp; pip += 1) {
				context.fillStyle = pip < enemy.hp ? baseColor : 'rgba(255,255,255,0.15)';
				context.fillRect(
					enemy.x - 8 * gameScale + pip * 10 * gameScale,
					pipY,
					7 * gameScale,
					3 * gameScale
				);
			}
		}

		function drawBullet(bullet: Bullet) {
			context.strokeStyle = bullet.color;
			context.fillStyle = bullet.color;
			context.shadowBlur = (bullet.kind === 'seeker' ? 16 : 8) * gameScale;
			context.shadowColor = bullet.color;
			if (bullet.kind === 'seeker') {
				context.beginPath();
				context.arc(bullet.x, bullet.y, 7 * gameScale, 0, Math.PI * 2);
				context.fill();
			}
			context.lineWidth = (bullet.kind === 'sniper' ? 3 : 2) * gameScale;
			context.beginPath();
			context.moveTo(bullet.x, bullet.y);
			context.lineTo(
				bullet.x - bullet.vx * 0.04 * gameScale,
				bullet.y - bullet.vy * 0.04 * gameScale
			);
			context.stroke();
			context.shadowBlur = 0;
		}

		function draw() {
			context.fillStyle = '#090d16';
			context.fillRect(0, 0, world.width, world.height);
			drawGrid();
			for (const enemy of enemies) if (enemy.alive) drawTelegraph(enemy);
			for (const particle of particles) {
				context.globalAlpha = particle.life;
				context.fillStyle = particle.color;
				context.fillRect(particle.x - 2, particle.y - 2, 4, 4);
			}
			context.globalAlpha = 1;
			for (const bullet of bullets) drawBullet(bullet);
			if (status !== 'dead') {
				drawPlayer();
			}
			context.shadowBlur = 0;
			for (const enemy of enemies) if (enemy.alive) drawEnemy(enemy);
			if (screenFlash > 0) {
				context.fillStyle = `rgba(255, 255, 255, ${Math.min(0.24, screenFlash * 1.7)})`;
				context.fillRect(0, 0, world.width, world.height);
			}
		}

		function frame(time: number) {
			const delta = Math.min((time - previousTime) / 1000, 0.05);
			previousTime = time;
			update(delta);
			draw();
			animationFrame = requestAnimationFrame(frame);
		}

		resize();
		resetEncounter();
		window.addEventListener('resize', resize);
		window.addEventListener('keydown', handleKeyDown);
		window.addEventListener('keyup', handleKeyUp);
		window.addEventListener('blur', handleBlur);
		animationFrame = requestAnimationFrame(frame);
		return () => {
			cancelAnimationFrame(animationFrame);
			window.clearTimeout(swapTimer);
			window.removeEventListener('resize', resize);
			window.removeEventListener('keydown', handleKeyDown);
			window.removeEventListener('keyup', handleKeyUp);
			window.removeEventListener('blur', handleBlur);
			restartGame = () => {};
			adjustGameScale = () => {};
		};
	});
</script>

<svelte:head>
	<meta name="theme-color" content="#090d16" />
</svelte:head>

<section class="game-shell" aria-label="Boogie Woogie game prototype">
	<canvas bind:this={canvas} aria-label="Game arena"></canvas>
	<div class="hud" aria-live="polite">
		<div class="title-block">
			<a href="/" aria-label="Leave game">&larr;</a>
			<div>
				<h1>Boogie Woogie</h1>
				<p>
					{kills} kills · {swaps} swaps · {activeEnemies} active{selectedKey
						? ` · ${selectedKey} selected`
						: ''}
				</p>
			</div>
		</div>
		<div class="objective">
			<strong>Endless encounter · another enemy joins every five kills.</strong>
			<span>
				Swap after momentum commits · <i class="charger-dot"></i> rush · <i
					class="sniper-dot"
				></i> snipe ·
				<i class="scatter-dot"></i> spread · <i class="seeker-dot"></i> hunt
			</span>
		</div>
		<div class="controls">
			<span><kbd>WASD</kbd> move</span>
			<span><kbd>LL</kbd> self-swap with L</span>
			<span><kbd>LK</kbd> swap any two</span>
			<span><kbd>R</kbd> restart</span>
			<span class="scale-control" aria-label="Game scale">
				<button aria-label="Decrease game scale" onclick={() => adjustGameScale(-0.05)}>−</button>
				<output>{Math.round(gameScale * 100)}%</output>
				<button aria-label="Increase game scale" onclick={() => adjustGameScale(0.05)}>+</button>
			</span>
		</div>
	</div>
	{#if combatNotice}
		<div class="combat-notice">{combatNotice}</div>
	{/if}
	{#if status !== 'playing'}
		<div class="result">
			<p>Run over · {kills} kills · {swaps} swaps</p>
			<h2>Read the pressure.</h2>
			<button onclick={restartGame}><kbd>R</kbd> Play again</button>
		</div>
	{/if}
</section>

<style>
	:global(body:has(.game-shell)) {
		overflow: hidden;
	}
	.game-shell {
		background: #090d16;
		box-shadow: inset 0 0 0 3px rgb(244 63 94 / 0.32);
		color: white;
		flex: 1;
		min-height: 0;
		position: relative;
		user-select: none;
	}
	canvas {
		display: block;
		height: 100%;
		inset: 0;
		position: absolute;
		width: 100%;
	}
	.hud {
		display: flex;
		inset: 0;
		justify-content: space-between;
		padding: max(1rem, env(safe-area-inset-top)) max(1rem, env(safe-area-inset-right))
			max(1rem, env(safe-area-inset-bottom)) max(1rem, env(safe-area-inset-left));
		pointer-events: none;
		position: absolute;
	}
	.title-block {
		align-items: flex-start;
		display: flex;
		gap: 0.75rem;
	}
	a {
		align-items: center;
		backdrop-filter: blur(12px);
		background: rgb(15 23 42 / 0.72);
		border: 1px solid rgb(148 163 184 / 0.25);
		border-radius: 999px;
		color: white;
		display: flex;
		font-size: 1.15rem;
		height: 2.5rem;
		justify-content: center;
		pointer-events: auto;
		text-decoration: none;
		width: 2.5rem;
	}
	h1,
	h2,
	p {
		margin: 0;
	}
	h1 {
		font-size: clamp(1rem, 2vw, 1.35rem);
		letter-spacing: 0.04em;
		line-height: 1.1;
		text-transform: uppercase;
	}
	p {
		color: #94a3b8;
		font: 0.72rem/1.4 var(--font-mono);
		margin-top: 0.25rem;
	}
	.objective {
		align-items: center;
		display: flex;
		flex-direction: column;
		font-size: 0.78rem;
		gap: 0.25rem;
		left: 50%;
		position: absolute;
		text-align: center;
		transform: translateX(-50%);
	}
	.objective span {
		color: #94a3b8;
		font: 0.65rem/1.4 var(--font-mono);
		white-space: nowrap;
	}
	.objective i {
		border-radius: 999px;
		display: inline-block;
		height: 0.45rem;
		margin-inline: 0.2rem;
		width: 0.45rem;
	}
	.charger-dot {
		background: #e43f54;
	}
	.sniper-dot {
		background: #a855f7;
	}
	.scatter-dot {
		background: #f59e0b;
	}
	.seeker-dot {
		background: #84cc16;
	}
	.controls {
		align-self: flex-end;
		backdrop-filter: blur(12px);
		background: rgb(15 23 42 / 0.72);
		border: 1px solid rgb(148 163 184 / 0.2);
		border-radius: 0.75rem;
		color: #cbd5e1;
		display: flex;
		font: 0.7rem/1.4 var(--font-mono);
		gap: 1rem;
		padding: 0.65rem 0.8rem;
	}
	.scale-control {
		align-items: center;
		border-left: 1px solid rgb(148 163 184 / 0.2);
		display: inline-flex;
		gap: 0.35rem;
		padding-left: 0.9rem;
	}
	.scale-control button {
		align-items: center;
		background: rgb(255 255 255 / 0.08);
		border: 1px solid rgb(148 163 184 / 0.28);
		border-radius: 0.35rem;
		color: white;
		cursor: pointer;
		display: inline-flex;
		font: 700 0.85rem/1 var(--font-mono);
		height: 1.4rem;
		justify-content: center;
		pointer-events: auto;
		width: 1.4rem;
	}
	.scale-control button:hover,
	.scale-control button:focus-visible {
		background: rgb(56 189 248 / 0.2);
		border-color: rgb(125 211 252 / 0.72);
		outline: none;
	}
	.scale-control output {
		color: #e2e8f0;
		min-width: 2.7rem;
		text-align: center;
	}
	kbd {
		color: white;
		font: inherit;
		font-weight: 700;
	}
	.combat-notice {
		background: rgb(15 23 42 / 0.82);
		border: 1px solid rgb(251 191 36 / 0.7);
		border-radius: 999px;
		color: #fef3c7;
		font: 800 clamp(0.7rem, 1.5vw, 0.9rem) / 1 var(--font-mono);
		left: 50%;
		letter-spacing: 0.08em;
		padding: 0.6rem 0.85rem;
		pointer-events: none;
		position: absolute;
		top: 4.6rem;
		transform: translateX(-50%);
	}
	.result {
		align-items: center;
		backdrop-filter: blur(18px);
		background: rgb(9 13 22 / 0.82);
		border: 1px solid rgb(244 63 94 / 0.45);
		border-radius: 1rem;
		box-shadow: 0 1rem 5rem rgb(0 0 0 / 0.45);
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
		left: 50%;
		padding: 2rem 2.5rem;
		position: absolute;
		top: 50%;
		transform: translate(-50%, -50%);
	}
	.result p {
		color: #94a3b8;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	.result h2 {
		font-size: clamp(1.4rem, 4vw, 2rem);
		white-space: nowrap;
	}
	.result button {
		background: white;
		border: 0;
		border-radius: 999px;
		color: #090d16;
		cursor: pointer;
		font: 700 0.75rem/1 var(--font-mono);
		margin-top: 0.35rem;
		padding: 0.8rem 1rem;
	}
	.result button kbd {
		color: inherit;
	}
	@media (max-width: 46rem) {
		.objective {
			display: none;
		}
		.controls {
			flex-direction: column;
			gap: 0.2rem;
		}
		.scale-control {
			border-left: 0;
			border-top: 1px solid rgb(148 163 184 / 0.2);
			margin-top: 0.2rem;
			padding-left: 0;
			padding-top: 0.4rem;
		}
		.result {
			padding: 1.5rem;
		}
	}
</style>
