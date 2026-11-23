import { useEffect, useRef, useState } from "react"
import { Link } from "react-router"
import Icon from "../../../shared/ui/dashboard/Icon"
import { formatSystemTime } from "../../../shared/format/time"
import { useNotificationBadge, useNotificationList } from "../hooks/useNotifications"
import {
	badgeLabel,
	moreLabel,
	notificationPath,
	notificationText,
} from "../model/notificationRules"
import "../styles/notifications.css"

// 위 띠 오른쪽 종 (「비동기 작업 알림 설계 문서」 7.5·7.8절, SCRUM-334). 모든 역할에 보여요.
// 역할 칩·시연 도구처럼 <details>라서 바깥을 누르거나 Esc, 화면을 옮기면 닫혀요(AppLayout이 처리).
// 지금은 업무 알림만 — 작업 알림(추적기, 준혁님)이 생기면 같은 목록에 "작업" 꼬리표로 시간순으로 섞어요.
// AppLayout이 key={loginId}로 그려서 계정이 바뀌면 처음부터 다시 시작해요.
export default function NotificationBell({ loginId }) {
	const [open, setOpen] = useState(false)
	const { total, seen, markSeen } = useNotificationBadge(loginId)
	const list = useNotificationList(loginId, { enabled: open })
	const label = badgeLabel(total)

	// 열었을 때 이전에 본 시각 — 그보다 새 줄에 "새" 표시. 목록을 받으면 그 server_time으로 본 것으로 쳐요.
	const seenAtOpen = useRef(null)
	const markedFor = useRef(null)
	useEffect(() => {
		if (!open || !list.data || list.isFetching) return
		if (markedFor.current === list.dataUpdatedAt) return
		markedFor.current = list.dataUpdatedAt
		markSeen(list.data.serverTime)
	}, [open, list.data, list.isFetching, list.dataUpdatedAt, markSeen])

	const onToggle = (event) => {
		const next = event.currentTarget.open
		if (next) seenAtOpen.current = seen
		setOpen(next)
	}
	const isNew = (item) =>
		!seenAtOpen.current || Date.parse(item.at) > Date.parse(seenAtOpen.current)

	return (
		<details className="notification-bell" onToggle={onToggle}>
			<summary aria-label={label ? `알림, 새 알림 ${label}건` : "알림"}>
				<Icon name="bell" size={18} />
				{label && (
					<span className="notification-count" aria-hidden="true">
						{label}
					</span>
				)}
			</summary>
			<div className="notification-panel" role="region" aria-label="알림 목록">
				<p className="notification-panel-head">업무 알림 · 최근 7일</p>
				{open && <NotificationList list={list} isNew={isNew} />}
			</div>
		</details>
	)
}

function NotificationList({ list, isNew }) {
	if (list.isPending) return <p className="notification-empty">불러오는 중…</p>
	if (list.isError)
		return (
			<div className="notification-empty" role="alert">
				<p>알림을 불러오지 못했어요.</p>
				<button type="button" onClick={() => list.refetch()}>
					다시 불러오기
				</button>
			</div>
		)
	if (list.data.items.length === 0) return <p className="notification-empty">새 알림이 없어요.</p>
	const more = moreLabel(list.data.total, list.data.items.length)
	return (
		<>
			<ul className="notification-list">
				{list.data.items.map((item, index) => (
					<li key={`${item.type}-${item.caseNo}-${item.at}-${index}`}>
						<Link to={notificationPath(item)}>
							<span className="notification-tag">업무</span>
							{isNew(item) && <span className="notification-new">새 알림</span>}
							<span className="notification-text">{notificationText(item)}</span>
							<small>
								{[item.actor?.displayName, formatSystemTime(item.at)]
									.filter(Boolean)
									.join(" · ")}
							</small>
						</Link>
					</li>
				))}
			</ul>
			{more && <p className="notification-more">{more}</p>}
		</>
	)
}
