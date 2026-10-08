// __API_MODE__ 는 vite.config.js 가 정합니다: 데모 빌드는 mock, 실제 빌드는 http.
import { api as mock } from './mock.js'
import { api as http } from './http.js'

export const isDemo = __API_MODE__ === 'mock'
export const api = isDemo ? mock : http
