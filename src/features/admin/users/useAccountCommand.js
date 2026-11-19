import { useMutation, useQueryClient } from "@tanstack/react-query"
import { adminUsersApi } from "./api/adminUsersApi"
import { getErrorCode } from "../../../shared/api/apiClient"

// 목록이 서버와 달라서 생기는 오류 — 계정 목록을 다시 불러 버튼을 맞춰요(계약서 3절).
const REFETCH_ON = ["ACCOUNT_CHANGE_NOT_ALLOWED", "USER_NOT_FOUND"]

/** 계정 변경(create·changeRole·deactivate·activate·resetPassword). 성공하면 계정 목록·조사역 목록을 다시 불러요. */
export function useAccountCommand(name) {
	const client = useQueryClient()
	const refresh = () => client.invalidateQueries({ queryKey: ["admin", "users"] })
	return useMutation({
		mutationFn: (input) => adminUsersApi[name](input),
		onSuccess: refresh,
		onError: (error) => {
			if (REFETCH_ON.includes(getErrorCode(error))) void refresh()
		},
	})
}
