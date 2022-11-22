type BaseLayoutProps = {
  children?: React.ReactNode
}

const BaseLayout = ({ children }: BaseLayoutProps) => {
  return (
    <div className="container max-w-screen-sm mx-auto px-12 py-8">
      {children}
    </div>
  )
}

export default BaseLayout
