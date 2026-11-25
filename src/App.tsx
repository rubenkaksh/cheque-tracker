import { useState } from 'react'
import { Button, ConfigProvider, Dropdown, Layout, Menu, Spin } from 'antd'
import Dashboard from './features/Dashboard'
import ChequeForm from './features/ChequeForm'
import LoginPage from './features/LoginPage'
import { AuthProvider, useAuth } from './lib/auth'

type Tab = 'dashboard' | 'new'

function Shell() {
  const { session, role, loading, signOut } = useAuth()
  const [tab, setTab] = useState<Tab>('dashboard')

  if (loading) return <Spin className="!block !mt-16" />
  if (!session) return <LoginPage />

  const isAdmin = role === 'admin'
  const items = [{ key: 'dashboard', label: 'Dashboard' }, ...(isAdmin ? [{ key: 'new', label: 'New cheque' }] : [])]
  const email = session.user.email ?? ''

  return (
    <Layout className="min-h-screen">
      <Layout.Header className="flex items-center gap-4 !px-3 sm:!px-6">
        <span className="whitespace-nowrap font-display font-bold text-white">Collection Desk</span>
        <Menu
          theme="dark"
          mode="horizontal"
          selectedKeys={[tab]}
          onClick={({ key }) => setTab(key as Tab)}
          className="min-w-0 flex-1"
          items={items}
        />
        <Dropdown
          trigger={['click']}
          menu={{
            items: [{ key: 'logout', label: 'Logout' }],
            onClick: () => void signOut(),
          }}
        >
          <Button type="text" className="!text-white" data-testid="user-menu">
            {email} ({role ?? 'no role'})
          </Button>
        </Dropdown>
      </Layout.Header>
      <Layout.Content>
        {tab === 'new' && isAdmin ? <ChequeForm onAdded={() => setTab('dashboard')} /> : <Dashboard />}
      </Layout.Content>
    </Layout>
  )
}

export default function App() {
  return (
    <ConfigProvider theme={{ token: { colorPrimary: '#174d3c' } }}>
      <AuthProvider>
        <Shell />
      </AuthProvider>
    </ConfigProvider>
  )
}
