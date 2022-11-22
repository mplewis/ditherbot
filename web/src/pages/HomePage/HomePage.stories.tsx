import type { ComponentMeta } from '@storybook/react'

import BaseLayout from 'src/layouts/BaseLayout/BaseLayout'

import HomePage, { ErrorView, Loading, CohostPreview } from './HomePage'

export const loading = () => {
  return (
    <BaseLayout>
      <Loading />
    </BaseLayout>
  )
}

export const errorView = () => <ErrorView msg="Couldn't reticulate splines." />

export const cohostPreview = () => (
  <BaseLayout>
    <CohostPreview>
      <h1>Hello!</h1>
      <p>This is some preview content.</p>
    </CohostPreview>
  </BaseLayout>
)

export default {
  title: 'Pages/HomePage',
  component: HomePage,
} as ComponentMeta<typeof HomePage>
