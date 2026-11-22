import { useCallback, useEffect, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { notificationsApi } from "../api/notificationsApi"
import { seenKey } from "../model/notificationRules"
import { useToast } from "../../../shared/ui/toast/useToast"

// 업무 알림 (「비동기 작업 알림 설계 문서」 7.5·7.8절, SCRUM-334).
// 종 숫자: since=마지막으로 본 시각으로 30초마다 total만 받아요(size 1). 탭이 가려지면 멈추고, 보이면 바로 한 번.
// 목록: 종을 열 때 최근 7일(since 없이)을 받아요 — 본 것도 다시 볼 수 있게(설계 7.5 "놓친 알림을 여기서 다시 봐요").
// 키 첫 칸이 "notifications"라 로그아웃·계정 전환 때 업무 캐시와 같이 지워져요.
export const NOTIFICATION_POLL_MS = 30_000
const LIST_SIZE = 20

export const notificationsKey = (loginId) => ["notifications", loginId]

function readSeen(loginId) {
	try {
		return localStorage.getItem(seenKey(loginId))
	} catch {
		return null
	}
}

function writeSeen(loginId, value) {
	try {
		localStorage.setItem(seenKey(loginId), value)
	} catch {
		// 저장하지 못해도 이번 화면에서는 본 것으로 쳐요.
	}
}

/** 종 숫자 + 새 알림 토스트. 마지막으로 본 시각은 로그인 아이디별 localStorage(응답 server_time 그대로). */
export function useNotificationBadge(loginId) {
	const [seen, setSeen] = useState(() => readSeen(loginId))
	const badge = useQuery({
		queryKey: [...notificationsKey(loginId), "badge", seen],
		queryFn: ({ signal }) => notificationsApi.list({ since: seen, size: 1 }, signal),
		enabled: Boolean(loginId),
		refetchInterval: NOTIFICATION_POLL_MS,
		refetchIntervalInBackground: false,
		refetchOnWindowFocus: true,
		staleTime: 0,
		retry: false,
		// 조회가 실패해도 종은 직전 숫자 그대로(설계 9 #41) — 에러 토스트 없음
		placeholderData: (previous) => previous,
	})
	// 자리 채움 값은 "본 시각"이 바뀌어 새 키를 부르는 동안의 옛 숫자예요 — 방금 봤으니 0으로.
	const total = badge.isPlaceholderData ? 0 : (badge.data?.total ?? 0)

	// 숫자가 늘면 "새 알림 n건" 하나만. 로그인 직후 첫 응답·본 직후 0으로 내려간 건 띄우지 않아요.
	const { show } = useToast()
	const previous = useRef(null)
	useEffect(() => {
		if (!badge.isSuccess || badge.isPlaceholderData) return
		const before = previous.current
		previous.current = total
		if (before != null && total > before)
			show({ tone: "info", text: `새 알림 ${total - before}건` })
	}, [badge.isSuccess, badge.isPlaceholderData, badge.dataUpdatedAt, total, show])

	const markSeen = useCallback(
		(serverTime) => {
			if (!serverTime) return
			writeSeen(loginId, serverTime)
			previous.current = 0
			setSeen(serverTime)
		},
		[loginId],
	)
	return { total, seen, markSeen }
}

/** 종을 열었을 때의 목록 — 최근 7일, 최신순 20개. */
export function useNotificationList(loginId, { enabled }) {
	return useQuery({
		queryKey: [...notificationsKey(loginId), "list"],
		queryFn: ({ signal }) => notificationsApi.list({ size: LIST_SIZE }, signal),
		enabled: Boolean(loginId) && enabled,
		staleTime: 0,
		retry: false,
	})
}
