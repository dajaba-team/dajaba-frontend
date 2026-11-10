import { useMutation, useQueryClient } from "@tanstack/react-query"
import { adminUsersApi } from "./api/adminUsersApi"

/** 계정 변경(create·changeRole·deactivate·activate·resetPassword). 성공하면 계정 목록·조사역 목록을 다시 불러요. */
export function useAccountCommand(name) {
	const client = useQueryClient()
	return useMutation({
		mutationFn: (input) => adminUsersApi[name](input),
		onSuccess: () => client.invalidateQueries({ queryKey: ["admin", "users"] }),
	})
}
