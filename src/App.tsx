import { useState } from 'react'
import { Button, ConfigProvider, Dropdown, Layout, Menu, Spin } from 'antd'
import Dashboard from './features/Dashboard'
import ChequeForm from './features/ChequeForm'
import BanksPage from './features/BanksPage'
import PartiesPage from './features/PartiesPage'
import AgentsPage from './features/AgentsPage'
import LoginPage from './features/LoginPage'
import { AuthProvider, useAuth } from './lib/auth'

type Tab = 'dashboard' | 'new' | 'banks' | 'parties' | 'agents'

function Shell() {
  const { session, role, loading, signOut } = useAuth()
  const [tab, setTab] = useState<Tab>('dashboard')

  if (loading) return <Spin className="!block !mt-16" />
  if (!session) return <LoginPage />

  const isAdmin = role === 'admin'
  const items = [{ key: 'dashboard', label: 'Dashboard' }, ...(isAdmin
      ? [
          { key: 'new', label: 'New cheque' },
          { key: 'banks', label: 'Banks' },
          { key: 'parties', label: 'Parties' },
          { key: 'agents', label: 'Agents' },
        ]
      : []),
  ]
  const email = session.user.email ?? ''

  return (
    <Layout className="min-h-screen">
      <Layout.Header className="flex !h-auto max-sm:!leading-[52px] flex-wrap items-center gap-x-4 !px-3 sm:flex-nowrap sm:!px-6">
        <span className="whitespace-nowrap font-display font-bold text-white">Collection Desk</span>
        <Menu
          theme="dark"
          mode="horizontal"
          selectedKeys={[tab]}
          onClick={({ key }) => setTab(key as Tab)}
          // Phone: own full-width row that scrolls sideways; never folds tabs into a hidden "..." menu.
          disabledOverflow
          className="order-last -mx-3 min-w-0 basis-[calc(100%+1.5rem)] overflow-x-auto whitespace-nowrap max-sm:[&_.ant-menu-item]:!px-2 max-sm:[&_.ant-menu-item]:!leading-[44px] sm:order-none sm:mx-0 sm:flex-1 sm:basis-auto"
          items={items}
        />
        <Dropdown
          trigger={['click']}
          menu={{
            items: [{ key: 'logout', label: 'Logout' }],
            onClick: () => void signOut(),
          }}
        >
          <Button type="text" className="ml-auto max-w-[60vw] truncate !text-white sm:max-w-none" data-testid="user-menu">
            {email} ({role ?? 'no role'})
          </Button>
        </Dropdown>
      </Layout.Header>
      <Layout.Content>
        {tab === 'new' && isAdmin ? (
          <ChequeForm onAdded={() => setTab('dashboard')} />
        ) : tab === 'banks' && isAdmin ? (
          <BanksPage />
        ) : tab === 'parties' && isAdmin ? (
          <PartiesPage />
        ) : tab === 'agents' && isAdmin ? (
          <AgentsPage />
        ) : (
          <Dashboard />
        )}
      </Layout.Content>
    </Layout>
  )
}

export default function App() {
  return (
    <ConfigProvider
      theme={{
        token: { colorPrimary: '#174d3c', fontFamily: "'DM Sans', system-ui, sans-serif" },
        components: {
          // theme.css --color-sidebar / --color-green, instead of antd's default navy #001529
          Layout: { headerBg: '#123c32' },
          Menu: { darkItemBg: '#123c32', darkItemSelectedBg: '#174d3c', darkPopupBg: '#123c32' },
        },
      }}
    >
      <AuthProvider>
        <Shell />
      </AuthProvider>
    </ConfigProvider>
  )
}
