import Icon from "./Icon.jsx"
export default function Button({
	children,
	onClick,
	variant = "primary",
	icon,
	disabled,
	title,
	type = "button",
}) {
	return (
		<button
			type={type}
			className={`button button-${variant}`}
			onClick={onClick}
			disabled={disabled}
			title={title}
		>
			{icon && <Icon name={icon} size={16} />}
			<span>{children}</span>
		</button>
	)
}
