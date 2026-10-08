import { createRouter, createWebHistory, createMemoryHistory } from 'vue-router'
import { session, refreshMe } from './store.js'
import Login from './pages/Login.vue'
import Main from './pages/Main.vue'
import Product from './pages/Product.vue'
import AiNew from './pages/AiNew.vue'
import AiReview from './pages/AiReview.vue'
import DocReview from './pages/DocReview.vue'
import Requests from './pages/Requests.vue'
import History from './pages/History.vue'
import Admin from './pages/Admin.vue'

// 화면 번호는 화면 설계서 v2 (S01~S10). S07 수정 요청 쓰기는 S06 위에 뜨는 창.
const routes = [
  { path: '/login', component: Login, meta: { public: true } },
  { path: '/', component: Main },
  { path: '/products/:id', component: Product, props: true },
  { path: '/products/:id/ai/new', component: AiNew, props: true },
  { path: '/ai/:id', component: AiReview, props: true },
  { path: '/docs/:id', component: DocReview, props: true },
  { path: '/docs/:id/history', component: History, props: true },
  { path: '/requests', component: Requests },
  { path: '/admin', component: Admin },
]

export const router = createRouter({
  // 데모에서는 주소창을 쓰지 않는 메모리 방식, 실제 배포에서는 일반 주소
  history: __ROUTER_MODE__ === 'memory' ? createMemoryHistory() : createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})

router.beforeEach(async to => {
  if (!session.loaded) await refreshMe()
  if (!to.meta.public && !session.user) return { path: '/login', query: { next: to.fullPath } }
})
