import { screen, within } from "@testing-library/react"

// SelectMenu(공용 펼침 목록)에서 값 또는 보이는 글자로 항목을 골라요. user.selectOptions 대신 써요.
export async function pickOption(user, trigger, valueOrLabel) {
	await user.click(trigger)
	const list = screen.getByRole("listbox")
	const option =
		list.querySelector(`[data-value="${CSS.escape(valueOrLabel)}"]`) ??
		within(list).getByRole("option", { name: valueOrLabel })
	await user.click(option)
}

// 열린 목록의 값들(<option>.value 대신). 확인한 뒤 Esc 로 닫아요.
export async function optionValues(user, trigger) {
	await user.click(trigger)
	const values = within(screen.getByRole("listbox"))
		.getAllByRole("option")
		.map((option) => option.dataset.value)
	await user.keyboard("{Escape}")
	return values
}
