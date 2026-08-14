import type { ReactNode } from 'react';

/**
 * The handful of controls this editor needs, built directly rather than pulled from a component
 * library — there are five of them and they all want the same dense, tool-like proportions.
 */

export function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
	return (
		<section className="border-b border-edge">
			<header className="flex items-center justify-between px-3 py-2">
				<h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted">{title}</h2>
				{aside}
			</header>
			<div className="flex flex-col gap-2 px-3 pb-3">{children}</div>
		</section>
	);
}

export function Field({ label, hint, children }: { label: string; hint?: string | undefined; children: ReactNode }) {
	return (
		<label className="flex items-center justify-between gap-3">
			<span className="flex flex-col">
				<span>{label}</span>
				{hint ? <span className="text-[11px] text-muted">{hint}</span> : null}
			</span>
			<span className="shrink-0">{children}</span>
		</label>
	);
}

export function Select<T extends string>({
	value,
	options,
	onChange,
	disabled,
}: {
	value: T;
	options: readonly T[] | readonly { value: T; label: string }[];
	onChange: (value: T) => void;
	disabled?: boolean;
}) {
	const normalized = options.map((o) => (typeof o === 'string' ? { value: o, label: prettify(o) } : o));
	return (
		<select
			className="min-w-36 rounded border border-edge bg-surface px-2 py-1 text-ink disabled:opacity-40"
			value={value}
			disabled={disabled}
			onChange={(e) => onChange(e.target.value as T)}
		>
			{normalized.map((o) => (
				<option key={o.value} value={o.value}>
					{o.label}
				</option>
			))}
		</select>
	);
}

export function Slider({
	value,
	min,
	max,
	step = 1,
	onChange,
	disabled,
	format,
}: {
	value: number;
	min: number;
	max: number;
	step?: number;
	onChange: (value: number) => void;
	disabled?: boolean;
	format?: (v: number) => string;
}) {
	return (
		<span className="flex items-center gap-2">
			<input
				type="range"
				className="w-32 accent-accent disabled:opacity-40"
				value={value}
				min={min}
				max={max}
				step={step}
				disabled={disabled}
				onChange={(e) => onChange(Number(e.target.value))}
			/>
			<span className="w-12 text-right tabular-nums text-muted">
				{format ? format(value) : value}
			</span>
		</span>
	);
}

export function Toggle({
	checked,
	onChange,
	disabled,
	label,
}: {
	checked: boolean;
	onChange: (checked: boolean) => void;
	disabled?: boolean;
	label?: string;
}) {
	return (
		<input
			type="checkbox"
			aria-label={label}
			className="size-4 accent-accent disabled:opacity-40"
			checked={checked}
			disabled={disabled}
			onChange={(e) => onChange(e.target.checked)}
		/>
	);
}

export function Button({
	children,
	onClick,
	disabled,
	variant = 'default',
	title,
}: {
	children: ReactNode;
	onClick?: () => void;
	disabled?: boolean;
	variant?: 'default' | 'primary' | 'ghost';
	title?: string;
}) {
	const styles = {
		default: 'border-edge bg-panel hover:bg-edge',
		primary: 'border-accent bg-accent text-surface hover:opacity-90 font-medium',
		ghost: 'border-transparent hover:bg-panel',
	}[variant];
	return (
		<button
			type="button"
			title={title}
			className={`rounded border px-2.5 py-1 transition disabled:cursor-not-allowed disabled:opacity-40 ${styles}`}
			onClick={onClick}
			disabled={disabled}
		>
			{children}
		</button>
	);
}

export function prettify(value: string): string {
	return value
		.toLowerCase()
		.split('_')
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
		.join(' ');
}
