import {
	defaultPointerSettings,
	type ClickMode,
	type HoverMode,
	type PointerSettings
} from './pointer-interaction';
import {
	DEFAULT_MIN_ACCELERATION,
	DEFAULT_TICK_RATE,
	DEFAULT_TIME_SCALE
} from './physics';

export type ParticleAppearance = {
	dotOpacity: number;
	linkEnabled: boolean;
	linkOpacity: number;
	linkRadius: number;
	linkDropoff: number;
};

export const defaultParticleAppearance: ParticleAppearance = {
	dotOpacity: 0.5,
	linkEnabled: true,
	linkOpacity: 0.2,
	linkRadius: 130,
	linkDropoff: 1
};

export interface PlaygroundDotsGroup {
	count: number;
	defaultCount: number;
	bounce: number;
	opacity: number;
}

export interface PlaygroundLinksGroup {
	enabled: boolean;
	opacity: number;
	radius: number;
	dropoff: number;
}

export interface PlaygroundHoverGroup {
	mode: HoverMode;
	mu: number;
	coreRadius: number;
}

export interface PlaygroundClickGroup {
	mode: ClickMode;
	mu: number;
	growthMuPerSecond: number;
	coreRadius: number;
	strokeWidth: number;
	wallOpacity: number;
	eraserRadius: number;
}

export interface PlaygroundWorldGroup {
	walls: boolean;
	timeScale: number;
	tickRate: number;
	minAcceleration: number;
}

export interface PlaygroundGroups {
	dots: PlaygroundDotsGroup;
	links: PlaygroundLinksGroup;
	hover: PlaygroundHoverGroup;
	click: PlaygroundClickGroup;
	world: PlaygroundWorldGroup;
}

export interface SliderControlSchema {
	id: string;
	label: string;
	value: number;
	defaultValue: number;
	min?: number;
	max?: number;
	step: number;
	pixelsPerStep?: number;
	format?: (value: number) => string;
	onChange: (value: number) => void;
}

export interface ControlSectionSchema {
	id: 'dots' | 'links' | 'hover' | 'click' | 'world';
	title: string;
	toggle?: {
		enabled: boolean;
		label: string;
		onChange: (enabled: boolean) => void;
	};
	modes?: {
		value: string;
		options: ReadonlyArray<{ value: string; label: string }>;
		onChange: (mode: string) => void;
	};
	controls: SliderControlSchema[];
	action?: {
		label: string;
		disabled?: boolean;
		onClick: () => void;
	};
}

export function formatForceMagnitude(value: number): string {
	if (value === 0) return '0';
	if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
	return `${Math.round(value / 1000)}k`;
}

export function formatForceRate(value: number): string {
	if (value === 0) return '0/s';
	return `${(value / 1_000_000).toFixed(1)}M/s`;
}

export function createDefaultPlaygroundGroups(defaultCount = 0): PlaygroundGroups {
	return {
		dots: {
			count: defaultCount,
			defaultCount,
			bounce: 0.3,
			opacity: defaultParticleAppearance.dotOpacity
		},
		links: {
			enabled: defaultParticleAppearance.linkEnabled,
			opacity: defaultParticleAppearance.linkOpacity,
			radius: defaultParticleAppearance.linkRadius,
			dropoff: defaultParticleAppearance.linkDropoff
		},
		hover: {
			mode: defaultPointerSettings.hover.mode ?? 'push',
			mu: defaultPointerSettings.hover.mu,
			coreRadius: defaultPointerSettings.hover.coreRadius
		},
		click: {
			mode: defaultPointerSettings.press.mode ?? 'pull',
			mu: defaultPointerSettings.press.mu ?? 0,
			growthMuPerSecond: defaultPointerSettings.press.growthMuPerSecond,
			coreRadius: defaultPointerSettings.press.coreRadius,
			strokeWidth: defaultPointerSettings.press.strokeWidth ?? 10,
			wallOpacity: defaultPointerSettings.press.wallOpacity ?? 0.35,
			eraserRadius: defaultPointerSettings.press.eraserRadius ?? 18
		},
		world: {
			walls: true,
			timeScale: DEFAULT_TIME_SCALE,
			tickRate: DEFAULT_TICK_RATE,
			minAcceleration: DEFAULT_MIN_ACCELERATION
		}
	};
}

export function toPointerSettings(groups: PlaygroundGroups): PointerSettings {
	return {
		hover:
			groups.hover.mode === 'off'
				? null
				: {
						mode: groups.hover.mode,
						mu: groups.hover.mu,
						coreRadius: groups.hover.coreRadius
					},
		press:
			groups.click.mode === 'off'
				? null
				: {
						mode: groups.click.mode,
						mu: groups.click.mu,
						growthMuPerSecond: groups.click.growthMuPerSecond,
						coreRadius: groups.click.coreRadius,
						strokeWidth: groups.click.strokeWidth,
						wallOpacity: groups.click.wallOpacity,
						eraserRadius: groups.click.eraserRadius
					}
	};
}

export function buildPlaygroundControlSections(
	groups: PlaygroundGroups,
	wallCount: number,
	handlers: {
		onDotsChange: (next: PlaygroundDotsGroup) => void;
		onLinksChange: (next: PlaygroundLinksGroup) => void;
		onHoverChange: (next: PlaygroundHoverGroup) => void;
		onClickChange: (next: PlaygroundClickGroup) => void;
		onWorldChange: (next: PlaygroundWorldGroup) => void;
		onClearWalls: () => void;
	}
): ControlSectionSchema[] {
	const { dots, links, hover, click, world } = groups;

	const clickControls: SliderControlSchema[] =
		click.mode === 'pull' || click.mode === 'push'
			? [
					{
						id: 'click-force',
						label: 'Force',
						value: click.mu,
						defaultValue: defaultPointerSettings.press.mu ?? 0,
						min: 0,
						step: 25000,
						pixelsPerStep: 8,
						format: formatForceMagnitude,
						onChange: (mu) => handlers.onClickChange({ ...click, mu })
					},
					{
						id: 'click-force-delta',
						label: 'Force delta',
						value: click.growthMuPerSecond,
						defaultValue: defaultPointerSettings.press.growthMuPerSecond,
						min: 0,
						step: 100000,
						pixelsPerStep: 8,
						format: formatForceRate,
						onChange: (growthMuPerSecond) =>
							handlers.onClickChange({ ...click, growthMuPerSecond })
					},
					{
						id: 'click-core-radius',
						label: 'Core radius',
						value: click.coreRadius,
						defaultValue: defaultPointerSettings.press.coreRadius,
						min: 4,
						max: 120,
						step: 2,
						pixelsPerStep: 10,
						format: (value) => `${value} px`,
						onChange: (coreRadius) => handlers.onClickChange({ ...click, coreRadius })
					}
				]
			: click.mode === 'draw'
				? [
						{
							id: 'click-stroke-width',
							label: 'Stroke width',
							value: click.strokeWidth,
							defaultValue: defaultPointerSettings.press.strokeWidth ?? 10,
							min: 2,
							max: 80,
							step: 2,
							pixelsPerStep: 10,
							format: (value) => `${value} px`,
							onChange: (strokeWidth) => handlers.onClickChange({ ...click, strokeWidth })
						},
						{
							id: 'click-wall-opacity',
							label: 'Wall opacity',
							value: click.wallOpacity,
							defaultValue: defaultPointerSettings.press.wallOpacity ?? 0.35,
							min: 0.05,
							max: 1,
							step: 0.05,
							pixelsPerStep: 14,
							format: (value) => `${Math.round(value * 100)}%`,
							onChange: (wallOpacity) => handlers.onClickChange({ ...click, wallOpacity })
						}
					]
				: click.mode === 'erase'
					? [
							{
								id: 'click-eraser-radius',
								label: 'Eraser size',
								value: click.eraserRadius,
								defaultValue: defaultPointerSettings.press.eraserRadius ?? 18,
								min: 4,
								max: 100,
								step: 2,
								pixelsPerStep: 10,
								format: (value) => `${value} px`,
								onChange: (eraserRadius) => handlers.onClickChange({ ...click, eraserRadius })
							}
						]
					: [];

	return [
		{
			id: 'dots',
			title: 'Dots',
			controls: [
				{
					id: 'dots-count',
					label: 'Count',
					value: dots.count,
					defaultValue: dots.defaultCount,
					min: 0,
					step: 1,
					pixelsPerStep: 6,
					onChange: (count) => handlers.onDotsChange({ ...dots, count })
				},
				{
					id: 'dots-bounce',
					label: 'Bounce',
					value: dots.bounce,
					defaultValue: 0.3,
					min: 0,
					max: 1,
					step: 0.05,
					pixelsPerStep: 10,
					format: (value) => value.toFixed(2),
					onChange: (bounce) => handlers.onDotsChange({ ...dots, bounce })
				},
				{
					id: 'dots-opacity',
					label: 'Opacity',
					value: dots.opacity,
					defaultValue: defaultParticleAppearance.dotOpacity,
					min: 0,
					max: 1,
					step: 0.05,
					pixelsPerStep: 14,
					format: (value) => `${Math.round(value * 100)}%`,
					onChange: (opacity) => handlers.onDotsChange({ ...dots, opacity })
				}
			]
		},
		{
			id: 'links',
			title: 'Links',
			toggle: {
				enabled: links.enabled,
				label: links.enabled ? 'On' : 'Off',
				onChange: (enabled) => handlers.onLinksChange({ ...links, enabled })
			},
			controls: links.enabled
				? [
						{
							id: 'links-opacity',
							label: 'Opacity',
							value: links.opacity,
							defaultValue: defaultParticleAppearance.linkOpacity,
							min: 0,
							max: 1,
							step: 0.05,
							pixelsPerStep: 14,
							format: (value) => `${Math.round(value * 100)}%`,
							onChange: (opacity) => handlers.onLinksChange({ ...links, opacity })
						},
						{
							id: 'links-radius',
							label: 'Search radius',
							value: links.radius,
							defaultValue: defaultParticleAppearance.linkRadius,
							min: 0,
							step: 10,
							pixelsPerStep: 8,
							format: (value) => `${value} px`,
							onChange: (radius) => handlers.onLinksChange({ ...links, radius })
						},
						{
							id: 'links-dropoff',
							label: 'Opacity dropoff',
							value: links.dropoff,
							defaultValue: defaultParticleAppearance.linkDropoff,
							min: 0,
							max: 4,
							step: 0.25,
							pixelsPerStep: 14,
							format: (value) => (value === 0 ? 'Flat (0)' : value.toFixed(2)),
							onChange: (dropoff) => handlers.onLinksChange({ ...links, dropoff })
						}
					]
				: []
		},
		{
			id: 'hover',
			title: 'Hover',
			modes: {
				value: hover.mode,
				options: [
					{ value: 'push', label: 'Push' },
					{ value: 'pull', label: 'Pull' },
					{ value: 'off', label: 'Off' }
				],
				onChange: (mode) => handlers.onHoverChange({ ...hover, mode: mode as HoverMode })
			},
			controls:
				hover.mode !== 'off'
					? [
							{
								id: 'hover-force',
								label: 'Force',
								value: hover.mu,
								defaultValue: defaultPointerSettings.hover.mu,
								min: 0,
								step: 5000,
								pixelsPerStep: 8,
								format: formatForceMagnitude,
								onChange: (mu) => handlers.onHoverChange({ ...hover, mu })
							},
							{
								id: 'hover-core-radius',
								label: 'Core radius',
								value: hover.coreRadius,
								defaultValue: defaultPointerSettings.hover.coreRadius,
								min: 4,
								max: 120,
								step: 2,
								pixelsPerStep: 10,
								format: (value) => `${value} px`,
								onChange: (coreRadius) => handlers.onHoverChange({ ...hover, coreRadius })
							}
						]
					: []
		},
		{
			id: 'click',
			title: 'Click',
			modes: {
				value: click.mode,
				options: [
					{ value: 'pull', label: 'Pull' },
					{ value: 'push', label: 'Push' },
					{ value: 'draw', label: 'Draw' },
					{ value: 'erase', label: 'Erase' },
					{ value: 'off', label: 'Off' }
				],
				onChange: (mode) => handlers.onClickChange({ ...click, mode: mode as ClickMode })
			},
			controls: clickControls,
			action:
				click.mode === 'draw' || click.mode === 'erase' || wallCount > 0
					? {
							label: wallCount > 0 ? `Clear walls (${wallCount})` : 'No walls drawn',
							disabled: wallCount === 0,
							onClick: handlers.onClearWalls
						}
					: undefined
		},
		{
			id: 'world',
			title: 'World',
			toggle: {
				enabled: world.walls,
				label: world.walls ? 'Walls: On' : 'Walls: Off',
				onChange: (walls) => handlers.onWorldChange({ ...world, walls })
			},
			controls: [
				{
					id: 'world-time-scale',
					label: 'Time scale',
					value: world.timeScale,
					defaultValue: DEFAULT_TIME_SCALE,
					min: 0,
					max: 4,
					step: 0.1,
					pixelsPerStep: 10,
					format: (value) => `${value.toFixed(1)}×`,
					onChange: (timeScale) => handlers.onWorldChange({ ...world, timeScale })
				},
				{
					id: 'world-tick-rate',
					label: 'Tick rate',
					value: world.tickRate,
					defaultValue: DEFAULT_TICK_RATE,
					min: 30,
					max: 480,
					step: 30,
					pixelsPerStep: 10,
					format: (value) => `${value} Hz`,
					onChange: (tickRate) => handlers.onWorldChange({ ...world, tickRate })
				},
				{
					id: 'world-min-accel',
					label: 'Min acceleration',
					value: world.minAcceleration,
					defaultValue: DEFAULT_MIN_ACCELERATION,
					min: 0,
					step: 0.05,
					pixelsPerStep: 16,
					format: (value) => `${value.toFixed(2)} px/s²`,
					onChange: (minAcceleration) =>
						handlers.onWorldChange({ ...world, minAcceleration })
				}
			]
		}
	];
}
