import { Link } from "react-router"
import "../styles/button.css"

// 공통 버튼(SCRUM-371, 05_ui.md 1-1절). 채움 파랑(primary)은 화면당 1개.
// variant: primary · secondary · ghost · danger(되돌릴 수 없는 일). 높이는 --control-height.
function classOf({ variant = "secondary", size = "md", block = false, className }) {
	return [
		"ui-button",
		`ui-button-${variant}`,
		size === "sm" && "ui-button-sm",
		block && "is-block",
		className,
	]
		.filter(Boolean)
		.join(" ")
}

export default function Button({
	variant,
	size,
	block,
	loading = false,
	className,
	type = "button",
	disabled,
	children,
	...rest
}) {
	return (
		<button
			{...rest}
			type={type}
			className={classOf({ variant, size, block, className })}
			disabled={disabled || loading}
			aria-busy={loading || undefined}
		>
			{children}
		</button>
	)
}

// 버튼 모양의 화면 이동 — 이동은 링크로(버튼 onClick 이동 금지).
export function ButtonLink({ variant, size, block, className, children, ...rest }) {
	return (
		<Link {...rest} className={classOf({ variant, size, block, className })}>
			{children}
		</Link>
	)
}
