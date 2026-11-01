import Icon from "./Icon.jsx"
export default function Empty({ title, text }) {
	return (
		<div className="empty">
			<Icon name="document" size={26} />
			<strong>{title}</strong>
			<p>{text}</p>
		</div>
	)
}
