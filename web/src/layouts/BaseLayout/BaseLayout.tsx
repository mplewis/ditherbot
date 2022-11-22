type BaseLayoutProps = {
  children?: React.ReactNode
}

const BaseLayout = ({ children }: BaseLayoutProps) => {
  return (
    <div className="h-screen bg-slate-800 text-neutral-200">
      <div className="container mx-auto max-w-screen-sm px-12 py-8">
        {children}
      </div>
    </div>
  )
}

export default BaseLayout
