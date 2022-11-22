import { useState } from 'react'

import { MetaTags } from '@redwoodjs/web'

const HomePage = () => {
  const [outHTML, setOutHTML] = useState('')

  async function sendDemoRequest() {
    const resp = await fetch('/.redwood/functions/dither', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_url: 'http://127.0.0.1:8000/daftpunk.png' }),
    })
    console.log({ resp })
    const html = await resp.text()
    setOutHTML(html)
  }

  return (
    <>
      <MetaTags title="Home" description="Home page" />

      <h1>Ditherbot</h1>
      <p>Convert an image into cohost-friendly pixel art</p>
      <button
        className="rounded-full bg-slate-200 px-3 py-1"
        onClick={sendDemoRequest}
      >
        Send demo request
      </button>

      <pre>
        <code dangerouslySetInnerHTML={{ __html: outHTML }} />
      </pre>
    </>
  )
}

export default HomePage
