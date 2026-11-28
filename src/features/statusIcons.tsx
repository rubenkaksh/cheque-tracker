import {
  BankOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DollarOutlined,
  FlagOutlined,
  HomeOutlined,
  PauseCircleOutlined,
  PieChartOutlined,
  QuestionCircleOutlined,
  ReloadOutlined,
  RollbackOutlined,
  ShopOutlined,
  StopOutlined,
  SwapOutlined,
  UserOutlined,
} from '@ant-design/icons'
import type { ReactNode } from 'react'
import type { ChequeStatus } from '../data/transitions'

/** One icon per status, so the status wheel reads at a glance. */
export const STATUS_ICONS: Record<ChequeStatus, ReactNode> = {
  with_agent: <UserOutlined />,
  paid_at_office: <ShopOutlined />,
  in_office: <HomeOutlined />,
  pdc_hold: <PauseCircleOutlined />,
  deposited: <BankOutlined />,
  cleared: <CheckCircleOutlined />,
  bounced: <RollbackOutlined />,
  enquiry: <QuestionCircleOutlined />,
  stale: <ClockCircleOutlined />,
  closed_full_cash: <DollarOutlined />,
  partial_cash: <PieChartOutlined />,
  replaced: <SwapOutlined />,
  redeposit: <ReloadOutlined />,
  bad_debt: <StopOutlined />,
  party_flagged: <FlagOutlined />,
}
