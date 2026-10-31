import { useQuery } from "@tanstack/react-query"
import { authApi } from "../api/authApi"

export const sessionKey = ["auth", "me"]

export function useSession() {
	return useQuery({ queryKey: sessionKey, queryFn: authApi.me, retry: false })
}
