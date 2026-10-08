import { createRouter, createWebHistory, createMemoryHistory } from 'vue-router'
import { session, refreshMe } from './store.js'
import Login from './pages/Login.vue'
import Home from './pages/Home.vue'
import ManualDashboard from './pages/ManualDashboard.vue'
import IssueNew from './pages/IssueNew.vue'
import IssueDetail from './pages/IssueDetail.vue'
import Revisions from './pages/Revisions.vue'
import ManualNew from './pages/ManualNew.vue'
import Admin from './pages/Admin.vue'

const routes = [
  { path: '/login', component: Login, meta: { public: true } },
  { path: '/', component: Home },
  { path: '/manuals/new', component: ManualNew },
  { path: '/manuals/:id', component: ManualDashboard, props: true },
  { path: '/manuals/:id/issues/new', component: IssueNew, props: true },
  { path: '/manuals/:id/revisions', component: Revisions, props: true },
  { path: '/issues/:id', component: IssueDetail, props: true },
  { path: '/admin', component: Admin },
]

export const router = createRouter({
  // 데모(Artifact)에서는 주소창을 쓰지 않는 메모리 방식, 실제 배포에서는 일반 주소
  history: __ROUTER_MODE__ === 'memory' ? createMemoryHistory() : createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})

router.beforeEach(async to => {
  if (!session.loaded) await refreshMe()
  if (!to.meta.public && !session.user) return '/login'
})
