export class ApiError extends Error {
	constructor(status, body) {
		super(body.error.message)
		this.name = "DemoApiError"
		this.status = status
		this.body = body
	}
}
