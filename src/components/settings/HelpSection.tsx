import React from 'react'
import { RefreshCw } from 'lucide-react'
import UpdateStatus from '../UpdateStatus'
import { Card } from '../ui/SettingControls'
import type { TFunc } from './types'

const HelpSection: React.FC<{ t: TFunc }> = ({ t }) => (
  <div className="space-y-4 slide-in-right">
    <Card title={t('settings.updates')} icon={<RefreshCw size={14} color="var(--color-success)" />}>
      <UpdateStatus />
    </Card>
  </div>
)

export default HelpSection
