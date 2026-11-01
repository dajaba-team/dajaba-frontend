import { useQuery } from "@tanstack/react-query"
import { casesApi } from "../api/casesApi"

export function useCases(params) {
	return useQuery({
		queryKey: ["cases", params],
		queryFn: ({ signal }) => casesApi.list(params, signal),
	})
}
export function useCaseDetail(id) {
	return useQuery({
		queryKey: ["case", id],
		queryFn: ({ signal }) => casesApi.detail(id, signal),
	})
}
