import { useEffect, useRef, useState } from "react"
import { Link } from "react-router"
import Icon from "../../../shared/ui/dashboard/Icon"
import { formatSystemTime } from "../../../shared/format/time"
import { useJobs } from "../../../shared/jobs/useJobs"
import { useNotificationBadge, useNotificationList } from "../hooks/useNotifications"
import {
	badgeLabel,
	moreLabel,
	notificationPath,
	notificationText,
} from "../model/notificationRules"
import "../styles/notifications.css"
import Spinner from "../../../shared/ui/Spinner"

// 위 띠 오른쪽 종 (「비동기 작업 알림 설계 문서」 7.5·7.8절, SCRUM-334). 모든 역할에 보여요.
// 역할 칩·시연 도구처럼 <details>라서 바깥을 누르거나 Esc, 화면을 옮기면 닫혀요(AppLayout이 처리).
// 작업 알림(추적기, SCRUM-365)은 목록 위 "작업" 칸 — 안 본 끝난 작업 수를 숫자에 더하고, 진행 중이면 종 옆에 돌아가는 표시.
// AppLayout이 key={loginId}로 그려서 계정이 바뀌면 처음부터 다시 시작해요.
export default function NotificationBell({ loginId }) {
	const [open, setOpen] = useState(false)
	const { total, seen, markSeen } = useNotificationBadge(loginId)
	const list = useNotificationList(loginId, { enabled: open })
	const jobs = useJobs()
	const label = badgeLabel(total + jobs.unseen)

	// 열었을 때 이전에 본 시각 — 그보다 새 줄에 "새" 표시. 목록을 받으면 그 server_time으로 본 것으로 쳐요.
	const seenAtOpen = useRef(null)
	const markedFor = useRef(null)
	useEffect(() => {
		if (!open || !list.data || list.isFetching) return
		if (markedFor.current === list.dataUpdatedAt) return
		markedFor.current = list.dataUpdatedAt
		markSeen(list.data.serverTime)
	}, [open, list.data, list.isFetching, list.dataUpdatedAt, markSeen])

	// 열려 있는 동안 끝난 작업도 본 것으로 — 열 때 한 번만 부르면 열어 둔 사이 끝난 건 "안 봄"으로 남아서(#96 리뷰)
	const { unseen, markSeen: markJobsSeen } = jobs
	useEffect(() => {
		if (open && unseen > 0) markJobsSeen()
	}, [open, unseen, markJobsSeen])

	const onToggle = (event) => {
		const next = event.currentTarget.open
		if (next) seenAtOpen.current = seen
		setOpen(next)
	}
	const isNew = (item) =>
		!seenAtOpen.current || Date.parse(item.at) > Date.parse(seenAtOpen.current)

	return (
		<details className="notification-bell" onToggle={onToggle}>
			<summary
				aria-label={[
					"알림",
					label && `새 알림 ${label}건`,
					jobs.running > 0 && `작업 ${jobs.running}개 진행 중`,
				]
					.filter(Boolean)
					.join(", ")}
			>
				<Icon name="bell" size={18} />
				{jobs.running > 0 && <span className="notification-running" aria-hidden="true" />}
				{label && (
					<span className="notification-count" aria-hidden="true">
						{label}
					</span>
				)}
			</summary>
			<div className="notification-panel" role="region" aria-label="알림 목록">
				{jobs.jobs.length > 0 && <JobList jobs={jobs.jobs} recheck={jobs.recheck} />}
				<p className="notification-panel-head">업무 알림 · 최근 7일</p>
				{open && <NotificationList list={list} isNew={isNew} />}
			</div>
		</details>
	)
}

// 내가 시작한 작업(추적기) — 진행 중·확인 필요·끝남. 확인 필요엔 [다시 확인](설계 7.5)
const jobText = (job) =>
	job.state === "TRACKING"
		? `${job.label} · 진행 중`
		: job.state === "STALE"
			? `${job.label} · 아직 진행 중이에요(확인 필요)`
			: job.text

function JobList({ jobs, recheck }) {
	return (
		<>
			<p className="notification-panel-head">작업</p>
			<ul className="notification-list">
				{jobs.map((job) => (
					<li
						key={`${job.kind}-${job.id}`}
						className="notification-job"
						data-state={job.state}
					>
						<Link to={job.to}>
							<span className="notification-tag is-job">작업</span>
							<span className="notification-text">{jobText(job)}</span>
							<small>{formatSystemTime(job.finishedAt ?? job.trackedAt)}</small>
						</Link>
						{job.state === "STALE" && (
							<button
								type="button"
								className="notification-recheck"
								onClick={() => recheck(job)}
							>
								다시 확인
							</button>
						)}
					</li>
				))}
			</ul>
		</>
	)
}

function NotificationList({ list, isNew }) {
	if (list.isPending) return <Spinner size="sm" label="알림을 불러오는 중" />
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
