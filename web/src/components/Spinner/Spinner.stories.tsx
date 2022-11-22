import type { ComponentMeta } from '@storybook/react'

import Spinner from './Spinner'

export const dark = () => {
  return (
    <div className="bg-slate-500 p-3">
      <Spinner color="white" />
    </div>
  )
}

export const light = () => {
  return (
    <div className="bg-slate-200 p-3">
      <Spinner color="black" />
    </div>
  )
}

export default {
  title: 'Components/Spinner',
  component: Spinner,
} as ComponentMeta<typeof Spinner>
