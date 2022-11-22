import { useState } from 'react'

import { MetaTags } from '@redwoodjs/web'

import Spinner from 'src/components/Spinner/Spinner'

export const Loading = () => (
  <div className="py-4 text-center">
    <Spinner color="white" className="mx-auto" />
    Converting image...
  </div>
)

export const ErrorView = (props) => {
  return (
    <div>
      <h1>Sorry, something went wrong:</h1>
      <p className="italic">{props.msg}</p>
      <p>Please try again in a moment.</p>
    </div>
  )
}

export const CohostPreview = ({ children }) => {
  return (
    <div
      className="bg-white text-black"
      style={{
        width: '648px',
        borderRadius: '8px',
      }}
    >
      <header
        className="flex flex-col justify-center px-3"
        style={{
          height: '48px',
          background: 'rgb(255, 249, 242)',
          borderRadius: '8px 8px 0 0',
        }}
      >
        <p className="opacity-50">Cohost Preview Dialog</p>
      </header>
      <hr className="mx-3 border-gray-300" />
      <div className="my-4 px-3">{children}</div>
      <hr className="mx-3 border-gray-300" />
      <footer
        className="flex flex-col justify-center px-3"
        style={{
          height: '48px',
          background: 'rgb(255, 249, 242)',
          borderRadius: '0 0 8px 8px',
        }}
      >
        <p className="opacity-50">
          Thank you for using Cohost Preview Dialog :)
        </p>
      </footer>
    </div>
  )
}

type RequestState =
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'error'; msg: string }
  | { state: 'success'; html: string }

const HomePage = () => {
  const [state, setState] = useState({ state: 'idle' } as RequestState)

  async function sendDemoRequest() {
    const args = {
      image_url: 'http://127.0.0.1:8000/daftpunk.png',
      pixel_size: 2,
      colors: 16,
    }
    setState({ state: 'loading' })
    const resp = await fetch('/.redwood/functions/dither', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    })
    if (resp.status !== 200) {
      setState({ state: 'error', msg: await resp.text() })
      return
    }
    const html = await resp.text()
    setState({ state: 'success', html })
  }

  return (
    <>
      <MetaTags title="Home" description="Home page" />

      <h1>Ditherbot</h1>
      <p>Convert an image into cohost-friendly pixel art</p>
      {state.state !== 'loading' && (
        <button
          className="rounded-full bg-slate-200 px-3 py-1"
          onClick={sendDemoRequest}
        >
          Send demo request
        </button>
      )}
      {state.state === 'loading' && <Loading />}
      {state.state === 'error' && <ErrorView msg={state.msg} />}
      {state.state === 'success' && (
        <CohostPreview>
          <div dangerouslySetInnerHTML={{ __html: state.html }} />
        </CohostPreview>
      )}
    </>
  )
}

export default HomePage
